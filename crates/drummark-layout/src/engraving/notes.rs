use crate::collision::{
    rect_obstacle_from_glyph, rect_obstacle_from_line, rect_overlap_area, GlyphObstacle,
    LineObstacle, RectObstacle,
};
use crate::compat_planning::SlotMapper;
use crate::contract::{EventKind, Fraction, RenderEvent, RenderHeader, RenderMeasure};
use crate::fraction::compare_fractions;
use crate::instruments::staff_y_for_track;
use crate::metrics::{
    canonical_glyph_metric, canonical_text_metric, notehead_glyph, rest_glyph_for_fraction,
    CanonicalGlyphMetric, GlyphPoint, GlyphRole, TextRole,
};
use crate::planning::{
    glyph_bbox_center_x_offset, glyph_bbox_center_y_offset, grouping_segment_index_for_fraction,
    is_beamable_duration, measure_geometry, rect_obstacle_from_rest_placement,
    rendered_glyph_width, undotted_base_denominator, visual_duration, MeasureGeometryInput,
};
use crate::scene_builder::{GlyphItemSpec, LineItemSpec, SceneEmitSink, TextItemSpec};
use crate::BASE_FONT_SIZE_PT;

use super::beams::{render_beam_groups, BeamAnchor};
use super::tuplets::render_tuplet_groups;

#[derive(Clone)]
pub(crate) struct SlotEvent<'a> {
    pub(crate) start: Fraction,
    pub(crate) event_x: f32,
    pub(crate) event: &'a RenderEvent,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct BeamRunState {
    pub(crate) segment: usize,
    pub(crate) group: u32,
}

#[derive(Clone)]
pub(crate) struct NotePlacement {
    pub(crate) note_id: String,
    pub(crate) note_x: f32,
    pub(crate) note_y: f32,
    pub(crate) note_center_x: f32,
    pub(crate) has_accent: bool,
    pub(crate) note_role: GlyphRole,
    pub(crate) stem_up_anchor_ss: Option<GlyphPoint>,
    pub(crate) stem_down_anchor_ss: Option<GlyphPoint>,
}

#[derive(Clone, Copy)]
pub(crate) struct PreparedClusterNote<'a> {
    pub(crate) slot_event: &'a SlotEvent<'a>,
    pub(crate) staff_position_ss: f32,
    pub(crate) note_y_offset: f32,
    pub(crate) note_role: GlyphRole,
    pub(crate) glyph_metric: CanonicalGlyphMetric,
    pub(crate) x_offset: f32,
}

#[derive(Clone, Copy)]
pub(crate) struct StemLayout {
    pub(crate) stem_x: f32,
    pub(crate) stem_attach_y: f32,
    pub(crate) stem_body_min_y: f32,
    pub(crate) stem_body_max_y: f32,
    pub(crate) anchor_note_id: Option<usize>,
}

#[derive(Clone, Debug)]
pub(crate) struct BeamAnchorPlan {
    pub(crate) x: f32,
    pub(crate) stem_x: f32,
    pub(crate) stem_tip_y: f32,
    pub(crate) voice: u8,
    pub(crate) group: u32,
    pub(crate) level: u8,
    pub(crate) up: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct StemRenderPlan {
    pub(crate) x: f32,
    pub(crate) y1: f32,
    pub(crate) y2: f32,
    pub(crate) anchor_note_id: Option<String>,
    pub(crate) beam_anchor: Option<BeamAnchorPlan>,
}

pub(crate) struct HitClusterPlan {
    pub(crate) measure_id: String,
    pub(crate) beam_level: u8,
    pub(crate) stem_up: bool,
    pub(crate) note_placements: Vec<NotePlacement>,
    pub(crate) ledger_lines: Vec<LineObstacle>,
    pub(crate) stem_plan: Option<StemRenderPlan>,
    pub(crate) accent_glyphs: Vec<GlyphObstacle>,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct RestPlacement {
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) role: GlyphRole,
    pub(crate) font_size_pt: f32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct RestPlacementDiagnostic {
    pub(crate) voice: u8,
    pub(crate) start: Fraction,
    pub(crate) duration: Fraction,
}

pub(crate) struct RenderMeasureEventsInput<'a> {
    pub(crate) measure_id: &'a str,
    pub(crate) header: &'a RenderHeader,
    pub(crate) measure: &'a RenderMeasure,
    pub(crate) geometry: MeasureGeometryInput,
    pub(crate) staff_top: f32,
    pub(crate) staff_bottom: f32,
    pub(crate) mapper: &'a SlotMapper,
    pub(crate) stem_len_pt: f32,
    pub(crate) hide_voice2_rests: bool,
    pub(crate) issues: &'a mut Vec<String>,
}

pub(crate) fn render_measure_events(
    sink: &mut SceneEmitSink<'_>,
    input: RenderMeasureEventsInput<'_>,
) {
    let mut beam_anchors: Vec<BeamAnchor> = Vec::new();
    let geometry = measure_geometry(input.header, input.measure, input.mapper, &input.geometry);
    let mut slot_events = input
        .measure
        .events
        .iter()
        .map(|event| SlotEvent {
            start: event.start,
            event_x: geometry.x_for_fraction(input.header, event.start),
            event,
        })
        .collect::<Vec<_>>();
    slot_events.sort_by(|a, b| {
        compare_fractions(a.start, b.start)
            .then_with(|| a.event.voice.cmp(&b.event.voice))
            .then_with(|| {
                staff_y_for_track(&a.event.track)
                    .partial_cmp(&staff_y_for_track(&b.event.track))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    let mut index = 0usize;
    let mut beam_states_by_voice: std::collections::BTreeMap<u8, BeamRunState> =
        std::collections::BTreeMap::new();
    let mut next_beam_group = 0_u32;
    while index < slot_events.len() {
        let start = slot_events[index].start;
        let event_x = slot_events[index].event_x;
        let slot_start = index;
        while index < slot_events.len()
            && compare_fractions(slot_events[index].start, start) == std::cmp::Ordering::Equal
        {
            index += 1;
        }
        let slot_group = &slot_events[slot_start..index];
        let beam_groups_by_voice = beam_groups_for_slot(
            input.header,
            start,
            slot_group,
            &mut beam_states_by_voice,
            &mut next_beam_group,
        );
        render_slot_group(
            sink,
            RenderSlotGroupInput {
                measure_id: input.measure_id,
                slot_group,
                beam_groups_by_voice: &beam_groups_by_voice,
                event_x,
                staff_top: input.staff_top,
                beam_anchors: &mut beam_anchors,
                stem_len_pt: input.stem_len_pt,
                hide_voice2_rests: input.hide_voice2_rests,
                issues: input.issues,
            },
        );
    }

    render_tuplet_groups(sink, input.measure_id, &slot_events, input.staff_top);
    render_beam_groups(
        sink,
        input.measure_id,
        beam_anchors,
        input.geometry.measure_width,
        input.staff_bottom,
    );
}

pub(crate) struct RenderSlotGroupInput<'a, 'b> {
    measure_id: &'a str,
    slot_group: &'a [SlotEvent<'a>],
    beam_groups_by_voice: &'a std::collections::BTreeMap<u8, u32>,
    event_x: f32,
    staff_top: f32,
    beam_anchors: &'b mut Vec<BeamAnchor>,
    stem_len_pt: f32,
    hide_voice2_rests: bool,
    issues: &'b mut Vec<String>,
}

const REST_LANES_VOICE_1_SS: [f32; 15] = [
    2.0, 1.5, 2.5, 1.0, 3.0, 0.5, 3.5, 0.0, 4.0, -0.5, 4.5, -1.0, 5.0, -1.5, 5.5,
];
const REST_LANES_VOICE_2_SS: [f32; 15] = [
    3.0, 3.5, 2.5, 4.0, 2.0, 4.5, 1.5, 5.0, 1.0, 5.5, 0.5, 6.0, 0.0, 6.5, -0.5,
];
const STAFF_SPACE_STEP_PT: f32 = 10.0;
const STEM_STROKE_WIDTH_PT: f32 = 1.5;
const BEAM_THICKNESS_PT: f32 = 4.0;
const SECONDARY_BEAM_GAP_PT: f32 = 6.0;

fn rest_lane_candidates_ss(voice: u8) -> &'static [f32] {
    if voice == 2 {
        &REST_LANES_VOICE_2_SS
    } else {
        &REST_LANES_VOICE_1_SS
    }
}

fn rest_placement_for_lane(
    rest_metric: CanonicalGlyphMetric,
    center_x: f32,
    lane_center_y: f32,
    font_size_pt: f32,
) -> RestPlacement {
    RestPlacement {
        x: center_x - glyph_bbox_center_x_offset(rest_metric, font_size_pt),
        y: lane_center_y - glyph_bbox_center_y_offset(rest_metric, font_size_pt),
        role: rest_metric.role,
        font_size_pt,
    }
}

pub(crate) fn notehead_obstacles(note_placements: &[NotePlacement]) -> Vec<RectObstacle> {
    note_placements
        .iter()
        .map(|note| {
            rect_obstacle_from_glyph(GlyphObstacle {
                x: note.note_x,
                y: note.note_y,
                glyph_role: note.note_role,
                font_size_pt: BASE_FONT_SIZE_PT,
                anchor_item_id: None,
            })
        })
        .collect()
}

fn ledger_line_obstacles(lines: &[LineObstacle]) -> Vec<RectObstacle> {
    lines.iter().copied().map(rect_obstacle_from_line).collect()
}

fn stem_obstacle(stem_plan: &StemRenderPlan) -> RectObstacle {
    rect_obstacle_from_line(LineObstacle {
        x1: stem_plan.x,
        y1: stem_plan.y1,
        x2: stem_plan.x,
        y2: stem_plan.y2,
        stroke_width: STEM_STROKE_WIDTH_PT,
    })
}

fn beam_envelope_obstacle(
    stem_plan: &StemRenderPlan,
    beam_level: u8,
    stem_up: bool,
) -> Option<RectObstacle> {
    if beam_level == 0 {
        return None;
    }
    let extra_span =
        BEAM_THICKNESS_PT + SECONDARY_BEAM_GAP_PT * beam_level.saturating_sub(1) as f32;
    Some(if stem_up {
        RectObstacle {
            x1: stem_plan.x - 1.0,
            x2: stem_plan.x + 12.0,
            y1: stem_plan.y1,
            y2: stem_plan.y1 + extra_span,
        }
    } else {
        RectObstacle {
            x1: stem_plan.x - 1.0,
            x2: stem_plan.x + 12.0,
            y1: stem_plan.y2 - extra_span,
            y2: stem_plan.y2,
        }
    })
}

pub(crate) fn resolve_rest_placement(
    rest: &SlotEvent<'_>,
    center_x: f32,
    staff_top: f32,
    rest_metric: CanonicalGlyphMetric,
    font_size_pt: f32,
    obstacles: &[RectObstacle],
    occupied_rests: &[RectObstacle],
) -> (RestPlacement, Option<RestPlacementDiagnostic>) {
    let mut best: Option<(RestPlacement, f32, usize)> = None;
    for (lane_index, lane_ss) in rest_lane_candidates_ss(rest.event.voice)
        .iter()
        .copied()
        .enumerate()
    {
        let placement = rest_placement_for_lane(
            rest_metric,
            center_x,
            staff_top + lane_ss * STAFF_SPACE_STEP_PT,
            font_size_pt,
        );
        let rest_rect = rect_obstacle_from_rest_placement(placement);
        let overlap = obstacles
            .iter()
            .chain(occupied_rests.iter())
            .map(|obstacle| rect_overlap_area(rest_rect, *obstacle))
            .sum::<f32>();
        if overlap <= 0.001 {
            return (placement, None);
        }
        match best {
            Some((_, best_overlap, _best_lane)) if overlap > best_overlap + 0.001 => {}
            Some((_, best_overlap, best_lane))
                if (overlap - best_overlap).abs() <= 0.001 && lane_index >= best_lane => {}
            _ => best = Some((placement, overlap, lane_index)),
        }
    }
    let (placement, _, _) = best.expect("rest lanes should not be empty");
    (
        placement,
        Some(RestPlacementDiagnostic {
            voice: rest.event.voice,
            start: rest.event.start,
            duration: rest.event.duration,
        }),
    )
}

fn rest_is_hidden_by_slot_context(rest: &SlotEvent<'_>, slot_group: &[SlotEvent<'_>]) -> bool {
    matches!(rest.event.kind, EventKind::Rest)
        && slot_group.iter().any(|other| {
            other.event.voice == rest.event.voice && matches!(other.event.kind, EventKind::Hit)
        })
}

pub(crate) fn render_slot_group(sink: &mut SceneEmitSink<'_>, input: RenderSlotGroupInput<'_, '_>) {
    let hit_voice_count = input
        .slot_group
        .iter()
        .filter(|slot_event| matches!(slot_event.event.kind, EventKind::Hit))
        .map(|slot_event| slot_event.event.voice)
        .collect::<std::collections::BTreeSet<_>>()
        .len();

    let mut note_anchors_by_voice: std::collections::BTreeMap<u8, Vec<NotePlacement>> =
        std::collections::BTreeMap::new();
    let mut hit_cluster_plans = Vec::new();

    for voice in input
        .slot_group
        .iter()
        .map(|slot_event| slot_event.event.voice)
        .collect::<std::collections::BTreeSet<_>>()
    {
        let voice_shift = if hit_voice_count > 1 {
            if voice == 1 {
                -4.0
            } else {
                4.0
            }
        } else {
            0.0
        };
        let voice_hits = input
            .slot_group
            .iter()
            .filter(|slot_event| {
                slot_event.event.voice == voice && matches!(slot_event.event.kind, EventKind::Hit)
            })
            .collect::<Vec<_>>();
        if !voice_hits.is_empty() {
            let cluster_plan = render_hit_cluster(
                sink,
                RenderHitClusterInput {
                    measure_id: input.measure_id,
                    event_x: input.event_x,
                    voice_shift,
                    staff_top: input.staff_top,
                    voice_hits: &voice_hits,
                    beam_group: input.beam_groups_by_voice.get(&voice).copied(),
                    stem_len_pt: input.stem_len_pt,
                },
            );
            note_anchors_by_voice.insert(voice, cluster_plan.note_placements.clone());
            hit_cluster_plans.push(cluster_plan);
        }
    }

    let mut slot_obstacles = Vec::new();
    for cluster_plan in &hit_cluster_plans {
        slot_obstacles.extend(notehead_obstacles(&cluster_plan.note_placements));
        slot_obstacles.extend(ledger_line_obstacles(&cluster_plan.ledger_lines));
        if let Some(stem_plan) = cluster_plan.stem_plan.as_ref() {
            slot_obstacles.push(stem_obstacle(stem_plan));
            if let Some(beam_rect) =
                beam_envelope_obstacle(stem_plan, cluster_plan.beam_level, cluster_plan.stem_up)
            {
                slot_obstacles.push(beam_rect);
            }
        }
        slot_obstacles.extend(
            cluster_plan
                .accent_glyphs
                .iter()
                .cloned()
                .map(rect_obstacle_from_glyph),
        );
    }

    let slot_hit_center_x = note_anchors_by_voice
        .values()
        .find_map(|placements| placements.first().map(|placement| placement.note_center_x));

    let mut visible_rests = input
        .slot_group
        .iter()
        .enumerate()
        .filter(|(_, slot_event)| matches!(slot_event.event.kind, EventKind::Rest))
        .filter(|(_, slot_event)| !(input.hide_voice2_rests && slot_event.event.voice == 2))
        .filter(|(_, slot_event)| !rest_is_hidden_by_slot_context(slot_event, input.slot_group))
        .collect::<Vec<_>>();
    visible_rests.sort_by(|left, right| {
        left.1
            .event
            .voice
            .cmp(&right.1.event.voice)
            .then_with(|| compare_fractions(right.1.event.duration, left.1.event.duration))
            .then_with(|| {
                staff_y_for_track(&left.1.event.track)
                    .partial_cmp(&staff_y_for_track(&right.1.event.track))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| left.1.event.track.cmp(&right.1.event.track))
            .then_with(|| left.0.cmp(&right.0))
    });
    let mut occupied_rest_rects = Vec::new();
    for (_, rest) in visible_rests {
        let voice_shift = if hit_voice_count > 1 {
            if rest.event.voice == 1 {
                -4.0
            } else {
                4.0
            }
        } else {
            0.0
        };
        let rest_dot_count = rest.event.dot_count as usize;
        let rest_shape_duration = if rest_dot_count > 0 {
            Fraction {
                numerator: 1,
                denominator: undotted_base_denominator(rest.event.duration, rest.event.dot_count),
            }
        } else {
            rest.event.duration
        };
        let rest_metric = rest_glyph_for_fraction(rest_shape_duration);
        let rest_font_size = BASE_FONT_SIZE_PT;
        let reference_note_metric =
            notehead_glyph(&rest.event.track, &rest.event.modifiers, &rest.event.glyph);
        let note_center_x = slot_hit_center_x.unwrap_or_else(|| {
            input.event_x - 7.0
                + voice_shift
                + glyph_bbox_center_x_offset(reference_note_metric, rest_font_size)
        });
        let (placement, diagnostic) = resolve_rest_placement(
            rest,
            note_center_x,
            input.staff_top,
            rest_metric,
            rest_font_size,
            &slot_obstacles,
            &occupied_rest_rects,
        );
        if let Some(diagnostic) = diagnostic {
            input.issues.push(format!(
                "LAYOUT_WARNING rest-placement voice={} start={}/{} duration={}/{}",
                diagnostic.voice,
                diagnostic.start.numerator,
                diagnostic.start.denominator,
                diagnostic.duration.numerator,
                diagnostic.duration.denominator
            ));
        }
        sink.push_glyph_item(GlyphItemSpec {
            measure_id: Some(input.measure_id),
            role: "rest",
            x: placement.x,
            y: placement.y,
            glyph_role: placement.role,
            font_family: "Bravura",
            font_size_pt: placement.font_size_pt,
            fill: "#333",
        });
        if rest_dot_count > 0 {
            let dot_metric = canonical_glyph_metric(GlyphRole::AugmentationDot);
            let dot_glyph = char::from_u32(dot_metric.smufl_codepoint)
                .unwrap_or('?')
                .to_string();
            let dot_spacing_x = 5.0_f32;
            for i in 0..rest_dot_count {
                let dot_x = placement.x
                    + (i as f32) * dot_spacing_x
                    + rest_metric.width_ss() * rest_font_size / 4.0
                    + 8.0;
                sink.push_text_item(TextItemSpec {
                    measure_id: Some(input.measure_id),
                    role: "augmentation-dot",
                    x: dot_x,
                    y: placement.y,
                    text_role: TextRole::Tempo,
                    text: dot_glyph.clone(),
                    font_family: "Bravura",
                    font_size_pt: rest_font_size,
                    fill: "#333",
                    text_anchor: None,
                    font_weight: None,
                });
            }
        }
        occupied_rest_rects.push(rect_obstacle_from_rest_placement(placement));
    }

    for cluster_plan in hit_cluster_plans {
        render_hit_cluster_stem_and_accents(sink, cluster_plan, input.beam_anchors);
    }

    let default_anchor = note_anchors_by_voice.values().find_map(|placements| {
        placements
            .first()
            .map(|placement| placement.note_id.clone())
    });
    let default_anchor_y = note_anchors_by_voice
        .values()
        .flat_map(|placements| placements.iter().map(|placement| placement.note_y))
        .fold(None, |acc: Option<f32>, y| {
            Some(acc.map_or(y, |current| current.min(y)))
        });

    let sticking_metric = canonical_text_metric(TextRole::Sticking);
    for sticking in input
        .slot_group
        .iter()
        .filter(|slot_event| matches!(slot_event.event.kind, EventKind::Sticking))
    {
        let sticking_id = sink.push_text_item(TextItemSpec {
            measure_id: Some(input.measure_id),
            role: "sticking",
            x: input.event_x,
            y: input.staff_top - sticking_metric.descent_pt,
            text_role: TextRole::Sticking,
            text: sticking.event.glyph.clone(),
            font_family: sticking_metric.font_family,
            font_size_pt: sticking_metric.font_size_pt,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        sink.set_anchor_item_id(&sticking_id, default_anchor.clone());
        if let Some(anchor_y) = default_anchor_y {
            sink.set_text_y(
                &sticking_id,
                anchor_y - sticking_metric.line_height_pt - 4.0,
            );
        }
    }
}

fn beam_groups_for_slot(
    header: &RenderHeader,
    start: Fraction,
    slot_group: &[SlotEvent<'_>],
    states_by_voice: &mut std::collections::BTreeMap<u8, BeamRunState>,
    next_group: &mut u32,
) -> std::collections::BTreeMap<u8, u32> {
    let mut result = std::collections::BTreeMap::new();
    let voices = slot_group
        .iter()
        .map(|slot_event| slot_event.event.voice)
        .collect::<std::collections::BTreeSet<_>>();

    for voice in voices {
        let voice_events = slot_group
            .iter()
            .filter(|slot_event| slot_event.event.voice == voice)
            .collect::<Vec<_>>();
        let has_visible_rest = voice_events.iter().any(|slot_event| {
            matches!(slot_event.event.kind, EventKind::Rest)
                && !rest_is_hidden_by_slot_context(slot_event, slot_group)
        });
        let beamable_hit = voice_events
            .iter()
            .filter(|slot_event| matches!(slot_event.event.kind, EventKind::Hit))
            .find(|slot_event| is_beamable_duration(visual_duration(slot_event.event)));

        if has_visible_rest || beamable_hit.is_none() {
            states_by_voice.remove(&voice);
            continue;
        }

        let segment = grouping_segment_index_for_fraction(header, start);
        let group = match states_by_voice.get(&voice).copied() {
            Some(state) if state.segment == segment => state.group,
            _ => {
                let group = *next_group;
                *next_group += 1;
                group
            }
        };
        states_by_voice.insert(voice, BeamRunState { segment, group });
        result.insert(voice, group);
    }

    result
}

pub(crate) struct RenderHitClusterInput<'a> {
    measure_id: &'a str,
    event_x: f32,
    voice_shift: f32,
    staff_top: f32,
    voice_hits: &'a [&'a SlotEvent<'a>],
    beam_group: Option<u32>,
    stem_len_pt: f32,
}

pub(crate) fn render_hit_cluster(
    sink: &mut SceneEmitSink<'_>,
    input: RenderHitClusterInput<'_>,
) -> HitClusterPlan {
    let note_font_size = 30.0_f32;
    let stem_up = input
        .voice_hits
        .first()
        .map(|slot_event| slot_event.event.voice != 2)
        .unwrap_or(true);
    let base_note_x = input.event_x - 7.0 + input.voice_shift;
    let mut placements = input
        .voice_hits
        .iter()
        .map(|slot_event| {
            let staff_position_ss = staff_y_for_track(&slot_event.event.track);
            let glyph_metric = notehead_glyph(
                &slot_event.event.track,
                &slot_event.event.modifiers,
                &slot_event.event.glyph,
            );
            PreparedClusterNote {
                slot_event,
                staff_position_ss,
                note_y_offset: staff_position_ss * 10.0,
                note_role: glyph_role_for_codepoint(glyph_metric.smufl_codepoint),
                glyph_metric,
                x_offset: 0.0,
            }
        })
        .collect::<Vec<_>>();
    placements.sort_by(|a, b| {
        a.note_y_offset
            .partial_cmp(&b.note_y_offset)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    displace_overlapping_same_voice_noteheads(&mut placements, note_font_size);

    let mut note_placements = Vec::new();
    let mut ledger_lines = Vec::new();
    for placement in &placements {
        let note_x = base_note_x + placement.x_offset;
        let note_glyph = char::from_u32(placement.glyph_metric.smufl_codepoint)
            .unwrap_or('?')
            .to_string();
        let actual_note_y = input.staff_top + placement.note_y_offset;
        let note_id = sink.push_text_item(TextItemSpec {
            measure_id: Some(input.measure_id),
            role: "notehead",
            x: note_x,
            y: actual_note_y,
            text_role: TextRole::Tempo,
            text: note_glyph,
            font_family: "Bravura",
            font_size_pt: note_font_size,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let ledger_half_overhang_pt = 3.0_f32;
        for ledger_y_offset in ledger_line_offsets_for_staff_position(placement.staff_position_ss) {
            let ledger_y = input.staff_top + ledger_y_offset * 10.0;
            let note_width = rendered_glyph_width(placement.note_role, note_font_size);
            let ledger_x1 = note_x - ledger_half_overhang_pt;
            let ledger_x2 = note_x + note_width + ledger_half_overhang_pt;
            ledger_lines.push(LineObstacle {
                x1: ledger_x1,
                y1: ledger_y,
                x2: ledger_x2,
                y2: ledger_y,
                stroke_width: 1.25,
            });
            let ledger_id = sink.push_line_item(LineItemSpec {
                measure_id: Some(input.measure_id),
                role: "ledger-line",
                x1: ledger_x1,
                y1: ledger_y,
                x2: ledger_x2,
                y2: ledger_y,
                stroke: "#333",
                stroke_width: 1.25,
                stroke_line_cap: None,
            });
            sink.set_anchor_item_id(&ledger_id, Some(note_id.clone()));
        }
        let note_center_x =
            note_x + glyph_bbox_center_x_offset(placement.glyph_metric, note_font_size);
        let has_accent = placement
            .slot_event
            .event
            .modifiers
            .iter()
            .any(|modifier| modifier == "accent");
        let dot_count = placement.slot_event.event.dot_count as usize;
        if dot_count > 0 {
            let dot_metric = canonical_glyph_metric(GlyphRole::AugmentationDot);
            let dot_glyph = char::from_u32(dot_metric.smufl_codepoint)
                .unwrap_or('?')
                .to_string();
            let dot_ss = placement.staff_position_ss;
            let dot_y_ss = if dot_ss.fract().abs() < 0.01 {
                dot_ss - 0.5
            } else {
                dot_ss
            };
            let dot_spacing_x = 5.0_f32;
            for i in 0..dot_count {
                let dot_x = note_x
                    + (i as f32) * dot_spacing_x
                    + canonical_glyph_metric(placement.note_role).width_ss() * note_font_size / 4.0
                    + 8.0;
                let dot_y = input.staff_top + dot_y_ss * 10.0;
                sink.push_text_item(TextItemSpec {
                    measure_id: Some(input.measure_id),
                    role: "augmentation-dot",
                    x: dot_x,
                    y: dot_y,
                    text_role: TextRole::Tempo,
                    text: dot_glyph.clone(),
                    font_family: "Bravura",
                    font_size_pt: note_font_size,
                    fill: "#333",
                    text_anchor: None,
                    font_weight: None,
                });
            }
        }
        render_grace_notes_for_hit(
            sink,
            input.measure_id,
            placement.slot_event.event,
            note_id.clone(),
            note_x,
            actual_note_y,
            placement.note_role,
            stem_up,
        );
        note_placements.push(NotePlacement {
            note_id: note_id.clone(),
            note_x,
            note_y: actual_note_y,
            note_center_x,
            has_accent,
            note_role: placement.note_role,
            stem_up_anchor_ss: placement.glyph_metric.stem_up_anchor_ss,
            stem_down_anchor_ss: placement.glyph_metric.stem_down_anchor_ss,
        });
    }

    let first_hit = input
        .voice_hits
        .first()
        .expect("voice hit cluster should contain at least one hit");
    let first_visual_duration = visual_duration(first_hit.event);
    let needs_stem = first_visual_duration.denominator >= 4 || first_hit.event.tuplet.is_some();
    let dot_count = first_hit.event.dot_count;
    let undotted_denom = undotted_base_denominator(first_visual_duration, dot_count);
    let beam_level = if undotted_denom >= 32 {
        3
    } else if undotted_denom >= 16 {
        2
    } else if undotted_denom >= 8 {
        1
    } else {
        0
    };

    let stem_plan = build_stem_render_plan(
        &note_placements,
        input.event_x,
        first_hit.event.voice,
        input.beam_group,
        beam_level,
        stem_up,
        needs_stem,
        input.stem_len_pt,
    );
    let accent_glyphs = build_accent_glyph_plans(&note_placements, stem_up, stem_plan.as_ref());

    HitClusterPlan {
        measure_id: input.measure_id.to_string(),
        beam_level,
        stem_up,
        note_placements,
        ledger_lines,
        stem_plan,
        accent_glyphs,
    }
}

fn shared_stem_layout(
    note_placements: &[NotePlacement],
    default_attach_note: &NotePlacement,
    stem_up: bool,
    stem_anchor: GlyphPoint,
    smufl_ss: f32,
) -> StemLayout {
    if let Some(stem_x) = centered_stem_x_for_displaced_chord(note_placements) {
        if stem_up {
            if let Some((anchor_note_index, anchor_note)) = note_placements
                .iter()
                .enumerate()
                .filter(|(_, note)| note.note_x + 0.001 < stem_x)
                .max_by(|(_, left), (_, right)| {
                    left.note_y
                        .partial_cmp(&right.note_y)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
            {
                let (stem_body_min_y, stem_body_max_y) =
                    chord_stem_body_range(note_placements, stem_up, smufl_ss);
                return StemLayout {
                    stem_x,
                    stem_attach_y: anchor_note.note_y - stem_anchor.y_ss * smufl_ss,
                    stem_body_min_y,
                    stem_body_max_y,
                    anchor_note_id: Some(anchor_note_index),
                };
            }
        } else if let Some((anchor_note_index, anchor_note)) = note_placements
            .iter()
            .enumerate()
            .filter(|(_, note)| note.note_x + 0.001 >= stem_x)
            .min_by(|(_, left), (_, right)| {
                left.note_y
                    .partial_cmp(&right.note_y)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
        {
            let (stem_body_min_y, stem_body_max_y) =
                chord_stem_body_range(note_placements, stem_up, smufl_ss);
            return StemLayout {
                stem_x,
                stem_attach_y: anchor_note.note_y - stem_anchor.y_ss * smufl_ss,
                stem_body_min_y,
                stem_body_max_y,
                anchor_note_id: Some(anchor_note_index),
            };
        }
    }

    let anchor_note_index = note_placements
        .iter()
        .position(|note| std::ptr::eq(note, default_attach_note));
    let (stem_body_min_y, stem_body_max_y) =
        chord_stem_body_range(note_placements, stem_up, smufl_ss);
    StemLayout {
        stem_x: default_attach_note.note_x + stem_anchor.x_ss * smufl_ss,
        stem_attach_y: default_attach_note.note_y - stem_anchor.y_ss * smufl_ss,
        stem_body_min_y,
        stem_body_max_y,
        anchor_note_id: anchor_note_index,
    }
}

fn chord_stem_body_range(
    note_placements: &[NotePlacement],
    stem_up: bool,
    smufl_ss: f32,
) -> (f32, f32) {
    let mut min_y = f32::INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for note in note_placements {
        let anchor = if stem_up {
            note.stem_up_anchor_ss.unwrap_or(GlyphPoint {
                x_ss: 1.18,
                y_ss: 0.168,
            })
        } else {
            note.stem_down_anchor_ss.unwrap_or(GlyphPoint {
                x_ss: 0.0,
                y_ss: -0.168,
            })
        };
        let y = note.note_y - anchor.y_ss * smufl_ss;
        min_y = min_y.min(y);
        max_y = max_y.max(y);
    }
    (min_y, max_y)
}

pub(crate) fn render_hit_cluster_stem_and_accents(
    sink: &mut SceneEmitSink<'_>,
    cluster_plan: HitClusterPlan,
    beam_anchors: &mut Vec<BeamAnchor>,
) {
    let mut stem_item_id = None;
    if let Some(stem_plan) = cluster_plan.stem_plan.as_ref() {
        let stem_id = sink.push_line_item(LineItemSpec {
            measure_id: Some(cluster_plan.measure_id.as_str()),
            role: "stem",
            x1: stem_plan.x,
            y1: stem_plan.y1,
            x2: stem_plan.x,
            y2: stem_plan.y2,
            stroke: "#333",
            stroke_width: 1.5,
            stroke_line_cap: None,
        });
        if let Some(anchor_note_id) = stem_plan.anchor_note_id.as_ref() {
            sink.set_anchor_item_id(&stem_id, Some(anchor_note_id.clone()));
        }
        stem_item_id = Some(stem_id.clone());
        if let Some(anchor_plan) = stem_plan.beam_anchor.as_ref() {
            beam_anchors.push(BeamAnchor {
                x: anchor_plan.x,
                stem_x: anchor_plan.stem_x,
                stem_tip_y: anchor_plan.stem_tip_y,
                voice: anchor_plan.voice,
                group: anchor_plan.group,
                level: anchor_plan.level,
                up: anchor_plan.up,
                stem_item_id: stem_id,
            });
        }
    }
    for accent in &cluster_plan.accent_glyphs {
        let accent_id = sink.push_glyph_item(GlyphItemSpec {
            measure_id: Some(cluster_plan.measure_id.as_str()),
            role: "accent",
            x: accent.x,
            y: accent.y,
            glyph_role: accent.glyph_role,
            font_family: "Bravura",
            font_size_pt: accent.font_size_pt,
            fill: "#333",
        });
        sink.set_anchor_item_id(
            &accent_id,
            accent
                .anchor_item_id
                .clone()
                .or_else(|| stem_item_id.clone())
                .or_else(|| {
                    cluster_plan
                        .note_placements
                        .first()
                        .map(|note| note.note_id.clone())
                }),
        );
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn render_grace_notes_for_hit(
    sink: &mut SceneEmitSink<'_>,
    measure_id: &str,
    event: &RenderEvent,
    anchor_note_id: String,
    main_note_x: f32,
    main_note_y: f32,
    note_role: GlyphRole,
    stem_up: bool,
) {
    let grace_count = if event.modifiers.iter().any(|modifier| modifier == "drag") {
        2
    } else if event.modifiers.iter().any(|modifier| modifier == "flam") {
        1
    } else {
        return;
    };
    let grace_flag_role = if event.modifiers.iter().any(|modifier| modifier == "flam") {
        Some(grace_flag_role_for_event(event, stem_up))
    } else {
        None
    };

    let grace_font_size = 16.0_f32;
    let grace_spacing = 8.0_f32;
    let grace_gap = 9.0_f32;
    let note_metric = canonical_glyph_metric(note_role);
    let note_glyph = char::from_u32(note_metric.smufl_codepoint)
        .unwrap_or('?')
        .to_string();
    let total_grace_width = (grace_count as f32 - 1.0) * grace_spacing;
    let first_grace_x = main_note_x - grace_gap - total_grace_width;
    let stem_anchor = if stem_up {
        note_metric.stem_up_anchor_ss.unwrap_or(GlyphPoint {
            x_ss: 1.18,
            y_ss: 0.168,
        })
    } else {
        note_metric.stem_down_anchor_ss.unwrap_or(GlyphPoint {
            x_ss: 0.0,
            y_ss: -0.168,
        })
    };
    let smufl_ss = grace_font_size / 4.0;

    for index in 0..grace_count {
        let grace_x = first_grace_x + index as f32 * grace_spacing;
        let note_id = sink.push_text_item(TextItemSpec {
            measure_id: Some(measure_id),
            role: "grace-notehead",
            x: grace_x,
            y: main_note_y,
            text_role: TextRole::Tempo,
            text: note_glyph.clone(),
            font_family: "Bravura",
            font_size_pt: grace_font_size,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        sink.set_anchor_item_id(&note_id, Some(anchor_note_id.clone()));

        let stem_x = grace_x + stem_anchor.x_ss * smufl_ss;
        let stem_attach_y = main_note_y - stem_anchor.y_ss * smufl_ss;
        let (stem_y1, stem_y2) = if stem_up {
            (stem_attach_y - 18.0, stem_attach_y)
        } else {
            (stem_attach_y, stem_attach_y + 18.0)
        };
        let stem_id = sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "grace-stem",
            x1: stem_x,
            y1: stem_y1,
            x2: stem_x,
            y2: stem_y2,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: None,
        });
        sink.set_anchor_item_id(&stem_id, Some(note_id.clone()));

        if let Some(flag_role) = grace_flag_role {
            let flag_metric = canonical_glyph_metric(flag_role);
            let flag_anchor =
                flag_metric
                    .stem_anchor_for_direction(stem_up)
                    .unwrap_or(GlyphPoint {
                        x_ss: 0.0,
                        y_ss: 0.0,
                    });
            let stem_tip_y = if stem_up { stem_y1 } else { stem_y2 };
            let flag_id = sink.push_glyph_item(GlyphItemSpec {
                measure_id: Some(measure_id),
                role: "grace-flag",
                x: stem_x - flag_anchor.x_ss * smufl_ss,
                y: stem_tip_y + flag_anchor.y_ss * smufl_ss,
                glyph_role: flag_role,
                font_family: "Bravura",
                font_size_pt: grace_font_size,
                fill: "#333",
            });
            sink.set_anchor_item_id(&flag_id, Some(stem_id.clone()));
        }

        let slash_mid_y = if stem_up {
            stem_y1 + 9.0
        } else {
            stem_y2 - 9.0
        };
        let slash_id = sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "grace-slash",
            x1: stem_x - 3.5,
            y1: slash_mid_y + 4.0,
            x2: stem_x + 4.5,
            y2: slash_mid_y - 4.0,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: Some("round"),
        });
        sink.set_anchor_item_id(&slash_id, Some(stem_id));
    }
}

fn grace_flag_role_for_event(event: &RenderEvent, stem_up: bool) -> GlyphRole {
    let undotted_denom = undotted_base_denominator(visual_duration(event), event.dot_count);
    match (stem_up, undotted_denom) {
        (true, denom) if denom >= 32 => GlyphRole::Flag32ndUp,
        (false, denom) if denom >= 32 => GlyphRole::Flag32ndDown,
        (true, denom) if denom >= 16 => GlyphRole::Flag16thUp,
        (false, denom) if denom >= 16 => GlyphRole::Flag16thDown,
        (true, _) => GlyphRole::Flag8thUp,
        (false, _) => GlyphRole::Flag8thDown,
    }
}

fn centered_stem_x_for_displaced_chord(note_placements: &[NotePlacement]) -> Option<f32> {
    let min_x = note_placements
        .iter()
        .map(|note| note.note_x)
        .fold(f32::INFINITY, f32::min);
    let max_x = note_placements
        .iter()
        .map(|note| note.note_x)
        .fold(f32::NEG_INFINITY, f32::max);

    if max_x - min_x > 0.01 {
        Some(max_x)
    } else {
        None
    }
}

fn displace_overlapping_same_voice_noteheads(
    placements: &mut [PreparedClusterNote<'_>],
    note_font_size: f32,
) {
    let mut run_start = 0usize;
    while run_start < placements.len() {
        let mut run_end = run_start;
        while run_end + 1 < placements.len()
            && noteheads_overlap_on_adjacent_staff_positions(
                placements[run_end].staff_position_ss,
                placements[run_end + 1].staff_position_ss,
            )
        {
            run_end += 1;
        }
        if run_end > run_start {
            let right_column_offset = placements[run_start..=run_end]
                .iter()
                .map(|placement| rendered_glyph_width(placement.note_role, note_font_size))
                .fold(0.0_f32, f32::max);
            for (index_in_run, placement) in placements[run_start..=run_end].iter_mut().enumerate()
            {
                placement.x_offset = if index_in_run % 2 == 0 {
                    right_column_offset
                } else {
                    0.0
                };
            }
        }
        run_start = run_end + 1;
    }
}

fn noteheads_overlap_on_adjacent_staff_positions(
    upper_staff_position_ss: f32,
    lower_staff_position_ss: f32,
) -> bool {
    ((lower_staff_position_ss - upper_staff_position_ss).abs() - 0.5).abs() < 0.001
}

#[allow(clippy::too_many_arguments)]
fn build_stem_render_plan(
    note_placements: &[NotePlacement],
    event_x: f32,
    voice: u8,
    beam_group: Option<u32>,
    beam_level: u8,
    stem_up: bool,
    needs_stem: bool,
    stem_len_pt: f32,
) -> Option<StemRenderPlan> {
    if !needs_stem {
        return None;
    }
    let smufl_ss = BASE_FONT_SIZE_PT / 4.0;
    let attach_note = if stem_up {
        note_placements.iter().min_by(|a, b| {
            a.note_y
                .partial_cmp(&b.note_y)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    } else {
        note_placements.iter().max_by(|a, b| {
            a.note_y
                .partial_cmp(&b.note_y)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    }?;
    let fallback_anchor = if stem_up {
        GlyphPoint {
            x_ss: 1.18,
            y_ss: 0.168,
        }
    } else {
        GlyphPoint {
            x_ss: 0.0,
            y_ss: -0.168,
        }
    };
    let stem_anchor = if stem_up {
        attach_note.stem_up_anchor_ss
    } else {
        attach_note.stem_down_anchor_ss
    }
    .unwrap_or(fallback_anchor);
    let stem_layout =
        shared_stem_layout(note_placements, attach_note, stem_up, stem_anchor, smufl_ss);
    let stem_attach_y = stem_layout.stem_attach_y;
    let stem_y1 = if stem_up {
        stem_attach_y - stem_len_pt
    } else {
        stem_layout.stem_body_min_y
    };
    let stem_y2 = if stem_up {
        stem_layout.stem_body_max_y
    } else {
        stem_attach_y + stem_len_pt
    };
    Some(StemRenderPlan {
        x: stem_layout.stem_x,
        y1: stem_y1,
        y2: stem_y2,
        anchor_note_id: stem_layout
            .anchor_note_id
            .map(|index| note_placements[index].note_id.clone()),
        beam_anchor: beam_group
            .filter(|_| beam_level > 0)
            .map(|group| BeamAnchorPlan {
                x: event_x,
                stem_x: stem_layout.stem_x,
                stem_tip_y: if stem_up { stem_y1 } else { stem_y2 },
                voice,
                group,
                level: beam_level,
                up: stem_up,
            }),
    })
}

fn build_accent_glyph_plans(
    note_placements: &[NotePlacement],
    stem_up: bool,
    stem_plan: Option<&StemRenderPlan>,
) -> Vec<GlyphObstacle> {
    let accent_role = if stem_up {
        GlyphRole::ArticAccentAbove
    } else {
        GlyphRole::ArticAccentBelow
    };
    let accent_font_size = BASE_FONT_SIZE_PT;
    let accent_gap = 4.0_f32;
    let accent_width = rendered_glyph_width(accent_role, accent_font_size);
    let fallback_reference_y = if stem_up {
        note_placements
            .iter()
            .map(|placement| placement.note_y)
            .fold(f32::INFINITY, f32::min)
            - 18.0
    } else {
        note_placements
            .iter()
            .map(|placement| placement.note_y)
            .fold(f32::NEG_INFINITY, f32::max)
            + 18.0
    };
    let reference_y = stem_plan
        .map(|plan| if stem_up { plan.y1 } else { plan.y2 })
        .unwrap_or(fallback_reference_y);
    let accent_y = if stem_up {
        reference_y - accent_gap
    } else {
        reference_y + accent_gap
    };
    note_placements
        .iter()
        .filter(|placement| placement.has_accent)
        .map(|placement| GlyphObstacle {
            x: placement.note_center_x - accent_width * 0.5,
            y: accent_y,
            glyph_role: accent_role,
            font_size_pt: accent_font_size,
            anchor_item_id: Some(placement.note_id.clone()),
        })
        .collect()
}

pub(crate) fn glyph_role_for_codepoint(codepoint: u32) -> GlyphRole {
    match codepoint {
        0xE0A9 => GlyphRole::NoteheadX,
        0xE0B2 => GlyphRole::NoteheadDiamond,
        0xE0B3 => GlyphRole::NoteheadCircleX,
        0xE0CE => GlyphRole::NoteheadRim,
        _ => GlyphRole::NoteheadBlack,
    }
}

pub(crate) fn ledger_line_offsets_for_staff_position(track_ss: f32) -> Vec<f32> {
    let mut lines = Vec::new();
    if track_ss <= -1.0 {
        let mut line_ss = -1.0_f32;
        while line_ss >= track_ss.ceil() {
            lines.push(line_ss);
            line_ss -= 1.0;
        }
    } else if track_ss >= 5.0 {
        let mut line_ss = 5.0_f32;
        while line_ss <= track_ss.floor() {
            lines.push(line_ss);
            line_ss += 1.0;
        }
    }
    lines
}
