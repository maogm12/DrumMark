use super::*;

use crate::wire_js_export::{wire_js_composite, wire_js_item};
use js_sys::{Array, Object};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireLayoutScene {
    pub(crate) version: String,
    pub(crate) metrics_version: String,
    pub(crate) pages: Vec<WireScenePage>,
    pub(crate) issues: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WirePageHeader {
    pub(crate) items: Vec<WireSceneItem>,
    pub(crate) composites: Vec<WireSceneComposite>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireScenePage {
    pub(crate) index: u32,
    pub(crate) width_pt: f32,
    pub(crate) height_pt: f32,
    pub(crate) header: Option<WirePageHeader>,
    pub(crate) systems: Vec<WireSceneSystem>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireSceneSystem {
    pub(crate) id: String,
    pub(crate) index: u32,
    pub(crate) page_index: u32,
    pub(crate) x_pt: f32,
    pub(crate) y_pt: f32,
    pub(crate) width_pt: f32,
    pub(crate) height_pt: f32,
    pub(crate) measures: Vec<WireSceneMeasure>,
    pub(crate) items: Vec<WireSceneItem>,
    pub(crate) composites: Vec<WireSceneComposite>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireSceneMeasure {
    pub(crate) id: String,
    pub(crate) index: u32,
    pub(crate) global_index: u32,
    pub(crate) system_id: String,
    pub(crate) x_pt: f32,
    pub(crate) y_pt: f32,
    pub(crate) width_pt: f32,
    pub(crate) height_pt: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireSceneItem {
    pub(crate) id: String,
    pub(crate) measure_id: Option<String>,
    pub(crate) anchor_item_id: Option<String>,
    pub(crate) measure_local_fraction: Option<Fraction>,
    pub(crate) role: String,
    pub(crate) kind: &'static str,
    pub(crate) z_index: i32,
    pub(crate) primitive: WireScenePrimitive,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum WireScenePrimitive {
    GlyphRun {
        x_pt: f32,
        y_pt: f32,
        glyph_role: &'static str,
        glyph_count: u32,
        codepoint: Option<u32>,
        font_family: String,
        font_size_pt: f32,
        fill: String,
    },
    TextRun {
        x_pt: f32,
        y_pt: f32,
        text_role: &'static str,
        text: String,
        font_family: String,
        font_size_pt: f32,
        fill: String,
        text_anchor: Option<String>,
        font_weight: Option<String>,
        font_style: Option<String>,
        accessible_label: Option<String>,
    },
    LineSegment {
        x1_pt: f32,
        y1_pt: f32,
        x2_pt: f32,
        y2_pt: f32,
        stroke: String,
        stroke_width: f32,
        stroke_line_cap: Option<String>,
    },
    Rect {
        x_pt: f32,
        y_pt: f32,
        width_pt: f32,
        height_pt: f32,
        fill: String,
        stroke: Option<String>,
        stroke_width: Option<f32>,
    },
    Polyline {
        points_pt: Vec<(f32, f32)>,
    },
    Path {
        d: String,
        fill: String,
        stroke: Option<String>,
        stroke_width: Option<f32>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WireSceneComposite {
    pub(crate) id: String,
    pub(crate) kind: &'static str,
    pub(crate) fragment: &'static str,
    pub(crate) child_item_ids: Vec<String>,
    pub(crate) label: Option<String>,
    pub(crate) count: Option<u32>,
    pub(crate) start_anchor_id: Option<String>,
    pub(crate) end_anchor_id: Option<String>,
}

fn wire_scene_item(item: &SceneItem) -> WireSceneItem {
    WireSceneItem {
        id: item.id.clone(),
        measure_id: item.measure_id.clone(),
        anchor_item_id: item.anchor_item_id.clone(),
        measure_local_fraction: item.measure_local_fraction,
        role: item.role.clone(),
        kind: scene_item_kind_name(item.kind),
        z_index: item.z_index,
        primitive: match &item.primitive {
            ScenePrimitive::GlyphRun(glyph) => WireScenePrimitive::GlyphRun {
                x_pt: glyph.x_pt,
                y_pt: glyph.y_pt,
                glyph_role: glyph_role_name(glyph.glyph_role),
                glyph_count: glyph.glyph_count,
                codepoint: glyph.smufl_codepoint,
                font_family: glyph.font_family.clone(),
                font_size_pt: glyph.font_size_pt,
                fill: glyph.fill.clone(),
            },
            ScenePrimitive::TextRun(text) => WireScenePrimitive::TextRun {
                x_pt: text.x_pt,
                y_pt: text.y_pt,
                text_role: text_role_name(text.text_role),
                text: text.text.clone(),
                font_family: text.font_family.clone(),
                font_size_pt: text.font_size_pt,
                fill: text.fill.clone(),
                text_anchor: text.text_anchor.clone(),
                font_weight: text.font_weight.clone(),
                font_style: text.font_style.clone(),
                accessible_label: text.accessible_label.clone(),
            },
            ScenePrimitive::LineSegment(line) => WireScenePrimitive::LineSegment {
                x1_pt: line.x1_pt,
                y1_pt: line.y1_pt,
                x2_pt: line.x2_pt,
                y2_pt: line.y2_pt,
                stroke: line.stroke.clone(),
                stroke_width: line.stroke_width,
                stroke_line_cap: line.stroke_line_cap.clone(),
            },
            ScenePrimitive::Rect(rect) => WireScenePrimitive::Rect {
                x_pt: rect.x_pt,
                y_pt: rect.y_pt,
                width_pt: rect.width_pt,
                height_pt: rect.height_pt,
                fill: rect.fill.clone(),
                stroke: rect.stroke.clone(),
                stroke_width: rect.stroke_width,
            },
            ScenePrimitive::Polyline(polyline) => WireScenePrimitive::Polyline {
                points_pt: polyline.points_pt.clone(),
            },
            ScenePrimitive::Path(path) => WireScenePrimitive::Path {
                d: path.d.clone(),
                fill: path.fill.clone(),
                stroke: path.stroke.clone(),
                stroke_width: path.stroke_width,
            },
        },
    }
}

fn wire_scene_measure(measure: &SceneMeasure) -> WireSceneMeasure {
    WireSceneMeasure {
        id: measure.id.clone(),
        index: measure.index,
        global_index: measure.global_index,
        system_id: measure.system_id.clone(),
        x_pt: measure.x_pt,
        y_pt: measure.y_pt,
        width_pt: measure.width_pt,
        height_pt: measure.height_pt,
    }
}

fn wire_scene_composite(composite: &SceneComposite) -> WireSceneComposite {
    WireSceneComposite {
        id: composite.id.clone(),
        kind: composite_kind_name(composite.kind),
        fragment: fragment_kind_name(composite.fragment),
        child_item_ids: composite.child_item_ids.clone(),
        label: composite.label.clone(),
        count: composite.count,
        start_anchor_id: composite.start_anchor_id.clone(),
        end_anchor_id: composite.end_anchor_id.clone(),
    }
}

pub(crate) fn to_wire_scene(scene: &LayoutScene) -> WireLayoutScene {
    WireLayoutScene {
        version: scene.version.clone(),
        metrics_version: scene.metrics_version.clone(),
        pages: scene
            .pages
            .iter()
            .map(|page| WireScenePage {
                index: page.index,
                width_pt: page.width_pt,
                height_pt: page.height_pt,
                header: page.header.as_ref().map(|header| WirePageHeader {
                    items: header.items.iter().map(wire_scene_item).collect(),
                    composites: header
                        .composites
                        .iter()
                        .map(wire_scene_composite)
                        .collect(),
                }),
                systems: page
                    .systems
                    .iter()
                    .map(|system| WireSceneSystem {
                        id: system.id.clone(),
                        index: system.index,
                        page_index: system.page_index,
                        x_pt: system.x_pt,
                        y_pt: system.y_pt,
                        width_pt: system.width_pt,
                        height_pt: system.height_pt,
                        measures: system.measures.iter().map(wire_scene_measure).collect(),
                        items: system.items.iter().map(wire_scene_item).collect(),
                        composites: system
                            .composites
                            .iter()
                            .map(wire_scene_composite)
                            .collect(),
                    })
                    .collect(),
            })
            .collect(),
        issues: scene.issues.clone(),
    }
}

pub fn layout_scene_to_js(scene: &LayoutScene) -> JsValue {
    let wire = to_wire_scene(scene);
    let result = Object::new();
    js_sys::Reflect::set(
        &result,
        &JsValue::from_str("version"),
        &JsValue::from_str(&wire.version),
    )
    .unwrap();
    js_sys::Reflect::set(
        &result,
        &JsValue::from_str("metricsVersion"),
        &JsValue::from_str(&wire.metrics_version),
    )
    .unwrap();

    let pages = Array::new();
    for page in wire.pages {
        let page_obj = Object::new();
        js_sys::Reflect::set(
            &page_obj,
            &JsValue::from_str("index"),
            &JsValue::from_f64(page.index as f64),
        )
        .unwrap();
        js_sys::Reflect::set(
            &page_obj,
            &JsValue::from_str("widthPt"),
            &JsValue::from_f64(page.width_pt as f64),
        )
        .unwrap();
        js_sys::Reflect::set(
            &page_obj,
            &JsValue::from_str("heightPt"),
            &JsValue::from_f64(page.height_pt as f64),
        )
        .unwrap();

        if let Some(header) = page.header {
            let header_obj = Object::new();
            let header_items = Array::new();
            for item in header.items {
                header_items.push(&wire_js_item(&item).into());
            }
            js_sys::Reflect::set(
                &header_obj,
                &JsValue::from_str("items"),
                &header_items.into(),
            )
            .unwrap();
            let header_composites = Array::new();
            for composite in header.composites {
                header_composites.push(&wire_js_composite(&composite).into());
            }
            js_sys::Reflect::set(
                &header_obj,
                &JsValue::from_str("composites"),
                &header_composites.into(),
            )
            .unwrap();
            js_sys::Reflect::set(
                &page_obj,
                &JsValue::from_str("header"),
                &header_obj.into(),
            )
            .unwrap();
        }

        let systems = Array::new();
        for system in page.systems {
            let system_obj = Object::new();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("id"),
                &JsValue::from_str(&system.id),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("index"),
                &JsValue::from_f64(system.index as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("pageIndex"),
                &JsValue::from_f64(system.page_index as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("xPt"),
                &JsValue::from_f64(system.x_pt as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("yPt"),
                &JsValue::from_f64(system.y_pt as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("widthPt"),
                &JsValue::from_f64(system.width_pt as f64),
            )
            .unwrap();
            js_sys::Reflect::set(
                &system_obj,
                &JsValue::from_str("heightPt"),
                &JsValue::from_f64(system.height_pt as f64),
            )
            .unwrap();
            let measures = Array::new();
            for measure in &system.measures {
                let measure_obj = Object::new();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("id"), &JsValue::from_str(&measure.id)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("index"), &JsValue::from_f64(measure.index as f64)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("globalIndex"), &JsValue::from_f64(measure.global_index as f64)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("systemId"), &JsValue::from_str(&measure.system_id)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("xPt"), &JsValue::from_f64(measure.x_pt as f64)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("yPt"), &JsValue::from_f64(measure.y_pt as f64)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("widthPt"), &JsValue::from_f64(measure.width_pt as f64)).unwrap();
                js_sys::Reflect::set(&measure_obj, &JsValue::from_str("heightPt"), &JsValue::from_f64(measure.height_pt as f64)).unwrap();
                measures.push(&measure_obj);
            }
            js_sys::Reflect::set(&system_obj, &JsValue::from_str("measures"), &measures.into()).unwrap();

            let items = Array::new();
            for item in &system.items {
                items.push(&wire_js_item(item).into());
            }
            js_sys::Reflect::set(&system_obj, &JsValue::from_str("items"), &items.into()).unwrap();

            let composites = Array::new();
            for composite in &system.composites {
                composites.push(&wire_js_composite(composite).into());
            }
            js_sys::Reflect::set(&system_obj, &JsValue::from_str("composites"), &composites.into()).unwrap();

            systems.push(&system_obj);
        }
        js_sys::Reflect::set(&page_obj, &JsValue::from_str("systems"), &systems.into()).unwrap();
        pages.push(&page_obj);
    }
    js_sys::Reflect::set(&result, &JsValue::from_str("pages"), &pages.into()).unwrap();

    let issues = Array::new();
    for issue in wire.issues {
        issues.push(&JsValue::from_str(&issue));
    }
    js_sys::Reflect::set(&result, &JsValue::from_str("issues"), &issues.into()).unwrap();
    result.into()
}
