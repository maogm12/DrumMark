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
    /// Position of each event start within the group, as fraction of group width.
    /// Maps slot → cumulative offset fraction (0..1). Used by x_for_fraction.
    segment_offsets: Vec<f32>,
    segment_boundaries: Vec<Fraction>,
}

#[derive(Debug, Clone)]
pub(crate) struct MeasureGeometry {
    inner_left_pt: f32,
    inner_width_pt: f32,
    groups: Vec<GroupGeometry>,
}

impl MeasureGeometry {
    pub(crate) fn x_for_fraction(&self, _header: &RenderHeader, fraction: Fraction) -> f32 {
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
}

pub(crate) struct SystemStartReservation {
    opening_barline_thickness: f32,
    clef_width: f32,
    clef_trailing_gap: f32,
    time_signature_width: f32,
    time_signature_trailing_gap: f32,
}

pub(crate) const MEASURE_RIGHT_PAD_PT: f32 = 14.0;
pub(crate) const NON_INITIAL_MEASURE_LEFT_PAD_PT: f32 = 14.0;
pub(crate) const SYSTEM_PREAMBLE_TRAILING_CONTENT_GAP_PT: f32 = 8.0;
pub(crate) const COMPLEX_BARLINE_TRAILING_CONTENT_GAP_PT: f32 = 8.0;
pub(crate) const SVG_POINT_TO_USER_UNIT: f32 = 4.0 / 3.0;
pub(crate) const REPEAT_BARLINE_FONT_SIZE_PT: f32 = 30.0;
pub(crate) const FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT: f32 = 10.0;
pub(crate) const START_REPEAT_TRAILING_GAP_PT: f32 = 22.0;
pub(crate) const VOLTA_TEXT_SIZE_PT: f32 = 12.0;
pub(crate) const VOLTA_LINE_HEIGHT_PT: f32 = 15.0;
pub(crate) const VOLTA_LINE_THICKNESS_PT: f32 = 1.0;
pub(crate) const VOLTA_SKYLINE_GAP_PT: f32 = 4.0;

impl SystemStartReservation {
    pub(crate) fn width(&self) -> f32 {
        self.opening_barline_thickness
            + self.clef_width
            + self.clef_trailing_gap
            + self.time_signature_width
            + self.time_signature_trailing_gap
    }
}

pub(crate) fn system_start_reservation(is_first_system: bool) -> SystemStartReservation {
    SystemStartReservation {
        opening_barline_thickness: 1.0,
        clef_width: 25.0,
        clef_trailing_gap: 18.0,
        time_signature_width: if is_first_system { 24.0 } else { 0.0 },
        time_signature_trailing_gap: if is_first_system { 18.0 } else { 0.0 },
    }
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

pub(crate) fn first_measure_start_repeat_x(measure_x: f32, is_first_system: bool) -> f32 {
    measure_x + system_start_reservation(is_first_system).width()
        - FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT
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
    staff_space_pt: f32,
) -> f32 {
    if measure_index_in_system == 0 {
        let repeat_start_width = if is_start_repeat_barline(barline) {
            start_repeat_reserved_width(staff_space_pt) - FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT
        } else {
            0.0
        };
        system_start_reservation(is_first_system).width()
            + SYSTEM_PREAMBLE_TRAILING_CONTENT_GAP_PT
            + repeat_start_width
    } else {
        if is_start_repeat_barline(barline) {
            start_repeat_reserved_width(staff_space_pt)
        } else {
            NON_INITIAL_MEASURE_LEFT_PAD_PT
        }
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

pub(crate) fn measure_fraction_for_beat_units(beat_units: u32, beat_unit: u32) -> Fraction {
    reduce_fraction(Fraction {
        numerator: beat_units,
        denominator: beat_unit.max(1),
    })
}

pub(crate) fn measure_fraction_for_division_slot(header: &RenderHeader, slot: u32) -> Fraction {
    reduce_fraction(Fraction {
        numerator: slot.saturating_mul(header.time_beats.max(1)),
        denominator: header
            .divisions
            .max(1)
            .saturating_mul(header.time_beat_unit.max(1)),
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
    pub(crate) duration_compression: f32,
}

pub(crate) fn measure_geometry(
    header: &RenderHeader,
    measure: &RenderMeasure,
    mapper: &SlotMapper,
    input: &MeasureGeometryInput,
) -> MeasureGeometry {
    let inner_left_pt = input.measure_x + input.left_pad;
    let inner_width_pt = (input.measure_width - input.left_pad - input.right_pad).max(1.0);
    let grouping = normalized_grouping(header);
    let mut groups = Vec::new();
    let mut weighted_width_sum = 0.0_f32;
    let mut start_fraction = Fraction {
        numerator: 0,
        denominator: 1,
    };
    let measure_end = measure_fraction_for_beat_units(header.time_beats, header.time_beat_unit);

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

    for beat_units in grouping {
        let group_duration =
            measure_fraction_for_beat_units(beat_units.max(1), header.time_beat_unit);
        let end_fraction = add_fractions(start_fraction, group_duration);
        let base_quarters = beat_units as f32 * 4.0 / header.time_beat_unit.max(1) as f32;

        // Content weight for measure-width compression
        let group_starts: Vec<Fraction> = all_starts
            .iter()
            .copied()
            .filter(|start| {
                compare_fractions(*start, start_fraction) != std::cmp::Ordering::Less
                    && compare_fractions(*start, end_fraction) == std::cmp::Ordering::Less
            })
            .collect();
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

        let mut segment_offsets = Vec::with_capacity(segment_boundaries.len());
        if segment_boundaries.len() <= 1 {
            segment_offsets.push(0.5);
        } else {
            let group_span = fraction_to_f32(group_duration).max(0.0001);
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
                    1.0 + input.duration_compression * (ratio + 1.0).log2()
                })
                .collect();

            let total_weight = weights.iter().sum::<f32>().max(1e-6);
            let mut cum = 0.0_f32;
            for &w in &weights {
                segment_offsets.push(cum + (w / total_weight) * 0.5);
                cum += w / total_weight;
            }
            segment_offsets.push(1.0);
        }

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

    MeasureGeometry {
        inner_left_pt,
        inner_width_pt,
        groups,
    }
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

    let grouping = normalized_grouping(header);

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
        .scan(0_u32, |accumulated_units, beat_units| {
            let base_quarters = beat_units as f32 * 4.0 / header.time_beat_unit.max(1) as f32;
            let content_weight =
                1.0 + compression * (segment_count as f32).max(1.0).log2() + modifier_bonus;
            *accumulated_units += beat_units.max(1);
            Some(base_quarters * mapper.px_per_quarter * content_weight)
        })
        .sum()
}

pub(crate) fn finalize_planned_system<'a>(
    systems: &mut Vec<PlannedSystem<'a>>,
    current_measures: Vec<&'a DisplayMeasure<'a>>,
    current_inner_estimates: Vec<f32>,
    is_first_system: bool,
    available_width: f32,
) {
    if current_measures.is_empty() {
        return;
    }
    let fixed_width: f32 = current_inner_estimates
        .iter()
        .enumerate()
        .map(|(index, _)| {
            let left = measure_left_pad(
                index,
                is_first_system,
                current_measures[index].measure.barline.as_deref(),
                7.5,
            );
            let right_barline = current_measures[index]
                .closing_barline
                .as_deref()
                .or(current_measures[index].barline.as_deref());
            left + measure_right_pad(right_barline, 7.5)
        })
        .sum();
    let current_inner_sum: f32 = current_inner_estimates.iter().sum();
    let scale = ((available_width - fixed_width).max(1.0) / current_inner_sum.max(1.0)).max(0.01);
    let widths = current_inner_estimates
        .into_iter()
        .enumerate()
        .map(|(index, width)| {
            let left = measure_left_pad(
                index,
                is_first_system,
                current_measures[index].barline.as_deref(),
                7.5,
            );
            let right_barline = current_measures[index]
                .closing_barline
                .as_deref()
                .or(current_measures[index].barline.as_deref());
            width * scale + left + measure_right_pad(right_barline, 7.5)
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
    let available_width =
        (opts.page_width_pt - opts.left_margin_pt - opts.right_margin_pt).max(100.0);
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
    );

    systems
}
