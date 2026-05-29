use drummark_core::ast::{
    Barline, Document, GroupExpr, MeasureExpr, MeasureSection, NoteExpr, SourceLocation,
};
use drummark_core::event::{EventKind, NormalizedEvent};
use drummark_core::fraction::Fraction as CoreFraction;
use drummark_core::normalize::{NormalizedMeasure, NormalizedScore};
use drummark_layout::{
    composite_kind_name, fragment_kind_name, glyph_role_name, scene_item_kind_name, text_role_name,
    Fraction, LayoutScene, SceneComposite, SceneItem, ScenePage, ScenePrimitive,
};
use serde_json::{json, Value};

pub fn ast_json(doc: &Document) -> Result<String, String> {
    serde_json::to_string_pretty(&json!({
        "version": "drummark-parser-ast/v1",
        "headers": {
            "title": doc.headers.title,
            "subtitle": doc.headers.subtitle,
            "composer": doc.headers.composer,
            "tempo": doc.headers.tempo,
            "time": doc.headers.time.map(|(beats, unit)| json!([beats, unit])),
            "grouping": doc.headers.grouping,
            "note": doc.headers.note.map(|(num, den)| json!([num, den])),
            "divisions": doc.headers.divisions,
        },
        "paragraphs": doc.paragraphs.iter().map(|paragraph| json!({
            "note": paragraph.note.map(|(num, den)| json!([num, den])),
            "lines": paragraph.lines.iter().map(|line| json!({
                "track": line.track,
                "measures": line.measures.iter().map(measure_section_json).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "errors": doc.errors.iter().map(|error| json!({
            "line": error.line,
            "column": error.column,
            "message": error.message,
        })).collect::<Vec<_>>(),
    }))
    .map_err(|error| format!("failed to serialize AST JSON: {error}"))
}

pub fn normalized_json(score: &NormalizedScore) -> Result<String, String> {
    serde_json::to_string_pretty(&json!({
        "version": score.version,
        "header": {
            "title": score.header.title,
            "subtitle": score.header.subtitle,
            "composer": score.header.composer,
            "tempo": score.header.tempo,
            "timeBeats": score.header.time_beats,
            "timeBeatUnit": score.header.time_beat_unit,
            "divisions": score.header.divisions,
            "noteValue": score.header.note_value,
            "grouping": score.header.grouping,
        },
        "tracks": score.tracks.iter().map(|track| json!({
            "id": track.id,
            "family": track.family,
        })).collect::<Vec<_>>(),
        "measures": score.measures.iter().map(normalized_measure_json).collect::<Vec<_>>(),
        "repeatSpans": score.repeat_spans.iter().map(|span| json!({
            "startMeasure": span.start_measure,
            "endMeasure": span.end_measure,
            "times": span.times,
        })).collect::<Vec<_>>(),
        "errors": score.errors,
    }))
    .map_err(|error| format!("failed to serialize IR JSON: {error}"))
}

pub fn scene_json(scene: &LayoutScene) -> Result<String, String> {
    serde_json::to_string_pretty(&json!({
        "version": scene.version,
        "metricsVersion": scene.metrics_version,
        "issues": scene.issues,
        "pages": scene.pages.iter().map(scene_page_json).collect::<Vec<_>>(),
    }))
    .map_err(|error| format!("failed to serialize scene JSON: {error}"))
}

fn measure_section_json(measure: &MeasureSection) -> Value {
    json!({
        "barline": barline_json(&measure.barline),
        "barlineLocation": source_location_json(&measure.barline_location),
        "closingBarline": measure.closing_barline.as_ref().map(barline_json),
        "closingBarlineLocation": measure.closing_barline_location.as_ref().map(source_location_json),
        "tokens": measure.tokens.iter().map(measure_expr_json).collect::<Vec<_>>(),
    })
}

fn source_location_json(location: &SourceLocation) -> Value {
    json!({
        "line": location.line,
        "column": location.column,
        "offset": location.offset,
    })
}

fn barline_json(barline: &Barline) -> Value {
    match barline {
        Barline::Regular => json!("regular"),
        Barline::Double => json!("double"),
        Barline::RepeatStart => json!("repeatStart"),
        Barline::RepeatEnd => json!("repeatEnd"),
        Barline::VoltaTerminator => json!("voltaTerminator"),
        Barline::RepeatEndVoltaTerminator => json!("repeatEndVoltaTerminator"),
        Barline::DoubleVoltaTerminator => json!("doubleVoltaTerminator"),
        Barline::VoltaRepeatStart => json!("voltaRepeatStart"),
        Barline::Volta { prefix, numbers } => json!({
            "kind": "volta",
            "prefix": prefix,
            "numbers": numbers,
        }),
    }
}

fn measure_expr_json(expr: &MeasureExpr) -> Value {
    match expr {
        MeasureExpr::BasicNote(note) => note_json("basic", note),
        MeasureExpr::SummonedNote { track, note } => {
            let mut value = note_json("summoned", note);
            value["track"] = json!(track);
            value
        }
        MeasureExpr::RoutedBracedBlock { track, content } => json!({
            "kind": "routedBraced",
            "track": track,
            "content": content.iter().map(measure_expr_json).collect::<Vec<_>>(),
        }),
        MeasureExpr::InlineBracedBlock(content) => json!({
            "kind": "inlineBraced",
            "content": content.iter().map(measure_expr_json).collect::<Vec<_>>(),
        }),
        MeasureExpr::Group(group) => group_json(group),
        MeasureExpr::CombinedHit(hits) => json!({
            "kind": "combinedHit",
            "hits": hits.iter().map(measure_expr_json).collect::<Vec<_>>(),
        }),
        MeasureExpr::MeasureRepeat(count) => json!({"kind": "measureRepeat", "count": count}),
        MeasureExpr::MultiRest(count) => json!({"kind": "multiRest", "count": count}),
        MeasureExpr::InlineRepeat(times) => json!({"kind": "inlineRepeat", "times": times}),
        MeasureExpr::Crescendo => json!({"kind": "crescendo"}),
        MeasureExpr::Decrescendo => json!({"kind": "decrescendo"}),
        MeasureExpr::HairpinEnd => json!({"kind": "hairpinEnd"}),
        MeasureExpr::Dynamic(level) => json!({"kind": "dynamic", "level": level.as_str()}),
        MeasureExpr::NavMarker(name) => json!({"kind": "navMarker", "name": name}),
        MeasureExpr::NavJump(name) => json!({"kind": "navJump", "name": name}),
    }
}

fn note_json(kind: &str, note: &NoteExpr) -> Value {
    json!({
        "kind": kind,
        "glyph": note.glyph,
        "dots": note.dots,
        "halves": note.halves,
        "stars": note.stars,
        "modifiers": note.modifiers,
    })
}

fn group_json(group: &GroupExpr) -> Value {
    json!({
        "kind": "group",
        "n": group.n,
        "items": group.items.iter().map(measure_expr_json).collect::<Vec<_>>(),
        "modifiers": group.modifiers,
    })
}

fn normalized_measure_json(measure: &NormalizedMeasure) -> Value {
    json!({
        "index": measure.index,
        "globalIndex": measure.global_index,
        "paragraphIndex": measure.paragraph_index,
        "measureInParagraph": measure.measure_in_paragraph,
        "sourceLine": measure.source_line,
        "barline": measure.barline,
        "closingBarline": measure.closing_barline,
        "startNav": measure.start_nav.as_ref().map(|nav| nav.kind_name()),
        "endNav": measure.end_nav.as_ref().map(|nav| nav.kind_name()),
        "volta": measure.volta,
        "measureRepeatSlashes": measure.measure_repeat_slashes,
        "multiRestCount": measure.multi_rest_count,
        "noteValue": measure.note_value,
        "voltaTerminator": measure.volta_terminator,
        "events": measure.events.iter().map(normalized_event_json).collect::<Vec<_>>(),
        "dynamics": measure.dynamics.iter().map(|dynamic| json!({
            "level": dynamic.level.as_str(),
            "at": core_fraction_json(dynamic.at),
        })).collect::<Vec<_>>(),
    })
}

fn normalized_event_json(event: &NormalizedEvent) -> Value {
    json!({
        "track": event.track,
        "paragraphIndex": event.paragraph_index,
        "measureIndex": event.measure_index,
        "measureInParagraph": event.measure_in_paragraph,
        "start": core_fraction_json(event.start),
        "duration": core_fraction_json(event.duration),
        "visualDuration": core_fraction_json(event.visual_duration),
        "kind": match event.kind {
            EventKind::Hit => "hit",
            EventKind::Rest => "rest",
            EventKind::Sticking => "sticking",
        },
        "glyph": event.glyph,
        "modifiers": event.modifiers,
        "dotCount": event.dot_count,
        "modifier": event.modifier,
        "voice": event.voice,
        "beam": event.beam,
        "tuplet": event.tuplet.map(|(actual, normal)| json!([actual, normal])),
        "sourceOffset": event.source_offset,
    })
}

fn scene_page_json(page: &ScenePage) -> Value {
    json!({
        "index": page.index,
        "widthPt": page.width_pt,
        "heightPt": page.height_pt,
        "header": page.header.as_ref().map(|header| json!({
            "items": header.items.iter().map(scene_item_json).collect::<Vec<_>>(),
            "composites": header.composites.iter().map(scene_composite_json).collect::<Vec<_>>(),
        })),
        "systems": page.systems.iter().map(|system| json!({
            "id": system.id,
            "index": system.index,
            "pageIndex": system.page_index,
            "xPt": system.x_pt,
            "yPt": system.y_pt,
            "widthPt": system.width_pt,
            "heightPt": system.height_pt,
            "measures": system.measures.iter().map(|measure| json!({
                "id": measure.id,
                "index": measure.index,
                "globalIndex": measure.global_index,
                "systemId": measure.system_id,
                "xPt": measure.x_pt,
                "yPt": measure.y_pt,
                "widthPt": measure.width_pt,
                "heightPt": measure.height_pt,
            })).collect::<Vec<_>>(),
            "items": system.items.iter().map(scene_item_json).collect::<Vec<_>>(),
            "composites": system.composites.iter().map(scene_composite_json).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
    })
}

fn scene_composite_json(composite: &SceneComposite) -> Value {
    json!({
        "id": composite.id,
        "kind": composite_kind_name(composite.kind),
        "fragment": fragment_kind_name(composite.fragment),
        "childItemIds": composite.child_item_ids,
        "label": composite.label,
        "count": composite.count,
        "startAnchorId": composite.start_anchor_id,
        "endAnchorId": composite.end_anchor_id,
    })
}

fn scene_item_json(item: &SceneItem) -> Value {
    json!({
        "id": item.id,
        "measureId": item.measure_id,
        "anchorItemId": item.anchor_item_id,
        "measureLocalFraction": item.measure_local_fraction.map(fraction_json),
        "role": item.role,
        "kind": scene_item_kind_name(item.kind),
        "zIndex": item.z_index,
        "primitive": scene_primitive_json(&item.primitive),
    })
}

fn scene_primitive_json(primitive: &ScenePrimitive) -> Value {
    match primitive {
        ScenePrimitive::GlyphRun(glyph) => json!({
            "xPt": glyph.x_pt,
            "yPt": glyph.y_pt,
            "glyphRole": glyph_role_name(glyph.glyph_role),
            "glyphCount": glyph.glyph_count,
            "codepoint": glyph.smufl_codepoint,
            "fontFamily": glyph.font_family,
            "fontSizePt": glyph.font_size_pt,
            "fill": glyph.fill,
        }),
        ScenePrimitive::TextRun(text) => json!({
            "xPt": text.x_pt,
            "yPt": text.y_pt,
            "textRole": text_role_name(text.text_role),
            "text": text.text,
            "fontFamily": text.font_family,
            "fontSizePt": text.font_size_pt,
            "fill": text.fill,
            "textAnchor": text.text_anchor,
            "fontWeight": text.font_weight,
            "fontStyle": text.font_style,
            "accessibleLabel": text.accessible_label,
        }),
        ScenePrimitive::LineSegment(line) => json!({
            "x1Pt": line.x1_pt,
            "y1Pt": line.y1_pt,
            "x2Pt": line.x2_pt,
            "y2Pt": line.y2_pt,
            "stroke": line.stroke,
            "strokeWidth": line.stroke_width,
            "strokeLineCap": line.stroke_line_cap,
        }),
        ScenePrimitive::Rect(rect) => json!({
            "xPt": rect.x_pt,
            "yPt": rect.y_pt,
            "widthPt": rect.width_pt,
            "heightPt": rect.height_pt,
            "fill": rect.fill,
            "stroke": rect.stroke,
            "strokeWidth": rect.stroke_width,
        }),
        ScenePrimitive::Polyline(polyline) => json!({
            "pointsPt": polyline.points_pt,
        }),
        ScenePrimitive::Path(path) => json!({
            "d": path.d,
            "fill": path.fill,
            "stroke": path.stroke,
            "strokeWidth": path.stroke_width,
        }),
    }
}

fn fraction_json(fraction: Fraction) -> Value {
    json!({
        "numerator": fraction.numerator,
        "denominator": fraction.denominator,
    })
}

fn core_fraction_json(fraction: CoreFraction) -> Value {
    json!({
        "numerator": fraction.numerator,
        "denominator": fraction.denominator,
    })
}
