use crate::wire::{WireSceneComposite, WireSceneItem, WireSceneMeasure, WireScenePrimitive};
use js_sys::{Array, Object};
use wasm_bindgen::prelude::*;

pub(crate) fn wire_js_measure(measure: &WireSceneMeasure) -> Object {
    let measure_obj = Object::new();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("id"), &JsValue::from_str(&measure.id)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("index"), &JsValue::from_f64(measure.index as f64)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("globalIndex"), &JsValue::from_f64(measure.global_index as f64)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("systemId"), &JsValue::from_str(&measure.system_id)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("xPt"), &JsValue::from_f64(measure.x_pt as f64)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("yPt"), &JsValue::from_f64(measure.y_pt as f64)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("widthPt"), &JsValue::from_f64(measure.width_pt as f64)).unwrap();
    js_sys::Reflect::set(&measure_obj, &JsValue::from_str("heightPt"), &JsValue::from_f64(measure.height_pt as f64)).unwrap();
    measure_obj
}

pub(crate) fn wire_js_item(item: &WireSceneItem) -> Object {
    let item_obj = Object::new();
        let item_obj = Object::new();
        js_sys::Reflect::set(
            &item_obj,
            &JsValue::from_str("id"),
            &JsValue::from_str(&item.id),
        )
        .unwrap();
        if let Some(measure_id) = item.measure_id.as_deref() {
            js_sys::Reflect::set(
                &item_obj,
                &JsValue::from_str("measureId"),
                &JsValue::from_str(&measure_id),
            )
            .unwrap();
        }
        if let Some(anchor_item_id) = item.anchor_item_id.as_deref() {
            js_sys::Reflect::set(
                &item_obj,
                &JsValue::from_str("anchorItemId"),
                &JsValue::from_str(&anchor_item_id),
            )
            .unwrap();
        }
        if let Some(fraction) = item.measure_local_fraction {
            let fraction_obj = Object::new();
            js_sys::Reflect::set(
                &fraction_obj,
                &JsValue::from_str("numerator"),
                &JsValue::from_f64(fraction.numerator as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &fraction_obj,
                &JsValue::from_str("denominator"),
                &JsValue::from_f64(fraction.denominator as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &item_obj,
                &JsValue::from_str("measureLocalFraction"),
                &fraction_obj.into(),
            )
            .unwrap();
        }
        js_sys::Reflect::set(
            &item_obj,
            &JsValue::from_str("role"),
            &JsValue::from_str(&item.role),
        )
        .unwrap();
        js_sys::Reflect::set(
            &item_obj,
            &JsValue::from_str("kind"),
            &JsValue::from_str(item.kind),
        )
        .unwrap();
        js_sys::Reflect::set(
            &item_obj,
            &JsValue::from_str("zIndex"),
            &JsValue::from_f64(item.z_index as f64),
        )
        .unwrap();
        let primitive = Object::new();
        match &item.primitive {
            WireScenePrimitive::GlyphRun {
                x_pt,
                y_pt,
                glyph_role,
                glyph_count,
                codepoint,
                font_family,
                font_size_pt,
                fill,
            } => {
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("xPt"),
                    &JsValue::from_f64(*x_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("yPt"),
                    &JsValue::from_f64(*y_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("glyphRole"),
                    &JsValue::from_str(glyph_role),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("glyphCount"),
                    &JsValue::from_f64(*glyph_count as f64),
                )
                .unwrap();
                if let Some(codepoint) = codepoint {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("codepoint"),
                        &JsValue::from_f64(*codepoint as f64),
                    )
                    .unwrap();
                }
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fontFamily"),
                    &JsValue::from_str(&font_family),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fontSizePt"),
                    &JsValue::from_f64(*font_size_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fill"),
                    &JsValue::from_str(&fill),
                )
                .unwrap();
            }
            WireScenePrimitive::TextRun {
                x_pt,
                y_pt,
                text_role,
                text,
                font_family,
                font_size_pt,
                fill,
                text_anchor,
                font_weight,
                font_style,
                accessible_label,
            } => {
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("xPt"),
                    &JsValue::from_f64(*x_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("yPt"),
                    &JsValue::from_f64(*y_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("textRole"),
                    &JsValue::from_str(text_role),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("text"),
                    &JsValue::from_str(&text),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fontFamily"),
                    &JsValue::from_str(&font_family),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fontSizePt"),
                    &JsValue::from_f64(*font_size_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fill"),
                    &JsValue::from_str(&fill),
                )
                .unwrap();
                if let Some(text_anchor) = text_anchor {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("textAnchor"),
                        &JsValue::from_str(&text_anchor),
                    )
                    .unwrap();
                }
                if let Some(font_weight) = font_weight {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("fontWeight"),
                        &JsValue::from_str(&font_weight),
                    )
                    .unwrap();
                }
                if let Some(font_style) = font_style {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("fontStyle"),
                        &JsValue::from_str(&font_style),
                    )
                    .unwrap();
                }
                if let Some(accessible_label) = accessible_label {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("accessibleLabel"),
                        &JsValue::from_str(&accessible_label),
                    )
                    .unwrap();
                }
            }
            WireScenePrimitive::LineSegment {
                x1_pt,
                y1_pt,
                x2_pt,
                y2_pt,
                stroke,
                stroke_width,
                stroke_line_cap,
            } => {
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("x1Pt"),
                    &JsValue::from_f64(*x1_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("y1Pt"),
                    &JsValue::from_f64(*y1_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("x2Pt"),
                    &JsValue::from_f64(*x2_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("y2Pt"),
                    &JsValue::from_f64(*y2_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("stroke"),
                    &JsValue::from_str(&stroke),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("strokeWidth"),
                    &JsValue::from_f64(*stroke_width as f64),
                )
                .unwrap();
                if let Some(cap) = stroke_line_cap {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("strokeLineCap"),
                        &JsValue::from_str(&cap),
                    )
                    .unwrap();
                }
            }
            WireScenePrimitive::Rect {
                x_pt,
                y_pt,
                width_pt,
                height_pt,
                fill,
                stroke,
                stroke_width,
            } => {
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("xPt"),
                    &JsValue::from_f64(*x_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("yPt"),
                    &JsValue::from_f64(*y_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("widthPt"),
                    &JsValue::from_f64(*width_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("heightPt"),
                    &JsValue::from_f64(*height_pt as f64),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fill"),
                    &JsValue::from_str(&fill),
                )
                .unwrap();
                if let Some(stroke) = stroke {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("stroke"),
                        &JsValue::from_str(&stroke),
                    )
                    .unwrap();
                }
                if let Some(stroke_width) = stroke_width {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("strokeWidth"),
                        &JsValue::from_f64(*stroke_width as f64),
                    )
                    .unwrap();
                }
            }
            WireScenePrimitive::Polyline { points_pt } => {
                let points = Array::new();
                for (x, y) in points_pt {
                    let point = Array::new();
                    point.push(&JsValue::from_f64(*x as f64));
                    point.push(&JsValue::from_f64(*y as f64));
                    points.push(&point.into());
                }
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("pointsPt"),
                    &points.into(),
                )
                .unwrap();
            }
            WireScenePrimitive::Path {
                d,
                fill,
                stroke,
                stroke_width,
            } => {
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("d"),
                    &JsValue::from_str(&d),
                )
                .unwrap();
                js_sys::Reflect::set(
                    &primitive,
                    &JsValue::from_str("fill"),
                    &JsValue::from_str(&fill),
                )
                .unwrap();
                if let Some(stroke) = stroke {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("stroke"),
                        &JsValue::from_str(&stroke),
                    )
                    .unwrap();
                }
                if let Some(stroke_width) = stroke_width {
                    js_sys::Reflect::set(
                        &primitive,
                        &JsValue::from_str("strokeWidth"),
                        &JsValue::from_f64(*stroke_width as f64),
                    )
                    .unwrap();
                }
            }
        }
        js_sys::Reflect::set(
            &item_obj,
            &JsValue::from_str("primitive"),
            &primitive.into(),
        )
        .unwrap();
    item_obj
}

pub(crate) fn wire_js_composite(composite: &WireSceneComposite) -> Object {
    let composite_obj = Object::new();
    js_sys::Reflect::set(
        &composite_obj,
        &JsValue::from_str("id"),
        &JsValue::from_str(&composite.id),
    )
    .unwrap();
    js_sys::Reflect::set(
        &composite_obj,
        &JsValue::from_str("kind"),
        &JsValue::from_str(composite.kind),
    )
    .unwrap();
    js_sys::Reflect::set(
        &composite_obj,
        &JsValue::from_str("fragment"),
        &JsValue::from_str(composite.fragment),
    )
    .unwrap();
    let child_ids = Array::new();
    for child_id in &composite.child_item_ids {
        child_ids.push(&JsValue::from_str(child_id));
    }
    js_sys::Reflect::set(
        &composite_obj,
        &JsValue::from_str("childItemIds"),
        &child_ids.into(),
    )
    .unwrap();
    if let Some(label) = composite.label.as_deref() {
        js_sys::Reflect::set(
            &composite_obj,
            &JsValue::from_str("label"),
            &JsValue::from_str(label),
        )
        .unwrap();
    }
    if let Some(count) = composite.count {
        js_sys::Reflect::set(
            &composite_obj,
            &JsValue::from_str("count"),
            &JsValue::from_f64(count as f64),
        )
        .unwrap();
    }
    if let Some(start_anchor_id) = composite.start_anchor_id.as_deref() {
        js_sys::Reflect::set(
            &composite_obj,
            &JsValue::from_str("startAnchorId"),
            &JsValue::from_str(start_anchor_id),
        )
        .unwrap();
    }
    if let Some(end_anchor_id) = composite.end_anchor_id.as_deref() {
        js_sys::Reflect::set(
            &composite_obj,
            &JsValue::from_str("endAnchorId"),
            &JsValue::from_str(end_anchor_id),
        )
        .unwrap();
    }
    composite_obj
}
