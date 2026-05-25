use crate::event::{EventKind, NormalizedEvent};
use crate::fraction::{lcm, Fraction};
use crate::hairpin::HairpinKind;
use crate::nav::{EndNav, StartNav};
use crate::normalize::{NormalizedMeasure, NormalizedScore};
use std::cmp::Ordering;

#[derive(Clone, Copy)]
struct VoiceTrack {
    voice: u8,
    stem: &'static str,
}

#[derive(Clone)]
struct ExportMeasure {
    measure: NormalizedMeasure,
    content_measure: NormalizedMeasure,
    output_index: usize,
    measure_repeat_styles: Vec<MeasureRepeatStyle>,
}

#[derive(Clone)]
struct MeasureRepeatStyle {
    kind: &'static str,
    count: Option<u32>,
    slashes: Option<u32>,
}

#[derive(Clone, Copy)]
struct InstrumentSpec {
    display_step: &'static str,
    display_octave: u8,
    notehead: Option<&'static str>,
}

#[derive(Clone)]
enum VoiceEntry {
    Rest {
        start: Fraction,
        duration: Fraction,
    },
    Notes {
        start: Fraction,
        duration: Fraction,
        events: Vec<NormalizedEvent>,
    },
}

pub fn build_music_xml(score: &NormalizedScore, hide_voice2_rests: bool) -> String {
    let divisions = collect_divisions(score);
    let export_measures = build_export_measures(score);
    let measures = export_measures
        .iter()
        .enumerate()
        .map(|(index, export_measure)| {
            let force_line_break = index > 0
                && export_measures[index - 1].measure.source_line != export_measure.measure.source_line;
            measure_xml(score, &export_measures, export_measure, divisions, force_line_break, hide_voice2_rests)
        })
        .collect::<Vec<_>>()
        .join("");

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE score-partwise PUBLIC \"-//Recordare//DTD MusicXML 3.1 Partwise//EN\"\n\
  \"http://www.musicxml.org/dtds/partwise.dtd\">\n\
<score-partwise version=\"3.1\">\n\
{}\n\
  <part-list>\n\
    <score-part id=\"P1\">\n\
      <part-name>Drumset</part-name>\n\
      <score-instrument id=\"P1-I1\">\n\
        <instrument-name>Drumset</instrument-name>\n\
      </score-instrument>\n\
    </score-part>\n\
  </part-list>\n\
  <part id=\"P1\">\n\
    {}\n\
  </part>\n\
</score-partwise>",
        score_metadata_xml(score),
        measures
    )
}

fn score_metadata_xml(score: &NormalizedScore) -> String {
    let title = score.header.title.as_deref().unwrap_or("DrumMark");
    let mut parts = vec![
        "  <work>".to_string(),
        format!("    <work-title>{}</work-title>", xml_escape(title)),
        "  </work>".to_string(),
    ];
    if let Some(composer) = &score.header.composer {
        parts.push(format!(
            "  <identification>\n    <creator type=\"composer\">{}</creator>\n  </identification>",
            xml_escape(composer)
        ));
    }
    parts.push(credit_xml("title", title));
    if let Some(subtitle) = &score.header.subtitle {
        parts.push(credit_xml("subtitle", subtitle));
    }
    if let Some(composer) = &score.header.composer {
        parts.push(credit_xml("composer", composer));
    }
    parts.join("\n")
}

fn credit_xml(kind: &str, words: &str) -> String {
    let mixed_stack = "Charter, Bitstream Charter, Sitka Text, Cambria, Georgia, Times New Roman, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif";
    let attributes = match kind {
        "title" => format!("justify=\"center\" font-size=\"20\" font-family=\"{}\" font-weight=\"bold\"", mixed_stack),
        "subtitle" => format!("justify=\"center\" font-size=\"12\" font-family=\"{}\" font-style=\"italic\"", mixed_stack),
        "composer" => format!("justify=\"right\" font-size=\"10\" font-family=\"{}\"", mixed_stack),
        _ => String::new(),
    };
    format!(
        "  <credit page=\"1\">\n    <credit-type>{}</credit-type>\n    <credit-words {}>{}</credit-words>\n  </credit>",
        xml_escape(kind),
        attributes,
        xml_escape(words)
    )
}

fn measure_xml(
    score: &NormalizedScore,
    export_measures: &[ExportMeasure],
    export_measure: &ExportMeasure,
    divisions: u64,
    force_line_break: bool,
    hide_voice2_rests: bool,
) -> String {
    let measure = &export_measure.measure;
    let content_measure = &export_measure.content_measure;
    let measure_duration = Fraction::new(
        score.header.time_beats as u64,
        score.header.time_beat_unit as u64,
    );
    let previous_measure = measure
        .global_index
        .checked_sub(1)
        .and_then(|i| score.measures.get(i as usize));
    let next_measure = score.measures.get((measure.global_index + 1) as usize);

    let up_entries = build_voice_entries(content_measure, 1);
    let down_entries = build_voice_entries(content_measure, 2);
    let stickings = stickings_by_start(&content_measure.events);
    let style_xml = measure_style_xml(export_measure);
    let show_attributes = export_measure.output_index == 0 || !style_xml.is_empty();
    let attributes = if show_attributes {
        let first = export_measure.output_index == 0;
        format!(
            "<attributes>{}{}{}{}{}{}</attributes>{}",
            if first { format!("<divisions>{}</divisions>", divisions) } else { String::new() },
            if first { "<key><fifths>0</fifths></key>".to_string() } else { String::new() },
            if first {
                format!(
                    "<time><beats>{}</beats><beat-type>{}</beat-type></time>",
                    score.header.time_beats, score.header.time_beat_unit
                )
            } else {
                String::new()
            },
            if first { "<staves>1</staves>".to_string() } else { String::new() },
            if first { "<clef number=\"1\"><sign>percussion</sign><line>2</line></clef>".to_string() } else { String::new() },
            style_xml,
            if first {
                format!(
                    "<direction placement=\"above\"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>{}</per-minute></metronome></direction-type><sound tempo=\"{}\"/></direction>",
                    score.header.tempo, score.header.tempo
                )
            } else {
                String::new()
            }
        )
    } else {
        String::new()
    };

    let up_notes = process_voice_entries(
        &up_entries,
        VoiceTrack { voice: 1, stem: "up" },
        score,
        measure_duration,
        divisions,
        &stickings,
        hide_voice2_rests,
    );
    let down_notes = process_voice_entries(
        &down_entries,
        VoiceTrack { voice: 2, stem: "down" },
        score,
        measure_duration,
        divisions,
        &stickings,
        hide_voice2_rests,
    );

    let mut voice_content = Vec::new();
    if !up_notes.is_empty() {
        voice_content.extend(up_notes);
    }
    if !down_notes.is_empty() {
        if !voice_content.is_empty() {
            voice_content.push(format!(
                "<backup><duration>{}</duration></backup>",
                fraction_to_divisions(measure_duration, divisions)
            ));
        }
        voice_content.extend(down_notes);
    }

    let is_purely_empty = measure.multi_rest_count.is_some()
        || (up_entries.iter().all(is_rest_entry) && down_entries.iter().all(is_rest_entry));
    let content = if is_purely_empty {
        vec![format!(
            "<note><rest measure=\"yes\"/><duration>{}</duration><voice>1</voice><type>whole</type><staff>1</staff></note>",
            fraction_to_divisions(measure_duration, divisions)
        )]
    } else {
        voice_content
    };

    let print = if export_measure.output_index == 0 {
        "<print><measure-numbering>system</measure-numbering></print>"
    } else if force_line_break {
        "<print new-system=\"yes\"><measure-numbering>system</measure-numbering></print>"
    } else {
        ""
    };

    format!(
        "<measure number=\"{}\">{}{}{}{}{}{}{}{}{}{}</measure>",
        export_measure.output_index + 1,
        print,
        attributes,
        left_barline_xml(measure, previous_measure),
        start_nav_direction_xml(&measure.start_nav),
        end_nav_direction_xml(&measure.end_nav),
        hairpin_directions_xml(export_measures, export_measure.output_index, divisions),
        dynamic_directions_xml(measure, divisions),
        content.join(""),
        right_barline_xml(measure, next_measure),
        ""
    )
}

fn process_voice_entries(
    entries: &[VoiceEntry],
    voice: VoiceTrack,
    score: &NormalizedScore,
    measure_duration: Fraction,
    divisions: u64,
    stickings: &[(Fraction, String)],
    hide_voice2_rests: bool,
) -> Vec<String> {
    if !entries.is_empty() && entries.iter().all(is_rest_entry) {
        let total = entries.iter().fold(Fraction::zero(), |sum, entry| match entry {
            VoiceEntry::Rest { duration, .. } => sum.add(*duration),
            VoiceEntry::Notes { duration, .. } => sum.add(*duration),
        });
        if total.compare(measure_duration) == Ordering::Equal {
            let duration = fraction_to_divisions(measure_duration, divisions);
            return if hide_voice2_rests && voice.voice == 2 {
                vec![forward_xml(duration)]
            } else {
                vec![whole_measure_rest_xml(duration, voice)]
            };
        }
    }

    let mut result = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        match entry {
            VoiceEntry::Rest { duration, .. } => {
                let duration_divisions = fraction_to_divisions(*duration, divisions);
                if hide_voice2_rests && voice.voice == 2 {
                    result.push(forward_xml(duration_divisions));
                } else {
                    result.push(rest_xml(*duration, divisions, voice));
                }
            }
            VoiceEntry::Notes {
                start,
                duration,
                events,
            } => {
                let prev_beamable = index > 0 && entry_is_beamable(&entries[index - 1]);
                let next_beamable = index + 1 < entries.len() && entry_is_beamable(&entries[index + 1]);
                let beamable = is_beamable(*duration);
                let beam_state = if beamable && !prev_beamable && next_beamable {
                    Some("begin")
                } else if beamable && prev_beamable && next_beamable {
                    Some("continue")
                } else if beamable && prev_beamable && !next_beamable {
                    Some("end")
                } else {
                    None
                };
                let sticking = stickings
                    .iter()
                    .find(|(s, _)| s.compare(*start) == Ordering::Equal)
                    .map(|(_, value)| value.as_str());
                for (event_index, event) in events.iter().enumerate() {
                    if event.modifiers.iter().any(|m| m == "flam") {
                        result.push(grace_note_xml(event, voice, true));
                    }
                    if event.modifiers.iter().any(|m| m == "drag") {
                        result.push(grace_note_xml(event, voice, false));
                        result.push(grace_note_xml(event, voice, false));
                    }
                    result.push(note_xml(
                        event,
                        *duration,
                        divisions,
                        voice,
                        event_index > 0,
                        sticking,
                        beam_state,
                        score,
                    ));
                }
            }
        }
    }
    result
}

fn build_voice_entries(measure: &NormalizedMeasure, voice: u8) -> Vec<VoiceEntry> {
    let mut groups: Vec<(Fraction, Fraction, Vec<NormalizedEvent>)> = Vec::new();
    let mut events: Vec<_> = measure
        .events
        .iter()
        .filter(|event| event.voice == voice && event.track != "ST")
        .cloned()
        .collect();
    events.sort_by(|a, b| {
        a.start
            .compare(b.start)
            .then(a.duration.compare(b.duration))
            .then(a.track.cmp(&b.track))
    });
    for event in events {
        if let Some((_, _, existing)) = groups.iter_mut().find(|(start, duration, _)| {
            start.compare(event.start) == Ordering::Equal
                && duration.compare(event.duration) == Ordering::Equal
        }) {
            existing.push(event);
        } else {
            groups.push((event.start, event.duration, vec![event]));
        }
    }
    groups
        .into_iter()
        .map(|(start, duration, events)| {
            if events.iter().all(|event| event.kind == EventKind::Rest) {
                VoiceEntry::Rest { start, duration }
            } else {
                VoiceEntry::Notes {
                    start,
                    duration,
                    events: events
                        .into_iter()
                        .filter(|event| event.kind != EventKind::Rest)
                        .collect(),
                }
            }
        })
        .collect()
}

fn note_xml(
    event: &NormalizedEvent,
    duration: Fraction,
    divisions: u64,
    voice: VoiceTrack,
    is_chord: bool,
    sticking: Option<&str>,
    beam_state: Option<&str>,
    _score: &NormalizedScore,
) -> String {
    let instrument = instrument_for_track(&event.track);
    let shape = note_shape_for_fraction(duration);
    let dots = "<dot/>".repeat(shape.1);
    let notehead = notehead_xml(event, instrument);
    let beam = beam_state
        .map(|state| format!("<beam number=\"1\">{}</beam>", state))
        .unwrap_or_default();
    let notations = notations_xml(event, sticking);
    format!(
        "<note>{}<unpitched><display-step>{}</display-step><display-octave>{}</display-octave></unpitched><duration>{}</duration><instrument id=\"P1-I1\"/><voice>{}</voice><type>{}</type>{}<stem>{}</stem>{}<staff>1</staff>{}{}</note>",
        if is_chord { "<chord/>" } else { "" },
        instrument.display_step,
        instrument.display_octave,
        fraction_to_divisions(duration, divisions),
        voice.voice,
        shape.0,
        dots,
        voice.stem,
        notehead,
        beam,
        notations
    )
}

fn notations_xml(event: &NormalizedEvent, sticking: Option<&str>) -> String {
    let mut technical = Vec::new();
    let mut articulations = Vec::new();
    let mut ornaments = Vec::new();
    if event.modifiers.iter().any(|m| m == "open") && notehead_value(event, instrument_for_track(&event.track)) != Some("circle-x") {
        technical.push("<open-string/>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "close") {
        technical.push("<stopped/>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "half-open") {
        technical.push("<other-technical>half-open</other-technical>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "rim") {
        technical.push("<other-technical>rim</other-technical>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "cross") {
        technical.push("<other-technical>cross-stick</other-technical>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "bell") {
        technical.push("<other-technical>bell</other-technical>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "accent") {
        articulations.push("<accent placement=\"above\"/>".to_string());
    }
    if event.modifiers.iter().any(|m| m == "roll") {
        ornaments.push("<tremolo type=\"single\">3</tremolo>".to_string());
    }
    if let Some(sticking) = sticking {
        technical.push(format!(
            "<fingering placement=\"above\" font-size=\"14\">{}</fingering>",
            xml_escape(sticking)
        ));
    }
    let mut content = Vec::new();
    if !technical.is_empty() {
        content.push(format!("<technical>{}</technical>", technical.join("")));
    }
    if !articulations.is_empty() {
        content.push(format!("<articulations>{}</articulations>", articulations.join("")));
    }
    if !ornaments.is_empty() {
        content.push(format!("<ornaments>{}</ornaments>", ornaments.join("")));
    }
    if content.is_empty() {
        String::new()
    } else {
        format!("<notations>{}</notations>", content.join(""))
    }
}

fn rest_xml(duration: Fraction, divisions: u64, voice: VoiceTrack) -> String {
    let shape = note_shape_for_fraction(duration);
    let dots = "<dot/>".repeat(shape.1);
    let display_step = if voice.voice == 1 { "B" } else { "F" };
    format!(
        "<note><rest><display-step>{}</display-step><display-octave>4</display-octave></rest><duration>{}</duration><voice>{}</voice><type>{}</type>{}<staff>1</staff></note>",
        display_step,
        fraction_to_divisions(duration, divisions),
        voice.voice,
        shape.0,
        dots
    )
}

fn whole_measure_rest_xml(divisions: u64, voice: VoiceTrack) -> String {
    let display_step = if voice.voice == 1 { "B" } else { "F" };
    format!(
        "<note><rest measure=\"yes\"><display-step>{}</display-step><display-octave>4</display-octave></rest><duration>{}</duration><voice>{}</voice><type>whole</type><staff>1</staff></note>",
        display_step, divisions, voice.voice
    )
}

fn forward_xml(duration: u64) -> String {
    format!("<forward><duration>{}</duration></forward>", duration)
}

fn grace_note_xml(event: &NormalizedEvent, voice: VoiceTrack, slash: bool) -> String {
    let instrument = instrument_for_track(&event.track);
    let slash_attr = if slash { " slash=\"yes\"" } else { "" };
    format!(
        "<note><grace{}/><unpitched><display-step>{}</display-step><display-octave>{}</display-octave></unpitched><instrument id=\"P1-I1\"/><voice>{}</voice><type>16th</type><stem>{}</stem>{}<staff>1</staff></note>",
        slash_attr,
        instrument.display_step,
        instrument.display_octave,
        voice.voice,
        voice.stem,
        notehead_xml(event, instrument)
    )
}

fn notehead_xml(event: &NormalizedEvent, instrument: InstrumentSpec) -> String {
    notehead_value(event, instrument)
        .map(|value| format!("<notehead>{}</notehead>", value))
        .unwrap_or_default()
}

fn notehead_value(event: &NormalizedEvent, instrument: InstrumentSpec) -> Option<&'static str> {
    if event.modifiers.iter().any(|m| m == "ghost") {
        return None;
    }
    if event.modifiers.iter().any(|m| m == "dead") {
        return Some("x");
    }
    if event.track == "SD" && event.modifiers.iter().any(|m| m == "cross") {
        return Some("x");
    }
    if matches!(event.track.as_str(), "RC" | "RC2")
        && event.modifiers.iter().any(|m| m == "bell")
    {
        return Some("diamond");
    }
    if event.track == "HH" && event.modifiers.iter().any(|m| m == "open") {
        return Some("circle-x");
    }
    instrument.notehead
}

fn instrument_for_track(track: &str) -> InstrumentSpec {
    match track {
        "HH" => InstrumentSpec { display_step: "G", display_octave: 5, notehead: Some("x") },
        "HF" => InstrumentSpec { display_step: "D", display_octave: 4, notehead: Some("x") },
        "SD" => InstrumentSpec { display_step: "C", display_octave: 5, notehead: None },
        "BD" => InstrumentSpec { display_step: "F", display_octave: 4, notehead: None },
        "BD2" => InstrumentSpec { display_step: "E", display_octave: 4, notehead: None },
        "T1" => InstrumentSpec { display_step: "E", display_octave: 5, notehead: None },
        "T2" => InstrumentSpec { display_step: "D", display_octave: 5, notehead: None },
        "T3" => InstrumentSpec { display_step: "A", display_octave: 4, notehead: None },
        "T4" => InstrumentSpec { display_step: "G", display_octave: 4, notehead: None },
        "RC" => InstrumentSpec { display_step: "F", display_octave: 5, notehead: Some("x") },
        "RC2" => InstrumentSpec { display_step: "E", display_octave: 5, notehead: Some("x") },
        "C" => InstrumentSpec { display_step: "A", display_octave: 5, notehead: Some("x") },
        "C2" => InstrumentSpec { display_step: "B", display_octave: 5, notehead: Some("x") },
        "SPL" => InstrumentSpec { display_step: "D", display_octave: 6, notehead: Some("x") },
        "CHN" => InstrumentSpec { display_step: "C", display_octave: 6, notehead: Some("x") },
        "CB" => InstrumentSpec { display_step: "B", display_octave: 4, notehead: None },
        "WB" => InstrumentSpec { display_step: "A", display_octave: 3, notehead: None },
        "CL" => InstrumentSpec { display_step: "G", display_octave: 4, notehead: None },
        "ST" => InstrumentSpec { display_step: "B", display_octave: 5, notehead: None },
        _ => InstrumentSpec { display_step: "B", display_octave: 5, notehead: None },
    }
}

fn measure_style_xml(measure: &ExportMeasure) -> String {
    let mut styles = Vec::new();
    for repeat in &measure.measure_repeat_styles {
        let slashes = repeat
            .slashes
            .map(|value| format!(" slashes=\"{}\"", value))
            .unwrap_or_default();
        let count = repeat.count.map(|value| value.to_string()).unwrap_or_default();
        styles.push(format!(
            "<measure-repeat type=\"{}\"{}>{}</measure-repeat>",
            repeat.kind, slashes, count
        ));
    }
    if let Some(count) = measure.measure.multi_rest_count {
        styles.push(format!("<multiple-rest>{}</multiple-rest>", count));
    }
    if styles.is_empty() {
        String::new()
    } else {
        format!("<measure-style>{}</measure-style>", styles.join(""))
    }
}

fn build_export_measures(score: &NormalizedScore) -> Vec<ExportMeasure> {
    let mut expanded = Vec::new();
    for measure in &score.measures {
        if let Some(slashes) = measure.measure_repeat_slashes {
            if slashes > 1 {
                for i in 0..slashes {
                    let source_index = measure.global_index.saturating_sub(slashes) + i;
                    let source = score
                        .measures
                        .get(source_index as usize)
                        .cloned()
                        .unwrap_or_else(|| measure.clone());
                    let is_first = i == 0;
                    let is_last = i + 1 == slashes;
                    let mut export_measure = measure.clone();
                    export_measure.measure_repeat_slashes = if is_first { Some(slashes) } else { None };
                    export_measure.start_nav = if is_first { measure.start_nav.clone() } else { None };
                    export_measure.end_nav = if is_last { measure.end_nav.clone() } else { None };
                    export_measure.barline = if is_first {
                        left_edge_barline(measure.barline.as_deref())
                    } else if is_last {
                        right_edge_barline(measure.barline.as_deref())
                    } else {
                        None
                    };
                    expanded.push(ExportMeasure {
                        measure: export_measure,
                        content_measure: source,
                        output_index: expanded.len(),
                        measure_repeat_styles: if is_first {
                            vec![MeasureRepeatStyle { kind: "start", count: Some(slashes), slashes: Some(slashes) }]
                        } else {
                            Vec::new()
                        },
                    });
                }
                continue;
            }
        }
        if let Some(count) = measure.multi_rest_count {
            if count > 1 {
                for i in 0..count {
                    let is_first = i == 0;
                    let is_last = i + 1 == count;
                    let mut export_measure = measure.clone();
                    export_measure.multi_rest_count = if is_first { Some(count) } else { None };
                    export_measure.start_nav = if is_first { measure.start_nav.clone() } else { None };
                    export_measure.end_nav = if is_last { measure.end_nav.clone() } else { None };
                    export_measure.barline = if is_first {
                        left_edge_barline(measure.barline.as_deref())
                    } else if is_last {
                        right_edge_barline(measure.barline.as_deref())
                    } else {
                        None
                    };
                    expanded.push(ExportMeasure {
                        measure: export_measure,
                        content_measure: measure.clone(),
                        output_index: expanded.len(),
                        measure_repeat_styles: Vec::new(),
                    });
                }
                continue;
            }
        }
        let content_measure = if measure.measure_repeat_slashes == Some(1) {
            measure
                .global_index
                .checked_sub(1)
                .and_then(|index| score.measures.get(index as usize))
                .cloned()
                .unwrap_or_else(|| measure.clone())
        } else {
            measure.clone()
        };
        expanded.push(ExportMeasure {
            measure: measure.clone(),
            content_measure,
            output_index: expanded.len(),
            measure_repeat_styles: if measure.measure_repeat_slashes == Some(1) {
                vec![MeasureRepeatStyle { kind: "start", count: Some(1), slashes: Some(1) }]
            } else {
                Vec::new()
            },
        });
    }
    for i in 0..expanded.len() {
        let count = expanded[i]
            .measure_repeat_styles
            .iter()
            .find(|style| style.kind == "start")
            .and_then(|style| style.count);
        if let Some(count) = count {
            if let Some(target) = expanded.get_mut(i + count as usize) {
                target.measure_repeat_styles.push(MeasureRepeatStyle {
                    kind: "stop",
                    count: None,
                    slashes: None,
                });
            }
        }
    }
    expanded
}

fn left_edge_barline(barline: Option<&str>) -> Option<String> {
    match barline {
        Some("repeat-start") | Some("repeat-both") => Some("repeat-start".to_string()),
        _ => None,
    }
}

fn right_edge_barline(barline: Option<&str>) -> Option<String> {
    match barline {
        Some("repeat-end") | Some("repeat-both") => Some("repeat-end".to_string()),
        Some("double") => Some("double".to_string()),
        Some("final") => Some("final".to_string()),
        _ => None,
    }
}

fn left_barline_xml(measure: &NormalizedMeasure, previous: Option<&NormalizedMeasure>) -> String {
    let current_volta = volta_key(measure);
    let previous_volta = previous.and_then(volta_key);
    let starts_volta = current_volta.is_some() && current_volta != previous_volta;
    let mut parts = Vec::new();
    if let Some(volta) = current_volta.filter(|_| starts_volta) {
        parts.push(format!("<ending number=\"{}\" type=\"start\"/>", xml_escape(&volta)));
    }
    if matches!(measure.barline.as_deref(), Some("repeat-start" | "repeat-both")) {
        parts.push("<repeat direction=\"forward\"/>".to_string());
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!("<barline location=\"left\">{}</barline>", parts.join(""))
    }
}

fn right_barline_xml(measure: &NormalizedMeasure, next: Option<&NormalizedMeasure>) -> String {
    let current_volta = volta_key(measure);
    let next_volta = next.and_then(volta_key);
    let ends_volta = current_volta.is_some() && current_volta != next_volta;
    let mut parts = Vec::new();
    match measure.barline.as_deref() {
        Some("double") => parts.push("<bar-style>light-light</bar-style>".to_string()),
        Some("final") => parts.push("<bar-style>light-heavy</bar-style>".to_string()),
        _ => {}
    }
    if let Some(volta) = current_volta.filter(|_| ends_volta) {
        parts.push(format!("<ending number=\"{}\" type=\"stop\"/>", xml_escape(&volta)));
    }
    if matches!(measure.barline.as_deref(), Some("repeat-end" | "repeat-both")) {
        parts.push("<repeat direction=\"backward\"/>".to_string());
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!("<barline location=\"right\">{}</barline>", parts.join(""))
    }
}

fn volta_key(measure: &NormalizedMeasure) -> Option<String> {
    measure
        .volta
        .as_ref()
        .map(|indices| indices.iter().map(u32::to_string).collect::<Vec<_>>().join(","))
}

fn start_nav_direction_xml(start_nav: &Option<StartNav>) -> String {
    match start_nav {
        Some(StartNav::Segno { .. }) => {
            "<direction placement=\"above\"><direction-type><segno/></direction-type></direction>".to_string()
        }
        Some(StartNav::Coda { .. }) => {
            "<direction placement=\"above\"><direction-type><coda/></direction-type></direction>".to_string()
        }
        None => String::new(),
    }
}

fn end_nav_direction_xml(end_nav: &Option<EndNav>) -> String {
    let label = match end_nav {
        Some(EndNav::Fine { .. }) => "Fine",
        Some(EndNav::DC { .. }) => "D.C.",
        Some(EndNav::DS { .. }) => "D.S.",
        Some(EndNav::DCalFine { .. }) => "D.C. al Fine",
        Some(EndNav::DCalCoda { .. }) => "D.C. al Coda",
        Some(EndNav::DSalFine { .. }) => "D.S. al Fine",
        Some(EndNav::DSalCoda { .. }) => "D.S. al Coda",
        Some(EndNav::ToCoda { .. }) => "To Coda",
        None => return String::new(),
    };
    format!(
        "<direction placement=\"above\"><direction-type><words>{}</words></direction-type></direction>",
        xml_escape(label)
    )
}

fn hairpin_directions_xml(export_measures: &[ExportMeasure], measure_index: usize, divisions: u64) -> String {
    let Some(current) = export_measures.get(measure_index) else {
        return String::new();
    };
    let current_measure_index = current.measure.global_index as usize;
    let all_hairpins = export_measures
        .iter()
        .flat_map(|measure| measure.content_measure.hairpins.iter())
        .collect::<Vec<_>>();
    let mut fragments = Vec::new();
    for (index, hairpin) in all_hairpins.iter().enumerate() {
        let number = index + 1;
        if current_measure_index < hairpin.start_measure_index
            || current_measure_index > hairpin.end_measure_index
        {
            continue;
        }
        if hairpin.start_measure_index == hairpin.end_measure_index {
            if current_measure_index == hairpin.start_measure_index {
                fragments.push(wedge_direction_xml(hairpin_start_type(hairpin.kind), number, fraction_to_divisions(hairpin.start, divisions)));
                fragments.push(wedge_direction_xml("stop", number, fraction_to_divisions(hairpin.end, divisions)));
            }
        } else if current_measure_index == hairpin.start_measure_index {
            fragments.push(wedge_direction_xml(hairpin_start_type(hairpin.kind), number, fraction_to_divisions(hairpin.start, divisions)));
        } else if current_measure_index == hairpin.end_measure_index {
            fragments.push(wedge_direction_xml("stop", number, fraction_to_divisions(hairpin.end, divisions)));
        } else {
            fragments.push(wedge_direction_xml("continue", number, 0));
        }
    }
    fragments.join("")
}

fn hairpin_start_type(kind: HairpinKind) -> &'static str {
    match kind {
        HairpinKind::Crescendo => "crescendo",
        HairpinKind::Decrescendo => "diminuendo",
    }
}

fn wedge_direction_xml(kind: &str, number: usize, offset: u64) -> String {
    format!(
        "<direction placement=\"below\"><direction-type><wedge type=\"{}\" number=\"{}\"/></direction-type><offset>{}</offset></direction>",
        kind, number, offset
    )
}

fn dynamic_directions_xml(measure: &NormalizedMeasure, divisions: u64) -> String {
    measure
        .dynamics
        .iter()
        .map(|dynamic| {
            format!(
                "<direction placement=\"below\"><direction-type><dynamics><{}/></dynamics></direction-type><offset>{}</offset></direction>",
                dynamic.level.as_str(),
                fraction_to_divisions(dynamic.at, divisions)
            )
        })
        .collect::<Vec<_>>()
        .join("")
}

fn collect_divisions(score: &NormalizedScore) -> u64 {
    let mut divisions = 1;
    for measure in &score.measures {
        for dynamic in &measure.dynamics {
            divisions = lcm(divisions, dynamic.at.denominator);
        }
        for event in &measure.events {
            divisions = lcm(divisions, event.duration.denominator);
            divisions = lcm(divisions, event.start.denominator);
        }
    }
    divisions
}

fn note_shape_for_fraction(duration: Fraction) -> (&'static str, usize) {
    match (duration.numerator, duration.denominator) {
        (1, 1) => ("whole", 0),
        (3, 2) => ("whole", 1),
        (7, 4) => ("whole", 2),
        (1, 2) => ("half", 0),
        (3, 4) => ("half", 1),
        (7, 8) => ("half", 2),
        (1, 4) => ("quarter", 0),
        (3, 8) => ("quarter", 1),
        (7, 16) => ("quarter", 2),
        (1, 8) => ("eighth", 0),
        (3, 16) => ("eighth", 1),
        (7, 32) => ("eighth", 2),
        (1, 16) => ("16th", 0),
        (3, 32) => ("16th", 1),
        (7, 64) => ("16th", 2),
        (1, 32) => ("32nd", 0),
        (3, 64) => ("32nd", 1),
        (1, 64) => ("64th", 0),
        _ => ("16th", 0),
    }
}

fn stickings_by_start(events: &[NormalizedEvent]) -> Vec<(Fraction, String)> {
    let mut result: Vec<(Fraction, Vec<String>)> = Vec::new();
    for event in events.iter().filter(|event| event.track == "ST") {
        if let Some((_, values)) = result
            .iter_mut()
            .find(|(start, _)| start.compare(event.start) == Ordering::Equal)
        {
            values.push(event.glyph.clone());
        } else {
            result.push((event.start, vec![event.glyph.clone()]));
        }
    }
    result
        .into_iter()
        .map(|(start, values)| (start, values.join(" ")))
        .collect()
}

fn is_rest_entry(entry: &VoiceEntry) -> bool {
    matches!(entry, VoiceEntry::Rest { .. })
}

fn entry_is_beamable(entry: &VoiceEntry) -> bool {
    match entry {
        VoiceEntry::Rest { duration, .. } | VoiceEntry::Notes { duration, .. } => {
            is_beamable(*duration)
        }
    }
}

fn is_beamable(duration: Fraction) -> bool {
    duration.denominator >= 8
}

fn fraction_to_divisions(duration: Fraction, divisions: u64) -> u64 {
    duration.numerator * 4 * divisions / duration.denominator
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::Parser;

    #[test]
    fn exports_basic_musicxml() {
        let doc = Parser::new("title Test\ntime 4/4\n\nHH | x - - - |").parse_lossy();
        let score = crate::normalize::normalize_document(&doc);
        let xml = build_music_xml(&score, false);
        assert!(xml.contains("<score-partwise"));
        assert!(xml.contains("<work-title>Test</work-title>"));
        assert!(xml.contains("<notehead>x</notehead>"));
    }

    #[test]
    fn exports_ride_bell_as_diamond_notehead() {
        let doc = Parser::new(
            "time 4/4\n\
             note 1/4\n\
             grouping 4\n\n\
             RC | r:bell - - - |\n\
             RC2 | r2:bell - - - |",
        )
        .parse_lossy();
        let score = crate::normalize::normalize_document(&doc);
        let xml = build_music_xml(&score, false);

        assert_eq!(xml.matches("<notehead>diamond</notehead>").count(), 2);
    }

    #[test]
    fn exports_drag_as_two_unslashed_sixteenth_grace_notes() {
        let doc = Parser::new(
            "time 4/4\n\
             note 1/4\n\
             grouping 4\n\n\
             SD | d:drag - - - |",
        )
        .parse_lossy();
        let score = crate::normalize::normalize_document(&doc);
        let xml = build_music_xml(&score, false);

        assert_eq!(xml.matches("<note><grace/>").count(), 2);
        assert!(!xml.contains("<grace slash=\"yes\"/>"));
        assert_eq!(xml.matches("<type>16th</type>").count(), 2);
    }

    #[test]
    fn maps_visual_note_shapes_for_dotted_durations() {
        assert_eq!(note_shape_for_fraction(Fraction::new(1, 4)), ("quarter", 0));
        assert_eq!(note_shape_for_fraction(Fraction::new(3, 8)), ("quarter", 1));
        assert_eq!(note_shape_for_fraction(Fraction::new(7, 16)), ("quarter", 2));
        assert_eq!(note_shape_for_fraction(Fraction::new(1, 8)), ("eighth", 0));
        assert_eq!(note_shape_for_fraction(Fraction::new(3, 16)), ("eighth", 1));
    }

    #[test]
    fn groups_same_start_events_as_chords_and_preserves_explicit_rests() {
        let doc = Parser::new(
            "time 4/4\n\
             divisions 4\n\n\
             HH | x - x - |\n\
             SD | d - d - |",
        )
        .parse_lossy();
        let score = crate::normalize::normalize_document(&doc);
        let measure = score.measures.first().expect("measure");
        let entries = build_voice_entries(measure, 1);

        assert!(matches!(&entries[0], VoiceEntry::Notes { events, .. } if events.len() == 2));
        assert!(matches!(&entries[1], VoiceEntry::Rest { duration, .. } if *duration == Fraction::new(1, 4)));
        assert!(matches!(&entries[2], VoiceEntry::Notes { events, .. } if events.len() == 2));
    }

    #[test]
    fn hide_voice2_rests_converts_secondary_rests_to_forwards() {
        let doc = Parser::new(
            "time 4/4\n\
             divisions 4\n\n\
             HH | x - x - |\n\
             BD | - b - b |",
        )
        .parse_lossy();
        let score = crate::normalize::normalize_document(&doc);
        let visible = build_music_xml(&score, false);
        let hidden = build_music_xml(&score, true);

        assert!(visible.contains("<rest><display-step>F"));
        assert!(hidden.contains("<forward><duration>"));
        assert!(!hidden.contains("<rest><display-step>F"));
    }
}
