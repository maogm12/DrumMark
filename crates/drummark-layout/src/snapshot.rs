use super::*;

use crate::wire::{to_wire_scene, WireScenePrimitive};

fn append_wire_item(out: &mut String, item: &crate::wire::WireSceneItem, indent: &str) {
    let measure_fraction = item
        .measure_local_fraction
        .map(|fraction| format!("{}/{}", fraction.numerator, fraction.denominator))
        .map(|value| format!(" measureLocalFraction={}", value))
        .unwrap_or_default();
    out.push_str(&format!(
        "{indent}item id={} measureId={} anchorItemId={}{} role={} kind={} zIndex={}",
        item.id,
        item.measure_id.as_deref().unwrap_or("-"),
        item.anchor_item_id.as_deref().unwrap_or("-"),
        measure_fraction,
        item.role,
        item.kind,
        item.z_index
    ));
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
            out.push_str(&format!(
                " primitive={{glyphRole={} glyphCount={} codepoint={} xPt={:.3} yPt={:.3} fontFamily={} fontSizePt={:.3} fill={}}}",
                glyph_role,
                glyph_count,
                codepoint.map(|value| value.to_string()).unwrap_or_else(|| "-".to_string()),
                x_pt,
                y_pt,
                font_family,
                font_size_pt,
                fill
            ));
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
            let mut style_attrs = format!(
                "textAnchor={} fontWeight={}",
                text_anchor.as_deref().unwrap_or("-"),
                font_weight.as_deref().unwrap_or("-")
            );
            if let Some(font_style) = font_style {
                style_attrs.push_str(&format!(" fontStyle={font_style}"));
            }
            if let Some(accessible_label) = accessible_label {
                style_attrs.push_str(&format!(" accessibleLabel={accessible_label}"));
            }
            out.push_str(&format!(
                " primitive={{textRole={} text={:?} xPt={:.3} yPt={:.3} fontFamily={} fontSizePt={:.3} fill={} {}}}",
                text_role, text, x_pt, y_pt, font_family, font_size_pt, fill, style_attrs
            ));
        }
        WireScenePrimitive::LineSegment {
            x1_pt,
            y1_pt,
            x2_pt,
            y2_pt,
            stroke,
            stroke_width,
            stroke_line_cap: _,
        } => {
            out.push_str(&format!(
                " primitive={{x1Pt={:.3} y1Pt={:.3} x2Pt={:.3} y2Pt={:.3} stroke={} strokeWidth={:.3}}}",
                x1_pt, y1_pt, x2_pt, y2_pt, stroke, stroke_width
            ));
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
            out.push_str(&format!(
                " primitive={{xPt={:.3} yPt={:.3} widthPt={:.3} heightPt={:.3} fill={} stroke={} strokeWidth={}}}",
                x_pt,
                y_pt,
                width_pt,
                height_pt,
                fill,
                stroke.as_deref().unwrap_or("-"),
                stroke_width
                    .map(|value| format!("{value:.3}"))
                    .unwrap_or_else(|| "-".to_string())
            ));
        }
        WireScenePrimitive::Polyline { points_pt } => {
            let points = points_pt
                .iter()
                .map(|(x, y)| format!("{x:.3},{y:.3}"))
                .collect::<Vec<_>>()
                .join(" ");
            out.push_str(&format!(" primitive={{pointsPt=[{points}]}}"));
        }
        WireScenePrimitive::Path {
            d,
            fill,
            stroke,
            stroke_width,
        } => {
            out.push_str(&format!(
                " primitive={{d={:?} fill={} stroke={} strokeWidth={}}}",
                d,
                fill,
                stroke.as_deref().unwrap_or("-"),
                stroke_width
                    .map(|value| format!("{value:.3}"))
                    .unwrap_or_else(|| "-".to_string())
            ));
        }
    }
    out.push('\n');
}

pub fn layout_scene_snapshot(scene: &LayoutScene) -> String {
    let wire = to_wire_scene(scene);
    let mut out = String::new();
    out.push_str(&format!("version={}\n", wire.version));
    out.push_str(&format!("metricsVersion={}\n", wire.metrics_version));
    if !wire.issues.is_empty() {
        out.push_str("issues:\n");
        for issue in &wire.issues {
            out.push_str(&format!("  - {}\n", issue));
        }
    }
    for page in &wire.pages {
        out.push_str(&format!(
            "page index={} widthPt={:.3} heightPt={:.3}\n",
            page.index, page.width_pt, page.height_pt
        ));
        if let Some(header) = &page.header {
            out.push_str("  header\n");
            for item in &header.items {
                append_wire_item(&mut out, item, "    ");
            }
            for composite in &header.composites {
                out.push_str(&format!(
                    "    composite id={} kind={} fragment={} childItemIds=[{}] label={} count={} startAnchorId={} endAnchorId={}\n",
                    composite.id,
                    composite.kind,
                    composite.fragment,
                    composite.child_item_ids.join(","),
                    composite.label.as_deref().unwrap_or("-"),
                    composite
                        .count
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "-".to_string()),
                    composite.start_anchor_id.as_deref().unwrap_or("-"),
                    composite.end_anchor_id.as_deref().unwrap_or("-")
                ));
            }
        }
        for system in &page.systems {
            let measure_ids = system
                .measures
                .iter()
                .map(|measure| measure.id.as_str())
                .collect::<Vec<_>>()
                .join(",");
            out.push_str(&format!(
                "  system id={} index={} pageIndex={} xPt={:.3} yPt={:.3} widthPt={:.3} heightPt={:.3} measureIds=[{measure_ids}]\n",
                system.id,
                system.index,
                system.page_index,
                system.x_pt,
                system.y_pt,
                system.width_pt,
                system.height_pt,
            ));
            for measure in &system.measures {
                out.push_str(&format!(
                    "    measure id={} index={} globalIndex={} systemId={} xPt={:.3} yPt={:.3} widthPt={:.3} heightPt={:.3}\n",
                    measure.id,
                    measure.index,
                    measure.global_index,
                    measure.system_id,
                    measure.x_pt,
                    measure.y_pt,
                    measure.width_pt,
                    measure.height_pt
                ));
            }
            for item in &system.items {
                append_wire_item(&mut out, item, "    ");
            }
            for composite in &system.composites {
                out.push_str(&format!(
                    "    composite id={} kind={} fragment={} childItemIds=[{}] label={} count={} startAnchorId={} endAnchorId={}\n",
                    composite.id,
                    composite.kind,
                    composite.fragment,
                    composite.child_item_ids.join(","),
                    composite.label.as_deref().unwrap_or("-"),
                    composite
                        .count
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "-".to_string()),
                    composite.start_anchor_id.as_deref().unwrap_or("-"),
                    composite.end_anchor_id.as_deref().unwrap_or("-")
                ));
            }
        }
    }
    out
}
