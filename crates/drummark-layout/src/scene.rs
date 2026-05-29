use super::*;
use crate::scene_page::{
    collect_page_measures, route_composites_to_systems, route_items_to_systems,
};
use crate::structural::spans::push_system_volta_composites;

// ── Platform-Neutral Scene Output ───────────────────────────────

#[allow(dead_code)]
pub(crate) fn render_header_layout_box(
    header: &RenderHeader,
    opts: &LayoutOptions,
) -> HeaderLayoutBox {
    let page_w = opts.page_width_pt;
    let margin = opts.left_margin_pt;
    let center_x = page_w / 2.0;
    let header_bottom_y = opts.top_margin_pt + opts.header_height_pt;
    let mut item_counter = 0usize;
    let mut items = Vec::new();
    let mut composites = Vec::new();
    let mut sink = SceneEmitSink::new(&mut items, &mut item_counter, opts.staff_space_pt);

    let title_metric = canonical_text_metric(TextRole::Title, opts.staff_space_pt);
    let subtitle_metric = canonical_text_metric(TextRole::Subtitle, opts.staff_space_pt);
    let composer_metric = canonical_text_metric(TextRole::Composer, opts.staff_space_pt);
    let tempo_metric = canonical_text_metric(TextRole::Tempo, opts.staff_space_pt);
    let title_y = opts.top_margin_pt + title_metric.ascent_pt + 18.0;
    let subtitle_y = header_bottom_y + subtitle_metric.ascent_pt + 12.0;
    let composer_y = header_bottom_y + composer_metric.ascent_pt + 12.0;
    let tempo_y = header_bottom_y + opts.header_staff_spacing_pt + opts.tempo_offset_y;

    if let Some(ref text) = header.title {
        let title_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "title",
            x: center_x,
            y: title_y,
            text_role: TextRole::Title,
            text: text.clone(),
            font_family: title_metric.font_family,
            font_size_pt: title_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        composites.push(SceneComposite {
            id: "text-block-title".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![title_id],
            label: Some("title".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    if let Some(ref text) = header.subtitle {
        let subtitle_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "subtitle",
            x: center_x,
            y: subtitle_y,
            text_role: TextRole::Subtitle,
            text: text.clone(),
            font_family: subtitle_metric.font_family,
            font_size_pt: subtitle_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: None,
        });
        composites.push(SceneComposite {
            id: "text-block-subtitle".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![subtitle_id],
            label: Some("subtitle".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    if let Some(ref text) = header.composer {
        let composer_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "composer",
            x: page_w - margin,
            y: composer_y,
            text_role: TextRole::Composer,
            text: text.clone(),
            font_family: composer_metric.font_family,
            font_size_pt: composer_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("end"),
            font_weight: None,
        });
        composites.push(SceneComposite {
            id: "text-block-composer".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![composer_id],
            label: Some("composer".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    if header.tempo > 0 {
        let tempo_glyph_x = margin + 9.0;
        let tempo_glyph_width =
            canonical_glyph_metric(GlyphRole::MetNoteQuarterUp).width_ss() * tempo_glyph_position_pt(opts.staff_space_pt) / 4.0;
        let tempo_equals_x = tempo_glyph_x + tempo_glyph_width + 8.0;
        let tempo_value_text = header.tempo.to_string();
        let tempo_value_x = tempo_equals_x + canonical_text_width(TextRole::Tempo, "=", opts.staff_space_pt) + 6.0;
        let tempo_glyph_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "tempo-glyph",
            x: tempo_glyph_x,
            y: tempo_y,
            text_role: TextRole::Tempo,
            text: "\u{ECA5}".to_string(),
            font_family: "Bravura",
            font_size_pt: tempo_glyph_render_font_pt(opts.staff_space_pt),
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let tempo_equals_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "tempo-equals",
            x: tempo_equals_x,
            y: tempo_y,
            text_role: TextRole::Tempo,
            text: "=".to_string(),
            font_family: tempo_metric.font_family,
            font_size_pt: tempo_metric.font_size_pt,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let tempo_value_id = sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "tempo",
            x: tempo_value_x,
            y: tempo_y,
            text_role: TextRole::Tempo,
            text: tempo_value_text,
            font_family: tempo_metric.font_family,
            font_size_pt: tempo_metric.font_size_pt,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        composites.push(SceneComposite {
            id: "text-block-tempo".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![tempo_glyph_id, tempo_equals_id, tempo_value_id],
            label: Some("tempo".to_string()),
            count: Some(header.tempo),
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }

    let item_bounds = bounds_for_items(&items, opts.staff_space_pt).ok().flatten();
    let visual_top = item_bounds
        .map(|bounds| bounds.y)
        .unwrap_or(opts.top_margin_pt);
    let visual_bottom = item_bounds
        .map(|bounds| bounds.y + bounds.height)
        .unwrap_or(opts.top_margin_pt + opts.header_height_pt);

    HeaderLayoutBox {
        items,
        composites,
        visual_top,
        visual_bottom,
    }
}

pub fn build_layout_scene(score: &RenderScore, opts: &LayoutOptions) -> LayoutScene {
    let page_w = opts.page_width_pt;
    let page_h = opts.page_height_pt;
    let margin = opts.left_margin_pt;
    let staff_ss = opts.staff_space_pt;
    let center_x = page_w / 2.0;
    let system_left = margin;
    let system_right = page_w - margin;
    let header_bottom_y = opts.top_margin_pt + opts.header_height_pt;
    let mut sys_y = header_bottom_y + opts.header_staff_spacing_pt;
    let mut item_counter = 0usize;
    let mapper = SlotMapper::new(opts.px_per_quarter);
    let expanded = expand_layout_data(score);

    let planned_systems = plan_scene_systems(&score.header, &expanded.measures, opts);

    let mut page = ScenePage {
        index: 0,
        width_pt: page_w,
        height_pt: page_h,
        header: Some(PageHeader::default()),
        systems: Vec::new(),
    };
    let header = page.header.as_mut().expect("header initialized");
    let mut header_sink =
        SceneEmitSink::new(&mut header.items, &mut item_counter, opts.staff_space_pt);
    let mut layout_issues = Vec::new();

    let title_metric = canonical_text_metric(TextRole::Title, opts.staff_space_pt);
    let subtitle_metric = canonical_text_metric(TextRole::Subtitle, opts.staff_space_pt);
    let composer_metric = canonical_text_metric(TextRole::Composer, opts.staff_space_pt);
    let title_y = opts.top_margin_pt + title_metric.ascent_pt + 18.0;
    let subtitle_y = header_bottom_y + subtitle_metric.ascent_pt + 12.0;
    let composer_y = header_bottom_y + composer_metric.ascent_pt + 12.0;

    if let Some(ref text) = score.header.title {
        let title_id = header_sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "title",
            x: center_x,
            y: title_y,
            text_role: TextRole::Title,
            text: text.clone(),
            font_family: title_metric.font_family,
            font_size_pt: title_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        header.composites.push(SceneComposite {
            id: "text-block-title".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![title_id],
            label: Some("title".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    if let Some(ref text) = score.header.subtitle {
        let subtitle_id = header_sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "subtitle",
            x: center_x,
            y: subtitle_y,
            text_role: TextRole::Subtitle,
            text: text.clone(),
            font_family: subtitle_metric.font_family,
            font_size_pt: subtitle_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: None,
        });
        header.composites.push(SceneComposite {
            id: "text-block-subtitle".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![subtitle_id],
            label: Some("subtitle".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    if let Some(ref text) = score.header.composer {
        let composer_id = header_sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "composer",
            x: page_w - margin,
            y: composer_y,
            text_role: TextRole::Composer,
            text: text.clone(),
            font_family: composer_metric.font_family,
            font_size_pt: composer_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("end"),
            font_weight: None,
        });
        header.composites.push(SceneComposite {
            id: "text-block-composer".to_string(),
            kind: CompositeKind::TextBlock,
            fragment: SpanFragmentKind::SingleSegment,
            child_item_ids: vec![composer_id],
            label: Some("composer".to_string()),
            count: None,
            start_anchor_id: None,
            end_anchor_id: None,
        });
    }
    let mut deferred_navs = Vec::new();

    for (sys_idx, system) in planned_systems.iter().enumerate() {
        let is_first_system = sys_idx == 0;
        let is_last = sys_idx + 1 == planned_systems.len();
        let system_id = format!("system-{sys_idx}");
        let sy = sys_y;
        sys_y += staff_bounding_height_pt(staff_ss) + opts.system_spacing_pt;
        let s_top = sy + staff_ss;
        let s_bot = sy + staff_bounding_height_pt(staff_ss);
        let s_mid = sy + staff_ss * 3.0;
        let mut mx = system_left;

        page.systems.push(SceneSystem {
            id: system_id.clone(),
            index: sys_idx as u32,
            page_index: 0,
            x_pt: system_left,
            y_pt: sy,
            width_pt: system_right - system_left,
            height_pt: s_bot - sy,
            measures: Vec::new(),
            items: Vec::new(),
            composites: Vec::new(),
        });
        let current = page.systems.last_mut().expect("system just pushed");
        let mut sink = SceneEmitSink::new(&mut current.items, &mut item_counter, opts.staff_space_pt);

        for i in 0..5 {
            let ly = sy + staff_ss * (1.0 + i as f32);
            sink.push_line_item(LineItemSpec {
                measure_id: None,
                role: "staff-line",
                x1: system_left,
                y1: ly,
                x2: system_right,
                y2: ly,
                stroke: "#333",
                stroke_width: 1.0,
                stroke_line_cap: None,
            });
        }
        let clef_metric = canonical_text_metric(TextRole::PercussionClef, opts.staff_space_pt);
        sink.push_text_item(TextItemSpec {
            measure_id: None,
            role: "percussion-clef",
            x: clef_x_pt(margin),
            y: s_mid,
            text_role: TextRole::PercussionClef,
            text: "\u{E069}".to_string(),
            font_family: "Bravura",
            font_size_pt: clef_metric.font_size_pt,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        if is_first_system {
            let tsx = time_signature_x_pt(margin, opts.staff_space_pt);
            let time_sig_metric = canonical_text_metric(TextRole::TimeSignatureDigit, opts.staff_space_pt);
            sink.push_text_item(TextItemSpec {
                measure_id: None,
                role: "time-signature-digit",
                x: tsx,
                y: sy + staff_ss * 2.0,
                text_role: TextRole::TimeSignatureDigit,
                text: num_to_glyph(score.header.time_beats),
                font_family: time_sig_metric.font_family,
                font_size_pt: time_sig_metric.font_size_pt,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
            sink.push_text_item(TextItemSpec {
                measure_id: None,
                role: "time-signature-digit",
                x: tsx,
                y: sy + staff_ss * 4.0,
                text_role: TextRole::TimeSignatureDigit,
                text: num_to_glyph(score.header.time_beat_unit),
                font_family: time_sig_metric.font_family,
                font_size_pt: time_sig_metric.font_size_pt,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
        }
        if is_first_system && score.header.tempo > 0 {
            let first_measure_id = format!("measure-{}", system.measures[0].global_index);
            let tempo_metric = canonical_text_metric(TextRole::Tempo, opts.staff_space_pt);
            let tempo_y = sy + opts.tempo_offset_y;
            let tempo_glyph_x = margin + 9.0;
            let tempo_glyph_width =
                canonical_glyph_metric(GlyphRole::MetNoteQuarterUp).width_ss() * tempo_glyph_position_pt(opts.staff_space_pt) / 4.0;
            let tempo_equals_x = tempo_glyph_x + tempo_glyph_width + 8.0;
            let tempo_value_text = score.header.tempo.to_string();
            let tempo_value_x = tempo_equals_x + canonical_text_width(TextRole::Tempo, "=", opts.staff_space_pt) + 6.0;
            let tempo_glyph_id = sink.push_text_item(TextItemSpec {
                measure_id: Some(&first_measure_id),
                role: "tempo-glyph",
                x: tempo_glyph_x,
                y: tempo_y,
                text_role: TextRole::Tempo,
                text: "\u{ECA5}".to_string(),
                font_family: "Bravura",
                font_size_pt: tempo_glyph_render_font_pt(opts.staff_space_pt),
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
            let tempo_equals_id = sink.push_text_item(TextItemSpec {
                measure_id: Some(&first_measure_id),
                role: "tempo-equals",
                x: tempo_equals_x,
                y: tempo_y,
                text_role: TextRole::Tempo,
                text: "=".to_string(),
                font_family: tempo_metric.font_family,
                font_size_pt: tempo_metric.font_size_pt,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
            let tempo_value_id = sink.push_text_item(TextItemSpec {
                measure_id: Some(&first_measure_id),
                role: "tempo",
                x: tempo_value_x,
                y: tempo_y,
                text_role: TextRole::Tempo,
                text: tempo_value_text,
                font_family: tempo_metric.font_family,
                font_size_pt: tempo_metric.font_size_pt,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
            current.composites.push(SceneComposite {
                id: "text-block-tempo".to_string(),
                kind: CompositeKind::TextBlock,
                fragment: SpanFragmentKind::SingleSegment,
                child_item_ids: vec![tempo_glyph_id, tempo_equals_id, tempo_value_id],
                label: Some("tempo".to_string()),
                count: Some(score.header.tempo),
                start_anchor_id: None,
                end_anchor_id: None,
            });
        }
        let measure_number_metric = canonical_text_metric(TextRole::MeasureNumber, opts.staff_space_pt);
        if !is_first_system {
            sink.push_text_item(TextItemSpec {
                measure_id: None,
                role: "measure-number",
                x: margin,
                y: sy,
                text_role: TextRole::MeasureNumber,
                text: format!("{}", system.measures[0].measure.global_index + 1),
                font_family: measure_number_metric.font_family,
                font_size_pt: measure_number_metric.font_size_pt,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
        }

        for (mi, (measure, mw)) in system.measures.iter().zip(system.widths.iter()).enumerate() {
            let measure_id = format!("measure-{}", measure.global_index);
            let left_pad = measure_left_pad(mi, is_first_system, measure.barline.as_deref(), opts.staff_space_pt);
            let right_barline = measure
                .closing_barline
                .as_deref()
                .or(measure.barline.as_deref());
            let right_pad = measure_right_pad(right_barline, opts.staff_space_pt);
            let left_repeat_is_shared_boundary = mi > 0
                && is_start_repeat_barline(measure.barline.as_deref())
                && system.measures.get(mi - 1).is_some_and(|previous| {
                    is_end_repeat_barline(
                        previous
                            .closing_barline
                            .as_deref()
                            .or(previous.barline.as_deref()),
                    )
                });

            if mi == 0 {
                render_system_opening_barline(&mut sink, Some(&measure_id), mx, s_top, s_bot);
                if is_start_repeat_barline(measure.barline.as_deref()) {
                    render_start_repeat_barline(
                        &mut sink,
                        Some(&measure_id),
                        first_measure_start_repeat_x(mx, margin, is_first_system, opts.staff_space_pt),
                        s_top,
                        s_bot,
                    );
                }
            } else if !left_repeat_is_shared_boundary {
                render_left_barline(
                    &mut sink,
                    Some(&measure_id),
                    mx,
                    s_top,
                    s_bot,
                    measure.barline.as_deref(),
                );
            }

            current.measures.push(SceneMeasure {
                id: measure_id.clone(),
                index: measure.global_index,
                global_index: measure.global_index,
                system_id: system_id.clone(),
                x_pt: mx,
                y_pt: sy,
                width_pt: *mw,
                height_pt: s_bot - sy,
            });

            if let Some(count) = measure.measure.multi_rest_count {
                let center_y = s_top + (s_bot - s_top) * 0.5;
                let inner_left = compact_measure_inner_left(
                    mx,
                    mi,
                    margin,
                    is_first_system,
                    measure.barline.as_deref(),
                    opts.staff_space_pt,
                );
                let inner_right = compact_measure_inner_right(
                    mx,
                    *mw,
                    right_barline,
                    opts.staff_space_pt,
                );
                let inner_width = (inner_right - inner_left).max(0.0);
                let pad = (inner_width * 0.1).max(8.0);
                let bar_left = inner_left + pad;
                let bar_right = inner_right - pad;
                let bar_thickness = staff_ss * 0.5;
                let serif_height = staff_ss * 2.0;
                let serif_thickness = 2.0;
                let bar_id = sink.push_line_item(LineItemSpec {
                    measure_id: Some(&measure_id),
                    role: "multi-rest-bar",
                    x1: bar_left,
                    y1: center_y,
                    x2: bar_right,
                    y2: center_y,
                    stroke: "#333",
                    stroke_width: bar_thickness,
                    stroke_line_cap: Some("butt"),
                });
                let left_serif_id = sink.push_line_item(LineItemSpec {
                    measure_id: Some(&measure_id),
                    role: "multi-rest-serif",
                    x1: bar_left,
                    y1: center_y - serif_height * 0.5,
                    x2: bar_left,
                    y2: center_y + serif_height * 0.5,
                    stroke: "#333",
                    stroke_width: serif_thickness,
                    stroke_line_cap: Some("butt"),
                });
                let right_serif_id = sink.push_line_item(LineItemSpec {
                    measure_id: Some(&measure_id),
                    role: "multi-rest-serif",
                    x1: bar_right,
                    y1: center_y - serif_height * 0.5,
                    x2: bar_right,
                    y2: center_y + serif_height * 0.5,
                    stroke: "#333",
                    stroke_width: serif_thickness,
                    stroke_line_cap: Some("butt"),
                });
                let count_glyph: String = count
                    .to_string()
                    .chars()
                    .map(|c| char::from_u32(0xE080 + c.to_digit(10).unwrap()).unwrap())
                    .collect();
                let time_sig_metric = canonical_text_metric(TextRole::TimeSignatureDigit, opts.staff_space_pt);
                let count_y = s_top - staff_ss * 0.5 - time_sig_metric.font_size_pt * 0.5;
                let count_id = sink.push_text_item(TextItemSpec {
                    measure_id: Some(&measure_id),
                    role: "multi-rest-count",
                    x: (inner_left + inner_right) * 0.5,
                    y: count_y,
                    text_role: TextRole::TimeSignatureDigit,
                    text: count_glyph,
                    font_family: time_sig_metric.font_family,
                    font_size_pt: time_sig_metric.font_size_pt,
                    fill: "#333",
                    text_anchor: Some("middle"),
                    font_weight: None,
                });
                current.composites.push(SceneComposite {
                    id: format!("multi-rest-{}", measure.global_index),
                    kind: CompositeKind::MultiRest,
                    fragment: SpanFragmentKind::SingleSegment,
                    child_item_ids: vec![bar_id, left_serif_id, right_serif_id, count_id],
                    label: None,
                    count: Some(count),
                    start_anchor_id: Some(measure_id.clone()),
                    end_anchor_id: Some(measure_id.clone()),
                });
            } else if let Some(repeat_part) = measure.repeat_part {
                match repeat_part {
                    MeasureRepeatDisplayPart::Single => {
                        let repeat_metric =
                            canonical_glyph_metric(GlyphRole::MeasureRepeatMark1Bar);
                        let repeat_id = sink.push_glyph_item(GlyphItemSpec {
                            measure_id: Some(&measure_id),
                            role: "measure-repeat",
                            x: mx + *mw * 0.5 - repeat_metric.bbox_center_x_pt(glyph_position_pt(opts.staff_space_pt)),
                            y: s_mid + repeat_metric.bbox_center_y_pt(glyph_position_pt(opts.staff_space_pt)),
                            glyph_role: GlyphRole::MeasureRepeatMark1Bar,
                            font_family: "Bravura",
                            font_size_pt: notation_render_font_pt(opts.staff_space_pt),
                            fill: "#333",
                        });
                        current.composites.push(SceneComposite {
                            id: format!("measure-repeat-{}", measure.global_index),
                            kind: CompositeKind::MeasureRepeat,
                            fragment: SpanFragmentKind::SingleSegment,
                            child_item_ids: vec![repeat_id],
                            label: None,
                            count: Some(1),
                            start_anchor_id: Some(measure_id.clone()),
                            end_anchor_id: Some(measure_id.clone()),
                        });
                    }
                    MeasureRepeatDisplayPart::TwoBarStart => {
                        let next_width = system.widths.get(mi + 1).copied().unwrap_or(*mw);
                        let span_center_x = mx + (*mw + next_width) * 0.5;
                        let repeat_metric =
                            canonical_glyph_metric(GlyphRole::MeasureRepeatMark2Bars);
                        let repeat_id = sink.push_glyph_item(GlyphItemSpec {
                            measure_id: Some(&measure_id),
                            role: "measure-repeat",
                            x: span_center_x - repeat_metric.bbox_center_x_pt(glyph_position_pt(opts.staff_space_pt)),
                            y: s_mid + repeat_metric.bbox_center_y_pt(glyph_position_pt(opts.staff_space_pt)),
                            glyph_role: GlyphRole::MeasureRepeatMark2Bars,
                            font_family: "Bravura",
                            font_size_pt: notation_render_font_pt(opts.staff_space_pt),
                            fill: "#333",
                        });
                        let end_anchor_id = format!("measure-{}", measure.global_index + 1);
                        current.composites.push(SceneComposite {
                            id: format!("measure-repeat-{}", measure.global_index),
                            kind: CompositeKind::MeasureRepeat,
                            fragment: SpanFragmentKind::SingleSegment,
                            child_item_ids: vec![repeat_id],
                            label: None,
                            count: Some(2),
                            start_anchor_id: Some(measure_id.clone()),
                            end_anchor_id: Some(end_anchor_id),
                        });
                    }
                    MeasureRepeatDisplayPart::TwoBarStop => {}
                }
            } else {
                render_measure_events(
                    &mut sink,
                    RenderMeasureEventsInput {
                        measure_id: &measure_id,
                        header: &score.header,
                        measure: measure.measure,
                        geometry: MeasureGeometryInput {
                            measure_x: mx,
                            measure_width: *mw,
                            left_pad,
                            right_pad,
                            duration_compression: opts.duration_spacing_compression,
                        },
                        staff_top: s_top,
                        staff_bottom: s_bot,
                        mapper: &mapper,
                        stem_len_pt: opts.stem_len_pt,
                        hide_voice2_rests: opts.hide_voice2_rests,
                        issues: &mut layout_issues,
                    },
                );
            }

            deferred_navs.push(DeferredNavMarker {
                measure_id: measure_id.clone(),
                global_index: measure.global_index,
                start_nav: measure.start_nav.clone(),
                end_nav: measure.end_nav.clone(),
                x: mx,
                width: *mw,
                top: s_top,
            });
            let right_repeat_is_shared_boundary = is_end_repeat_barline(right_barline)
                && system
                    .measures
                    .get(mi + 1)
                    .is_some_and(|next| is_start_repeat_barline(next.barline.as_deref()));
            if right_repeat_is_shared_boundary {
                render_right_left_repeat_barline(
                    &mut sink,
                    Some(&measure_id),
                    mx + *mw,
                    s_top,
                    s_bot,
                );
            } else {
                render_right_barline(
                    &mut sink,
                    RightBarlineSpec {
                        measure_id: Some(&measure_id),
                        x: mx + *mw,
                        top: s_top,
                        bottom: s_bot,
                        barline: right_barline,
                        is_last_measure_of_score: mi + 1 == system.measures.len() && is_last,
                    },
                );
            }
            mx += *mw;
        }
    }

    for (sys_idx, system) in page.systems.iter_mut().enumerate() {
        let measures = system.measures.clone();
        let mut sink = SceneEmitSink::new(&mut system.items, &mut item_counter, opts.staff_space_pt);
        push_system_volta_composites(
            &mut sink,
            &mut system.composites,
            &measures,
            &expanded.measures,
            opts,
            sys_idx == 0,
        );
    }

    let page_measures = collect_page_measures(&page);
    let mut post_items = Vec::new();
    let mut post_composites = Vec::new();
    let mut post_sink = SceneEmitSink::new(&mut post_items, &mut item_counter, opts.staff_space_pt);
    render_hairpin_fragments(
        &mut post_sink,
        &mut post_composites,
        &page_measures,
        &expanded.measures,
        opts.hairpin_offset_y,
    );
    render_dynamic_marks(&mut post_sink, &page_measures, &expanded.measures, &score.header);
    for nav_spec in &deferred_navs {
        render_nav_markers(&mut post_sink, &mut post_composites, nav_spec);
    }
    route_items_to_systems(&mut page.systems, post_items);
    route_composites_to_systems(&mut page.systems, post_composites);

    for system in &mut page.systems {
        stack_scene_structural_items(
            &mut system.items,
            &system.composites,
            opts.edge_padding,
            opts.staff_space_pt,
        );
        stack_sticking_items(
            &mut system.items,
            &system.measures,
            opts.edge_padding,
            opts.staff_space_pt,
        );
    }

    paginate_unpaginated_page(
        page,
        LayoutScene {
            version: LAYOUT_SCENE_VERSION.to_string(),
            metrics_version: CANONICAL_METRICS_VERSION.to_string(),
            pages: Vec::new(),
            issues: {
                let mut issues = score.errors.clone();
                issues.extend(layout_issues);
                issues
            },
        },
        opts,
    )
}

fn _layout_scene_from_page(page: ScenePage, issues: Vec<String>) -> LayoutScene {
    LayoutScene {
        version: LAYOUT_SCENE_VERSION.to_string(),
        metrics_version: CANONICAL_METRICS_VERSION.to_string(),
        pages: vec![page],
        issues,
    }
}

pub(crate) fn fraction_to_f32(fraction: Fraction) -> f32 {
    fraction.numerator as f32 / fraction.denominator.max(1) as f32
}

fn num_to_glyph(n: u32) -> String {
    match n {
        0 => "\u{E080}".to_string(),
        1 => "\u{E081}".to_string(),
        2 => "\u{E082}".to_string(),
        3 => "\u{E083}".to_string(),
        4 => "\u{E084}".to_string(),
        5 => "\u{E085}".to_string(),
        6 => "\u{E086}".to_string(),
        7 => "\u{E087}".to_string(),
        8 => "\u{E088}".to_string(),
        9 => "\u{E089}".to_string(),
        _ => n.to_string(),
    }
}
