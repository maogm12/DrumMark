use crate::contract::Fraction;
use crate::metrics::canonical_glyph_metric;
use crate::metrics::{GlyphRole, TextRole};
use crate::{
    GlyphRun, LineSegment, PathShape, RectShape, SceneItem, SceneItemKind, ScenePrimitive, TextRun,
};

/// Shared scene item builder with deterministic `item-N` ids.
pub(crate) struct SceneBuilder<'a> {
    items: &'a mut Vec<SceneItem>,
    counter: &'a mut usize,
}

/// Migration alias; target-state name is [`SceneBuilder`].
pub(crate) type SceneEmitSink<'a> = SceneBuilder<'a>;

impl<'a> SceneBuilder<'a> {
    pub(crate) fn new(items: &'a mut Vec<SceneItem>, counter: &'a mut usize) -> Self {
        Self { items, counter }
    }

    pub(crate) fn items(&self) -> &[SceneItem] {
        self.items
    }

    #[cfg(test)]
    pub(crate) fn item(&self, item_id: &str) -> Option<&SceneItem> {
        self.items.iter().find(|item| item.id == item_id)
    }

    /// Temporary migration helper. Prefer item-id-targeted mutation helpers.
    #[allow(dead_code)]
    pub(crate) fn last_item_mut(&mut self) -> Option<&mut SceneItem> {
        self.items.last_mut()
    }

    fn next_id(&mut self) -> String {
        let id = format!("item-{}", self.counter);
        *self.counter += 1;
        id
    }

    fn item_mut(&mut self, item_id: &str) -> Option<&mut SceneItem> {
        self.items.iter_mut().find(|item| item.id == item_id)
    }

    pub(crate) fn set_anchor_item_id(&mut self, item_id: &str, anchor_item_id: Option<String>) {
        if let Some(item) = self.item_mut(item_id) {
            item.anchor_item_id = anchor_item_id;
        }
    }

    pub(crate) fn set_measure_local_fraction(&mut self, item_id: &str, fraction: Fraction) {
        if let Some(item) = self.item_mut(item_id) {
            item.measure_local_fraction = Some(fraction);
        }
    }

    pub(crate) fn set_text_y(&mut self, item_id: &str, y_pt: f32) {
        if let Some(item) = self.item_mut(item_id) {
            if let ScenePrimitive::TextRun(text) = &mut item.primitive {
                text.y_pt = y_pt;
            }
        }
    }

    pub(crate) fn adjust_stem_tip(&mut self, stem_id: &str, target_y: f32, stem_up: bool) {
        if let Some(item) = self.item_mut(stem_id) {
            if let ScenePrimitive::LineSegment(line) = &mut item.primitive {
                if stem_up {
                    line.y1_pt = target_y;
                } else {
                    line.y2_pt = target_y;
                }
            }
        }
    }

    pub(crate) fn push_rect_item(&mut self, spec: RectItemSpec<'_>) {
        let id = self.next_id();
        self.items.push(SceneItem {
            id,
            measure_id: spec.measure_id.map(ToString::to_string),
            anchor_item_id: None,
            measure_local_fraction: None,
            role: spec.role.to_string(),
            kind: SceneItemKind::Rect,
            z_index: 0,
            primitive: ScenePrimitive::Rect(RectShape {
                x_pt: spec.x,
                y_pt: spec.y,
                width_pt: spec.width,
                height_pt: spec.height,
                fill: spec.fill.to_string(),
                stroke: spec.stroke.map(ToString::to_string),
                stroke_width: spec.stroke_width,
            }),
        });
    }

    pub(crate) fn push_text_item(&mut self, spec: TextItemSpec<'_>) -> String {
        let id = self.next_id();
        let font_style = if spec.text_role == TextRole::Dynamic {
            Some("italic".to_string())
        } else {
            None
        };
        let accessible_label = if spec.text_role == TextRole::Dynamic {
            Some(format!("dynamic {}", spec.text))
        } else {
            None
        };
        self.items.push(SceneItem {
            id: id.clone(),
            measure_id: spec.measure_id.map(ToString::to_string),
            anchor_item_id: None,
            measure_local_fraction: None,
            role: spec.role.to_string(),
            kind: SceneItemKind::TextRun,
            z_index: 0,
            primitive: ScenePrimitive::TextRun(TextRun {
                x_pt: spec.x,
                y_pt: spec.y,
                text_role: spec.text_role,
                text: spec.text,
                font_family: spec.font_family.to_string(),
                font_size_pt: spec.font_size_pt,
                fill: spec.fill.to_string(),
                text_anchor: spec.text_anchor.map(ToString::to_string),
                font_weight: spec.font_weight.map(ToString::to_string),
                font_style,
                accessible_label,
            }),
        });
        id
    }

    pub(crate) fn push_line_item(&mut self, spec: LineItemSpec<'_>) -> String {
        let id = self.next_id();
        self.items.push(SceneItem {
            id: id.clone(),
            measure_id: spec.measure_id.map(ToString::to_string),
            anchor_item_id: None,
            measure_local_fraction: None,
            role: spec.role.to_string(),
            kind: SceneItemKind::LineSegment,
            z_index: 0,
            primitive: ScenePrimitive::LineSegment(LineSegment {
                x1_pt: spec.x1,
                y1_pt: spec.y1,
                x2_pt: spec.x2,
                y2_pt: spec.y2,
                stroke: spec.stroke.to_string(),
                stroke_width: spec.stroke_width,
                stroke_line_cap: spec.stroke_line_cap.map(ToString::to_string),
            }),
        });
        id
    }

    pub(crate) fn push_path_item(&mut self, spec: PathItemSpec<'_>) -> String {
        let id = self.next_id();
        self.items.push(SceneItem {
            id: id.clone(),
            measure_id: spec.measure_id.map(ToString::to_string),
            anchor_item_id: None,
            measure_local_fraction: None,
            role: spec.role.to_string(),
            kind: SceneItemKind::Path,
            z_index: 0,
            primitive: ScenePrimitive::Path(PathShape {
                d: spec.d,
                fill: spec.fill.to_string(),
                stroke: spec.stroke.map(ToString::to_string),
                stroke_width: spec.stroke_width,
            }),
        });
        id
    }

    pub(crate) fn push_glyph_item(&mut self, spec: GlyphItemSpec<'_>) -> String {
        let id = self.next_id();
        let metric = canonical_glyph_metric(spec.glyph_role);
        self.items.push(SceneItem {
            id: id.clone(),
            measure_id: spec.measure_id.map(ToString::to_string),
            anchor_item_id: None,
            measure_local_fraction: None,
            role: spec.role.to_string(),
            kind: SceneItemKind::GlyphRun,
            z_index: 0,
            primitive: ScenePrimitive::GlyphRun(GlyphRun {
                x_pt: spec.x,
                y_pt: spec.y,
                glyph_role: spec.glyph_role,
                glyph_count: 1,
                smufl_codepoint: Some(metric.smufl_codepoint),
                font_family: spec.font_family.to_string(),
                font_size_pt: spec.font_size_pt,
                fill: spec.fill.to_string(),
            }),
        });
        id
    }
}

pub(crate) struct RectItemSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) role: &'a str,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
    pub(crate) fill: &'a str,
    pub(crate) stroke: Option<&'a str>,
    pub(crate) stroke_width: Option<f32>,
}

pub(crate) struct TextItemSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) role: &'a str,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) text_role: TextRole,
    pub(crate) text: String,
    pub(crate) font_family: &'a str,
    pub(crate) font_size_pt: f32,
    pub(crate) fill: &'a str,
    pub(crate) text_anchor: Option<&'a str>,
    pub(crate) font_weight: Option<&'a str>,
}

pub(crate) struct LineItemSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) role: &'a str,
    pub(crate) x1: f32,
    pub(crate) y1: f32,
    pub(crate) x2: f32,
    pub(crate) y2: f32,
    pub(crate) stroke: &'a str,
    pub(crate) stroke_width: f32,
    pub(crate) stroke_line_cap: Option<&'a str>,
}

pub(crate) struct PathItemSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) role: &'a str,
    pub(crate) d: String,
    pub(crate) fill: &'a str,
    pub(crate) stroke: Option<&'a str>,
    pub(crate) stroke_width: Option<f32>,
}

pub(crate) struct GlyphItemSpec<'a> {
    pub(crate) measure_id: Option<&'a str>,
    pub(crate) role: &'a str,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) glyph_role: GlyphRole,
    pub(crate) font_family: &'a str,
    pub(crate) font_size_pt: f32,
    pub(crate) fill: &'a str,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Fraction, GlyphRole, ScenePrimitive, TextRole};

    #[test]
    fn scene_builder_shares_one_counter_across_pushes() {
        let mut items = Vec::new();
        let mut counter = 0usize;

        {
            let mut sink = SceneEmitSink::new(&mut items, &mut counter);
            let text_id = sink.push_text_item(TextItemSpec {
                measure_id: Some("measure-0"),
                role: "dynamic",
                x: 10.0,
                y: 20.0,
                text_role: TextRole::Dynamic,
                text: "mf".to_string(),
                font_family: "Academico",
                font_size_pt: 12.0,
                fill: "#333",
                text_anchor: Some("middle"),
                font_weight: None,
            });
            let line_id = sink.push_line_item(LineItemSpec {
                measure_id: Some("measure-0"),
                role: "stem",
                x1: 14.0,
                y1: 22.0,
                x2: 14.0,
                y2: 8.0,
                stroke: "#333",
                stroke_width: 1.5,
                stroke_line_cap: None,
            });

            assert_eq!(text_id, "item-0");
            assert_eq!(line_id, "item-1");
        }

        let mut sink = SceneEmitSink::new(&mut items, &mut counter);
        let glyph_id = sink.push_glyph_item(GlyphItemSpec {
            measure_id: Some("measure-0"),
            role: "flag",
            x: 14.0,
            y: 8.0,
            glyph_role: GlyphRole::Flag8thUp,
            font_family: "Bravura",
            font_size_pt: 12.0,
            fill: "#333",
        });

        assert_eq!(glyph_id, "item-2");
        assert_eq!(sink.items().len(), 3);
    }

    #[test]
    fn scene_builder_supports_item_lookup_and_targeted_mutation() {
        let mut items = Vec::new();
        let mut counter = 0usize;
        let mut sink = SceneEmitSink::new(&mut items, &mut counter);

        let note_id = sink.push_text_item(TextItemSpec {
            measure_id: Some("measure-0"),
            role: "notehead",
            x: 30.0,
            y: 40.0,
            text_role: TextRole::Tempo,
            text: "x".to_string(),
            font_family: "Bravura",
            font_size_pt: 18.0,
            fill: "#333",
            text_anchor: None,
            font_weight: None,
        });
        let stem_id = sink.push_line_item(LineItemSpec {
            measure_id: Some("measure-0"),
            role: "stem",
            x1: 32.0,
            y1: 40.0,
            x2: 32.0,
            y2: 16.0,
            stroke: "#333",
            stroke_width: 1.5,
            stroke_line_cap: None,
        });

        sink.set_anchor_item_id(&stem_id, Some(note_id.clone()));
        sink.set_measure_local_fraction(
            &note_id,
            Fraction {
                numerator: 1,
                denominator: 4,
            },
        );
        sink.set_text_y(&note_id, 36.0);
        sink.adjust_stem_tip(&stem_id, 12.0, true);

        let note = sink.item(&note_id).expect("expected note item");
        let stem = sink.item(&stem_id).expect("expected stem item");

        assert_eq!(
            note.measure_local_fraction,
            Some(Fraction {
                numerator: 1,
                denominator: 4,
            })
        );
        match &note.primitive {
            ScenePrimitive::TextRun(text) => assert_eq!(text.y_pt, 36.0),
            primitive => panic!("expected text run, got {primitive:?}"),
        }
        assert_eq!(stem.anchor_item_id.as_deref(), Some(note_id.as_str()));
        match &stem.primitive {
            ScenePrimitive::LineSegment(line) => assert_eq!(line.y1_pt, 12.0),
            primitive => panic!("expected line segment, got {primitive:?}"),
        }
    }
}
