//! Planning/layout geometry helpers extracted from lib.rs.

use super::RestPlacement;
use crate::collision::{rect_obstacle_from_glyph, GlyphObstacle, RectObstacle};
use crate::compat_planning::SlotMapper;
use crate::display::DisplayMeasure;
use crate::fraction::*;
use crate::*;

#[derive(Debug, Clone)]
pub(crate) struct GroupGeometry {
    end_fraction: Fraction,
    width_pt: f32,
    /// Metric-time X fraction (0..1) for each segment boundary in the group.
    /// When the group has multiple attacks, spans from first to last attack fill the width.
    segment_offsets: Vec<f32>,
    segment_boundaries: Vec<Fraction>,
}

#[derive(Debug, Clone)]
pub(crate) struct MeasureGeometry {
    inner_left_pt: f32,
    inner_width_pt: f32,
    /// Inset content lane inside `[inner_left, inner_right]` with equal side gaps.
    content_left_pt: f32,
    content_width_pt: f32,
    raw_anchor_first_x: f32,
    raw_anchor_last_x: f32,
    groups: Vec<GroupGeometry>,
}

impl MeasureGeometry {
    fn raw_x_for_fraction(&self, fraction: Fraction) -> f32 {
        if self.groups.is_empty() || self.inner_width_pt <= 0.0 {
            return self.inner_left_pt;
        }

        let mut group_start_x = self.inner_left_pt;

        for group in &self.groups {
            if compare_fractions(fraction, group.end_fraction) == std::cmp::Ordering::Less {
                if group.segment_boundaries.is_empty() {
                    return group_start_x;
                }
                let seg = match group
                    .segment_boundaries
                    .binary_search_by(|boundary| compare_fractions(*boundary, fraction))
                {
                    Ok(index) => index,
                    Err(index) => index.saturating_sub(1),
                };
                let offset_frac = group.segment_offsets[seg.min(group.segment_offsets.len() - 1)];
                return group_start_x + offset_frac * group.width_pt;
            }
            group_start_x += group.width_pt;
        }

        self.inner_left_pt + self.inner_width_pt
    }

    pub(crate) fn x_for_fraction(&self, _header: &RenderHeader, fraction: Fraction) -> f32 {
        let raw = self.raw_x_for_fraction(fraction);
        let raw_span = self.raw_anchor_last_x - self.raw_anchor_first_x;
        if raw_span <= 0.01 {
            return self.content_left_pt;
        }
        let progress = (raw - self.raw_anchor_first_x) / raw_span;
        self.content_left_pt + progress * self.content_width_pt
    }
}

/// Volta ending label size (Academico), scaled from staff spacing (~12pt at 7.5ss).
pub(crate) fn volta_text_size_pt(staff_space_pt: f32) -> f32 {
    staff_space_pt * 1.6
}

pub(crate) fn volta_line_height_pt(staff_space_pt: f32) -> f32 {
    staff_space_pt * 2.0
}

/// Gap between the volta bracket line and the label baseline.
pub(crate) fn volta_label_baseline_gap_pt(staff_space_pt: f32) -> f32 {
    staff_space_pt * 0.4
}

pub(crate) fn volta_skyline_gap_pt(staff_space_pt: f32) -> f32 {
    staff_space_pt * 0.8
}

pub(crate) fn clef_width_pt(staff_space_pt: f32) -> f32 {
    canonical_text_metric(TextRole::PercussionClef, staff_space_pt).average_advance_pt
}

pub(crate) fn time_signature_width_pt(staff_space_pt: f32) -> f32 {
    canonical_text_metric(TextRole::TimeSignatureDigit, staff_space_pt).average_advance_pt
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct PreambleLayout {
    pub(crate) clef_x_pt: Option<f32>,
    pub(crate) time_signature_x_pt: Option<f32>,
    pub(crate) visible_end_x_pt: f32,
    pub(crate) content_start_x_pt: f32,
    pub(crate) reservation_width_pt: f32,
}

pub(crate) fn preamble_layout(
    page_margin_left: f32,
    is_first_system: bool,
    opts: &LayoutOptions,
) -> PreambleLayout {
    let staff_space_pt = opts.staff_space_pt;
    let glyph_origin_x_pt = page_margin_left + SYSTEM_PREAMBLE_SIDE_GAP_PT;
    let mut next_x = glyph_origin_x_pt;
    let mut visible_end_x_pt = page_margin_left;
    let mut clef_x_pt = None;
    let mut time_signature_x_pt = None;

    if !opts.hide_clef {
        let x = next_x;
        let end_x = x + clef_width_pt(staff_space_pt);
        clef_x_pt = Some(x);
        visible_end_x_pt = end_x;
        next_x = end_x + SYSTEM_PREAMBLE_SIDE_GAP_PT;
    }

    if is_first_system && !opts.hide_time_signature {
        let x = next_x;
        let end_x = x + time_signature_width_pt(staff_space_pt);
        time_signature_x_pt = Some(x);
        visible_end_x_pt = end_x;
    }

    let content_start_x_pt = if clef_x_pt.is_none() && time_signature_x_pt.is_none() {
        glyph_origin_x_pt
    } else {
        visible_end_x_pt + SYSTEM_PREAMBLE_SIDE_GAP_PT
    };

    PreambleLayout {
        clef_x_pt,
        time_signature_x_pt,
        visible_end_x_pt,
        content_start_x_pt,
        reservation_width_pt: content_start_x_pt - page_margin_left,
    }
}

pub(crate) fn system_content_preamble_width(is_first_system: bool, opts: &LayoutOptions) -> f32 {
    preamble_layout(opts.left_margin_pt, is_first_system, opts).reservation_width_pt
}

pub(crate) fn system_preamble_shows_clef_or_time_signature(
    is_first_system: bool,
    opts: &LayoutOptions,
) -> bool {
    !opts.hide_clef || (is_first_system && !opts.hide_time_signature)
}

pub(crate) fn skip_system_opening_barline(
    is_first_system: bool,
    barline: Option<&str>,
    opts: &LayoutOptions,
) -> bool {
    is_start_repeat_barline(barline)
        && !system_preamble_shows_clef_or_time_signature(is_first_system, opts)
}

pub(crate) fn opening_barline_reserved_width(
    is_first_system: bool,
    barline: Option<&str>,
    opts: &LayoutOptions,
) -> f32 {
    if skip_system_opening_barline(is_first_system, barline, opts) {
        0.0
    } else {
        OPENING_BARLINE_THICKNESS_PT
    }
}

pub(crate) fn system_start_reserved_width(
    is_first_system: bool,
    opts: &LayoutOptions,
    first_measure_barline: Option<&str>,
) -> f32 {
    opening_barline_reserved_width(is_first_system, first_measure_barline, opts)
        + system_content_preamble_width(is_first_system, opts)
}

pub(crate) fn is_start_repeat_barline(barline: Option<&str>) -> bool {
    matches!(barline, Some("repeat-start") | Some("repeat-both"))
}

pub(crate) fn is_end_repeat_barline(barline: Option<&str>) -> bool {
    matches!(barline, Some("repeat-end") | Some("repeat-both"))
}

pub(crate) fn start_repeat_reserved_width(staff_space_pt: f32) -> f32 {
    repeat_barline_rendered_width(GlyphRole::RepeatLeft, staff_space_pt) + START_REPEAT_TRAILING_GAP_PT
}

pub(crate) fn end_repeat_reserved_width(staff_space_pt: f32) -> f32 {
    repeat_barline_rendered_width(GlyphRole::RepeatRight, staff_space_pt) + START_REPEAT_TRAILING_GAP_PT
}

pub(crate) fn first_measure_start_repeat_left_pad(
    is_first_system: bool,
    opts: &LayoutOptions,
) -> f32 {
    if skip_system_opening_barline(is_first_system, Some("repeat-start"), opts) {
        return start_repeat_reserved_width(opts.staff_space_pt);
    }
    if is_first_system {
        system_start_reserved_width(true, opts, Some("repeat-start"))
            + start_repeat_reserved_width(opts.staff_space_pt)
            - FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT
    } else {
        system_start_reserved_width(false, opts, Some("repeat-start"))
            + start_repeat_reserved_width(opts.staff_space_pt)
    }
}

pub(crate) fn first_measure_start_repeat_x(
    measure_x: f32,
    page_margin_left: f32,
    is_first_system: bool,
    opts: &LayoutOptions,
) -> f32 {
    if skip_system_opening_barline(is_first_system, Some("repeat-start"), opts) {
        return measure_x;
    }
    let min_x = preamble_layout(page_margin_left, is_first_system, opts).content_start_x_pt;
    if is_first_system {
        let pulled = measure_x
            + system_start_reserved_width(is_first_system, opts, Some("repeat-start"))
            - FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT;
        pulled.max(min_x)
    } else {
        min_x
    }
}

pub(crate) fn start_repeat_vertical_origin(top: f32, bottom: f32, staff_space_pt: f32) -> f32 {
    let height_pt = repeat_barline_rendered_height(GlyphRole::RepeatLeft, staff_space_pt);
    top + (bottom - top - height_pt) * 0.5 + height_pt
}

pub(crate) fn repeat_barline_rendered_width(role: GlyphRole, staff_space_pt: f32) -> f32 {
    rendered_glyph_width(role, notation_render_font_pt(staff_space_pt))
}

pub(crate) fn repeat_barline_rendered_height(role: GlyphRole, staff_space_pt: f32) -> f32 {
    rendered_glyph_height(role, notation_render_font_pt(staff_space_pt))
}

pub(crate) fn rendered_glyph_width(role: GlyphRole, font_size_pt: f32) -> f32 {
    canonical_glyph_metric(role).width_pt(font_size_pt) * SVG_POINT_TO_USER_UNIT
}

pub(crate) fn glyph_bbox_center_x_offset(metric: CanonicalGlyphMetric, font_size_pt: f32) -> f32 {
    metric.bbox_center_x_ss() * (font_size_pt / 4.0) * SVG_POINT_TO_USER_UNIT
}

pub(crate) fn glyph_bbox_center_y_offset(metric: CanonicalGlyphMetric, font_size_pt: f32) -> f32 {
    metric.bbox_center_y_ss() * (font_size_pt / 4.0) * SVG_POINT_TO_USER_UNIT
}

pub(crate) fn rendered_glyph_height(role: GlyphRole, font_size_pt: f32) -> f32 {
    let metric = canonical_glyph_metric(role);
    metric.bbox_height_ss() * (font_size_pt / 4.0) * SVG_POINT_TO_USER_UNIT
}

pub(crate) fn rect_obstacle_from_rest_placement(placement: RestPlacement) -> RectObstacle {
    rect_obstacle_from_glyph(GlyphObstacle {
        x: placement.x,
        y: placement.y,
        glyph_role: placement.role,
        font_size_pt: placement.font_size_pt,
        anchor_item_id: None,
    })
}

pub(crate) fn measure_left_pad(
    measure_index_in_system: usize,
    is_first_system: bool,
    barline: Option<&str>,
    opts: &LayoutOptions,
) -> f32 {
    if measure_index_in_system == 0 {
        if is_start_repeat_barline(barline) {
            first_measure_start_repeat_left_pad(is_first_system, opts)
        } else {
            system_start_reserved_width(is_first_system, opts, barline)
        }
    } else if is_start_repeat_barline(barline) {
        start_repeat_reserved_width(opts.staff_space_pt)
    } else {
        NON_INITIAL_MEASURE_LEFT_PAD_PT
    }
}

pub(crate) fn measure_right_pad(barline: Option<&str>, staff_space_pt: f32) -> f32 {
    if is_end_repeat_barline(barline) {
        end_repeat_reserved_width(staff_space_pt)
    } else {
        match barline {
            Some("double") | Some("final") => {
                MEASURE_RIGHT_PAD_PT + COMPLEX_BARLINE_TRAILING_CONTENT_GAP_PT
            }
            _ => MEASURE_RIGHT_PAD_PT,
        }
    }
}

/// Right edge of clef/time-signature glyphs drawn at the system margin (see scene.rs).
pub(crate) fn compact_measure_preamble_end_x(
    page_margin_left: f32,
    is_first_system: bool,
    opts: &LayoutOptions,
) -> f32 {
    preamble_layout(page_margin_left, is_first_system, opts).visible_end_x_pt
}

pub(crate) fn compact_measure_inner_left(
    measure_x: f32,
    measure_index_in_system: usize,
    page_margin_left: f32,
    is_first_system: bool,
    barline: Option<&str>,
    opts: &LayoutOptions,
) -> f32 {
    if measure_index_in_system == 0 {
        if is_start_repeat_barline(barline)
            && skip_system_opening_barline(is_first_system, barline, opts)
        {
            return measure_x
                + repeat_barline_rendered_width(GlyphRole::RepeatLeft, opts.staff_space_pt)
                + START_REPEAT_TRAILING_GAP_PT;
        }
        let mut left = compact_measure_preamble_end_x(page_margin_left, is_first_system, opts)
            + COMPACT_MEASURE_EDGE_GAP_PT;
        if is_start_repeat_barline(barline) {
            let repeat_left =
                first_measure_start_repeat_x(measure_x, page_margin_left, is_first_system, opts);
            left = left.max(
                repeat_left
                    + repeat_barline_rendered_width(GlyphRole::RepeatLeft, opts.staff_space_pt)
                    + COMPACT_MEASURE_EDGE_GAP_PT,
            );
        }
        left.max(measure_x + opening_barline_reserved_width(is_first_system, barline, opts))
    } else if is_start_repeat_barline(barline) {
        measure_x
            + repeat_barline_rendered_width(GlyphRole::RepeatLeft, opts.staff_space_pt)
            + START_REPEAT_TRAILING_GAP_PT
    } else {
        measure_x + OPENING_BARLINE_THICKNESS_PT + COMPACT_MEASURE_EDGE_GAP_PT
    }
}

pub(crate) fn compact_measure_inner_right(
    measure_x: f32,
    measure_width: f32,
    right_barline: Option<&str>,
    staff_space_pt: f32,
) -> f32 {
    let x = measure_x + measure_width;
    match right_barline {
        Some("repeat-end") | Some("repeat-both") => {
            x - repeat_barline_rendered_width(GlyphRole::RepeatRight, staff_space_pt)
                - COMPACT_MEASURE_EDGE_GAP_PT
        }
        Some("final") | Some("double") => {
            x - FINAL_OR_DOUBLE_BARLINE_INNER_RIGHT_INSET_PT - COMPACT_MEASURE_EDGE_GAP_PT
        }
        _ => x - OPENING_BARLINE_THICKNESS_PT - COMPACT_MEASURE_EDGE_GAP_PT,
    }
}

#[derive(Debug)]
pub(crate) struct PlannedSystem<'a> {
    pub(crate) measures: Vec<&'a DisplayMeasure<'a>>,
    pub(crate) widths: Vec<f32>,
}

pub(crate) fn normalized_grouping(header: &RenderHeader) -> Vec<u32> {
    let fallback = vec![1; header.time_beats.max(1) as usize];
    if header.grouping.is_empty() {
        return fallback;
    }

    let grouping_sum: u32 = header.grouping.iter().sum();
    if grouping_sum == header.time_beats {
        header.grouping.clone()
    } else {
        fallback
    }
}

fn effective_measure_duration(measure: &RenderMeasure) -> Fraction {
    if compare_fractions(measure.actual_duration, Fraction { numerator: 0, denominator: 1 })
        == std::cmp::Ordering::Greater
    {
        measure.actual_duration
    } else {
        measure.full_duration
    }
}

fn effective_group_durations(header: &RenderHeader, measure: &RenderMeasure) -> Vec<Fraction> {
    let grouping = normalized_grouping(header);
    let mut remaining = effective_measure_duration(measure);
    let mut durations = Vec::new();

    for beat_units in grouping {
        if compare_fractions(remaining, Fraction { numerator: 0, denominator: 1 })
            != std::cmp::Ordering::Greater
        {
            break;
        }
        let group_duration = measure_fraction_for_beat_units(beat_units.max(1), header.time_beat_unit);
        let current = if compare_fractions(remaining, group_duration) == std::cmp::Ordering::Less {
            remaining
        } else {
            group_duration
        };
        durations.push(current);
        remaining = subtract_fractions(remaining, current);
    }

    if durations.is_empty() {
        durations.push(effective_measure_duration(measure));
    }

    durations
}

pub(crate) fn measure_fraction_for_beat_units(beat_units: u32, beat_unit: u32) -> Fraction {
    reduce_fraction(Fraction {
        numerator: beat_units,
        denominator: beat_unit.max(1),
    })
}

pub(crate) fn measure_fraction_for_division_slot(header: &RenderHeader, slot: u32) -> Fraction {
    reduce_fraction(Fraction {
        numerator: slot,
        denominator: header.note_value.max(1),
    })
}

pub(crate) fn decompose_rest_fraction(duration: Fraction) -> Vec<Fraction> {
    let primitives = [
        Fraction {
            numerator: 1,
            denominator: 1,
        },
        Fraction {
            numerator: 1,
            denominator: 2,
        },
        Fraction {
            numerator: 1,
            denominator: 4,
        },
        Fraction {
            numerator: 1,
            denominator: 8,
        },
        Fraction {
            numerator: 1,
            denominator: 16,
        },
        Fraction {
            numerator: 1,
            denominator: 32,
        },
    ];

    let mut result = Vec::new();
    let mut remaining = reduce_fraction(duration);
    for primitive in primitives {
        while compare_fractions(remaining, primitive) != std::cmp::Ordering::Less {
            result.push(primitive);
            remaining = subtract_fractions(remaining, primitive);
        }
    }
    if remaining.numerator > 0 {
        result.push(remaining);
    }
    result
}

pub(crate) fn grouping_segment_index_for_fraction(
    header: &RenderHeader,
    fraction: Fraction,
) -> usize {
    let grouping = normalized_grouping(header);
    let mut boundary_units = 0_u32;
    for (index, beat_units) in grouping.iter().enumerate() {
        boundary_units += (*beat_units).max(1);
        let boundary = measure_fraction_for_beat_units(boundary_units, header.time_beat_unit);
        if compare_fractions(fraction, boundary) == std::cmp::Ordering::Less {
            return index;
        }
    }
    grouping.len().saturating_sub(1)
}

pub(crate) fn is_beamable_duration(duration: Fraction) -> bool {
    let divisor = gcd_u32(duration.numerator, duration.denominator).max(1);
    duration.denominator / divisor >= 8
}

pub(crate) fn visual_duration(event: &RenderEvent) -> Fraction {
    event.visual_duration
}

/// Returns the denominator of the undotted base note value.
/// e.g. dotted eighth (3/16) → undotted base (1/8) → denominator 8.
pub(crate) fn undotted_base_denominator(duration: Fraction, dot_count: u8) -> u32 {
    if dot_count == 0 {
        return duration.denominator;
    }
    let dot_num = (1_u64 << (dot_count + 1)) - 1; // 2^(dots+1) - 1
    let dot_denom = 1_u64 << dot_count; // 2^dots
                                        // base = duration * dot_denom / dot_num
                                        // base = (dur_num * dot_denom) / (dur_denom * dot_num)
    let base_num = duration.numerator as u64 * dot_denom;
    let base_denom = duration.denominator as u64 * dot_num;
    let divisor = gcd_u64(base_num, base_denom).max(1);
    (base_denom / divisor) as u32
}

pub(crate) fn gcd_u64(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let remainder = a % b;
        a = b;
        b = remainder;
    }
    a
}

pub(crate) fn gcd_u32(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let remainder = a % b;
        a = b;
        b = remainder;
    }
    a
}

pub(crate) struct MeasureGeometryInput {
    pub(crate) measure_x: f32,
    pub(crate) measure_width: f32,
    pub(crate) left_pad: f32,
    pub(crate) right_pad: f32,
    /// Visual content lane after preamble glyphs / before barline glyphs.
    pub(crate) content_lane_left_pt: f32,
    pub(crate) content_lane_right_pt: f32,
    /// When true, attacks start at the content lane left edge instead of centering in the lane.
    pub(crate) suppress_content_lane_centering: bool,
    pub(crate) staff_space_pt: f32,
    pub(crate) duration_compression: f32,
}

fn segment_offsets_for_group(
    start_fraction: Fraction,
    group_duration: Fraction,
    segment_boundaries: &[Fraction],
    group_hit_starts: &[Fraction],
    duration_compression: f32,
    stretch_sparse_group: bool,
    center_lone_attack: bool,
) -> Vec<f32> {
    if segment_boundaries.is_empty() {
        return Vec::new();
    }
    if segment_boundaries.len() == 1 {
        return vec![0.0];
    }

    let group_span = fraction_to_f32(group_duration).max(0.0001);
    let mut offsets = if segment_boundaries.len() <= 1 {
        vec![0.5]
    } else {
        let mut raw_weights = Vec::with_capacity(segment_boundaries.len() - 1);
        for i in 0..segment_boundaries.len() - 1 {
            let seg_duration = fraction_to_f32(subtract_fractions(
                segment_boundaries[i + 1],
                segment_boundaries[i],
            )) / group_span;
            raw_weights.push(seg_duration);
        }

        let min_dur = raw_weights
            .iter()
            .fold(f32::MAX, |a, &b| if b > 0.0 { a.min(b) } else { a });
        let min_dur = min_dur.max(0.01);
        let weights: Vec<f32> = raw_weights
            .iter()
            .map(|&d| {
                let ratio = d / min_dur;
                1.0 + duration_compression * (ratio + 1.0).log2()
            })
            .collect();

        let total_weight = weights.iter().sum::<f32>().max(1e-6);
        let mut cum = 0.0_f32;
        let mut segment_offsets = Vec::with_capacity(segment_boundaries.len());
        for &w in &weights {
            segment_offsets.push(cum);
            cum += w / total_weight;
        }
        segment_offsets.push(1.0);
        segment_offsets
    };

    if center_lone_attack && group_hit_starts.len() == 1 {
        let attack = group_hit_starts[0];
        for (offset, boundary) in offsets.iter_mut().zip(segment_boundaries) {
            if compare_fractions(*boundary, attack) == std::cmp::Ordering::Equal {
                *offset = 0.5;
            }
        }
    } else if stretch_sparse_group && group_hit_starts.len() >= 2 {
        let first = group_hit_starts[0];
        let last = group_hit_starts[group_hit_starts.len() - 1];
        if compare_fractions(last, first) == std::cmp::Ordering::Greater {
            let attack_span = fraction_to_f32(subtract_fractions(last, first));
            let fill = attack_span / group_span;
            if fill < 0.5 {
                // Sparse: spread attacks across the group without reserving trailing metric time.
                let span = attack_span.max(1e-6);
                for (offset, boundary) in offsets.iter_mut().zip(segment_boundaries) {
                    *offset = (fraction_to_f32(subtract_fractions(*boundary, first)) / span)
                        .clamp(0.0, 1.0);
                }
            } else if fill >= 0.65 {
                // Dense: keep metric spacing through the full grouping span (matches earlier groups).
                for (offset, boundary) in offsets.iter_mut().zip(segment_boundaries) {
                    *offset = (fraction_to_f32(subtract_fractions(*boundary, start_fraction))
                        / group_span)
                        .clamp(0.0, 1.0);
                }
            }
        }
    }

    offsets
}

pub(crate) fn measure_geometry(
    header: &RenderHeader,
    measure: &RenderMeasure,
    mapper: &SlotMapper,
    input: &MeasureGeometryInput,
) -> MeasureGeometry {
    let inner_left_pt = input.measure_x + input.left_pad;
    let inner_width_pt = (input.measure_width - input.left_pad - input.right_pad).max(1.0);
    let grouping = effective_group_durations(header, measure);
    let mut groups = Vec::new();
    let mut weighted_width_sum = 0.0_f32;
    let mut start_fraction = Fraction {
        numerator: 0,
        denominator: 1,
    };
    let measure_end = effective_measure_duration(measure);

    let mut all_starts: Vec<Fraction> = measure.events.iter().map(|event| event.start).collect();
    sort_and_dedup_fractions(&mut all_starts);

    let mut all_boundaries = all_starts.clone();
    all_boundaries.extend(measure.events.iter().map(|event| {
        let end = add_fractions(event.start, event.duration);
        if compare_fractions(end, measure_end) == std::cmp::Ordering::Greater {
            measure_end
        } else {
            end
        }
    }));
    sort_and_dedup_fractions(&mut all_boundaries);
    let only_rests = !measure.events.is_empty()
        && measure
            .events
            .iter()
            .all(|event| matches!(event.kind, EventKind::Rest));
    if only_rests {
        let first_slot = measure_fraction_for_division_slot(header, 1);
        if compare_fractions(first_slot, measure_end) == std::cmp::Ordering::Less {
            all_boundaries.push(first_slot);
            let mut cursor = first_slot;
            for primitive in decompose_rest_fraction(subtract_fractions(measure_end, first_slot)) {
                cursor = add_fractions(cursor, primitive);
                all_boundaries.push(cursor);
            }
        }
        sort_and_dedup_fractions(&mut all_boundaries);
    }

    let grouping_len = grouping.len();
    for (group_index, group_duration) in grouping.into_iter().enumerate() {
        let end_fraction = add_fractions(start_fraction, group_duration);
        let base_quarters = fraction_to_f32(group_duration) * 4.0;

        // Content weight for measure-width compression
        let group_starts: Vec<Fraction> = all_starts
            .iter()
            .copied()
            .filter(|start| {
                compare_fractions(*start, start_fraction) != std::cmp::Ordering::Less
                    && compare_fractions(*start, end_fraction) == std::cmp::Ordering::Less
            })
            .collect();
        let mut group_hit_starts: Vec<Fraction> = measure
            .events
            .iter()
            .filter(|event| !matches!(event.kind, EventKind::Rest))
            .map(|event| event.start)
            .filter(|start| {
                compare_fractions(*start, start_fraction) != std::cmp::Ordering::Less
                    && compare_fractions(*start, end_fraction) == std::cmp::Ordering::Less
            })
            .collect();
        sort_and_dedup_fractions(&mut group_hit_starts);
        let segment_count = if group_starts.is_empty() {
            1
        } else {
            group_starts.len().max(1)
        };
        let content_weight =
            1.0 + input.duration_compression * (segment_count as f32).max(1.0).log2();
        let weighted_width = base_quarters * mapper.px_per_quarter * content_weight;
        weighted_width_sum += weighted_width;

        // Duration-weighted segment offsets within this group
        let mut segment_boundaries: Vec<Fraction> = all_boundaries
            .iter()
            .copied()
            .filter(|boundary| {
                compare_fractions(*boundary, start_fraction) != std::cmp::Ordering::Less
                    && compare_fractions(*boundary, end_fraction) != std::cmp::Ordering::Greater
            })
            .collect();
        if segment_boundaries
            .first()
            .map(|boundary| compare_fractions(*boundary, start_fraction))
            != Some(std::cmp::Ordering::Equal)
        {
            segment_boundaries.insert(0, start_fraction);
        }
        if segment_boundaries
            .last()
            .map(|boundary| compare_fractions(*boundary, end_fraction))
            != Some(std::cmp::Ordering::Equal)
        {
            segment_boundaries.push(end_fraction);
        }

        let stretch_sparse_group = group_index + 1 == grouping_len;
        let center_lone_attack = all_starts.len() <= 1
            && group_hit_starts.len() == 1
            && compare_fractions(group_hit_starts[0], start_fraction) != std::cmp::Ordering::Equal;
        let attack_starts = if group_hit_starts.is_empty() {
            &group_starts
        } else {
            &group_hit_starts
        };
        let segment_offsets = segment_offsets_for_group(
            start_fraction,
            group_duration,
            &segment_boundaries,
            attack_starts,
            input.duration_compression,
            stretch_sparse_group,
            center_lone_attack,
        );

        groups.push(GroupGeometry {
            end_fraction,
            width_pt: weighted_width,
            segment_offsets,
            segment_boundaries,
        });
        start_fraction = end_fraction;
    }

    let scale = inner_width_pt / weighted_width_sum.max(1.0);
    for group in &mut groups {
        group.width_pt *= scale;
    }

    let mut geometry = MeasureGeometry {
        inner_left_pt,
        inner_width_pt,
        content_left_pt: inner_left_pt,
        content_width_pt: inner_width_pt,
        raw_anchor_first_x: inner_left_pt,
        raw_anchor_last_x: inner_left_pt + inner_width_pt,
        groups,
    };

    if !all_starts.is_empty() {
        let first_content = all_starts[0];
        let last_content = all_starts[all_starts.len() - 1];
        let raw_first = geometry.raw_x_for_fraction(first_content);
        // Single attack/rest: anchor span is a point so left/right slack split evenly.
        let raw_last = if all_starts.len() == 1 {
            raw_first
        } else {
            geometry.raw_x_for_fraction(last_content)
        };
        let lane_left = input.content_lane_left_pt;
        let lane_right = input.content_lane_right_pt;
        let lane_width = (lane_right - lane_left).max(1.0);
        let raw_span = (raw_last - raw_first).max(0.0);
        let margin = if input.suppress_content_lane_centering || raw_span > lane_width {
            0.0
        } else {
            (lane_width - raw_span) * 0.5
        };
        let notehead_center_shift = measure
            .events
            .iter()
            .find(|event| matches!(event.kind, EventKind::Hit | EventKind::Rest))
            .map(|event| {
                let font_pt = notation_render_font_pt(input.staff_space_pt);
                let reference_metric =
                    notehead_glyph(&event.track, &event.modifiers, &event.glyph);
                NOTE_METRIC_TO_DRAW_X_PT
                    - glyph_bbox_center_x_offset(reference_metric, font_pt)
            })
            .unwrap_or(NOTE_METRIC_TO_DRAW_X_PT);
        geometry.content_left_pt = lane_left + margin + notehead_center_shift;
        geometry.content_width_pt = if raw_span > lane_width {
            lane_width
        } else {
            raw_span.max(1.0)
        };
        geometry.raw_anchor_first_x = raw_first;
        geometry.raw_anchor_last_x = raw_last;
    }

    geometry
}

pub(crate) fn estimated_measure_width(
    header: &RenderHeader,
    measure: &RenderMeasure,
    mapper: &SlotMapper,
    compression: f32,
) -> f32 {
    if measure.multi_rest_count.is_some() || measure.measure_repeat_slashes.is_some() {
        return mapper.measure_width(1, 1, true);
    }

    let grouping = effective_group_durations(header, measure);

    let mut starts: Vec<Fraction> = measure.events.iter().map(|event| event.start).collect();
    sort_and_dedup_fractions(&mut starts);
    let segment_count = starts.len().max(1);

    // Modifier bonuses (matching VexFlow)
    let has_tuplet = measure.events.iter().any(|event| event.tuplet.is_some());
    let sticking_count = measure
        .events
        .iter()
        .filter(|event| matches!(event.kind, EventKind::Sticking))
        .count();
    let modifier_bonus =
        (if has_tuplet { 0.15 } else { 0.0 }) + (if sticking_count >= 3 { 0.1 } else { 0.0 });

    grouping
        .into_iter()
        .map(|group_duration| {
            let base_quarters = fraction_to_f32(group_duration) * 4.0;
            let content_weight =
                1.0 + compression * (segment_count as f32).max(1.0).log2() + modifier_bonus;
            base_quarters * mapper.px_per_quarter * content_weight
        })
        .sum()
}

pub(crate) fn finalize_planned_system<'a>(
    systems: &mut Vec<PlannedSystem<'a>>,
    current_measures: Vec<&'a DisplayMeasure<'a>>,
    current_inner_estimates: Vec<f32>,
    is_first_system: bool,
    available_width: f32,
    opts: &LayoutOptions,
) {
    if current_measures.is_empty() {
        return;
    }
    let fixed_width: f32 = current_inner_estimates
        .iter()
        .enumerate()
        .map(|(index, width)| {
            let left = measure_left_pad(
                index,
                is_first_system,
                current_measures[index].measure.barline.as_deref(),
                opts,
            );
            let right_barline = current_measures[index]
                .closing_barline
                .as_deref()
                .or(current_measures[index].barline.as_deref());
            let is_compact = current_measures[index].measure.multi_rest_count.is_some()
                || current_measures[index].measure.measure_repeat_slashes.is_some();
            let compact_content_width = if is_compact { *width } else { 0.0 };
            compact_content_width + left + measure_right_pad(right_barline, opts.staff_space_pt)
        })
        .sum();
    let scalable_inner_sum: f32 = current_inner_estimates
        .iter()
        .enumerate()
        .filter_map(|(index, width)| {
            let is_compact = current_measures[index].measure.multi_rest_count.is_some()
                || current_measures[index].measure.measure_repeat_slashes.is_some();
            if is_compact {
                None
            } else {
                Some(*width)
            }
        })
        .sum();
    let scale = ((available_width - fixed_width).max(1.0) / scalable_inner_sum.max(1.0)).max(0.01);
    let widths = current_inner_estimates
        .into_iter()
        .enumerate()
        .map(|(index, width)| {
            let left = measure_left_pad(
                index,
                is_first_system,
                current_measures[index].barline.as_deref(),
                opts,
            );
            let right_barline = current_measures[index]
                .closing_barline
                .as_deref()
                .or(current_measures[index].barline.as_deref());
            let is_compact = current_measures[index].measure.multi_rest_count.is_some()
                || current_measures[index].measure.measure_repeat_slashes.is_some();
            let content_width = if is_compact { width.max(width * scale) } else { width * scale };
            content_width + left + measure_right_pad(right_barline, opts.staff_space_pt)
        })
        .collect();
    systems.push(PlannedSystem {
        measures: current_measures,
        widths,
    });
}

pub(crate) fn plan_scene_systems<'a>(
    header: &RenderHeader,
    measures: &'a [DisplayMeasure<'a>],
    opts: &LayoutOptions,
) -> Vec<PlannedSystem<'a>> {
    let mapper = SlotMapper::new(opts.px_per_quarter);
    let available_width = (opts.page_width_pt - opts.left_margin_pt - opts.right_margin_pt)
        .max(MIN_SYSTEM_AVAILABLE_WIDTH_PT);
    let mut systems: Vec<PlannedSystem<'a>> = Vec::new();
    let mut current_measures: Vec<&'a DisplayMeasure<'a>> = Vec::new();
    let mut current_inner_estimates: Vec<f32> = Vec::new();
    let mut current_paragraph: Option<u32> = None;
    let mut next_is_first_system = true;

    for measure in measures {
        let estimate = estimated_measure_width(
            header,
            measure.measure,
            &mapper,
            opts.measure_width_compression,
        );
        let paragraph_break =
            current_paragraph.is_some() && current_paragraph != Some(measure.paragraph_index);
        if !current_measures.is_empty() && paragraph_break {
            finalize_planned_system(
                &mut systems,
                current_measures,
                current_inner_estimates,
                next_is_first_system,
                available_width,
                opts,
            );
            current_measures = Vec::new();
            current_inner_estimates = Vec::new();
            next_is_first_system = false;
        }

        current_paragraph = Some(measure.paragraph_index);
        current_measures.push(measure);
        current_inner_estimates.push(estimate);
    }

    finalize_planned_system(
        &mut systems,
        current_measures,
        current_inner_estimates,
        next_is_first_system,
        available_width,
        opts,
    );

    systems
}
