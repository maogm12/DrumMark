use crate::metrics::{canonical_glyph_metric, GlyphPoint, GlyphRole};
use crate::scene_builder::{GlyphItemSpec, PathItemSpec, SceneEmitSink};
use crate::NOTE_FLAG_FONT_SIZE_PT;

#[derive(Clone, Debug)]
pub(crate) struct BeamAnchor {
    pub(crate) x: f32,
    pub(crate) stem_x: f32,
    pub(crate) stem_tip_y: f32,
    pub(crate) voice: u8,
    pub(crate) group: u32,
    pub(crate) level: u8,
    pub(crate) up: bool,
    pub(crate) stem_item_id: String,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct BeamLineSegment {
    pub(crate) start_x: f32,
    pub(crate) end_x: f32,
}

pub(crate) fn render_beam_groups(
    sink: &mut SceneEmitSink<'_>,
    measure_id: &str,
    mut anchors: Vec<BeamAnchor>,
    _measure_width: f32,
    _staff_bottom: f32,
) {
    anchors.sort_by(|a, b| {
        a.voice
            .cmp(&b.voice)
            .then_with(|| a.group.cmp(&b.group))
            .then_with(|| a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal))
    });

    let mut current: Vec<BeamAnchor> = Vec::new();
    let mut flush_group = |group: &mut Vec<BeamAnchor>| {
        if group.is_empty() {
            return;
        }
        if group.len() == 1 {
            let anchor = &group[0];
            let flag_role = match (anchor.up, anchor.level) {
                (true, level) if level >= 3 => GlyphRole::Flag32ndUp,
                (false, level) if level >= 3 => GlyphRole::Flag32ndDown,
                (true, level) if level >= 2 => GlyphRole::Flag16thUp,
                (false, level) if level >= 2 => GlyphRole::Flag16thDown,
                (true, _) => GlyphRole::Flag8thUp,
                (false, _) => GlyphRole::Flag8thDown,
            };
            let flag_metric = canonical_glyph_metric(flag_role);
            let smufl_ss = NOTE_FLAG_FONT_SIZE_PT / 4.0;
            let flag_anchor =
                flag_metric
                    .stem_anchor_for_direction(anchor.up)
                    .unwrap_or(GlyphPoint {
                        x_ss: 0.0,
                        y_ss: 0.0,
                    });
            let flag_x = anchor.stem_x - flag_anchor.x_ss * smufl_ss;
            let flag_y = anchor.stem_tip_y + flag_anchor.y_ss * smufl_ss;
            let flag_id = sink.push_glyph_item(GlyphItemSpec {
                measure_id: Some(measure_id),
                role: "flag",
                x: flag_x,
                y: flag_y,
                glyph_role: flag_role,
                font_family: "Bravura",
                font_size_pt: NOTE_FLAG_FONT_SIZE_PT,
                fill: "#333",
            });
            sink.set_anchor_item_id(&flag_id, Some(anchor.stem_item_id.clone()));
            group.clear();
            return;
        }

        let first = group.first().unwrap().clone();
        let last = group.last().unwrap().clone();
        let primary_y = first.stem_tip_y;
        let raw_end_y = last.stem_tip_y;
        let beam_slope = best_beam_slope(first.stem_x, primary_y, last.stem_x, raw_end_y);
        let end_y = primary_y + beam_slope * (last.stem_x - first.stem_x);

        // After the final beam slope is chosen, every non-leading stem must terminate on that beam.
        if group.len() > 1 {
            let x1 = first.stem_x;
            let xn = last.stem_x;
            let dx = xn - x1;
            let dy = end_y - primary_y;
            for anchor in &group[1..] {
                let t = if dx.abs() > 0.001 {
                    (anchor.stem_x - x1) / dx
                } else {
                    1.0
                };
                let target_tip_y = primary_y + dy * t;
                sink.adjust_stem_tip(&anchor.stem_item_id, target_tip_y, anchor.up);
            }
        }

        let beam_id = sink.push_path_item(PathItemSpec {
            measure_id: Some(measure_id),
            role: "beam",
            d: beam_path_d(first.stem_x, primary_y, last.stem_x, end_y, first.up, 4.0),
            fill: "#333",
            stroke: None,
            stroke_width: None,
        });
        sink.set_anchor_item_id(&beam_id, Some(first.stem_item_id.clone()));
        let max_level = group.iter().map(|anchor| anchor.level).max().unwrap_or(1);
        for level in 2..=max_level {
            for segment in beam_line_segments_for_level(group, level) {
                let level_offset = if first.up {
                    6.0 * (level - 1) as f32
                } else {
                    -6.0 * (level - 1) as f32
                };
                let start_y =
                    beam_y_at_x(segment.start_x, first.stem_x, primary_y, last.stem_x, end_y)
                        + level_offset;
                let segment_end_y =
                    beam_y_at_x(segment.end_x, first.stem_x, primary_y, last.stem_x, end_y)
                        + level_offset;
                let secondary_id = sink.push_path_item(PathItemSpec {
                    measure_id: Some(measure_id),
                    role: "beam-secondary",
                    d: beam_path_d(
                        segment.start_x,
                        start_y,
                        segment.end_x,
                        segment_end_y,
                        first.up,
                        4.0,
                    ),
                    fill: "#333",
                    stroke: None,
                    stroke_width: None,
                });
                sink.set_anchor_item_id(&secondary_id, Some(first.stem_item_id.clone()));
            }
        }
        group.clear();
    };

    for anchor in anchors {
        let starts_new_group = current.is_empty()
            || current
                .last()
                .map(|prev| {
                    prev.voice != anchor.voice || prev.up != anchor.up || prev.group != anchor.group
                })
                .unwrap_or(false);
        if starts_new_group {
            if !current.is_empty() {
                flush_group(&mut current);
            }
            current.push(anchor.clone());
        } else {
            current.push(anchor.clone());
        }
    }
    flush_group(&mut current);
}

const BEAM_MAX_SLOPE: f32 = 0.25;
const BEAM_MIN_SLOPE: f32 = -0.25;
const BEAM_SLOPE_ITERATIONS: u32 = 20;
const BEAM_SLOPE_COST: f32 = 100.0;

/// Finds the best beam slope by trying candidates in [BEAM_MIN_SLOPE, BEAM_MAX_SLOPE].
/// Cost is a combination of stem extension and distance from the ideal (half-natural) slope.
/// Matches VexFlow's `Beam.calculateSlope()`.
fn best_beam_slope(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1;
    if dx.abs() < 0.001 {
        return 0.0;
    }
    let initial_slope = (y2 - y1) / dx;
    let ideal_slope = initial_slope * 0.5;
    let increment = (BEAM_MAX_SLOPE - BEAM_MIN_SLOPE) / BEAM_SLOPE_ITERATIONS as f32;

    let mut best_slope = initial_slope.clamp(BEAM_MIN_SLOPE, BEAM_MAX_SLOPE);
    let mut min_cost = f32::MAX;

    let mut slope = BEAM_MIN_SLOPE;
    for _ in 0..=BEAM_SLOPE_ITERATIONS {
        let distance_from_ideal = (ideal_slope - slope).abs();
        let cost = BEAM_SLOPE_COST * distance_from_ideal;
        if cost < min_cost {
            min_cost = cost;
            best_slope = slope;
        }
        slope += increment;
    }

    best_slope
}

fn beam_y_at_x(x: f32, x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1;
    if dx.abs() < 0.001 {
        return y1;
    }
    y1 + (y2 - y1) * ((x - x1) / dx)
}

fn beam_line_segments_for_level(group: &[BeamAnchor], level: u8) -> Vec<BeamLineSegment> {
    const PARTIAL_BEAM_LENGTH_PT: f32 = 10.0;

    let mut segments = Vec::new();
    let mut active_start: Option<f32> = None;

    for (index, anchor) in group.iter().enumerate() {
        let gets_beam = anchor.level >= level;
        let next_gets_beam = group
            .get(index + 1)
            .map(|next| next.level >= level)
            .unwrap_or(false);

        if gets_beam {
            if let Some(start_x) = active_start {
                segments.push(BeamLineSegment {
                    start_x,
                    end_x: anchor.stem_x,
                });
                active_start = next_gets_beam.then_some(anchor.stem_x);
            } else if next_gets_beam {
                active_start = Some(anchor.stem_x);
            } else {
                // Isolated beamable note: draw a partial stub.
                // Direction: extends toward previous note in the beam group
                // (left if not first, right if first).
                let direction: f32 = if index > 0 { -1.0 } else { 1.0 };
                segments.push(BeamLineSegment {
                    start_x: anchor.stem_x,
                    end_x: anchor.stem_x + PARTIAL_BEAM_LENGTH_PT * direction,
                });
            }
        } else {
            active_start = None;
        }
    }

    segments
}

fn beam_path_d(x1: f32, y1: f32, x2: f32, y2: f32, up: bool, thickness: f32) -> String {
    let offset = if up { thickness } else { -thickness };
    format!(
        "M {:.3} {:.3} L {:.3} {:.3} L {:.3} {:.3} L {:.3} {:.3} Z",
        x1,
        y1,
        x2,
        y2,
        x2,
        y2 + offset,
        x1,
        y1 + offset,
    )
}
