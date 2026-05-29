//! Scene-item bounds, translation, and geometry helpers.
//!
//! ## Bounds consumer matrix
//!
//! | Consumer | API | Missing/unsupported bounds |
//! | --- | --- | --- |
//! | Pagination / header-system boxes | [`item_bounds`] (forgiving) | Skips unsupported items |
//! | Final validation | [`scene_item_bounds`] (strict) | Reports diagnostics |
//! | Skyline sampling | [`item_bounds`] (forgiving) | Skips item as obstacle |
//! | Structural stacking | [`item_bounds`] + [`bounding_box_for_ids`] | Skips empty groups |
//! | Stem-tip adjustment | item-id mutation in `scene_builder` | No-op when id missing |
//! | Item translation | [`translate_item_ids`] / [`translate_scene_item`] | Skips unknown ids |
//! | Snapshot / wire serialization | none | No bounds dependency |

use crate::metrics::{canonical_glyph_metric, canonical_text_metric, canonical_text_width};
use crate::{SceneItem, ScenePrimitive};

#[cfg(test)]
use crate::{
    GlyphRole, GlyphRun, LineSegment, PathShape, Polyline, RectShape, SceneItemKind, TextRole,
    TextRun,
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct SceneItemBounds {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl SceneItemBounds {
    pub(crate) fn as_tuple(self) -> (f32, f32, f32, f32) {
        (self.x, self.y, self.width, self.height)
    }
}

pub(crate) fn bounds_for_items(items: &[SceneItem], staff_space_pt: f32) -> Result<Option<SceneItemBounds>, String> {
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    let mut found = false;
    for item in items {
        let bounds = scene_item_bounds(item, staff_space_pt)?;
        min_x = min_x.min(bounds.x);
        min_y = min_y.min(bounds.y);
        max_x = max_x.max(bounds.x + bounds.width);
        max_y = max_y.max(bounds.y + bounds.height);
        found = true;
    }
    Ok(found.then_some(SceneItemBounds {
        x: min_x,
        y: min_y,
        width: max_x - min_x,
        height: max_y - min_y,
    }))
}

pub(crate) fn bounding_box_for_ids(
    items: &[SceneItem],
    item_index: &std::collections::HashMap<String, usize>,
    ids: &[String],
    staff_space_pt: f32,
) -> Option<(f32, f32, f32, f32)> {
    let bounds = ids
        .iter()
        .filter_map(|id| {
            item_index
                .get(id)
                .and_then(|index| item_bounds(&items[*index], staff_space_pt))
        })
        .collect::<Vec<_>>();
    if bounds.is_empty() {
        return None;
    }
    let min_x = bounds
        .iter()
        .map(|(x, _, _, _)| *x)
        .fold(f32::INFINITY, f32::min);
    let min_y = bounds
        .iter()
        .map(|(_, y, _, _)| *y)
        .fold(f32::INFINITY, f32::min);
    let max_x = bounds
        .iter()
        .map(|(x, _, width, _)| x + width)
        .fold(f32::NEG_INFINITY, f32::max);
    let max_y = bounds
        .iter()
        .map(|(_, y, _, height)| y + height)
        .fold(f32::NEG_INFINITY, f32::max);
    Some((min_x, min_y, max_x - min_x, max_y - min_y))
}

/// Forgiving bounds for skyline, stacking, collision sampling, and layout heuristics.
pub(crate) fn item_bounds(item: &SceneItem, staff_space_pt: f32) -> Option<(f32, f32, f32, f32)> {
    match &item.primitive {
        ScenePrimitive::TextRun(text) => {
            let metric = canonical_text_metric(text.text_role, staff_space_pt);
            let width = canonical_text_width(text.text_role, &text.text, staff_space_pt);
            let x = match text.text_anchor.as_deref() {
                Some("middle") => text.x_pt - width * 0.5,
                Some("end") => text.x_pt - width,
                _ => text.x_pt,
            };
            Some((
                x,
                text.y_pt - metric.ascent_pt,
                width,
                metric.line_height_pt,
            ))
        }
        ScenePrimitive::LineSegment(line) => Some((
            line.x1_pt.min(line.x2_pt),
            line.y1_pt.min(line.y2_pt),
            (line.x2_pt - line.x1_pt).abs().max(line.stroke_width),
            (line.y2_pt - line.y1_pt).abs().max(line.stroke_width),
        )),
        ScenePrimitive::Rect(rect) => Some((rect.x_pt, rect.y_pt, rect.width_pt, rect.height_pt)),
        ScenePrimitive::Polyline(polyline) => {
            let min_x = polyline
                .points_pt
                .iter()
                .map(|(x, _)| *x)
                .fold(f32::INFINITY, f32::min);
            let min_y = polyline
                .points_pt
                .iter()
                .map(|(_, y)| *y)
                .fold(f32::INFINITY, f32::min);
            let max_x = polyline
                .points_pt
                .iter()
                .map(|(x, _)| *x)
                .fold(f32::NEG_INFINITY, f32::max);
            let max_y = polyline
                .points_pt
                .iter()
                .map(|(_, y)| *y)
                .fold(f32::NEG_INFINITY, f32::max);
            Some((min_x, min_y, max_x - min_x, max_y - min_y))
        }
        ScenePrimitive::Path(path) => path_bounds(&path.d).map(SceneItemBounds::as_tuple),
        ScenePrimitive::GlyphRun(glyph) => {
            let metric = canonical_glyph_metric(glyph.glyph_role);
            let ss_to_pt = glyph.font_size_pt / 4.0;
            Some((
                glyph.x_pt + metric.bbox_sw_x_ss * ss_to_pt,
                glyph.y_pt - metric.bbox_ne_y_ss * ss_to_pt,
                metric.bbox_width_ss() * ss_to_pt,
                metric.bbox_height_ss() * ss_to_pt,
            ))
        }
    }
}

/// Strict bounds for validation and pagination assembly.
pub(crate) fn scene_item_bounds(item: &SceneItem, staff_space_pt: f32) -> Result<SceneItemBounds, String> {
    match &item.primitive {
        ScenePrimitive::TextRun(text) => {
            let metric = canonical_text_metric(text.text_role, staff_space_pt);
            let width = canonical_text_width(text.text_role, &text.text, staff_space_pt);
            let x = match text.text_anchor.as_deref() {
                Some("middle") => text.x_pt - width * 0.5,
                Some("end") => text.x_pt - width,
                _ => text.x_pt,
            };
            Ok(SceneItemBounds {
                x,
                y: text.y_pt - metric.ascent_pt,
                width,
                height: metric.line_height_pt,
            })
        }
        ScenePrimitive::LineSegment(line) => {
            let pad = line.stroke_width * 0.5;
            let min_x = line.x1_pt.min(line.x2_pt) - pad;
            let min_y = line.y1_pt.min(line.y2_pt) - pad;
            let max_x = line.x1_pt.max(line.x2_pt) + pad;
            let max_y = line.y1_pt.max(line.y2_pt) + pad;
            Ok(SceneItemBounds {
                x: min_x,
                y: min_y,
                width: max_x - min_x,
                height: max_y - min_y,
            })
        }
        ScenePrimitive::Rect(rect) => {
            let pad = if rect.stroke.is_some() {
                rect.stroke_width.unwrap_or(1.0) * 0.5
            } else {
                0.0
            };
            Ok(SceneItemBounds {
                x: rect.x_pt - pad,
                y: rect.y_pt - pad,
                width: rect.width_pt + pad * 2.0,
                height: rect.height_pt + pad * 2.0,
            })
        }
        ScenePrimitive::Polyline(polyline) => {
            if polyline.points_pt.is_empty() {
                return Err(format!("SceneItem {} has an empty polyline", item.id));
            }
            let min_x = polyline
                .points_pt
                .iter()
                .map(|(x, _)| *x)
                .fold(f32::INFINITY, f32::min);
            let min_y = polyline
                .points_pt
                .iter()
                .map(|(_, y)| *y)
                .fold(f32::INFINITY, f32::min);
            let max_x = polyline
                .points_pt
                .iter()
                .map(|(x, _)| *x)
                .fold(f32::NEG_INFINITY, f32::max);
            let max_y = polyline
                .points_pt
                .iter()
                .map(|(_, y)| *y)
                .fold(f32::NEG_INFINITY, f32::max);
            Ok(SceneItemBounds {
                x: min_x,
                y: min_y,
                width: max_x - min_x,
                height: max_y - min_y,
            })
        }
        ScenePrimitive::Path(path) => {
            let mut bounds = path_bounds(&path.d)
                .ok_or_else(|| format!("SceneItem {} has an unsupported path", item.id))?;
            if path.stroke.is_some() {
                let pad = path.stroke_width.unwrap_or(1.0) * 0.5;
                bounds.x -= pad;
                bounds.y -= pad;
                bounds.width += pad * 2.0;
                bounds.height += pad * 2.0;
            }
            Ok(bounds)
        }
        ScenePrimitive::GlyphRun(glyph) => {
            let metric = canonical_glyph_metric(glyph.glyph_role);
            let ss_to_pt = glyph.font_size_pt / 4.0;
            Ok(SceneItemBounds {
                x: glyph.x_pt + metric.bbox_sw_x_ss * ss_to_pt,
                y: glyph.y_pt - metric.bbox_ne_y_ss * ss_to_pt,
                width: metric.bbox_width_ss() * ss_to_pt,
                height: metric.bbox_height_ss() * ss_to_pt,
            })
        }
    }
}

pub(crate) fn translate_item_ids(
    items: &mut [SceneItem],
    item_index: &std::collections::HashMap<String, usize>,
    ids: &[String],
    dy: f32,
) {
    for id in ids {
        if let Some(index) = item_index.get(id) {
            translate_item(&mut items[*index], dy);
        }
    }
}

pub(crate) fn translate_item(item: &mut SceneItem, dy: f32) {
    match &mut item.primitive {
        ScenePrimitive::TextRun(text) => text.y_pt += dy,
        ScenePrimitive::LineSegment(line) => {
            line.y1_pt += dy;
            line.y2_pt += dy;
        }
        ScenePrimitive::Rect(rect) => rect.y_pt += dy,
        ScenePrimitive::Polyline(polyline) => {
            for (_, y) in &mut polyline.points_pt {
                *y += dy;
            }
        }
        ScenePrimitive::Path(path) => translate_path_y(&mut path.d, dy),
        ScenePrimitive::GlyphRun(glyph) => glyph.y_pt += dy,
    }
}

pub(crate) fn translate_scene_item(item: &mut SceneItem, dx: f32, dy: f32) {
    match &mut item.primitive {
        ScenePrimitive::TextRun(text) => {
            text.x_pt += dx;
            text.y_pt += dy;
        }
        ScenePrimitive::LineSegment(line) => {
            line.x1_pt += dx;
            line.y1_pt += dy;
            line.x2_pt += dx;
            line.y2_pt += dy;
        }
        ScenePrimitive::Rect(rect) => {
            rect.x_pt += dx;
            rect.y_pt += dy;
        }
        ScenePrimitive::Polyline(polyline) => {
            for (x, y) in &mut polyline.points_pt {
                *x += dx;
                *y += dy;
            }
        }
        ScenePrimitive::Path(path) => translate_path(&mut path.d, dx, dy),
        ScenePrimitive::GlyphRun(glyph) => {
            glyph.x_pt += dx;
            glyph.y_pt += dy;
        }
    }
}

pub(crate) fn translate_path(d: &mut String, dx: f32, dy: f32) {
    let tokens = d.split_whitespace().collect::<Vec<_>>();
    if tokens.is_empty() {
        return;
    }
    let mut translated = Vec::with_capacity(tokens.len());
    let mut coordinate_index = 0usize;
    for token in tokens {
        if let Ok(value) = token.parse::<f32>() {
            let adjusted = if coordinate_index.is_multiple_of(2) {
                value + dx
            } else {
                value + dy
            };
            translated.push(format!("{adjusted:.3}"));
            coordinate_index += 1;
        } else {
            translated.push(token.to_string());
        }
    }
    *d = translated.join(" ");
}

pub(crate) fn path_bounds(d: &str) -> Option<SceneItemBounds> {
    let numbers = d
        .split(|ch: char| !(ch.is_ascii_digit() || ch == '.' || ch == '-'))
        .filter(|segment| !segment.is_empty())
        .filter_map(|segment| segment.parse::<f32>().ok())
        .collect::<Vec<_>>();
    if numbers.len() < 2 {
        return None;
    }
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for pair in numbers.chunks(2) {
        if let [x, y] = pair {
            min_x = min_x.min(*x);
            min_y = min_y.min(*y);
            max_x = max_x.max(*x);
            max_y = max_y.max(*y);
        }
    }
    Some(SceneItemBounds {
        x: min_x,
        y: min_y,
        width: max_x - min_x,
        height: max_y - min_y,
    })
}

pub(crate) fn translate_path_y(d: &mut String, dy: f32) {
    let tokens = d.split_whitespace().collect::<Vec<_>>();
    if tokens.is_empty() {
        return;
    }
    let mut translated = Vec::with_capacity(tokens.len());
    let mut coordinate_index = 0usize;
    for token in tokens {
        if let Ok(value) = token.parse::<f32>() {
            let adjusted = if coordinate_index % 2 == 1 {
                value + dy
            } else {
                value
            };
            translated.push(format!("{adjusted:.3}"));
            coordinate_index += 1;
        } else {
            translated.push(token.to_string());
        }
    }
    *d = translated.join(" ");
}

#[cfg(test)]
mod tests {
    use super::*;

    const SS: f32 = 10.0;

    #[test]
    fn test_scene_item_bounds_cover_emitted_primitive_kinds() {
        let text = SceneItem {
            id: "text".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "title".into(),
            kind: SceneItemKind::TextRun,
            z_index: 0,
            primitive: ScenePrimitive::TextRun(TextRun {
                x_pt: 100.0,
                y_pt: 50.0,
                text_role: TextRole::Title,
                text: "AB".into(),
                font_family: "Academico".into(),
                font_size_pt: 24.0,
                fill: "#333".into(),
                text_anchor: Some("middle".into()),
                font_weight: None,
                font_style: None,
                accessible_label: None,
            }),
        };
        let text_bounds = scene_item_bounds(&text, SS).unwrap();
        assert_eq!(text_bounds.x, 91.75);
        assert_eq!(text_bounds.y, 36.5);
        assert_eq!(text_bounds.height, 21.0);

        let glyph = SceneItem {
            id: "glyph".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "notehead".into(),
            kind: SceneItemKind::GlyphRun,
            z_index: 0,
            primitive: ScenePrimitive::GlyphRun(GlyphRun {
                x_pt: 10.0,
                y_pt: 20.0,
                glyph_role: GlyphRole::NoteheadBlack,
                glyph_count: 1,
                smufl_codepoint: Some(0xE0A4),
                font_family: "Bravura".into(),
                font_size_pt: 20.0,
                fill: "#333".into(),
            }),
        };
        let glyph_bounds = scene_item_bounds(&glyph, SS).unwrap();
        assert_eq!(glyph_bounds.x, 10.0);
        assert_eq!(glyph_bounds.y, 17.5);
        assert!((glyph_bounds.width - 5.9).abs() < 0.001);

        let line = SceneItem {
            id: "line".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "staff-line".into(),
            kind: SceneItemKind::LineSegment,
            z_index: 0,
            primitive: ScenePrimitive::LineSegment(LineSegment {
                x1_pt: 10.0,
                y1_pt: 20.0,
                x2_pt: 30.0,
                y2_pt: 20.0,
                stroke: "#333".into(),
                stroke_width: 2.0,
                stroke_line_cap: None,
            }),
        };
        assert_eq!(
            scene_item_bounds(&line, SS).unwrap(),
            SceneItemBounds {
                x: 9.0,
                y: 19.0,
                width: 22.0,
                height: 2.0
            }
        );

        let rect = SceneItem {
            id: "rect".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "beam".into(),
            kind: SceneItemKind::Rect,
            z_index: 0,
            primitive: ScenePrimitive::Rect(RectShape {
                x_pt: 4.0,
                y_pt: 5.0,
                width_pt: 10.0,
                height_pt: 3.0,
                fill: "#333".into(),
                stroke: Some("#333".into()),
                stroke_width: Some(2.0),
            }),
        };
        assert_eq!(
            scene_item_bounds(&rect, SS).unwrap(),
            SceneItemBounds {
                x: 3.0,
                y: 4.0,
                width: 12.0,
                height: 5.0
            }
        );

        let polyline = SceneItem {
            id: "polyline".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "shape".into(),
            kind: SceneItemKind::Polyline,
            z_index: 0,
            primitive: ScenePrimitive::Polyline(Polyline {
                points_pt: vec![(5.0, 12.0), (20.0, -2.0), (7.0, 4.0)],
            }),
        };
        assert_eq!(
            scene_item_bounds(&polyline, SS).unwrap(),
            SceneItemBounds {
                x: 5.0,
                y: -2.0,
                width: 15.0,
                height: 14.0
            }
        );

        let path = SceneItem {
            id: "path".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "beam".into(),
            kind: SceneItemKind::Path,
            z_index: 0,
            primitive: ScenePrimitive::Path(PathShape {
                d: "M 10 10 L 30 12 L 28 16 L 8 14 Z".into(),
                fill: "#333".into(),
                stroke: Some("#333".into()),
                stroke_width: Some(2.0),
            }),
        };
        assert_eq!(
            scene_item_bounds(&path, SS).unwrap(),
            SceneItemBounds {
                x: 7.0,
                y: 9.0,
                width: 24.0,
                height: 8.0
            }
        );

        let empty_polyline = SceneItem {
            id: "empty".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "shape".into(),
            kind: SceneItemKind::Polyline,
            z_index: 0,
            primitive: ScenePrimitive::Polyline(Polyline { points_pt: vec![] }),
        };
        assert!(scene_item_bounds(&empty_polyline, SS).is_err());
    }

    #[test]
    fn forgiving_bounds_skip_unsupported_path_without_error() {
        let path = SceneItem {
            id: "path".into(),
            measure_id: None,
            anchor_item_id: None,
            measure_local_fraction: None,
            role: "beam".into(),
            kind: SceneItemKind::Path,
            z_index: 0,
            primitive: ScenePrimitive::Path(PathShape {
                d: "invalid".into(),
                fill: "#333".into(),
                stroke: None,
                stroke_width: None,
            }),
        };
        assert!(item_bounds(&path, SS).is_none());
        assert!(scene_item_bounds(&path, SS).is_err());
    }
}
