use std::collections::HashSet;

use crate::roles as scene_roles;
use crate::scene_geometry::item_bounds;
use crate::*;

/// Returns true for roles that are purely decorative (background, staff infrastructure)
/// and should not be considered when computing skyline for content-positioned markers.
const SKYLINE_Y_RANGE_ABOVE: f32 = 60.0;
const SKYLINE_Y_RANGE_BELOW: f32 = 30.0;

pub(crate) fn top_skyline_sample(
    items: &[SceneItem],
    block_measures: &[SceneMeasure],
    x1: f32,
    x2: f32,
    fallback_top: f32,
) -> f32 {
    top_skyline_sample_optional(items, block_measures, x1, x2).unwrap_or(fallback_top)
}

pub(crate) fn top_skyline_sample_optional(
    items: &[SceneItem],
    block_measures: &[SceneMeasure],
    x1: f32,
    x2: f32,
) -> Option<f32> {
    let left = x1.min(x2);
    let right = x1.max(x2);
    let measure_ids = block_measures
        .iter()
        .map(|measure| measure.id.as_str())
        .collect::<HashSet<_>>();
    let system_top = block_measures
        .iter()
        .map(|measure| measure.y_pt)
        .fold(f32::INFINITY, f32::min);
    let system_bottom = block_measures
        .iter()
        .map(|measure| measure.y_pt + measure.height_pt)
        .fold(f32::NEG_INFINITY, f32::max);
    let mut top = f32::INFINITY;
    for item in items {
        if is_decoration_role(&item.role) {
            continue;
        }
        if scene_roles::is_volta_role(&item.role) {
            continue;
        }
        let in_block_measure = item
            .measure_id
            .as_deref()
            .is_some_and(|measure_id| measure_ids.contains(measure_id));
        if let Some((item_x, item_y, item_width, _)) = item_bounds(item) {
            let in_system_band = item.measure_id.is_none()
                && item_y >= system_top - 60.0
                && item_y <= system_bottom + 20.0;
            if !in_block_measure && !in_system_band {
                continue;
            }
            let item_right = item_x + item_width;
            if item_x < right && item_right > left {
                top = top.min(item_y);
            }
        }
    }
    if top.is_finite() {
        Some(top)
    } else {
        None
    }
}

pub(crate) fn skyline_top_for_range(
    items: &[SceneItem],
    x1: f32,
    x2: f32,
    reference_top: f32,
    fallback: f32,
) -> f32 {
    let left = x1.min(x2);
    let right = x1.max(x2);
    let mut top = f32::INFINITY;
    for item in items {
        if is_decoration_role(&item.role) {
            continue;
        }
        if scene_roles::is_volta_role(&item.role) {
            continue;
        }
        if let Some((item_x, item_y, item_width, _)) = item_bounds(item) {
            // Only consider items within a reasonable Y band of the reference.
            // Items far above (e.g. volta lines from other systems on the
            // pre-pagination page) must not push this marker upward.
            if item_y < reference_top - SKYLINE_Y_RANGE_ABOVE
                || item_y > reference_top + SKYLINE_Y_RANGE_BELOW
            {
                continue;
            }
            let item_right = item_x + item_width;
            if item_x < right && item_right > left {
                top = top.min(item_y);
            }
        }
    }
    if top.is_finite() {
        top
    } else {
        fallback
    }
}

pub(crate) fn bottom_skyline_sample(
    items: &[SceneItem],
    block_measures: &[&SceneMeasure],
    x1: f32,
    x2: f32,
    fallback_bottom: f32,
) -> f32 {
    let left = x1.min(x2);
    let right = x1.max(x2);
    let measure_ids = block_measures
        .iter()
        .map(|measure| measure.id.as_str())
        .collect::<HashSet<_>>();
    let system_top = block_measures
        .iter()
        .map(|measure| measure.y_pt)
        .fold(f32::INFINITY, f32::min);
    let system_bottom = block_measures
        .iter()
        .map(|measure| measure.y_pt + measure.height_pt)
        .fold(f32::NEG_INFINITY, f32::max);
    let mut bottom = f32::NEG_INFINITY;
    for item in items {
        if scene_roles::is_hairpin_role(&item.role) {
            continue;
        }
        let in_block_measure = item
            .measure_id
            .as_deref()
            .is_some_and(|measure_id| measure_ids.contains(measure_id));
        if let Some((item_x, item_y, item_width, item_height)) = item_bounds(item) {
            let in_system_band = item.measure_id.is_none()
                && item_y >= system_top - 20.0
                && item_y <= system_bottom + 60.0;
            if !in_block_measure && !in_system_band {
                continue;
            }
            let item_right = item_x + item_width;
            if item_x < right && item_right > left {
                bottom = bottom.max(item_y + item_height);
            }
        }
    }
    if bottom.is_finite() {
        bottom
    } else {
        fallback_bottom
    }
}

pub(crate) fn bottom_skyline_sample_including_hairpins(
    items: &[SceneItem],
    block_measures: &[&SceneMeasure],
    x1: f32,
    x2: f32,
    fallback_bottom: f32,
) -> f32 {
    let left = x1.min(x2);
    let right = x1.max(x2);
    let measure_ids = block_measures
        .iter()
        .map(|measure| measure.id.as_str())
        .collect::<HashSet<_>>();
    let system_top = block_measures
        .iter()
        .map(|measure| measure.y_pt)
        .fold(f32::INFINITY, f32::min);
    let system_bottom = block_measures
        .iter()
        .map(|measure| measure.y_pt + measure.height_pt)
        .fold(f32::NEG_INFINITY, f32::max);
    let mut bottom = f32::NEG_INFINITY;
    for item in items {
        if item.role == scene_roles::DYNAMIC {
            continue;
        }
        let in_block_measure = item
            .measure_id
            .as_deref()
            .is_some_and(|measure_id| measure_ids.contains(measure_id));
        if let Some((item_x, item_y, item_width, item_height)) = item_bounds(item) {
            let in_system_band = item.measure_id.is_none()
                && item_y >= system_top - 20.0
                && item_y <= system_bottom + 80.0;
            if !in_block_measure && !in_system_band {
                continue;
            }
            let item_right = item_x + item_width;
            if item_x < right && item_right > left {
                bottom = bottom.max(item_y + item_height);
            }
        }
    }
    if bottom.is_finite() {
        bottom
    } else {
        fallback_bottom
    }
}

fn is_decoration_role(role: &str) -> bool {
    scene_roles::is_decoration_role(role)
}
