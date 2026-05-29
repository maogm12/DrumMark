use crate::display::DisplayMeasure;
use crate::planning::{
    measure_left_pad, rendered_glyph_width, VOLTA_LINE_HEIGHT_PT, VOLTA_LINE_THICKNESS_PT,
    VOLTA_SKYLINE_GAP_PT, VOLTA_TEXT_SIZE_PT,
};
use crate::scene_builder::{GlyphItemSpec, LineItemSpec, SceneEmitSink, TextItemSpec};
use crate::structural::skyline::{
    bottom_skyline_sample, bottom_skyline_sample_including_hairpins, skyline_top_for_range,
    top_skyline_sample, top_skyline_sample_optional,
};
use crate::*;

pub(crate) fn push_volta_composites(
    sink: &mut SceneEmitSink<'_>,
    composites: &mut Vec<SceneComposite>,
    page_measures: &[SceneMeasure],
    measures: &[DisplayMeasure<'_>],
    opts: &LayoutOptions,
) {
    let mut system_start = 0usize;
    while system_start < page_measures.len() {
        let system_id = page_measures[system_start].system_id.clone();
        let mut system_end = system_start;
        while system_end + 1 < page_measures.len()
            && page_measures[system_end + 1].system_id == system_id
        {
            system_end += 1;
        }

        push_system_volta_composites(
            sink,
            composites,
            &page_measures[system_start..=system_end],
            measures,
            opts,
            system_id == "system-0",
        );

        system_start = system_end + 1;
    }
}

fn push_system_volta_composites(
    sink: &mut SceneEmitSink<'_>,
    composites: &mut Vec<SceneComposite>,
    system_measures: &[SceneMeasure],
    measures: &[DisplayMeasure<'_>],
    opts: &LayoutOptions,
    is_first_system: bool,
) {
    let mut block_start = 0usize;
    while block_start < system_measures.len() {
        if display_measure_for_scene(measures, &system_measures[block_start])
            .and_then(|measure| measure.measure.volta_indices.as_ref())
            .is_none()
        {
            block_start += 1;
            continue;
        }

        let mut block_end = block_start;
        while block_end + 1 < system_measures.len()
            && display_measure_for_scene(measures, &system_measures[block_end + 1])
                .and_then(|measure| measure.measure.volta_indices.as_ref())
                .is_some()
        {
            block_end += 1;
        }

        let block_x1 = volta_segment_left_x(
            &system_measures[block_start],
            display_measure_for_scene(measures, &system_measures[block_start]),
            block_start == 0,
            is_first_system,
        );
        let block_x2 = system_measures[block_end].x_pt + system_measures[block_end].width_pt;
        let occupied_top = top_skyline_sample(
            sink.items(),
            &system_measures[block_start..=block_end],
            block_x1,
            block_x2,
            system_measures[block_start].y_pt - 60.0,
            sink.staff_space_pt,
        );
        struct PendingVoltaRun {
            start: usize,
            end: usize,
            label: Vec<u32>,
            show_left_hook: bool,
            show_label: bool,
            show_right: bool,
            fragment: SpanFragmentKind,
            line_y: f32,
        }
        let mut runs = Vec::new();
        let mut index = block_start;
        while index <= block_end {
            let Some(display_measure) =
                display_measure_for_scene(measures, &system_measures[index])
            else {
                index += 1;
                continue;
            };
            let Some(label) = display_measure.measure.volta_indices.as_ref() else {
                index += 1;
                continue;
            };

            let mut end = index;
            while end < block_end
                && display_measure_for_scene(measures, &system_measures[end + 1])
                    .and_then(|measure| measure.measure.volta_indices.as_ref())
                    == Some(label)
            {
                end += 1;
            }

            let start_measure = display_measure.global_index;
            let end_measure = display_measure_for_scene(measures, &system_measures[end])
                .map(|measure| measure.global_index)
                .unwrap_or(start_measure);
            let start_type = volta_type_for_measure(measures, start_measure);
            let end_type = volta_type_for_measure(measures, end_measure);
            let show_label = matches!(
                start_type,
                VoltaSegmentType::Begin | VoltaSegmentType::BeginEnd
            );
            let show_left_hook = show_label || index == 0;
            let show_right = matches!(end_type, VoltaSegmentType::End | VoltaSegmentType::BeginEnd);
            let fragment = volta_fragment_kind(show_label, show_right);
            let line_y = volta_line_y_for_segment(
                sink.items(),
                &system_measures[index..=end],
                measures,
                label,
                occupied_top,
                opts.volta_offset_y,
                show_left_hook,
                show_label,
                show_right,
                index == 0,
                is_first_system,
                sink.staff_space_pt,
            );
            runs.push(PendingVoltaRun {
                start: index,
                end,
                label: label.clone(),
                show_left_hook,
                show_label,
                show_right,
                fragment,
                line_y,
            });

            index = end + 1;
        }
        let block_line_y = runs
            .iter()
            .map(|run| run.line_y)
            .fold(f32::INFINITY, f32::min);
        for run in &runs {
            push_volta_segment(
                sink,
                composites,
                VoltaSegmentSpec {
                    segment_measures: &system_measures[run.start..=run.end],
                    measures,
                    label: &run.label,
                    line_y: block_line_y,
                    show_left_hook: run.show_left_hook,
                    show_label: run.show_label,
                    show_right: run.show_right,
                    fragment: run.fragment,
                    starts_at_system_left: run.start == 0,
                    is_first_system,
                },
            );
        }

        block_start = block_end + 1;
    }
}

#[allow(clippy::too_many_arguments)]
fn volta_line_y_for_segment(
    items: &[SceneItem],
    segment_measures: &[SceneMeasure],
    measures: &[DisplayMeasure<'_>],
    label: &[u32],
    occupied_top: f32,
    volta_offset_y: f32,
    show_left_hook: bool,
    show_label: bool,
    show_right: bool,
    starts_at_system_left: bool,
    is_first_system: bool,
    staff_space_pt: f32,
) -> f32 {
    let first = segment_measures
        .first()
        .expect("volta segment has measures");
    let last = segment_measures.last().expect("volta segment has measures");
    let first_display = display_measure_for_scene(measures, first);
    let x1 = volta_segment_left_x(first, first_display, starts_at_system_left, is_first_system);
    let x2 = last.x_pt + last.width_pt;
    let mut line_y = occupied_top - VOLTA_SKYLINE_GAP_PT - VOLTA_LINE_THICKNESS_PT;

    if show_left_hook {
        line_y = line_y.min(volta_line_y_for_child(
            items,
            segment_measures,
            x1 - VOLTA_LINE_THICKNESS_PT,
            x1 + VOLTA_LINE_THICKNESS_PT,
            VOLTA_LINE_HEIGHT_PT,
            staff_space_pt,
        ));
    }
    if show_right {
        line_y = line_y.min(volta_line_y_for_child(
            items,
            segment_measures,
            x2 - VOLTA_LINE_THICKNESS_PT,
            x2 + VOLTA_LINE_THICKNESS_PT,
            VOLTA_LINE_HEIGHT_PT,
            staff_space_pt,
        ));
    }
    if show_label {
        let label_text = format!(
            "{}.",
            label
                .iter()
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );
        let label_x = x1 + 5.0;
        let label_width = canonical_text_width(TextRole::CountLabel, &label_text, staff_space_pt);
        let count_metric = canonical_text_metric(TextRole::CountLabel, staff_space_pt);
        let label_bottom_extent = VOLTA_TEXT_SIZE_PT + 2.0 + count_metric.descent_pt;
        line_y = line_y.min(volta_line_y_for_child(
            items,
            segment_measures,
            label_x,
            label_x + label_width,
            label_bottom_extent,
            staff_space_pt,
        ));
    }

    line_y - volta_offset_y
}

fn volta_line_y_for_child(
    items: &[SceneItem],
    segment_measures: &[SceneMeasure],
    x1: f32,
    x2: f32,
    child_bottom_extent: f32,
    staff_space_pt: f32,
) -> f32 {
    top_skyline_sample_optional(items, segment_measures, x1, x2, staff_space_pt)
        .map(|top| top - VOLTA_SKYLINE_GAP_PT - child_bottom_extent)
        .unwrap_or(f32::INFINITY)
}

pub(crate) struct VoltaSegmentSpec<'a> {
    segment_measures: &'a [SceneMeasure],
    measures: &'a [DisplayMeasure<'a>],
    label: &'a [u32],
    line_y: f32,
    show_left_hook: bool,
    show_label: bool,
    show_right: bool,
    fragment: SpanFragmentKind,
    starts_at_system_left: bool,
    is_first_system: bool,
}

pub(crate) fn push_volta_segment(
    sink: &mut SceneEmitSink<'_>,
    composites: &mut Vec<SceneComposite>,
    spec: VoltaSegmentSpec<'_>,
) {
    if spec.segment_measures.is_empty() {
        return;
    }
    let first = spec.segment_measures.first().unwrap();
    let last = spec.segment_measures.last().unwrap();
    let label_text = format!(
        "{}.",
        spec.label
            .iter()
            .map(|value| value.to_string())
            .collect::<Vec<_>>()
            .join(",")
    );
    let first_display = display_measure_for_scene(spec.measures, first);
    let x1 = volta_segment_left_x(
        first,
        first_display,
        spec.starts_at_system_left,
        spec.is_first_system,
    );
    let x2 = last.x_pt + last.width_pt;

    let mut child_item_ids = Vec::new();
    child_item_ids.push(sink.push_line_item(LineItemSpec {
        measure_id: Some(&first.id),
        role: "volta-line",
        x1,
        y1: spec.line_y,
        x2,
        y2: spec.line_y,
        stroke: "#333",
        stroke_width: 1.0,
        stroke_line_cap: None,
    }));
    if spec.show_left_hook {
        child_item_ids.push(sink.push_line_item(LineItemSpec {
            measure_id: Some(&first.id),
            role: "volta-start-hook",
            x1,
            y1: spec.line_y,
            x2: x1,
            y2: spec.line_y + VOLTA_LINE_HEIGHT_PT,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: None,
        }));
    }
    if spec.show_label {
        child_item_ids.push(sink.push_text_item(TextItemSpec {
            measure_id: Some(&first.id),
            role: "volta-label",
            x: x1 + 5.0,
            y: spec.line_y + VOLTA_TEXT_SIZE_PT + 2.0,
            text_role: TextRole::CountLabel,
            text: label_text.clone(),
            font_family: "Academico",
            font_size_pt: VOLTA_TEXT_SIZE_PT,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        }));
    }
    if spec.show_right {
        child_item_ids.push(sink.push_line_item(LineItemSpec {
            measure_id: Some(&last.id),
            role: "volta-end-hook",
            x1: x2,
            y1: spec.line_y,
            x2,
            y2: spec.line_y + VOLTA_LINE_HEIGHT_PT,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: None,
        }));
    }
    composites.push(SceneComposite {
        id: format!("volta-{}-{}", first.id, last.id),
        kind: CompositeKind::Volta,
        fragment: spec.fragment,
        child_item_ids,
        label: Some(label_text),
        count: None,
        start_anchor_id: Some(first.id.clone()),
        end_anchor_id: Some(last.id.clone()),
    });
}

fn volta_segment_left_x(
    first: &SceneMeasure,
    first_display: Option<&DisplayMeasure<'_>>,
    starts_at_system_left: bool,
    is_first_system: bool,
) -> f32 {
    if starts_at_system_left {
        let barline = first_display.and_then(|measure| measure.barline.as_deref());
        first.x_pt + measure_left_pad(0, is_first_system, barline, 7.5)
    } else {
        first.x_pt
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum VoltaSegmentType {
    Begin,
    Mid,
    End,
    BeginEnd,
}

fn display_measure_for_scene<'a>(
    measures: &'a [DisplayMeasure<'_>],
    scene_measure: &SceneMeasure,
) -> Option<&'a DisplayMeasure<'a>> {
    measures
        .iter()
        .find(|measure| measure.global_index == scene_measure.global_index)
}

fn volta_key(measure: &DisplayMeasure<'_>) -> Option<String> {
    measure.measure.volta_indices.as_ref().map(|indices| {
        indices
            .iter()
            .map(u32::to_string)
            .collect::<Vec<_>>()
            .join(",")
    })
}

pub(crate) fn volta_type_for_measure(
    measures: &[DisplayMeasure<'_>],
    global_index: u32,
) -> VoltaSegmentType {
    let current = measures
        .iter()
        .find(|measure| measure.global_index == global_index);
    let current_key = current.and_then(volta_key);
    let previous_key = global_index
        .checked_sub(1)
        .and_then(|previous| {
            measures
                .iter()
                .find(|measure| measure.global_index == previous)
        })
        .and_then(volta_key);
    let next_key = measures
        .iter()
        .find(|measure| measure.global_index == global_index + 1)
        .and_then(volta_key);
    let begins = current_key != previous_key;
    let ends = current_key != next_key;

    match (begins, ends) {
        (true, true) => VoltaSegmentType::BeginEnd,
        (true, false) => VoltaSegmentType::Begin,
        (false, true) => VoltaSegmentType::End,
        (false, false) => VoltaSegmentType::Mid,
    }
}

fn volta_fragment_kind(show_left: bool, show_right: bool) -> SpanFragmentKind {
    match (show_left, show_right) {
        (true, true) => SpanFragmentKind::SingleSegment,
        (true, false) => SpanFragmentKind::Start,
        (false, true) => SpanFragmentKind::End,
        (false, false) => SpanFragmentKind::Continuation,
    }
}

pub(crate) fn measure_fragments_for_range(
    page_measures: &[SceneMeasure],
    start_measure: u32,
    end_measure: u32,
) -> Vec<Vec<&SceneMeasure>> {
    let mut matches: Vec<&SceneMeasure> = page_measures
        .iter()
        .filter(|measure| {
            measure.global_index >= start_measure && measure.global_index <= end_measure
        })
        .collect();
    matches.sort_by_key(|measure| measure.global_index);

    let mut fragments: Vec<Vec<&SceneMeasure>> = Vec::new();
    for measure in matches {
        if fragments
            .last()
            .map(|fragment| {
                fragment
                    .last()
                    .map(|last| last.system_id == measure.system_id)
                    .unwrap_or(false)
            })
            .unwrap_or(false)
        {
            fragments.last_mut().unwrap().push(measure);
        } else {
            fragments.push(vec![measure]);
        }
    }
    fragments
}

fn span_fragment_kind(index: usize, total: usize) -> SpanFragmentKind {
    if total <= 1 {
        SpanFragmentKind::SingleSegment
    } else if index == 0 {
        SpanFragmentKind::Start
    } else if index + 1 == total {
        SpanFragmentKind::End
    } else {
        SpanFragmentKind::Continuation
    }
}

#[derive(Clone)]
pub(crate) struct DeferredNavMarker {
    pub(crate) measure_id: String,
    pub(crate) global_index: u32,
    pub(crate) start_nav: Option<NavMarker>,
    pub(crate) end_nav: Option<NavJump>,
    pub(crate) x: f32,
    pub(crate) width: f32,
    pub(crate) top: f32,
}

pub(crate) fn render_nav_markers(
    sink: &mut SceneEmitSink<'_>,
    composites: &mut Vec<SceneComposite>,
    spec: &DeferredNavMarker,
) {
    let count_metric = canonical_text_metric(TextRole::CountLabel, sink.staff_space_pt);
    const NAV_TEXT_FONT: &str = "Academico";
    const NAV_GAP: f32 = 6.0;
    if let Some(ref start_nav) = spec.start_nav {
        let (label, glyph_role) = match start_nav {
            NavMarker::Segno => ("segno", GlyphRole::NavigationSegno),
            NavMarker::Coda => ("coda", GlyphRole::NavigationCoda),
        };
        let nav_render = nav_glyph_render_font_pt(sink.staff_space_pt);
        let nav_position = nav_glyph_position_pt(sink.staff_space_pt);
        let glyph_width = rendered_glyph_width(glyph_role, nav_position);
        let x_start = spec.x + 4.0;
        let default_y = spec.top - 8.0;
        let occupied_top = skyline_top_for_range(
            sink.items(),
            x_start,
            x_start + glyph_width,
            spec.top,
            default_y + NAV_GAP,
            sink.staff_space_pt,
        );
        let glyph_metric = canonical_glyph_metric(glyph_role);
        let nav_y = occupied_top - NAV_GAP + glyph_metric.bbox_sw_y_ss * (nav_position / 4.0);
        let nav_id = sink.push_glyph_item(GlyphItemSpec {
            measure_id: Some(spec.measure_id.as_str()),
            role: "nav-start",
            x: x_start,
            y: nav_y,
            glyph_role,
            font_family: "Bravura",
            font_size_pt: nav_render,
            fill: "#333",
        });
        composites.push(SceneComposite {
            id: format!("navigation-start-{}", spec.global_index),
            kind: CompositeKind::Navigation,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![nav_id],
            label: Some(label.to_string()),
            count: None,
            start_anchor_id: Some(spec.measure_id.clone()),
            end_anchor_id: Some(spec.measure_id.clone()),
        });
    }
    if let Some(ref end_nav) = spec.end_nav {
        let label = match end_nav {
            NavJump::Fine => "Fine",
            NavJump::DC => "D.C.",
            NavJump::DS => "D.S.",
            NavJump::DCalFine => "D.C. al Fine",
            NavJump::DCalCoda => "D.C. al Coda",
            NavJump::DSalFine => "D.S. al Fine",
            NavJump::DSalCoda => "D.S. al Coda",
            NavJump::ToCoda => "To Coda",
        };
        let child_item_ids = match end_nav {
            NavJump::ToCoda => {
                let right_x = spec.x + spec.width - 4.0;
                let coda_render = coda_glyph_render_font_pt(sink.staff_space_pt);
                let coda_position = coda_glyph_position_pt(sink.staff_space_pt);
                let coda_width = rendered_glyph_width(GlyphRole::NavigationCoda, coda_position);
                let to_text_width = canonical_text_width(TextRole::CountLabel, "To", sink.staff_space_pt);
                let combined_x_start = right_x - coda_width - 4.0 - to_text_width;
                let combined_x_end = right_x;
                let default_glyph_y = spec.top - 8.0;
                let default_text_y = spec.top - count_metric.descent_pt - 1.0;
                let occupied_top = skyline_top_for_range(
                    sink.items(),
                    combined_x_start,
                    combined_x_end,
                    spec.top,
                    default_glyph_y + NAV_GAP,
                    sink.staff_space_pt,
                );
                let coda_metric = canonical_glyph_metric(GlyphRole::NavigationCoda);
                let default_glyph_bottom =
                    default_glyph_y - coda_metric.bbox_sw_y_ss * (coda_position / 4.0);
                let default_text_bottom = default_text_y + count_metric.descent_pt;
                let default_group_bottom = default_glyph_bottom.max(default_text_bottom);
                let delta = occupied_top - NAV_GAP - default_group_bottom;
                let glyph_y = default_glyph_y + delta;
                let text_y = default_text_y + delta;
                let glyph_id = sink.push_glyph_item(GlyphItemSpec {
                    measure_id: Some(spec.measure_id.as_str()),
                    role: "nav-end-symbol",
                    x: right_x - coda_width,
                    y: glyph_y,
                    glyph_role: GlyphRole::NavigationCoda,
                    font_family: "Bravura",
                    font_size_pt: coda_render,
                    fill: "#333",
                });
                let text_id = sink.push_text_item(TextItemSpec {
                    measure_id: Some(spec.measure_id.as_str()),
                    role: "nav-end",
                    x: right_x - coda_width - 4.0,
                    y: text_y,
                    text_role: TextRole::CountLabel,
                    text: "To".to_string(),
                    font_family: NAV_TEXT_FONT,
                    font_size_pt: count_metric.font_size_pt,
                    fill: "#333",
                    text_anchor: Some("end"),
                    font_weight: Some("bold"),
                });
                vec![text_id, glyph_id]
            }
            _ => {
                let text_width = canonical_text_width(TextRole::CountLabel, label, sink.staff_space_pt);
                let x_start = spec.x + spec.width - 4.0 - text_width;
                let x_end = spec.x + spec.width - 4.0;
                let default_y = spec.top - count_metric.descent_pt - 1.0;
                let occupied_top = skyline_top_for_range(
                    sink.items(),
                    x_start,
                    x_end,
                    spec.top,
                    default_y + NAV_GAP,
                    sink.staff_space_pt,
                );
                let nav_y = occupied_top - NAV_GAP - count_metric.descent_pt;
                let nav_id = sink.push_text_item(TextItemSpec {
                    measure_id: Some(spec.measure_id.as_str()),
                    role: "nav-end",
                    x: spec.x + spec.width - 4.0,
                    y: nav_y,
                    text_role: TextRole::CountLabel,
                    text: label.to_string(),
                    font_family: NAV_TEXT_FONT,
                    font_size_pt: count_metric.font_size_pt,
                    fill: "#333",
                    text_anchor: Some("end"),
                    font_weight: Some("bold"),
                });
                vec![nav_id]
            }
        };
        composites.push(SceneComposite {
            id: format!("navigation-end-{}", spec.global_index),
            kind: CompositeKind::Navigation,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids,
            label: Some(label.to_string()),
            count: None,
            start_anchor_id: Some(spec.measure_id.clone()),
            end_anchor_id: Some(spec.measure_id.clone()),
        });
    }
}

pub(crate) fn render_hairpin_fragments(
    sink: &mut SceneEmitSink<'_>,
    composites: &mut Vec<SceneComposite>,
    page_measures: &[SceneMeasure],
    measures: &[DisplayMeasure<'_>],
    hairpin_offset_y: f32,
) {
    const HAIRPIN_OPEN_HEIGHT_PT: f32 = 10.0;
    const HAIRPIN_GAP_BELOW_PT: f32 = 0.0;

    for measure in measures {
        for hairpin in &measure.hairpins {
            let fragments = measure_fragments_for_range(
                page_measures,
                hairpin.start_measure_index,
                hairpin.end_measure_index,
            );
            let fragment_total = fragments.len();
            let total_start =
                hairpin.start_measure_index as f32 + crate::fraction_to_f32(hairpin.start);
            let mut total_end =
                hairpin.end_measure_index as f32 + crate::fraction_to_f32(hairpin.end);
            if total_end <= total_start {
                total_end = total_start + 0.05;
            }
            let total_span = total_end - total_start;
            for (fragment_index, fragment) in fragments.iter().enumerate() {
                if fragment.is_empty() {
                    continue;
                }
                let first = fragment.first().unwrap();
                let last = fragment.last().unwrap();
                let start_progress = if first.global_index == hairpin.start_measure_index {
                    crate::fraction_to_f32(hairpin.start)
                } else {
                    0.0
                };
                let end_progress = if last.global_index == hairpin.end_measure_index {
                    crate::fraction_to_f32(hairpin.end).max(start_progress + 0.05)
                } else {
                    1.0
                };
                let start_x = if fragment_index == 0 {
                    first.x_pt + 14.0 + start_progress * (first.width_pt - 28.0)
                } else {
                    first.x_pt + 14.0
                };
                let end_x = if fragment_index + 1 == fragment_total {
                    last.x_pt + 14.0 + end_progress * (last.width_pt - 28.0)
                } else {
                    last.x_pt + last.width_pt - 12.0
                };
                if end_x <= start_x {
                    continue;
                }
                let fragment_start_abs = first.global_index as f32 + start_progress;
                let fragment_end_abs = last.global_index as f32 + end_progress;
                let left_progress =
                    ((fragment_start_abs - total_start) / total_span).clamp(0.0, 1.0);
                let right_progress =
                    ((fragment_end_abs - total_start) / total_span).clamp(0.0, 1.0);
                let left_open_height = hairpin_open_height_at_progress(
                    hairpin.kind,
                    left_progress,
                    HAIRPIN_OPEN_HEIGHT_PT,
                );
                let right_open_height = hairpin_open_height_at_progress(
                    hairpin.kind,
                    right_progress,
                    HAIRPIN_OPEN_HEIGHT_PT,
                );
                let top_y = bottom_skyline_sample(
                    sink.items(),
                    fragment,
                    start_x,
                    end_x,
                    first.y_pt + first.height_pt,
                    sink.staff_space_pt,
                ) + HAIRPIN_GAP_BELOW_PT
                    + hairpin_offset_y;
                let center_y = top_y + HAIRPIN_OPEN_HEIGHT_PT * 0.5;
                let left_top_y = center_y - left_open_height * 0.5;
                let left_bottom_y = center_y + left_open_height * 0.5;
                let right_top_y = center_y - right_open_height * 0.5;
                let right_bottom_y = center_y + right_open_height * 0.5;
                let top_id = sink.push_line_item(LineItemSpec {
                    measure_id: Some(&first.id),
                    role: "hairpin-top",
                    x1: start_x,
                    y1: left_top_y,
                    x2: end_x,
                    y2: right_top_y,
                    stroke: "#333",
                    stroke_width: 1.2,
                    stroke_line_cap: None,
                });
                let bottom_id = sink.push_line_item(LineItemSpec {
                    measure_id: Some(&first.id),
                    role: "hairpin-bottom",
                    x1: start_x,
                    y1: left_bottom_y,
                    x2: end_x,
                    y2: right_bottom_y,
                    stroke: "#333",
                    stroke_width: 1.2,
                    stroke_line_cap: None,
                });
                composites.push(SceneComposite {
                    id: format!(
                        "hairpin-{}-{}-{}",
                        hairpin.start_measure_index, hairpin.end_measure_index, fragment_index
                    ),
                    kind: CompositeKind::Hairpin,
                    fragment: span_fragment_kind(fragment_index, fragment_total),
                    child_item_ids: vec![top_id, bottom_id],
                    label: Some(match hairpin.kind {
                        HairpinKind::Crescendo => "crescendo".to_string(),
                        HairpinKind::Decrescendo => "decrescendo".to_string(),
                    }),
                    count: None,
                    start_anchor_id: Some(first.id.clone()),
                    end_anchor_id: Some(last.id.clone()),
                });
            }
        }
    }
}

pub(crate) fn render_dynamic_marks(
    sink: &mut SceneEmitSink<'_>,
    page_measures: &[SceneMeasure],
    measures: &[DisplayMeasure<'_>],
    header: &RenderHeader,
) {
    const LOWER_EXPRESSION_GAP_PT: f32 = 4.0;
    const DYNAMIC_EDGE_PADDING_PT: f32 = 3.0;
    const DYNAMIC_TEXT_PADDING_X_PT: f32 = 1.5;
    const DYNAMIC_TEXT_PADDING_Y_PT: f32 = 1.0;

    let metric = canonical_text_metric(TextRole::Dynamic, sink.staff_space_pt);
    for display_measure in measures {
        if display_measure.measure.dynamics.is_empty() {
            continue;
        }
        let Some(scene_measure) = page_measures
            .iter()
            .find(|measure| measure.global_index == display_measure.global_index)
        else {
            continue;
        };
        for dynamic in &display_measure.measure.dynamics {
            let text = dynamic.level.as_str().to_string();
            let text_width = canonical_text_width(TextRole::Dynamic, &text, sink.staff_space_pt);
            let anchor_x = dynamic_anchor_x(scene_measure, header, dynamic.at);
            let left_bound = scene_measure.x_pt + DYNAMIC_EDGE_PADDING_PT;
            let right_bound = scene_measure.x_pt + scene_measure.width_pt - DYNAMIC_EDGE_PADDING_PT;
            let half_width = text_width * 0.5;
            let min_x = left_bound + half_width;
            let max_x = right_bound - half_width;
            let x = if min_x <= max_x {
                anchor_x.clamp(min_x, max_x)
            } else {
                (left_bound + right_bound) * 0.5
            };
            let occupied_bottom = bottom_skyline_sample_including_hairpins(
                sink.items(),
                &[scene_measure],
                x - half_width - DYNAMIC_TEXT_PADDING_X_PT,
                x + half_width + DYNAMIC_TEXT_PADDING_X_PT,
                scene_measure.y_pt + scene_measure.height_pt,
                sink.staff_space_pt,
            );
            let baseline_y = occupied_bottom
                + LOWER_EXPRESSION_GAP_PT
                + DYNAMIC_TEXT_PADDING_Y_PT
                + metric.ascent_pt;
            let item_id = sink.push_text_item(TextItemSpec {
                measure_id: Some(scene_measure.id.as_str()),
                role: "dynamic",
                x,
                y: baseline_y,
                text_role: TextRole::Dynamic,
                text,
                font_family: metric.font_family,
                font_size_pt: metric.font_size_pt,
                fill: "#333",
                text_anchor: Some("middle"),
                font_weight: None,
            });
            sink.set_measure_local_fraction(&item_id, dynamic.at);
        }
    }
}

fn dynamic_anchor_x(measure: &SceneMeasure, _header: &RenderHeader, fraction: Fraction) -> f32 {
    let progress = crate::fraction_to_f32(fraction).clamp(0.0, 1.0);
    measure.x_pt + 14.0 + progress * (measure.width_pt - 28.0).max(1.0)
}

fn hairpin_open_height_at_progress(kind: HairpinKind, progress: f32, max_height: f32) -> f32 {
    let clamped = progress.clamp(0.0, 1.0);
    match kind {
        HairpinKind::Crescendo => max_height * clamped,
        HairpinKind::Decrescendo => max_height * (1.0 - clamped),
    }
}
