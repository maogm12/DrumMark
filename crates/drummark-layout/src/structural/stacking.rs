use crate::roles as scene_roles;
use crate::scene_geometry::{bounding_box_for_ids, item_bounds, translate_item_ids};
use crate::*;

const STICKING_ROLE: &str = "sticking";

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
            CompositeKind::Navigation => Some((3_u8, false)),
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
                priority: 2,
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

/// Push sticking labels above other above-staff content in the same measure.
/// Stacking order from staff upward: notes → accents → voltas → navigation → sticking.
pub(crate) fn stack_sticking_items(
    items: &mut [SceneItem],
    measures: &[SceneMeasure],
    edge_padding: f32,
) {
    const SKYLINE_ABOVE_STAFF_PT: f32 = 70.0;
    const SKYLINE_BELOW_STAFF_PT: f32 = 24.0;

    let measure_staff_top = measures
        .iter()
        .map(|measure| (measure.id.as_str(), measure.y_pt + 10.0))
        .collect::<std::collections::HashMap<_, _>>();

    let sticking_ids = items
        .iter()
        .filter(|item| item.role == STICKING_ROLE)
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();

    for sticking_id in sticking_ids {
        let Some(sticking_measure_id) = items
            .iter()
            .find(|item| item.id == sticking_id)
            .and_then(|item| item.measure_id.clone())
        else {
            continue;
        };
        let sticking_anchor = items
            .iter()
            .find(|item| item.id == sticking_id)
            .and_then(|item| item.anchor_item_id.clone());
        let reference_staff_top = measure_staff_top
            .get(sticking_measure_id.as_str())
            .copied();

        let Some((left, _, width, height)) = items
            .iter()
            .find(|item| item.id == sticking_id)
            .and_then(item_bounds)
        else {
            continue;
        };
        let right = left + width;

        let mut skyline_top = f32::INFINITY;
        for item in items.iter() {
            if item.id == sticking_id {
                continue;
            }
            if item.measure_id.as_deref() != Some(sticking_measure_id.as_str()) {
                continue;
            }
            if scene_roles::is_decoration_role(&item.role) {
                continue;
            }
            let shares_anchor = sticking_anchor.as_ref().is_some_and(|anchor| {
                item.id == *anchor || item.anchor_item_id.as_deref() == Some(anchor.as_str())
            });
            let Some((item_x, item_y, item_width, _)) = item_bounds(item) else {
                continue;
            };
            if let Some(staff_top) = reference_staff_top {
                if item_y < staff_top - SKYLINE_ABOVE_STAFF_PT
                    || item_y > staff_top + SKYLINE_BELOW_STAFF_PT
                {
                    continue;
                }
            }
            let item_right = item_x + item_width;
            let x_overlap = item_x < right && item_right > left;
            if !shares_anchor && !x_overlap {
                continue;
            }
            skyline_top = skyline_top.min(item_y);
        }

        if !skyline_top.is_finite() {
            continue;
        }

        let target_top = skyline_top - edge_padding - height;
        let Some((_, current_top, _, _)) = items
            .iter()
            .find(|item| item.id == sticking_id)
            .and_then(item_bounds)
        else {
            continue;
        };
        let delta = target_top - current_top;
        if delta >= -0.01 {
            continue;
        }

        let item_index = items
            .iter()
            .enumerate()
            .map(|(index, item)| (item.id.clone(), index))
            .collect::<std::collections::HashMap<_, _>>();
        translate_item_ids(items, &item_index, std::slice::from_ref(&sticking_id), delta);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene_builder::{LineItemSpec, SceneEmitSink, TextItemSpec};
    use crate::TextRole;

    fn measure(id: &str, y_pt: f32) -> SceneMeasure {
        SceneMeasure {
            id: id.to_string(),
            index: 0,
            global_index: 0,
            system_id: "system-0".to_string(),
            x_pt: 0.0,
            y_pt,
            width_pt: 200.0,
            height_pt: 80.0,
        }
    }

    #[test]
    fn sticking_stacks_above_anchored_stem_even_without_x_overlap() {
        let mut items = Vec::new();
        let mut counter = 0usize;
        let mut sink = SceneEmitSink::new(&mut items, &mut counter);

        let note_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("m0"),
            role: "notehead",
            x: 194.5,
            y: 219.0,
            text_role: TextRole::Tempo,
            text: "note".to_string(),
            font_family: "Bravura",
            font_size_pt: 30.0,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let stem_id = sink.push_line_item(LineItemSpec {
            measure_id: Some("m0"),
            role: "stem",
            x1: 205.675,
            y1: 187.0,
            x2: 205.675,
            y2: 218.0,
            stroke: "#333",
            stroke_width: 1.5,
            stroke_line_cap: None,
        });
        sink.set_anchor_item_id(&stem_id, Some(note_id.clone()));
        let sticking_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("m0"),
            role: STICKING_ROLE,
            x: 201.5,
            y: 199.0,
            text_role: TextRole::Sticking,
            text: "R".to_string(),
            font_family: "Academico",
            font_size_pt: 12.0,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        sink.set_anchor_item_id(&sticking_id, Some(note_id));
        let _ = sticking_id;

        stack_sticking_items(&mut items, &[measure("m0", 200.0)], 4.0);

        let stem_top = item_bounds(
            items
                .iter()
                .find(|item| item.role == "stem")
                .expect("stem"),
        )
        .unwrap()
        .1;
        let sticking = items
            .iter()
            .find(|item| item.role == STICKING_ROLE)
            .expect("sticking");
        let (_, sticking_top, _, sticking_height) = item_bounds(sticking).unwrap();
        assert!(
            sticking_top + sticking_height <= stem_top - 4.0 + 0.01,
            "sticking should clear anchored stem tip"
        );
    }

    #[test]
    fn sticking_stacks_above_navigation_and_volta_content() {
        let mut items = Vec::new();
        let mut counter = 0usize;
        let mut sink = SceneEmitSink::new(&mut items, &mut counter);

        let nav_id = sink.push_glyph_item(GlyphItemSpec {
            measure_id: Some("m0"),
            role: "nav-start",
            x: 48.0,
            y: 20.0,
            glyph_role: GlyphRole::NavigationSegno,
            font_family: "Bravura",
            font_size_pt: 20.0,
            fill: "#333",
        });
        let sticking_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("m0"),
            role: STICKING_ROLE,
            x: 50.0,
            y: 30.0,
            text_role: TextRole::Sticking,
            text: "R".to_string(),
            font_family: "Academico",
            font_size_pt: 12.0,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        let _ = (nav_id, sticking_id);

        stack_sticking_items(&mut items, &[measure("m0", 0.0)], 4.0);

        let nav_top = item_bounds(&items[0]).unwrap().1;
        let sticking_top = item_bounds(&items[1]).unwrap().1;
        assert!(
            sticking_top + 0.01 < nav_top,
            "sticking should sit above navigation markers"
        );
    }

    #[test]
    fn sticking_does_not_use_obstacles_from_other_measures_at_same_x() {
        let mut items = Vec::new();
        let mut counter = 0usize;
        let mut sink = SceneEmitSink::new(&mut items, &mut counter);

        let _upper_note = sink.push_text_item(TextItemSpec {
            measure_id: Some("m0"),
            role: "notehead",
            x: 100.0,
            y: 219.0,
            text_role: TextRole::Tempo,
            text: "n".to_string(),
            font_family: "Bravura",
            font_size_pt: 30.0,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let _upper_stem = sink.push_line_item(LineItemSpec {
            measure_id: Some("m0"),
            role: "stem",
            x1: 111.0,
            y1: 187.0,
            x2: 111.0,
            y2: 218.0,
            stroke: "#333",
            stroke_width: 1.5,
            stroke_line_cap: None,
        });
        let lower_note_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("m1"),
            role: "notehead",
            x: 100.0,
            y: 419.0,
            text_role: TextRole::Tempo,
            text: "n".to_string(),
            font_family: "Bravura",
            font_size_pt: 30.0,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let _lower_stem = sink.push_line_item(LineItemSpec {
            measure_id: Some("m1"),
            role: "stem",
            x1: 111.0,
            y1: 387.0,
            x2: 111.0,
            y2: 418.0,
            stroke: "#333",
            stroke_width: 1.5,
            stroke_line_cap: None,
        });
        let sticking_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("m1"),
            role: STICKING_ROLE,
            x: 100.0,
            y: 399.0,
            text_role: TextRole::Sticking,
            text: "R".to_string(),
            font_family: "Academico",
            font_size_pt: 12.0,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
        sink.set_anchor_item_id(&sticking_id, Some(lower_note_id));

        stack_sticking_items(
            &mut items,
            &[measure("m0", 200.0), measure("m1", 400.0)],
            4.0,
        );

        let sticking = items
            .iter()
            .find(|item| item.id == sticking_id)
            .expect("sticking");
        let ScenePrimitive::TextRun(text) = &sticking.primitive else {
            panic!("expected text");
        };
        assert!(
            text.y_pt > 390.0,
            "lower-system sticking should stay near its staff, got {}",
            text.y_pt
        );
    }
}
