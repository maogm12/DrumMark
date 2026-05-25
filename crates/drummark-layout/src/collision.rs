//! Primitive rectangle obstacles and overlap scoring from resolved geometry.

use crate::metrics::{canonical_glyph_metric, GlyphRole};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct RectObstacle {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct LineObstacle {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub stroke_width: f32,
}

#[derive(Clone, Debug)]
pub(crate) struct GlyphObstacle {
    pub x: f32,
    pub y: f32,
    pub glyph_role: GlyphRole,
    pub font_size_pt: f32,
    pub anchor_item_id: Option<String>,
}

pub(crate) fn rect_obstacle_from_glyph(spec: GlyphObstacle) -> RectObstacle {
    let metric = canonical_glyph_metric(spec.glyph_role);
    let ss_to_pt = spec.font_size_pt / 4.0;
    RectObstacle {
        x1: spec.x + metric.bbox_sw_x_ss * ss_to_pt,
        y1: spec.y - metric.bbox_ne_y_ss * ss_to_pt,
        x2: spec.x + metric.bbox_ne_x_ss * ss_to_pt,
        y2: spec.y - metric.bbox_sw_y_ss * ss_to_pt,
    }
}

pub(crate) fn rect_obstacle_from_line(line: LineObstacle) -> RectObstacle {
    let pad = line.stroke_width * 0.5;
    RectObstacle {
        x1: line.x1.min(line.x2) - pad,
        y1: line.y1.min(line.y2) - pad,
        x2: line.x1.max(line.x2) + pad,
        y2: line.y1.max(line.y2) + pad,
    }
}

#[cfg(test)]
pub(crate) fn rect_obstacle_from_bounds(bounds: (f32, f32, f32, f32)) -> RectObstacle {
    RectObstacle {
        x1: bounds.0,
        y1: bounds.1,
        x2: bounds.0 + bounds.2,
        y2: bounds.1 + bounds.3,
    }
}

#[cfg(test)]
pub(crate) fn rects_intersect(a: RectObstacle, b: RectObstacle) -> bool {
    a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
}

pub(crate) fn rect_overlap_area(a: RectObstacle, b: RectObstacle) -> f32 {
    let overlap_x = (a.x2.min(b.x2) - a.x1.max(b.x1)).max(0.0);
    let overlap_y = (a.y2.min(b.y2) - a.y1.max(b.y1)).max(0.0);
    overlap_x * overlap_y
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glyph_and_line_obstacles_score_overlap() {
        let note = rect_obstacle_from_glyph(GlyphObstacle {
            x: 100.0,
            y: 200.0,
            glyph_role: GlyphRole::NoteheadBlack,
            font_size_pt: 30.0,
            anchor_item_id: None,
        });
        let stem = rect_obstacle_from_line(LineObstacle {
            x1: 104.0,
            y1: 180.0,
            x2: 104.0,
            y2: 200.0,
            stroke_width: 1.5,
        });
        assert!(rects_intersect(note, stem));
        assert!(rect_overlap_area(note, stem) > 0.0);

        let rest = rect_obstacle_from_glyph(GlyphObstacle {
            x: 140.0,
            y: 220.0,
            glyph_role: GlyphRole::RestEighth,
            font_size_pt: 30.0,
            anchor_item_id: None,
        });
        assert!(!rects_intersect(note, rest));
        assert_eq!(rect_overlap_area(note, rest), 0.0);
    }

    #[test]
    fn bounds_obstacle_matches_rectangle_conversion() {
        let obstacle = rect_obstacle_from_bounds((10.0, 20.0, 30.0, 12.0));
        assert_eq!(
            obstacle,
            RectObstacle {
                x1: 10.0,
                y1: 20.0,
                x2: 40.0,
                y2: 32.0
            }
        );
    }
}
