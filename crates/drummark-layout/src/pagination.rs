use std::collections::{BTreeSet, HashMap};

use crate::scene_geometry::{bounds_for_items, item_bounds, translate_scene_item};
use crate::validation::validate_layout_scene;
use crate::{
    CompositeKind, LayoutOptions, LayoutScene, SceneComposite, SceneItem, SceneMeasure, ScenePage,
    SceneSystem,
};

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub(crate) struct SystemLayoutBox {
    pub(crate) system_index: u32,
    pub(crate) system_id: String,
    pub(crate) local_system_origin_y: f32,
    pub(crate) staff_top: f32,
    pub(crate) staff_bottom: f32,
    pub(crate) visual_top: f32,
    pub(crate) visual_bottom: f32,
    pub(crate) width_pt: f32,
    pub(crate) measures: Vec<SceneMeasure>,
    pub(crate) systems: Vec<SceneSystem>,
    pub(crate) items: Vec<SceneItem>,
    pub(crate) composites: Vec<SceneComposite>,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub(crate) struct HeaderLayoutBox {
    pub(crate) items: Vec<SceneItem>,
    pub(crate) composites: Vec<SceneComposite>,
    pub(crate) visual_top: f32,
    pub(crate) visual_bottom: f32,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub(crate) struct PlacedSystemBox {
    pub(crate) system_index: u32,
    pub(crate) system_id: String,
    pub(crate) page_index: u32,
    pub(crate) page_x: f32,
    pub(crate) page_y: f32,
    pub(crate) local_visual_top: f32,
    pub(crate) local_system_origin_y: f32,
    pub(crate) width_pt: f32,
    pub(crate) measure_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub(crate) struct BoxPaginationResult {
    pub(crate) placements: Vec<PlacedSystemBox>,
    pub(crate) issues: Vec<String>,
}

#[allow(dead_code)]
pub(crate) fn layout_overflow_warning(
    page_index: u32,
    system_id: &str,
    visual_height: f32,
    available_height: f32,
) -> String {
    format!(
        "LAYOUT_WARNING overflow page={page_index} system={system_id} visualHeight={visual_height:.2} availableHeight={available_height:.2}"
    )
}

#[allow(dead_code)]
pub(crate) fn paginate_system_boxes(
    boxes: &[SystemLayoutBox],
    header: &HeaderLayoutBox,
    opts: &LayoutOptions,
) -> BoxPaginationResult {
    let mut placements = Vec::new();
    let mut issues = Vec::new();
    let content_bottom = opts.page_height_pt - opts.bottom_margin_pt;
    let available_height = (content_bottom - opts.top_margin_pt).max(0.0);
    let mut page_index = 0_u32;
    let mut cursor_y = page0_first_system_cursor(opts, header);
    let mut systems_on_page = 0usize;

    for system_box in boxes {
        let visual_height = system_box.visual_bottom - system_box.visual_top;
        let mut placement_y = cursor_y
            + if systems_on_page == 0 {
                0.0
            } else {
                opts.system_spacing_pt
            };
        if systems_on_page > 0 && placement_y + visual_height > content_bottom {
            page_index += 1;
            systems_on_page = 0;
            cursor_y = opts.top_margin_pt;
            placement_y = cursor_y;
        }

        if systems_on_page == 0 && placement_y + visual_height > content_bottom {
            issues.push(layout_overflow_warning(
                page_index,
                &system_box.system_id,
                visual_height,
                available_height,
            ));
        }

        placements.push(PlacedSystemBox {
            system_index: system_box.system_index,
            system_id: system_box.system_id.clone(),
            page_index,
            page_x: opts.left_margin_pt,
            page_y: placement_y,
            local_visual_top: system_box.visual_top,
            local_system_origin_y: system_box.local_system_origin_y,
            width_pt: system_box.width_pt,
            measure_ids: system_box
                .measures
                .iter()
                .map(|measure| measure.id.clone())
                .collect(),
        });
        cursor_y = placement_y + visual_height;
        systems_on_page += 1;
    }

    BoxPaginationResult { placements, issues }
}

#[allow(dead_code)]
pub(crate) fn page0_first_system_cursor(opts: &LayoutOptions, header: &HeaderLayoutBox) -> f32 {
    let fixed_cursor = opts.top_margin_pt + opts.header_height_pt + opts.header_staff_spacing_pt;
    let visual_cursor = header.visual_bottom + opts.header_staff_spacing_pt;
    fixed_cursor.max(visual_cursor)
}

pub(crate) fn paginate_unpaginated_page(
    page: ScenePage,
    mut scene: LayoutScene,
    opts: &LayoutOptions,
) -> LayoutScene {
    let header_box = header_box_from_page(&page, opts);
    let system_boxes = system_boxes_from_page(&page, opts);
    let pagination = paginate_system_boxes(&system_boxes, &header_box, opts);
    let mut pages = (0..=pagination
        .placements
        .iter()
        .map(|placement| placement.page_index)
        .max()
        .unwrap_or(0))
        .map(|index| ScenePage {
            index,
            width_pt: opts.page_width_pt,
            height_pt: opts.page_height_pt,
            systems: Vec::new(),
            measures: Vec::new(),
            items: Vec::new(),
            composites: Vec::new(),
        })
        .collect::<Vec<_>>();

    pages[0].items.extend(header_box.items.clone());
    pages[0].composites.extend(header_box.composites.clone());

    for placement in &pagination.placements {
        let Some(system_box) = system_boxes
            .iter()
            .find(|candidate| candidate.system_id == placement.system_id)
        else {
            continue;
        };
        let page = &mut pages[placement.page_index as usize];
        assemble_placed_system_box(page, system_box, placement);
    }

    for page in &mut pages {
        let mut seen = BTreeSet::new();
        page.items.retain(|item| seen.insert(item.id.clone()));
    }

    scene.pages = pages;
    scene.issues.extend(pagination.issues);
    scene.issues.extend(validate_layout_scene(&scene, opts.staff_space_pt));
    scene
}

pub(crate) fn header_box_from_page(page: &ScenePage, opts: &LayoutOptions) -> HeaderLayoutBox {
    let items_by_id = page
        .items
        .iter()
        .map(|item| (item.id.clone(), item))
        .collect::<std::collections::HashMap<_, _>>();
    let composites = page
        .composites
        .iter()
        .filter(|composite| composite.kind == CompositeKind::TextBlock)
        .filter(|composite| composite.label.as_deref() != Some("tempo"))
        .filter(|composite| {
            composite
                .child_item_ids
                .iter()
                .all(|id| page.items.iter().any(|item| &item.id == id))
        })
        .cloned()
        .collect::<Vec<_>>();
    let header_item_ids = composites
        .iter()
        .flat_map(|composite| composite.child_item_ids.iter())
        .cloned()
        .collect::<BTreeSet<_>>();
    let items = page
        .items
        .iter()
        .filter(|item| header_item_ids.contains(&item.id))
        .cloned()
        .collect::<Vec<_>>();
    let composites = page
        .composites
        .iter()
        .filter(|composite| composite.kind == CompositeKind::TextBlock)
        .filter(|composite| {
            composite
                .child_item_ids
                .iter()
                .all(|id| header_item_ids.contains(id))
        })
        .cloned()
        .collect::<Vec<_>>();
    let bounds = bounds_for_items(&items, opts.staff_space_pt).ok().flatten();
    HeaderLayoutBox {
        items,
        composites,
        visual_top: bounds.map(|bounds| bounds.y).unwrap_or(page.height_pt),
        visual_bottom: bounds.map(|bounds| bounds.y + bounds.height).unwrap_or(0.0),
    }
}

pub(crate) fn system_boxes_from_page(
    page: &ScenePage,
    opts: &LayoutOptions,
) -> Vec<SystemLayoutBox> {
    page.systems
        .iter()
        .enumerate()
        .map(|(index, system)| {
            let prev_y = index
                .checked_sub(1)
                .and_then(|prev| page.systems.get(prev))
                .map(|prev| prev.y_pt);
            let next_y = page.systems.get(index + 1).map(|next| next.y_pt);
            system_box_from_page_system(page, system, opts, prev_y, next_y)
        })
        .collect()
}

pub(crate) fn system_box_from_page_system(
    page: &ScenePage,
    system: &SceneSystem,
    opts: &LayoutOptions,
    previous_system_y: Option<f32>,
    next_system_y: Option<f32>,
) -> SystemLayoutBox {
    let measure_ids = system.measure_ids.iter().cloned().collect::<BTreeSet<_>>();
    let measures = page
        .measures
        .iter()
        .filter(|measure| measure.system_id == system.id)
        .map(|measure| {
            let mut local = measure.clone();
            local.x_pt -= opts.left_margin_pt;
            local
        })
        .collect::<Vec<_>>();
    let staff_top = system.y_pt + opts.staff_space_pt;
    let staff_bottom = system.y_pt + system.height_pt;
    let band_top = previous_system_y
        .map(|previous_y| (previous_y + system.y_pt) * 0.5)
        .unwrap_or(system.y_pt - 90.0);
    let band_bottom = next_system_y
        .map(|next_y| (system.y_pt + next_y) * 0.5)
        .unwrap_or(system.y_pt + system.height_pt + 90.0);
    let mut items = page
        .items
        .iter()
        .filter(|item| {
            if let Some(measure_id) = item.measure_id.as_ref() {
                return measure_ids.contains(measure_id);
            }
            if matches!(item.role.as_str(), "title" | "subtitle" | "composer") {
                return false;
            }
            item_bounds(item, opts.staff_space_pt)
                .map(|(_, y, _, height)| {
                    let center_y = y + height * 0.5;
                    if matches!(
                        item.role.as_str(),
                        "staff-line" | "percussion-clef" | "time-signature-digit"
                    ) {
                        return center_y >= staff_top - 0.5 && center_y <= staff_bottom + 0.5;
                    }
                    center_y >= band_top && center_y <= band_bottom
                })
                .unwrap_or(false)
        })
        .cloned()
        .collect::<Vec<_>>();
    for item in &mut items {
        translate_scene_item(item, -opts.left_margin_pt, 0.0);
    }
    let item_ids = items
        .iter()
        .map(|item| item.id.clone())
        .collect::<BTreeSet<_>>();
    let composites = page
        .composites
        .iter()
        .filter(|composite| {
            let children_match = composite
                .child_item_ids
                .iter()
                .all(|child_id| item_ids.contains(child_id));
            let start_matches = composite
                .start_anchor_id
                .as_ref()
                .is_none_or(|id| measure_ids.contains(id));
            let end_matches = composite
                .end_anchor_id
                .as_ref()
                .is_none_or(|id| measure_ids.contains(id));
            children_match && start_matches && end_matches
        })
        .cloned()
        .collect::<Vec<_>>();
    let bounds = bounds_for_items(&items, opts.staff_space_pt).ok().flatten();
    let visual_top = bounds.map(|bounds| bounds.y).unwrap_or(system.y_pt);
    let visual_bottom = bounds
        .map(|bounds| bounds.y + bounds.height)
        .unwrap_or(system.y_pt + system.height_pt);
    let mut local_system = system.clone();
    local_system.x_pt = 0.0;

    SystemLayoutBox {
        system_index: system.index,
        system_id: system.id.clone(),
        local_system_origin_y: system.y_pt,
        staff_top,
        staff_bottom,
        visual_top,
        visual_bottom,
        width_pt: system.width_pt,
        measures,
        systems: vec![local_system],
        items,
        composites,
    }
}

pub(crate) fn assemble_placed_system_box(
    page: &mut ScenePage,
    system_box: &SystemLayoutBox,
    placement: &PlacedSystemBox,
) {
    let dx = placement.page_x;
    let dy = placement.page_y - placement.local_visual_top;
    let item_remap = system_box
        .items
        .iter()
        .map(|item| {
            (
                item.id.clone(),
                format!("system-{}-{}", system_box.system_index, item.id),
            )
        })
        .collect::<HashMap<_, _>>();

    for system in &system_box.systems {
        let mut final_system = system.clone();
        final_system.page_index = placement.page_index;
        final_system.x_pt += dx;
        final_system.y_pt += dy;
        page.systems.push(final_system);
    }
    for measure in &system_box.measures {
        let mut final_measure = measure.clone();
        final_measure.x_pt += dx;
        final_measure.y_pt += dy;
        page.measures.push(final_measure);
    }
    for item in &system_box.items {
        let mut final_item = item.clone();
        final_item.id = item_remap
            .get(&item.id)
            .cloned()
            .unwrap_or_else(|| item.id.clone());
        if let Some(anchor) = final_item.anchor_item_id.clone() {
            final_item.anchor_item_id = item_remap.get(&anchor).cloned();
        }
        translate_scene_item(&mut final_item, dx, dy);
        page.items.push(final_item);
    }
    for composite in &system_box.composites {
        let mut final_composite = composite.clone();
        final_composite.id = format!("system-{}-{}", system_box.system_index, final_composite.id);
        final_composite.child_item_ids = final_composite
            .child_item_ids
            .iter()
            .filter_map(|id| item_remap.get(id).cloned())
            .collect();
        page.composites.push(final_composite);
    }
}
