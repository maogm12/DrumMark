use crate::event::EventKind;
use crate::fraction::Fraction;
use crate::hairpin::HairpinKind;
use crate::nav::{EndNav, StartNav};
use crate::normalize;

pub fn derive_render_score(score: &normalize::NormalizedScore) -> drummark_layout::RenderScore {
    drummark_layout::RenderScore {
        version: drummark_layout::RENDER_SCORE_VERSION.to_string(),
        header: drummark_layout::RenderHeader {
            tempo: score.header.tempo,
            time_beats: score.header.time_beats,
            time_beat_unit: score.header.time_beat_unit,
            note_value: score.header.note_value,
            grouping: score.header.grouping.clone(),
            title: score.header.title.clone(),
            subtitle: score.header.subtitle.clone(),
            composer: score.header.composer.clone(),
        },
        tracks: score
            .tracks
            .iter()
            .map(|track| drummark_layout::RenderTrack {
                id: track.id.clone(),
                family: track.family.clone(),
            })
            .collect(),
        measures: score
            .measures
            .iter()
            .map(|measure| {
                let mut events: Vec<drummark_layout::RenderEvent> = measure
                    .events
                    .iter()
                    .filter(|event| !is_st_track_spacer(event))
                    .map(event_to_render_event)
                    .collect();
                sort_render_events(&mut events);

                drummark_layout::RenderMeasure {
                    index: measure.index,
                    global_index: measure.global_index,
                    paragraph_index: measure.paragraph_index,
                    measure_in_paragraph: measure.measure_in_paragraph,
                    source_line: measure.source_line,
                    actual_duration: render_fraction(measure.actual_duration),
                    full_duration: render_fraction(measure.full_duration),
                    events,
                    barline: measure.barline.clone(),
                    closing_barline: measure.closing_barline.clone(),
                    start_nav: measure.start_nav.as_ref().map(start_nav_kind),
                    end_nav: measure.end_nav.as_ref().map(end_nav_kind),
                    volta_indices: measure.volta.clone(),
                    hairpins: measure
                        .hairpins
                        .iter()
                        .map(|hairpin| drummark_layout::HairpinSpan {
                            kind: match hairpin.kind {
                                HairpinKind::Crescendo => drummark_layout::HairpinKind::Crescendo,
                                HairpinKind::Decrescendo => {
                                    drummark_layout::HairpinKind::Decrescendo
                                }
                            },
                            start: drummark_layout::Fraction {
                                numerator: hairpin.start.numerator as u32,
                                denominator: hairpin.start.denominator as u32,
                            },
                            end: drummark_layout::Fraction {
                                numerator: hairpin.end.numerator as u32,
                                denominator: hairpin.end.denominator as u32,
                            },
                            start_measure_index: hairpin.start_measure_index as u32,
                            end_measure_index: hairpin.end_measure_index as u32,
                        })
                        .collect(),
                    dynamics: measure
                        .dynamics
                        .iter()
                        .map(|dynamic| drummark_layout::DynamicMark {
                            level: dynamic_level_to_render(&dynamic.level),
                            at: render_fraction(dynamic.at),
                        })
                        .collect(),
                    rehearsal_mark: measure.rehearsal_mark.as_ref().map(|mark| {
                        drummark_layout::RehearsalMark {
                            text: mark.text.clone(),
                            anchor: drummark_layout::RehearsalAnchor {
                                offset: render_fraction(mark.anchor.offset),
                            },
                        }
                    }),
                    measure_repeat_slashes: measure.measure_repeat_slashes,
                    multi_rest_count: measure.multi_rest_count,
                    note_value: measure.note_value,
                    volta_terminator: measure.volta_terminator,
                }
            })
            .collect(),
        errors: score.errors.clone(),
        repeat_spans: score
            .repeat_spans
            .iter()
            .map(|span| drummark_layout::RepeatSpan {
                start_measure: span.start_measure,
                end_measure: span.end_measure,
                times: span.times,
            })
            .collect(),
    }
}

fn dynamic_level_to_render(level: &crate::ast::DynamicLevel) -> drummark_layout::DynamicLevel {
    match level {
        crate::ast::DynamicLevel::Ppp => drummark_layout::DynamicLevel::Ppp,
        crate::ast::DynamicLevel::Pp => drummark_layout::DynamicLevel::Pp,
        crate::ast::DynamicLevel::P => drummark_layout::DynamicLevel::P,
        crate::ast::DynamicLevel::Mp => drummark_layout::DynamicLevel::Mp,
        crate::ast::DynamicLevel::Mf => drummark_layout::DynamicLevel::Mf,
        crate::ast::DynamicLevel::F => drummark_layout::DynamicLevel::F,
        crate::ast::DynamicLevel::Ff => drummark_layout::DynamicLevel::Ff,
        crate::ast::DynamicLevel::Fff => drummark_layout::DynamicLevel::Fff,
    }
}

fn is_st_track_spacer(event: &crate::event::NormalizedEvent) -> bool {
    event.track == "ST" && event.kind == EventKind::Rest
}

fn event_to_render_event(event: &crate::event::NormalizedEvent) -> drummark_layout::RenderEvent {
    drummark_layout::RenderEvent {
        track: event.track.clone(),
        track_family: crate::resolve::get_track_family(&event.track)
            .as_str()
            .to_string(),
        start: render_fraction(event.start),
        duration: render_fraction(event.duration),
        visual_duration: render_fraction(event.visual_duration),
        kind: match event.kind {
            EventKind::Hit => drummark_layout::EventKind::Hit,
            EventKind::Rest => drummark_layout::EventKind::Rest,
            EventKind::Sticking => drummark_layout::EventKind::Sticking,
        },
        glyph: event.glyph.clone(),
        modifiers: event.modifiers.clone(),
        dot_count: event.dot_count,
        modifier: event.modifier.clone(),
        voice: event.voice,
        beam: event.beam.clone(),
        tuplet: event.tuplet,
    }
}

fn render_fraction(fraction: Fraction) -> drummark_layout::Fraction {
    drummark_layout::Fraction {
        numerator: fraction.numerator as u32,
        denominator: fraction.denominator as u32,
    }
}

fn sort_render_events(events: &mut [drummark_layout::RenderEvent]) {
    events.sort_by(|left, right| {
        let start = (left.start.numerator as u64 * right.start.denominator as u64)
            .cmp(&(right.start.numerator as u64 * left.start.denominator as u64));
        if start != std::cmp::Ordering::Equal {
            return start;
        }
        let kind_rank = |kind: &drummark_layout::EventKind| match kind {
            drummark_layout::EventKind::Hit => 0_u8,
            drummark_layout::EventKind::Sticking => 1_u8,
            drummark_layout::EventKind::Rest => 2_u8,
        };
        let kind = kind_rank(&left.kind).cmp(&kind_rank(&right.kind));
        if kind != std::cmp::Ordering::Equal {
            return kind;
        }
        let duration = (left.duration.numerator as u64 * right.duration.denominator as u64)
            .cmp(&(right.duration.numerator as u64 * left.duration.denominator as u64));
        if duration != std::cmp::Ordering::Equal {
            return duration.reverse();
        }
        left.voice.cmp(&right.voice)
    });
}

fn start_nav_kind(nav: &StartNav) -> drummark_layout::NavMarker {
    match nav {
        StartNav::Segno { .. } => drummark_layout::NavMarker::Segno,
        StartNav::Coda { .. } => drummark_layout::NavMarker::Coda,
    }
}

fn end_nav_kind(nav: &EndNav) -> drummark_layout::NavJump {
    match nav {
        EndNav::Fine { .. } => drummark_layout::NavJump::Fine,
        EndNav::DC { .. } => drummark_layout::NavJump::DC,
        EndNav::DS { .. } => drummark_layout::NavJump::DS,
        EndNav::DCalFine { .. } => drummark_layout::NavJump::DCalFine,
        EndNav::DCalCoda { .. } => drummark_layout::NavJump::DCalCoda,
        EndNav::DSalFine { .. } => drummark_layout::NavJump::DSalFine,
        EndNav::DSalCoda { .. } => drummark_layout::NavJump::DSalCoda,
        EndNav::ToCoda { .. } => drummark_layout::NavJump::ToCoda,
    }
}

trait TrackFamilyExt {
    fn as_str(&self) -> &'static str;
}

impl TrackFamilyExt for crate::resolve::TrackFamily {
    fn as_str(&self) -> &'static str {
        match self {
            crate::resolve::TrackFamily::Cymbal => "cymbal",
            crate::resolve::TrackFamily::Drum => "drum",
            crate::resolve::TrackFamily::Pedal => "pedal",
            crate::resolve::TrackFamily::Percussion => "percussion",
            crate::resolve::TrackFamily::Auxiliary => "auxiliary",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::derive_render_score;
    use crate::fraction::Fraction;
    use crate::hairpin::{HairpinIntent, HairpinKind};
    use crate::nav::{Anchor, EndNav, StartNav};
    use crate::parser::Parser;

    #[test]
    fn derives_render_score_from_normalized_score() {
        let source = "title Smoke\ntime 4/4\nnote 1/4\ngrouping 2+2\nHH | @p x x @ff x x |\nSD | - o - o |\n";
        let document = Parser::new(source).parse().expect("parse");
        let normalized = crate::normalize::normalize_document(&document);
        let render = derive_render_score(&normalized);

        assert_eq!(render.version, drummark_layout::RENDER_SCORE_VERSION);
        assert_eq!(render.header.time_beats, 4);
        assert_eq!(render.measures.len(), 1);
        assert_eq!(
            render.measures[0].source_line,
            normalized.measures[0].source_line
        );
        assert_eq!(render.measures[0].events[0].track_family, "cymbal");
        assert_eq!(render.measures[0].dynamics.len(), 2);
        assert_eq!(
            render.measures[0].dynamics[0].level,
            drummark_layout::DynamicLevel::P
        );
        assert_eq!(
            render.measures[0].dynamics[0].at,
            drummark_layout::Fraction {
                numerator: 0,
                denominator: 1
            }
        );
        assert_eq!(
            render.measures[0].dynamics[1].level,
            drummark_layout::DynamicLevel::Ff
        );
        assert_eq!(
            render.measures[0].dynamics[1].at,
            drummark_layout::Fraction {
                numerator: 1,
                denominator: 2
            }
        );
    }

    #[test]
    fn preserves_navigation_and_hairpin_semantics() {
        let score = crate::normalize::NormalizedScore {
            version: "1".into(),
            header: crate::normalize::NormalizedHeader {
                title: None,
                subtitle: None,
                composer: None,
                tempo: 120,
                time_beats: 4,
                time_beat_unit: 4,
                note_value: 8,
                grouping: vec![1, 1, 1, 1],
            },
            tracks: vec![crate::normalize::NormalizedTrack {
                id: "HH".into(),
                family: "cymbal".into(),
            }],
            measures: vec![crate::normalize::NormalizedMeasure {
                index: 7,
                global_index: 7,
                paragraph_index: 0,
                measure_in_paragraph: 7,
                source_line: 12,
                actual_duration: Fraction::one(),
                full_duration: Fraction::one(),
                events: vec![],
                barline: Some("double".into()),
                closing_barline: Some("double".into()),
                start_nav: Some(StartNav::Segno {
                    anchor: Anchor::LeftEdge,
                }),
                end_nav: Some(EndNav::DCalCoda {
                    anchor: Anchor::RightEdge,
                }),
                volta: Some(vec![1, 2]),
                hairpins: vec![HairpinIntent {
                    kind: HairpinKind::Crescendo,
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    start_measure_index: 7,
                    end: Fraction {
                        numerator: 1,
                        denominator: 1,
                    },
                    end_measure_index: 8,
                }],
                dynamics: vec![],
                rehearsal_mark: None,
                measure_repeat_slashes: Some(1),
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: true,
            }],
            errors: vec![],
            repeat_spans: vec![crate::normalize::RepeatSpan {
                start_measure: 7,
                end_measure: 8,
                times: 2,
            }],
        };

        let render = derive_render_score(&score);
        assert!(matches!(
            render.measures[0].start_nav,
            Some(drummark_layout::NavMarker::Segno)
        ));
        assert!(matches!(
            render.measures[0].end_nav,
            Some(drummark_layout::NavJump::DCalCoda)
        ));
        assert_eq!(render.measures[0].hairpins.len(), 1);
        assert_eq!(render.measures[0].hairpins[0].start_measure_index, 7);
        assert_eq!(render.repeat_spans[0].times, 2);
    }

    #[test]
    fn derives_implicit_voice_rests_for_measure_gaps() {
        let source =
            "time 4/4\nnote 1/8\ngrouping 2+2\nHH | x x x x x x x x |\nBD | p - - - p - - - |\n";
        let document = Parser::new(source).parse().expect("parse");
        let normalized = crate::normalize::normalize_document(&document);
        let render = derive_render_score(&normalized);
        let measure = &render.measures[0];
        let rest_events: Vec<_> = measure
            .events
            .iter()
            .filter(|event| event.kind == drummark_layout::EventKind::Rest)
            .collect();
        assert_eq!(
            rest_events.len(),
            6,
            "explicit eighth rests should remain visible in the render score"
        );
        assert!(rest_events.iter().all(|event| event.voice == 2));
        assert!(rest_events.iter().all(|event| event.duration
            == drummark_layout::Fraction {
                numerator: 1,
                denominator: 8
            }));
    }

    #[test]
    fn does_not_invent_missing_voice_rests() {
        let source = "time 4/4\nnote 1/4\ngrouping 2+2\nBD | b - - - |\n";
        let document = Parser::new(source).parse().expect("parse");
        let normalized = crate::normalize::normalize_document(&document);
        let render = derive_render_score(&normalized);
        let measure = &render.measures[0];
        let rest_events: Vec<_> = measure
            .events
            .iter()
            .filter(|event| event.kind == drummark_layout::EventKind::Rest)
            .collect();
        assert!(!measure
            .events
            .iter()
            .any(|event| { event.kind == drummark_layout::EventKind::Rest && event.voice == 1 }));
        assert_eq!(rest_events.len(), 3);
        assert!(rest_events.iter().any(|event| event.duration
            == drummark_layout::Fraction {
                numerator: 1,
                denominator: 4
            }));
    }

    #[test]
    fn anonymous_lower_voice_measure_keeps_only_authored_rests() {
        let source = "time 4/4\nnote 1/4\ngrouping 4\n| b |\n";
        let document = Parser::new(source).parse().expect("parse");
        let normalized = crate::normalize::normalize_document(&document);
        let render = derive_render_score(&normalized);
        let measure = &render.measures[0];

        let voice_one_rests: Vec<_> = measure
            .events
            .iter()
            .filter(|event| event.kind == drummark_layout::EventKind::Rest && event.voice == 1)
            .collect();
        let voice_two_rests: Vec<_> = measure
            .events
            .iter()
            .filter(|event| event.kind == drummark_layout::EventKind::Rest && event.voice == 2)
            .collect();

        assert!(
            voice_one_rests.is_empty(),
            "anonymous lower-voice-only measures must not invent a whole-measure voice-1 rest"
        );
        assert_eq!(
            voice_two_rests.len(),
            0,
            "the trailing 3/4 gap after `b` must remain silent without synthesized rests"
        );
    }

    #[test]
    fn fully_silent_measure_requires_authored_rest_content() {
        let source = "time 4/4\nnote 1/4\ngrouping 4\nBD | b | - |\n";
        let document = Parser::new(source).parse().expect("parse");
        let normalized = crate::normalize::normalize_document(&document);
        let render = derive_render_score(&normalized);
        assert_eq!(render.measures.len(), 2);
        let silent_measure = &render.measures[1];
        let rest_events: Vec<_> = silent_measure
            .events
            .iter()
            .filter(|event| event.kind == drummark_layout::EventKind::Rest)
            .collect();

        assert_eq!(rest_events.len(), 1);
        assert!(rest_events.iter().all(|event| event.voice == 2));
        assert_eq!(
            rest_events[0].duration,
            drummark_layout::Fraction {
                numerator: 1,
                denominator: 4
            }
        );
    }
}
