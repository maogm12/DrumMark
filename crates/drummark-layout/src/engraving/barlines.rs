use crate::metrics::GlyphRole;
use crate::planning::{
    repeat_barline_rendered_width, start_repeat_vertical_origin,
};
use crate::notation_render_font_pt;
use crate::scene_builder::{GlyphItemSpec, RectItemSpec, SceneEmitSink};

pub(crate) fn render_left_barline(
    sink: &mut SceneEmitSink<'_>,
    measure_id: Option<&str>,
    x: f32,
    top: f32,
    bottom: f32,
    barline: Option<&str>,
) {
    match barline {
        Some("repeat-start") | Some("repeat-both") => {
            render_start_repeat_barline(sink, measure_id, x, top, bottom)
        }
        _ => {}
    }
}

pub(crate) fn render_system_opening_barline(
    sink: &mut SceneEmitSink<'_>,
    measure_id: Option<&str>,
    x: f32,
    top: f32,
    bottom: f32,
) {
    sink.push_rect_item(RectItemSpec {
        measure_id,
        role: "opening-barline",
        x,
        y: top,
        width: 1.0,
        height: bottom - top + 1.0,
        fill: "#333",
        stroke: None,
        stroke_width: None,
    });
}

pub(crate) fn render_start_repeat_barline(
    sink: &mut SceneEmitSink<'_>,
    measure_id: Option<&str>,
    x: f32,
    top: f32,
    bottom: f32,
) {
    sink.push_glyph_item(GlyphItemSpec {
        measure_id,
        role: "repeat-start",
        x,
        y: start_repeat_vertical_origin(top, bottom, sink.staff_space_pt),
        glyph_role: GlyphRole::RepeatLeft,
        font_family: "Bravura",
        font_size_pt: notation_render_font_pt(sink.staff_space_pt),
        fill: "#333",
    });
}

pub(crate) fn render_right_left_repeat_barline(
    sink: &mut SceneEmitSink<'_>,
    measure_id: Option<&str>,
    x: f32,
    top: f32,
    bottom: f32,
) {
    sink.push_glyph_item(GlyphItemSpec {
        measure_id,
        role: "repeat-end-start",
        x: x - repeat_barline_rendered_width(GlyphRole::RepeatRight, sink.staff_space_pt),
        y: start_repeat_vertical_origin(top, bottom, sink.staff_space_pt),
        glyph_role: GlyphRole::RepeatRightLeft,
        font_family: "Bravura",
        font_size_pt: notation_render_font_pt(sink.staff_space_pt),
        fill: "#333",
    });
}

pub(crate) struct RightBarlineSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) x: f32,
    pub(crate) top: f32,
    pub(crate) bottom: f32,
    pub(crate) barline: Option<&'a str>,
    pub(crate) is_last_measure_of_score: bool,
}

pub(crate) fn render_right_barline(sink: &mut SceneEmitSink<'_>, spec: RightBarlineSpec<'_>) {
    let h = spec.bottom - spec.top + 1.0;
    match spec.barline {
        Some("repeat-end") | Some("repeat-both") => {
            let y = start_repeat_vertical_origin(spec.top, spec.bottom, sink.staff_space_pt);
            sink.push_glyph_item(GlyphItemSpec {
                measure_id: spec.measure_id,
                role: "repeat-end",
                x: spec.x - repeat_barline_rendered_width(GlyphRole::RepeatRight, sink.staff_space_pt),
                y,
                glyph_role: GlyphRole::RepeatRight,
                font_family: "Bravura",
                font_size_pt: notation_render_font_pt(sink.staff_space_pt),
                fill: "#333",
            });
        }
        Some("double") => {
            sink.push_rect_item(RectItemSpec {
                measure_id: spec.measure_id,
                role: "double-barline-left",
                x: spec.x - 4.0,
                y: spec.top,
                width: 1.0,
                height: h,
                fill: "#333",
                stroke: None,
                stroke_width: None,
            });
            sink.push_rect_item(RectItemSpec {
                measure_id: spec.measure_id,
                role: "double-barline-right",
                x: spec.x - 1.0,
                y: spec.top,
                width: 1.0,
                height: h,
                fill: "#333",
                stroke: None,
                stroke_width: None,
            });
        }
        Some("final") => {
            sink.push_rect_item(RectItemSpec {
                measure_id: spec.measure_id,
                role: "final-barline-thin",
                x: spec.x - 4.0,
                y: spec.top,
                width: 1.0,
                height: h,
                fill: "#333",
                stroke: None,
                stroke_width: None,
            });
            sink.push_rect_item(RectItemSpec {
                measure_id: spec.measure_id,
                role: "final-barline-thick",
                x: spec.x - 3.0,
                y: spec.top,
                width: 3.0,
                height: h,
                fill: "#333",
                stroke: None,
                stroke_width: None,
            });
        }
        _ => {
            sink.push_rect_item(RectItemSpec {
                measure_id: spec.measure_id,
                role: if spec.is_last_measure_of_score {
                    "closing-barline"
                } else {
                    "barline"
                },
                x: spec.x - 1.0,
                y: spec.top,
                width: 1.0,
                height: h,
                fill: "#333",
                stroke: None,
                stroke_width: None,
            });
            if spec.is_last_measure_of_score {
                sink.push_rect_item(RectItemSpec {
                    measure_id: spec.measure_id,
                    role: "final-barline",
                    x: spec.x - 3.0,
                    y: spec.top,
                    width: 3.0,
                    height: h,
                    fill: "#333",
                    stroke: None,
                    stroke_width: None,
                });
            }
        }
    }
}
