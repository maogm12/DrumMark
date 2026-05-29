use std::collections::HashMap;

use crate::{PageHeader, SceneComposite, SceneItem, SceneMeasure, ScenePage, SceneSystem};

pub fn page_header_items(page: &ScenePage) -> &[SceneItem] {
    page.header
        .as_ref()
        .map(|header| header.items.as_slice())
        .unwrap_or(&[])
}

pub fn page_header_composites(page: &ScenePage) -> &[SceneComposite] {
    page.header
        .as_ref()
        .map(|header| header.composites.as_slice())
        .unwrap_or(&[])
}

pub fn page_all_measures<'a>(page: &'a ScenePage) -> impl Iterator<Item = &'a SceneMeasure> {
    page.systems.iter().flat_map(|system| system.measures.iter())
}

pub fn page_all_items<'a>(page: &'a ScenePage) -> impl Iterator<Item = &'a SceneItem> {
    page_header_items(page)
        .iter()
        .chain(page.systems.iter().flat_map(|system| system.items.iter()))
}

pub fn page_all_composites<'a>(page: &'a ScenePage) -> impl Iterator<Item = &'a SceneComposite> {
    page_header_composites(page)
        .iter()
        .chain(
            page.systems
                .iter()
                .flat_map(|system| system.composites.iter()),
        )
}

pub fn page_measure_count(page: &ScenePage) -> usize {
    page.systems.iter().map(|system| system.measures.len()).sum()
}

pub fn collect_page_measures(page: &ScenePage) -> Vec<SceneMeasure> {
    page.systems
        .iter()
        .flat_map(|system| system.measures.iter().cloned())
        .collect()
}

pub fn system_for_measure<'a>(page: &'a ScenePage, measure_id: &str) -> Option<&'a SceneSystem> {
    page.systems
        .iter()
        .find(|system| system.measures.iter().any(|measure| measure.id == measure_id))
}

pub fn route_items_to_systems(systems: &mut [SceneSystem], items: Vec<SceneItem>) {
    for item in items {
        let Some(measure_id) = item.measure_id.as_deref() else {
            continue;
        };
        if let Some(system) = systems
            .iter_mut()
            .find(|system| system.measures.iter().any(|measure| measure.id == measure_id))
        {
            system.items.push(item);
        }
    }
}

pub fn route_composites_to_systems(systems: &mut [SceneSystem], composites: Vec<SceneComposite>) {
    let item_to_system: HashMap<String, usize> = systems
        .iter()
        .enumerate()
        .flat_map(|(index, system)| {
            system
                .items
                .iter()
                .map(move |item| (item.id.clone(), index))
        })
        .collect();

    for composite in composites {
        let mut counts: HashMap<usize, usize> = HashMap::new();
        for child_id in &composite.child_item_ids {
            if let Some(index) = item_to_system.get(child_id) {
                *counts.entry(*index).or_default() += 1;
            }
        }
        let Some((system_index, _)) = counts.into_iter().max_by_key(|(_, count)| *count) else {
            continue;
        };
        systems[system_index].composites.push(composite);
    }
}

pub fn dedupe_page_item_ids(page: &mut ScenePage) {
    if let Some(header) = page.header.as_mut() {
        let mut seen = std::collections::BTreeSet::new();
        header.items.retain(|item| seen.insert(item.id.clone()));
    }
    for system in &mut page.systems {
        let mut seen = std::collections::BTreeSet::new();
        system.items.retain(|item| seen.insert(item.id.clone()));
    }
}
