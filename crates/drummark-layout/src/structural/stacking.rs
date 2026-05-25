use crate::roles as scene_roles;
use crate::scene_geometry::{bounding_box_for_ids, item_bounds, translate_item_ids};
use crate::*;

#[derive(Clone)]
pub(crate) struct EdgeGroup {
    item_ids: Vec<String>,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    priority: u8,
    below_staff: bool,
}

pub(crate) fn stack_scene_structural_items(
    items: &mut [SceneItem],
    composites: &[SceneComposite],
    edge_padding: f32,
) {
    let item_index = items
        .iter()
        .enumerate()
        .map(|(index, item)| (item.id.clone(), index))
        .collect::<std::collections::HashMap<_, _>>();
    let mut groups = Vec::new();
    let mut volta_groups = std::collections::BTreeMap::<i32, Vec<String>>::new();

    for composite in composites {
        if composite.kind == CompositeKind::Volta {
            if let Some((_, y, _, _)) =
                bounding_box_for_ids(items, &item_index, &composite.child_item_ids)
            {
                let key = (y * 100.0).round() as i32;
                volta_groups
                    .entry(key)
                    .or_default()
                    .extend(composite.child_item_ids.iter().cloned());
            }
            continue;
        }
        let priority = match composite.kind {
            CompositeKind::Navigation => Some((1_u8, false)),
            CompositeKind::RepeatSpan => Some((2_u8, false)),
            CompositeKind::Hairpin => Some((1_u8, true)),
            _ => None,
        };
        let Some((priority, below_staff)) = priority else {
            continue;
        };
        if composite.child_item_ids.is_empty() {
            continue;
        }
        if let Some((x, y, width, height)) =
            bounding_box_for_ids(items, &item_index, &composite.child_item_ids)
        {
            groups.push(EdgeGroup {
                item_ids: composite.child_item_ids.clone(),
                x,
                y,
                width,
                height,
                priority,
                below_staff,
            });
        }
    }

    for (_, item_ids) in volta_groups {
        if let Some((x, y, width, height)) = bounding_box_for_ids(items, &item_index, &item_ids) {
            groups.push(EdgeGroup {
                item_ids,
                x,
                y,
                width,
                height,
                priority: 3,
                below_staff: false,
            });
        }
    }

    for role in [scene_roles::MEASURE_NUMBER] {
        for item in items.iter().filter(|item| item.role == role) {
            if let Some((x, y, width, height)) = item_bounds(item) {
                groups.push(EdgeGroup {
                    item_ids: vec![item.id.clone()],
                    x,
                    y,
                    width,
                    height,
                    priority: 0,
                    below_staff: false,
                });
            }
        }
    }

    groups.sort_by(|a, b| a.priority.cmp(&b.priority));
    let mut shifted: Vec<EdgeGroup> = Vec::new();
    for mut group in groups {
        loop {
            let overlap = shifted
                .iter()
                .filter(|other| other.below_staff == group.below_staff)
                .find(|other| {
                    let x_overlap =
                        group.x < other.x + other.width && group.x + group.width > other.x;
                    let y_overlap =
                        group.y < other.y + other.height && group.y + group.height > other.y;
                    x_overlap && y_overlap
                })
                .cloned();
            let Some(other) = overlap else { break };
            if group.below_staff {
                group.y = other.y + other.height + edge_padding;
            } else {
                group.y = other.y - group.height - edge_padding;
            }
        }
        if let Some((_, original_y, _, _)) =
            bounding_box_for_ids(items, &item_index, &group.item_ids)
        {
            translate_item_ids(items, &item_index, &group.item_ids, group.y - original_y);
        }
        shifted.push(group);
    }
}
