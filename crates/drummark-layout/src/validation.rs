use std::collections::BTreeSet;

use crate::scene_geometry::scene_item_bounds;
use crate::scene_page::{page_all_composites, page_all_items, page_all_measures, page_header_items};
use crate::{LayoutScene, SceneItem, ScenePage};

pub(crate) fn validate_layout_scene(scene: &LayoutScene, staff_space_pt: f32) -> Vec<String> {
    let mut diagnostics = Vec::new();
    let overflow_systems = overflow_systems_by_page(scene);
    for (expected, page) in scene.pages.iter().enumerate() {
        if page.index != expected as u32 {
            diagnostics.push(format!(
                "LAYOUT_ERROR page-order expected={} actual={}",
                expected, page.index
            ));
        }
        let item_ids = page_all_items(page)
            .map(|item| item.id.as_str())
            .collect::<BTreeSet<_>>();
        let measure_ids = page_all_measures(page)
            .map(|measure| measure.id.as_str())
            .collect::<BTreeSet<_>>();
        for system in &page.systems {
            if system.page_index != page.index {
                diagnostics.push(format!(
                    "LAYOUT_ERROR system-page system={} page={} actual={}",
                    system.id, page.index, system.page_index
                ));
            }
            for measure in &system.measures {
                if measure.system_id != system.id {
                    diagnostics.push(format!(
                        "LAYOUT_ERROR measure-system measure={} system={} actual={}",
                        measure.id, system.id, measure.system_id
                    ));
                }
            }
            for item in &system.items {
                if let Some(measure_id) = item.measure_id.as_deref() {
                    if !system
                        .measures
                        .iter()
                        .any(|measure| measure.id == measure_id)
                    {
                        diagnostics.push(format!(
                            "LAYOUT_ERROR item-measure item={} measure={}",
                            item.id, measure_id
                        ));
                    }
                }
            }
        }
        for item in page_all_items(page) {
            if let Some(anchor_id) = item.anchor_item_id.as_deref() {
                if !item_ids.contains(anchor_id) {
                    diagnostics.push(format!(
                        "LAYOUT_ERROR item-anchor item={} anchor={}",
                        item.id, anchor_id
                    ));
                }
            }
            if let Ok(bounds) = scene_item_bounds(item, staff_space_pt) {
                if bounds.x < -0.01
                    || bounds.y < -0.01
                    || bounds.x + bounds.width > page.width_pt + 0.01
                    || bounds.y + bounds.height > page.height_pt + 0.01
                {
                    let overflow_item = item_system_id(page, item)
                        .map(|system_id| overflow_systems.contains(&(page.index, system_id)))
                        .unwrap_or(false);
                    if !overflow_item {
                        diagnostics.push(format!("LAYOUT_ERROR item-bounds item={}", item.id));
                    }
                }
            }
        }
        for composite in page_all_composites(page) {
            for child_id in &composite.child_item_ids {
                if !item_ids.contains(child_id.as_str()) {
                    diagnostics.push(format!(
                        "LAYOUT_ERROR composite-child composite={} child={}",
                        composite.id, child_id
                    ));
                }
            }
            for anchor_id in [
                composite.start_anchor_id.as_deref(),
                composite.end_anchor_id.as_deref(),
            ]
            .into_iter()
            .flatten()
            {
                if !measure_ids.contains(anchor_id) {
                    diagnostics.push(format!(
                        "LAYOUT_ERROR composite-anchor composite={} anchor={}",
                        composite.id, anchor_id
                    ));
                }
            }
        }
    }

    let mut global_item_ids = BTreeSet::new();
    let mut global_composite_ids = BTreeSet::new();
    for page in &scene.pages {
        for item in page_all_items(page) {
            if !global_item_ids.insert(item.id.as_str()) {
                diagnostics.push(format!("LAYOUT_ERROR duplicate-item id={}", item.id));
            }
        }
        for composite in page_all_composites(page) {
            if !global_composite_ids.insert(composite.id.as_str()) {
                diagnostics.push(format!(
                    "LAYOUT_ERROR duplicate-composite id={}",
                    composite.id
                ));
            }
        }
    }
    diagnostics
}

pub(crate) fn overflow_systems_by_page(scene: &LayoutScene) -> BTreeSet<(u32, String)> {
    scene
        .issues
        .iter()
        .filter_map(|issue| {
            let mut page_index = None;
            let mut system_id = None;
            if !issue.starts_with("LAYOUT_WARNING overflow ") {
                return None;
            }
            for token in issue.split_whitespace() {
                if let Some(value) = token.strip_prefix("page=") {
                    page_index = value.parse::<u32>().ok();
                } else if let Some(value) = token.strip_prefix("system=") {
                    system_id = Some(value.to_string());
                }
            }
            Some((page_index?, system_id?))
        })
        .collect()
}

pub(crate) fn item_system_id(page: &ScenePage, item: &SceneItem) -> Option<String> {
    if let Some(measure_id) = item.measure_id.as_deref() {
        if let Some(system) = page
            .systems
            .iter()
            .find(|system| system.measures.iter().any(|measure| measure.id == measure_id))
        {
            return Some(system.id.clone());
        }
    }

    if page_header_items(page).iter().any(|header_item| header_item.id == item.id) {
        return None;
    }

    page.systems
        .iter()
        .find(|system| item.id.starts_with(&format!("{}-", system.id)))
        .map(|system| system.id.clone())
}
