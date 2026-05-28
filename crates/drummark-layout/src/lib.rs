mod collision;
mod compat_planning;
mod contract;
mod display;
mod engraving;
mod fraction;
mod instruments;
mod metrics;
mod names;
mod options;
mod pagination;
mod planning;
mod roles;
mod scene;
mod scene_builder;
mod scene_geometry;
mod snapshot;
mod structural;
mod validation;
mod wire;

pub use compat_planning::{
    build_systems, place_barlines, place_notes, stack_edge_elements, ElementKind, LayoutElement,
    MeasureLayout, SlotMapper, System,
};
pub use contract::*;
#[allow(unused_imports)] // `scene` / `planning` pull these in via `super::*`.
use display::*;
#[allow(unused_imports)] // Re-exported for `scene` and integration tests.
pub(crate) use engraving::{
    glyph_role_for_codepoint, ledger_line_offsets_for_staff_position, render_hit_cluster,
    render_hit_cluster_stem_and_accents, render_left_barline, render_measure_events,
    render_right_barline, render_right_left_repeat_barline, render_slot_group,
    render_start_repeat_barline, render_system_opening_barline, resolve_rest_placement, BeamAnchor,
    BeamAnchorPlan, BeamLineSegment, BeamRunState, HitClusterPlan, NotePlacement,
    PreparedClusterNote, RenderMeasureEventsInput, RestPlacement, RestPlacementDiagnostic,
    RightBarlineSpec, SlotEvent, StemLayout, StemRenderPlan, TupletRun, TupletRunKey,
};
#[allow(unused_imports)] // `planning` imports via `crate::*`.
use fraction::*;
pub use instruments::*;
pub use metrics::*;
#[allow(unused_imports)] // `wire` pulls these in via `super::*`.
use names::*;
pub use names::{
    composite_kind_name, fragment_kind_name, glyph_role_name, scene_item_kind_name, text_role_name,
};
pub use options::*;
#[allow(unused_imports)] // `scene` and integration tests.
pub(crate) use pagination::{
    assemble_placed_system_box, header_box_from_page, layout_overflow_warning,
    page0_first_system_cursor, paginate_system_boxes, paginate_unpaginated_page,
    system_box_from_page_system, system_boxes_from_page, BoxPaginationResult, HeaderLayoutBox,
    PlacedSystemBox, SystemLayoutBox,
};
#[allow(unused_imports)] // `scene` pulls these in via `super::*`.
use planning::*;
use scene_builder::{GlyphItemSpec, LineItemSpec, SceneEmitSink, TextItemSpec};
use scene_geometry::bounds_for_items;
#[cfg(test)]
use scene_geometry::item_bounds;
#[allow(unused_imports)] // `scene` pulls these in via `super::*`.
use structural::spans::{
    push_volta_composites, render_dynamic_marks, render_hairpin_fragments, render_nav_markers,
    DeferredNavMarker,
};
#[cfg(test)]
use structural::spans::{volta_type_for_measure, VoltaSegmentType};
use structural::stacking::{stack_scene_structural_items, stack_sticking_items};

pub use scene::build_layout_scene;
pub(crate) use scene::fraction_to_f32;
pub use snapshot::layout_scene_snapshot;
pub use wire::layout_scene_to_js;

#[cfg(test)]
use collision::{rect_obstacle_from_bounds, rects_intersect, RectObstacle};
#[cfg(test)]
use scene::render_header_layout_box;
#[cfg(test)]
use validation::validate_layout_scene;

const BASE_FONT_SIZE_PT: f32 = 30.0;
const NOTE_FLAG_FONT_SIZE_PT: f32 = 22.0;

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_track_family() {
        assert_eq!(track_family("HH"), "cymbal");
        assert_eq!(track_family("SD"), "drum");
        assert_eq!(track_family("BD"), "drum");
        assert_eq!(track_family("HF"), "pedal");
        assert_eq!(track_family("CB"), "percussion");
    }

    #[test]
    fn test_staff_y() {
        assert_eq!(staff_y_for_track("HH"), -0.5);
        assert_eq!(staff_y_for_track("SD"), 1.5);
        assert_eq!(staff_y_for_track("BD"), 3.5);
        assert_eq!(staff_y_for_track("T1"), 0.5);
        assert_eq!(staff_y_for_track("C"), -1.0);
    }

    #[test]
    fn test_notehead_glyph() {
        let g = notehead_glyph("HH", &[], "x");
        assert_eq!(g.smufl_codepoint, 0xE0A9); // cymbal → X notehead
        let g = notehead_glyph("HF", &[], "d");
        assert_eq!(g.smufl_codepoint, 0xE0A9); // hi-hat pedal → X notehead
        let g = notehead_glyph("SD", &[], "d");
        assert_eq!(g.smufl_codepoint, 0xE0A4); // drum → standard notehead
        let g = notehead_glyph("SD", &["cross".to_string()], "d");
        assert_eq!(g.smufl_codepoint, 0xE0A9); // cross mod → X notehead
        let g = notehead_glyph("SD", &["rim".to_string()], "d");
        assert_eq!(g.smufl_codepoint, 0xE0D0); // rim mod → slashed black notehead
        let g = notehead_glyph("SD", &["ghost".to_string()], "d");
        assert_eq!(g.role, GlyphRole::NoteheadBlackParens);
        assert_eq!(g.smufl_codepoint, 0xE0A4); // ghost ligature uses black notehead as its base component
        assert_eq!(g.smufl_ligature, Some(&[0xE0F5, 0xE0A4, 0xE0F6][..]));
        assert_eq!(g.render_text(), "\u{E0F5}\u{E0A4}\u{E0F6}");
        let g = notehead_glyph("RC", &["bell".to_string()], "x");
        assert_eq!(g.smufl_codepoint, 0xE0DB); // ride bell → diamond black notehead
    }

    #[test]
    fn test_ledger_line_offsets_cover_top_and_bottom_positions() {
        assert_eq!(
            ledger_line_offsets_for_staff_position(-0.5),
            Vec::<f32>::new()
        );
        assert_eq!(ledger_line_offsets_for_staff_position(-1.0), vec![-1.0]);
        assert_eq!(ledger_line_offsets_for_staff_position(-1.5), vec![-1.0]);
        assert_eq!(
            ledger_line_offsets_for_staff_position(-2.0),
            vec![-1.0, -2.0]
        );
        assert_eq!(
            ledger_line_offsets_for_staff_position(4.5),
            Vec::<f32>::new()
        );
        assert_eq!(ledger_line_offsets_for_staff_position(5.0), vec![5.0]);
        assert_eq!(ledger_line_offsets_for_staff_position(6.5), vec![5.0, 6.0]);
    }

    #[test]
    fn test_rest_glyph_by_fraction() {
        assert_eq!(
            rest_glyph_for_fraction(Fraction {
                numerator: 1,
                denominator: 8
            })
            .smufl_codepoint,
            0xE4E6
        );
        assert_eq!(
            rest_glyph_for_fraction(Fraction {
                numerator: 1,
                denominator: 16
            })
            .smufl_codepoint,
            0xE4E7
        );
        assert_eq!(
            rest_glyph_for_fraction(Fraction {
                numerator: 1,
                denominator: 32
            })
            .smufl_codepoint,
            0xE4E8
        );
    }

    fn rest_bounds_ss(y_pt: f32, font_size_pt: f32, staff_top: f32, role: GlyphRole) -> (f32, f32) {
        let metric = canonical_glyph_metric(role);
        let ss_to_pt = font_size_pt / 4.0;
        let top_ss = (y_pt - metric.bbox_ne_y_ss * ss_to_pt - staff_top) / 10.0;
        let bottom_ss = (y_pt - metric.bbox_sw_y_ss * ss_to_pt - staff_top) / 10.0;
        (top_ss, bottom_ss)
    }

    fn staff_top_for_scene(scene: &LayoutScene) -> f32 {
        scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "staff-line")
            .and_then(|item| match &item.primitive {
                ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
                _ => None,
            })
            .expect("expected staff line")
    }

    #[test]
    fn test_whole_and_half_rests_attach_to_standard_staff_lines() {
        let whole_measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![test_rest(
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 1,
                },
                1,
            )],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 1,
            volta_terminator: false,
        };
        let half_measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![test_rest(
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 2,
                },
                1,
            )],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 2,
            volta_terminator: false,
        };

        let whole_scene = build_layout_scene(
            &simple_layout_score(vec![whole_measure]),
            &LayoutOptions::default(),
        );
        let half_scene = build_layout_scene(
            &simple_layout_score(vec![half_measure]),
            &LayoutOptions::default(),
        );

        let whole_staff_top = staff_top_for_scene(&whole_scene);
        let half_staff_top = staff_top_for_scene(&half_scene);

        let whole_rest = whole_scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "rest")
            .expect("expected whole rest");
        let half_rest = half_scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "rest")
            .expect("expected half rest");

        let (whole_y, whole_font_size) = match &whole_rest.primitive {
            ScenePrimitive::GlyphRun(glyph) => (glyph.y_pt, glyph.font_size_pt),
            _ => panic!("expected whole rest glyph"),
        };
        let (half_y, half_font_size) = match &half_rest.primitive {
            ScenePrimitive::GlyphRun(glyph) => (glyph.y_pt, glyph.font_size_pt),
            _ => panic!("expected half rest glyph"),
        };

        let (whole_top, _) = rest_bounds_ss(
            whole_y,
            whole_font_size,
            whole_staff_top,
            GlyphRole::RestWhole,
        );
        let (_, half_bottom) =
            rest_bounds_ss(half_y, half_font_size, half_staff_top, GlyphRole::RestHalf);

        assert!(
            (whole_top - 1.0).abs() < 0.01,
            "whole rest should hang from the second staff line: top={whole_top:.3}"
        );
        assert!(
            (half_bottom - 2.0).abs() < 0.01,
            "half rest should sit on the middle staff line: bottom={half_bottom:.3}"
        );
    }

    #[test]
    fn test_canonical_metrics_are_stable() {
        let glyph_once = canonical_glyph_metric(GlyphRole::NoteheadX);
        let glyph_twice = canonical_glyph_metric(GlyphRole::NoteheadX);
        assert_eq!(glyph_once, glyph_twice);

        let text_once = canonical_text_metric(TextRole::Tempo);
        let text_twice = canonical_text_metric(TextRole::Tempo);
        assert_eq!(text_once, text_twice);

        let clef_glyph_once = canonical_glyph_metric(GlyphRole::PercussionClef);
        let clef_glyph_twice = canonical_glyph_metric(GlyphRole::PercussionClef);
        assert_eq!(clef_glyph_once, clef_glyph_twice);
        assert_eq!(clef_glyph_once.smufl_codepoint, 0xE069);

        let time_sig_glyph_once = canonical_glyph_metric(GlyphRole::TimeSignatureDigit);
        let time_sig_glyph_twice = canonical_glyph_metric(GlyphRole::TimeSignatureDigit);
        assert_eq!(time_sig_glyph_once, time_sig_glyph_twice);
        assert_eq!(time_sig_glyph_once.smufl_codepoint, 0xE080);

        let clef_text_once = canonical_text_metric(TextRole::PercussionClef);
        let clef_text_twice = canonical_text_metric(TextRole::PercussionClef);
        assert_eq!(clef_text_once, clef_text_twice);
        assert_eq!(clef_text_once.font_size_pt, 30.0);

        let time_sig_text_once = canonical_text_metric(TextRole::TimeSignatureDigit);
        let time_sig_text_twice = canonical_text_metric(TextRole::TimeSignatureDigit);
        assert_eq!(time_sig_text_once, time_sig_text_twice);
        assert_eq!(time_sig_text_once.font_size_pt, 30.0);
    }

    #[test]
    fn test_canonical_flag_glyphs_exist() {
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag8thUp).smufl_codepoint,
            0xE240
        );
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag8thDown).smufl_codepoint,
            0xE241
        );
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag16thUp).smufl_codepoint,
            0xE242
        );
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag16thDown).smufl_codepoint,
            0xE243
        );
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag32ndUp).smufl_codepoint,
            0xE244
        );
        assert_eq!(
            canonical_glyph_metric(GlyphRole::Flag32ndDown).smufl_codepoint,
            0xE245
        );
    }

    #[test]
    fn test_canonical_glyph_metrics_preserve_metadata_anchors() {
        let notehead = canonical_glyph_metric(GlyphRole::NoteheadBlack);
        assert_eq!(notehead.bbox_sw_x_ss, 0.0);
        assert_eq!(notehead.bbox_ne_x_ss, 1.18);
        assert_eq!(
            notehead.stem_up_anchor_ss,
            Some(GlyphPoint {
                x_ss: 1.49,
                y_ss: 0.16
            })
        );
        assert_eq!(
            notehead.stem_down_anchor_ss,
            Some(GlyphPoint {
                x_ss: 0.1,
                y_ss: -0.16
            })
        );

        let rest = canonical_glyph_metric(GlyphRole::RestQuarter);
        assert_eq!(rest.stem_up_anchor_ss, None);
        assert_eq!(rest.stem_down_anchor_ss, None);

        let flag = canonical_glyph_metric(GlyphRole::Flag8thDown);
        assert_eq!(
            flag.stem_down_anchor_ss,
            Some(GlyphPoint {
                x_ss: 0.0,
                y_ss: 0.132
            })
        );
    }

    #[test]
    fn test_default_options() {
        let opts = LayoutOptions::default();
        assert_eq!(opts.page_width_pt, 612.0);
        assert_eq!(opts.px_per_quarter, 80.0);
        assert_eq!(opts.header_height_pt, 50.0);
        assert_eq!(opts.header_staff_spacing_pt, 60.0);
        assert_eq!(opts.volta_offset_y, 0.0);
    }

    #[test]
    fn test_staff_space() {
        let ss = StaffSpace::default();
        assert_eq!(ss.pt_per_ss, 8.0);
        assert_eq!(ss.to_pixels(40.0), 10.0); // 40pt staff / 4 = 10px per ss
    }

    fn cross_system_fixture_score() -> RenderScore {
        RenderScore {
            version: RENDER_SCORE_VERSION.to_string(),
            header: RenderHeader {
                tempo: 120,
                time_beats: 4,
                time_beat_unit: 4,
                divisions: 16,
                note_value: 8,
                grouping: vec![2, 2],
                title: Some("Fixture".into()),
                subtitle: Some("Scene".into()),
                composer: Some("Codex".into()),
            },
            tracks: vec![
                RenderTrack {
                    id: "HH".into(),
                    family: "cymbal".into(),
                },
                RenderTrack {
                    id: "SD".into(),
                    family: "drum".into(),
                },
            ],
            measures: vec![
                RenderMeasure {
                    index: 0,
                    global_index: 0,
                    paragraph_index: 0,
                    measure_in_paragraph: 0,
                    source_line: 1,
                    events: vec![RenderEvent {
                        track: "HH".into(),
                        track_family: "cymbal".into(),
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        duration: Fraction {
                            numerator: 1,
                            denominator: 32,
                        },
                        visual_duration: Fraction {
                            numerator: 1,
                            denominator: 32,
                        },
                        kind: EventKind::Hit,
                        glyph: "x".into(),
                        modifiers: vec![],
                        dot_count: 0,
                        modifier: None,
                        voice: 1,
                        beam: "none".into(),
                        tuplet: None,
                    }],
                    barline: Some("regular".into()),
                    closing_barline: Some("regular".into()),
                    start_nav: Some(NavMarker::Segno),
                    end_nav: None,
                    volta_indices: Some(vec![1]),
                    hairpins: vec![HairpinSpan {
                        kind: HairpinKind::Crescendo,
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        end: Fraction {
                            numerator: 3,
                            denominator: 4,
                        },
                        start_measure_index: 0,
                        end_measure_index: 3,
                    }],
                    dynamics: vec![],
                    measure_repeat_slashes: None,
                    multi_rest_count: None,
                    note_value: 8,
                    volta_terminator: false,
                },
                RenderMeasure {
                    index: 1,
                    global_index: 1,
                    paragraph_index: 1,
                    measure_in_paragraph: 0,
                    source_line: 2,
                    events: vec![
                        RenderEvent {
                            track: "HH".into(),
                            track_family: "cymbal".into(),
                            start: Fraction {
                                numerator: 0,
                                denominator: 1,
                            },
                            duration: Fraction {
                                numerator: 1,
                                denominator: 16,
                            },
                            visual_duration: Fraction {
                                numerator: 1,
                                denominator: 16,
                            },
                            kind: EventKind::Hit,
                            glyph: "x".into(),
                            modifiers: vec![],
                            dot_count: 0,
                            modifier: None,
                            voice: 1,
                            beam: "begin".into(),
                            tuplet: None,
                        },
                        RenderEvent {
                            track: "SD".into(),
                            track_family: "drum".into(),
                            start: Fraction {
                                numerator: 1,
                                denominator: 16,
                            },
                            duration: Fraction {
                                numerator: 1,
                                denominator: 16,
                            },
                            visual_duration: Fraction {
                                numerator: 1,
                                denominator: 16,
                            },
                            kind: EventKind::Hit,
                            glyph: "d".into(),
                            modifiers: vec![],
                            dot_count: 0,
                            modifier: None,
                            voice: 1,
                            beam: "end".into(),
                            tuplet: None,
                        },
                    ],
                    barline: Some("regular".into()),
                    closing_barline: Some("regular".into()),
                    start_nav: None,
                    end_nav: None,
                    volta_indices: Some(vec![1]),
                    hairpins: vec![],
                    dynamics: vec![],
                    measure_repeat_slashes: None,
                    multi_rest_count: None,
                    note_value: 8,
                    volta_terminator: false,
                },
                RenderMeasure {
                    index: 2,
                    global_index: 2,
                    paragraph_index: 2,
                    measure_in_paragraph: 0,
                    source_line: 3,
                    events: vec![RenderEvent {
                        track: "HH".into(),
                        track_family: "cymbal".into(),
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        duration: Fraction {
                            numerator: 1,
                            denominator: 4,
                        },
                        visual_duration: Fraction {
                            numerator: 1,
                            denominator: 4,
                        },
                        kind: EventKind::Hit,
                        glyph: "x".into(),
                        modifiers: vec![],
                        dot_count: 0,
                        modifier: None,
                        voice: 1,
                        beam: "none".into(),
                        tuplet: None,
                    }],
                    barline: Some("regular".into()),
                    closing_barline: Some("regular".into()),
                    start_nav: None,
                    end_nav: None,
                    volta_indices: Some(vec![1]),
                    hairpins: vec![],
                    dynamics: vec![],
                    measure_repeat_slashes: None,
                    multi_rest_count: None,
                    note_value: 8,
                    volta_terminator: false,
                },
                RenderMeasure {
                    index: 3,
                    global_index: 3,
                    paragraph_index: 3,
                    measure_in_paragraph: 0,
                    source_line: 4,
                    events: vec![RenderEvent {
                        track: "SD".into(),
                        track_family: "drum".into(),
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        duration: Fraction {
                            numerator: 1,
                            denominator: 4,
                        },
                        visual_duration: Fraction {
                            numerator: 1,
                            denominator: 4,
                        },
                        kind: EventKind::Hit,
                        glyph: "d".into(),
                        modifiers: vec!["accent".into()],
                        dot_count: 0,
                        modifier: Some("accent".into()),
                        voice: 1,
                        beam: "none".into(),
                        tuplet: None,
                    }],
                    barline: Some("regular".into()),
                    closing_barline: Some("final".into()),
                    start_nav: None,
                    end_nav: Some(NavJump::DSalCoda),
                    volta_indices: Some(vec![1]),
                    hairpins: vec![],
                    dynamics: vec![],
                    measure_repeat_slashes: None,
                    multi_rest_count: None,
                    note_value: 8,
                    volta_terminator: false,
                },
            ],
            errors: vec![],
            repeat_spans: vec![RepeatSpan {
                start_measure: 0,
                end_measure: 3,
                times: 2,
            }],
        }
    }

    fn regular_measure(index: u32, paragraph_index: u32, event_count: u32) -> RenderMeasure {
        let events = (0..event_count)
            .map(|event_index| RenderEvent {
                track: "HH".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: event_index,
                    denominator: event_count.max(1),
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: event_count.max(1) * 2,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: event_count.max(1) * 2,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            })
            .collect::<Vec<_>>();

        RenderMeasure {
            index,
            global_index: index,
            paragraph_index,
            measure_in_paragraph: index,
            source_line: index + 1,
            events,
            barline: Some("regular".into()),
            closing_barline: Some("regular".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }
    }

    fn simple_layout_score(measures: Vec<RenderMeasure>) -> RenderScore {
        RenderScore {
            version: RENDER_SCORE_VERSION.to_string(),
            header: RenderHeader {
                tempo: 120,
                time_beats: 4,
                time_beat_unit: 4,
                divisions: 16,
                note_value: 8,
                grouping: vec![2, 2],
                title: None,
                subtitle: None,
                composer: None,
            },
            tracks: vec![RenderTrack {
                id: "HH".into(),
                family: "cymbal".into(),
            }],
            measures,
            errors: vec![],
            repeat_spans: vec![],
        }
    }

    fn line_for_role<'a>(page: &'a ScenePage, role: &str) -> &'a LineSegment {
        let item = page
            .items
            .iter()
            .find(|item| item.role == role)
            .unwrap_or_else(|| panic!("expected {role} line item"));
        let ScenePrimitive::LineSegment(line) = &item.primitive else {
            panic!("expected {role} to be a line segment");
        };
        line
    }

    fn line_for_id<'a>(page: &'a ScenePage, id: &str) -> &'a LineSegment {
        let item = page
            .items
            .iter()
            .find(|item| item.id == id)
            .unwrap_or_else(|| panic!("expected line item {id}"));
        let ScenePrimitive::LineSegment(line) = &item.primitive else {
            panic!("expected {id} to be a line segment");
        };
        line
    }

    fn hairpin_center_y(page: &ScenePage) -> f32 {
        let top = line_for_role(page, "hairpin-top");
        let bottom = line_for_role(page, "hairpin-bottom");
        (top.y1_pt + top.y2_pt + bottom.y1_pt + bottom.y2_pt) / 4.0
    }

    #[test]
    fn test_scene_fixture_supports_span_fragments_across_system_breaks() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let volta_fragments = scene
            .pages
            .iter()
            .flat_map(|page| page.composites.iter())
            .filter(|composite| composite.kind == CompositeKind::Volta)
            .map(|composite| composite.fragment)
            .collect::<Vec<_>>();
        let hairpin_fragments = scene
            .pages
            .iter()
            .flat_map(|page| page.composites.iter())
            .filter(|composite| composite.kind == CompositeKind::Hairpin)
            .map(|composite| composite.fragment)
            .collect::<Vec<_>>();

        assert_eq!(
            volta_fragments,
            vec![
                SpanFragmentKind::Start,
                SpanFragmentKind::Continuation,
                SpanFragmentKind::Continuation,
                SpanFragmentKind::End
            ]
        );
        assert_eq!(
            hairpin_fragments,
            vec![
                SpanFragmentKind::Start,
                SpanFragmentKind::Continuation,
                SpanFragmentKind::Continuation,
                SpanFragmentKind::End
            ]
        );
    }

    #[test]
    fn test_single_system_hairpin_is_conical() {
        let mut measure = regular_measure(0, 0, 4);
        measure.hairpins = vec![HairpinSpan {
            kind: HairpinKind::Crescendo,
            start: Fraction {
                numerator: 0,
                denominator: 1,
            },
            end: Fraction {
                numerator: 1,
                denominator: 1,
            },
            start_measure_index: 0,
            end_measure_index: 0,
        }];
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let page = &scene.pages[0];
        let top = line_for_role(page, "hairpin-top");
        let bottom = line_for_role(page, "hairpin-bottom");

        assert!((bottom.y1_pt - top.y1_pt).abs() < 0.01);
        assert!(bottom.y2_pt - top.y2_pt > 8.0);
    }

    #[test]
    fn test_hairpin_vertical_offset_moves_down_when_positive() {
        let mut measure = regular_measure(0, 0, 4);
        measure.hairpins = vec![HairpinSpan {
            kind: HairpinKind::Crescendo,
            start: Fraction {
                numerator: 0,
                denominator: 1,
            },
            end: Fraction {
                numerator: 1,
                denominator: 1,
            },
            start_measure_index: 0,
            end_measure_index: 0,
        }];
        let score = simple_layout_score(vec![measure]);

        let baseline = build_layout_scene(&score, &LayoutOptions::default());
        let below = build_layout_scene(
            &score,
            &LayoutOptions {
                hairpin_offset_y: 10.0,
                ..LayoutOptions::default()
            },
        );
        let above = build_layout_scene(
            &score,
            &LayoutOptions {
                hairpin_offset_y: -5.0,
                ..LayoutOptions::default()
            },
        );

        let baseline_y = hairpin_center_y(&baseline.pages[0]);
        assert!((hairpin_center_y(&below.pages[0]) - baseline_y - 10.0).abs() < 0.01);
        assert!((hairpin_center_y(&above.pages[0]) - baseline_y + 5.0).abs() < 0.01);
    }

    #[test]
    fn test_dynamic_marks_render_below_hairpins_as_text_runs() {
        let mut measure = regular_measure(0, 0, 4);
        measure.hairpins = vec![HairpinSpan {
            kind: HairpinKind::Crescendo,
            start: Fraction {
                numerator: 0,
                denominator: 1,
            },
            end: Fraction {
                numerator: 1,
                denominator: 1,
            },
            start_measure_index: 0,
            end_measure_index: 0,
        }];
        measure.dynamics = vec![DynamicMark {
            level: DynamicLevel::P,
            at: Fraction {
                numerator: 1,
                denominator: 2,
            },
        }];

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let dynamic = items_by_role(&scene, "dynamic")
            .into_iter()
            .next()
            .expect("expected dynamic item");
        let ScenePrimitive::TextRun(text) = &dynamic.primitive else {
            panic!("dynamic should be text");
        };
        assert_eq!(text.text, "p");
        assert_eq!(text.text_role, TextRole::Dynamic);
        assert_eq!(text.text_anchor.as_deref(), Some("middle"));
        assert_eq!(text.font_style.as_deref(), Some("italic"));
        assert_eq!(text.accessible_label.as_deref(), Some("dynamic p"));
        assert_eq!(
            dynamic.measure_local_fraction,
            Some(Fraction {
                numerator: 1,
                denominator: 2
            })
        );

        let hairpin_bottom = scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "hairpin-bottom")
            .expect("expected hairpin bottom");
        let (_, hairpin_y, _, hairpin_h) = item_bounds(hairpin_bottom).unwrap();
        let (_, dynamic_y, _, _) = item_bounds(dynamic).unwrap();
        assert!(
            dynamic_y >= hairpin_y + hairpin_h + 4.0,
            "dynamic should sit below hairpin"
        );
    }

    #[test]
    fn test_cross_system_hairpin_continuation_keeps_partial_opening() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let page = &scene.pages[0];
        let continuation = page
            .composites
            .iter()
            .find(|composite| {
                composite.kind == CompositeKind::Hairpin
                    && composite.fragment == SpanFragmentKind::Continuation
            })
            .expect("expected continuation hairpin fragment");
        let top = line_for_id(page, &continuation.child_item_ids[0]);
        let bottom = line_for_id(page, &continuation.child_item_ids[1]);

        assert!(bottom.y1_pt - top.y1_pt > 0.5);
        assert!(bottom.y2_pt - top.y2_pt > bottom.y1_pt - top.y1_pt);
    }

    #[test]
    fn test_volta_segment_type_does_not_end_on_repeat_end_when_next_measure_matches() {
        let mut source_measures = [
            regular_measure(0, 0, 1),
            regular_measure(1, 0, 1),
            regular_measure(2, 0, 1),
        ];
        source_measures[0].volta_indices = Some(vec![2]);
        source_measures[1].volta_indices = Some(vec![2]);
        source_measures[1].barline = Some("repeat-end".into());
        source_measures[2].volta_indices = Some(vec![2]);

        let display_measures = source_measures
            .iter()
            .map(|measure| DisplayMeasure {
                measure,
                global_index: measure.global_index,
                paragraph_index: measure.paragraph_index,
                barline: measure.barline.clone(),
                closing_barline: measure.closing_barline.clone(),
                start_nav: measure.start_nav.clone(),
                end_nav: measure.end_nav.clone(),
                hairpins: measure.hairpins.clone(),
                repeat_part: None,
            })
            .collect::<Vec<_>>();

        assert_eq!(
            volta_type_for_measure(&display_measures, 1),
            VoltaSegmentType::Mid
        );
        assert_eq!(
            volta_type_for_measure(&display_measures, 2),
            VoltaSegmentType::End
        );
    }

    #[test]
    fn test_structural_span_fragments_emit_child_items_and_navigation() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let items = scene
            .pages
            .iter()
            .flat_map(|page| page.items.iter())
            .collect::<Vec<_>>();
        let composites = scene
            .pages
            .iter()
            .flat_map(|page| page.composites.iter())
            .collect::<Vec<_>>();

        assert!(composites
            .iter()
            .all(|composite| composite.kind != CompositeKind::RepeatSpan));
        assert!(items
            .iter()
            .all(|item| !item.role.starts_with("repeat-span")));

        let volta_fragments = composites
            .iter()
            .copied()
            .filter(|composite| composite.kind == CompositeKind::Volta)
            .collect::<Vec<_>>();
        assert!(!volta_fragments.is_empty());
        assert!(volta_fragments
            .iter()
            .all(|fragment| !fragment.child_item_ids.is_empty()));
        assert_eq!(
            items
                .iter()
                .filter(|item| item.role == "volta-start-hook")
                .count(),
            4
        );
        assert_eq!(
            items
                .iter()
                .filter(|item| item.role == "volta-label")
                .count(),
            1
        );

        let navigation = composites
            .iter()
            .copied()
            .filter(|composite| composite.kind == CompositeKind::Navigation)
            .collect::<Vec<_>>();
        assert_eq!(navigation.len(), 2);
        assert_eq!(navigation[0].label.as_deref(), Some("segno"));
        assert_eq!(navigation[1].label.as_deref(), Some("D.S. al Coda"));
        assert!(navigation
            .iter()
            .all(|composite| !composite.child_item_ids.is_empty()));
        assert!(items.iter().any(|item| {
            item.role == "nav-start"
                && matches!(
                    &item.primitive,
                    ScenePrimitive::GlyphRun(GlyphRun {
                        glyph_role: GlyphRole::NavigationSegno,
                        ..
                    })
                )
        }));
        assert!(items.iter().any(|item| {
            item.role == "nav-end"
                && matches!(
                    &item.primitive,
                    ScenePrimitive::TextRun(TextRun { text, .. }) if text == "D.S. al Coda"
                )
        }));
    }

    #[test]
    fn test_canonical_text_metrics_drive_structural_and_attachment_text() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let items = scene
            .pages
            .iter()
            .flat_map(|page| page.items.iter())
            .collect::<Vec<_>>();
        let count_metric = canonical_text_metric(TextRole::CountLabel);

        {
            let nav_start = items
                .iter()
                .copied()
                .find(|item| item.role == "nav-start")
                .expect("expected scene item with role nav-start");
            let ScenePrimitive::GlyphRun(glyph) = &nav_start.primitive else {
                panic!("expected glyph primitive for nav-start");
            };
            assert_eq!(glyph.glyph_role, GlyphRole::NavigationSegno);
            assert_eq!(glyph.font_family, "Bravura");
            assert_eq!(glyph.font_size_pt, 20.0);
        }
        {
            let nav_end = items
                .iter()
                .copied()
                .find(|item| item.role == "nav-end")
                .expect("expected scene item with role nav-end");
            let ScenePrimitive::TextRun(text) = &nav_end.primitive else {
                panic!("expected text primitive for nav-end");
            };
            assert_eq!(text.text_role, TextRole::CountLabel);
            assert_eq!(text.font_family, "Academico");
            assert_eq!(text.font_size_pt, count_metric.font_size_pt);
        }

        let volta_label = items
            .iter()
            .copied()
            .find(|item| item.role == "volta-label")
            .expect("expected volta label item");
        let ScenePrimitive::TextRun(volta_text) = &volta_label.primitive else {
            panic!("expected text primitive for volta label");
        };
        assert_eq!(volta_text.text_role, TextRole::CountLabel);
        assert_eq!(volta_text.font_family, "Academico");
        assert_eq!(volta_text.font_size_pt, VOLTA_TEXT_SIZE_PT);

        let accent_item = items
            .iter()
            .copied()
            .find(|item| item.role == "accent")
            .expect("expected accent scene item");
        let ScenePrimitive::GlyphRun(accent_glyph) = &accent_item.primitive else {
            panic!("expected glyph primitive for accent");
        };
        assert_eq!(accent_glyph.glyph_role, GlyphRole::ArticAccentAbove);
        assert_eq!(accent_glyph.font_family, "Bravura");
        assert_eq!(accent_glyph.font_size_pt, BASE_FONT_SIZE_PT);

        let sticking_score = RenderScore {
            version: RENDER_SCORE_VERSION.to_string(),
            header: RenderHeader {
                tempo: 0,
                time_beats: 4,
                time_beat_unit: 4,
                divisions: 16,
                note_value: 8,
                grouping: vec![1, 1, 1, 1],
                title: None,
                subtitle: None,
                composer: None,
            },
            tracks: vec![RenderTrack {
                id: "HH".into(),
                family: "cymbal".into(),
            }],
            measures: vec![RenderMeasure {
                index: 0,
                global_index: 0,
                paragraph_index: 0,
                measure_in_paragraph: 0,
                source_line: 1,
                events: vec![
                    RenderEvent {
                        track: "HH".into(),
                        track_family: "cymbal".into(),
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        duration: Fraction {
                            numerator: 1,
                            denominator: 8,
                        },
                        visual_duration: Fraction {
                            numerator: 1,
                            denominator: 8,
                        },
                        kind: EventKind::Hit,
                        glyph: "x".into(),
                        modifiers: vec![],
                        dot_count: 0,
                        modifier: None,
                        voice: 1,
                        beam: "none".into(),
                        tuplet: None,
                    },
                    RenderEvent {
                        track: "HH".into(),
                        track_family: "cymbal".into(),
                        start: Fraction {
                            numerator: 0,
                            denominator: 1,
                        },
                        duration: Fraction {
                            numerator: 1,
                            denominator: 8,
                        },
                        visual_duration: Fraction {
                            numerator: 1,
                            denominator: 8,
                        },
                        kind: EventKind::Sticking,
                        glyph: "R".into(),
                        modifiers: vec![],
                        dot_count: 0,
                        modifier: None,
                        voice: 1,
                        beam: "none".into(),
                        tuplet: None,
                    },
                ],
                barline: Some("regular".into()),
                closing_barline: Some("regular".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            }],
            errors: vec![],
            repeat_spans: vec![],
        };
        let sticking_scene = build_layout_scene(&sticking_score, &LayoutOptions::default());
        let sticking_item = sticking_scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "sticking")
            .expect("expected sticking scene item");
        let ScenePrimitive::TextRun(sticking_text) = &sticking_item.primitive else {
            panic!("expected text primitive for sticking");
        };
        let sticking_metric = canonical_text_metric(TextRole::Sticking);
        assert_eq!(sticking_text.text_role, TextRole::Sticking);
        assert_eq!(sticking_text.font_family, sticking_metric.font_family);
        assert_eq!(sticking_text.font_size_pt, sticking_metric.font_size_pt);
    }

    #[test]
    fn test_layout_owned_structural_stacking_avoids_overlap() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let page = &scene.pages[0];

        let measure_number = page
            .items
            .iter()
            .find(|item| item.role == "measure-number")
            .expect("expected measure number item");
        let nav_start = page
            .items
            .iter()
            .find(|item| item.role == "nav-start")
            .expect("expected navigation start item");
        let volta_label = page
            .items
            .iter()
            .find(|item| item.role == "volta-label")
            .expect("expected volta label item");
        let hairpin_top = page
            .items
            .iter()
            .find(|item| item.role == "hairpin-top")
            .expect("expected hairpin item");
        let notehead = page
            .items
            .iter()
            .find(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-0"))
            .expect("expected notehead item");

        let (_, measure_number_y, _, _) = item_bounds(measure_number).unwrap();
        let (_, nav_y, _, nav_h) = item_bounds(nav_start).unwrap();
        assert!(item_bounds(volta_label).is_some());
        let (_, hairpin_y, _, _) = item_bounds(hairpin_top).unwrap();
        let (_, notehead_y, _, notehead_h) = item_bounds(notehead).unwrap();

        assert!(nav_y + nav_h <= measure_number_y - 4.0);
        assert!(hairpin_y >= notehead_y + notehead_h + 4.0);
    }

    #[test]
    fn test_navigation_uses_anchor_aware_bounds_and_clears_notes() {
        let mut items = Vec::new();
        let mut counter = 0usize;
        let note_id = {
            let mut sink = SceneEmitSink::new(&mut items, &mut counter);
            let note_id = sink.push_text_item(TextItemSpec {
                measure_id: Some("measure-0"),
                role: "notehead",
                x: 500.0,
                y: 210.0,
                text_role: TextRole::Tempo,
                text: "\u{E0A4}".to_string(),
                font_family: "Bravura",
                font_size_pt: 30.0,
                fill: "#333",
                text_anchor: None,
                font_weight: None,
            });
            let mut composites = Vec::new();
            render_nav_markers(
                &mut sink,
                &mut composites,
                &DeferredNavMarker {
                    measure_id: "measure-0".to_string(),
                    global_index: 0,
                    start_nav: None,
                    end_nav: Some(NavJump::DSalCoda),
                    x: 50.0,
                    width: 520.0,
                    top: 220.0,
                },
            );
            note_id
        };

        let nav_end = items
            .iter()
            .find(|item| item.role == "nav-end")
            .expect("expected end navigation item");
        let notehead = items
            .iter()
            .find(|item| item.id == note_id)
            .expect("expected colliding notehead candidate");

        let (nav_x, nav_y, nav_w, nav_h) = item_bounds(nav_end).unwrap();
        let (note_x, note_y, note_w, _) = item_bounds(notehead).unwrap();
        assert!(
            nav_x < note_x + note_w && nav_x + nav_w > note_x,
            "fixture should exercise horizontal nav/note overlap: nav=({nav_x:.1},{nav_y:.1},{nav_w:.1},{nav_h:.1}) note=({note_x:.1},{note_y:.1},{note_w:.1})"
        );
        assert!(
            nav_y + nav_h <= note_y - 4.0,
            "end navigation should float above the overlapping notehead"
        );
    }

    #[test]
    fn test_cross_system_scene_snapshot_matches_golden() {
        let scene = build_layout_scene(&cross_system_fixture_score(), &LayoutOptions::default());
        let actual = layout_scene_snapshot(&scene);
        let expected = include_str!("../tests/goldens/cross_system_scene_snapshot.txt");
        assert_eq!(actual, expected);
    }

    #[test]
    fn test_same_paragraph_stays_on_one_system_even_when_page_is_narrow() {
        let score = simple_layout_score(vec![
            regular_measure(0, 0, 1),
            regular_measure(1, 0, 1),
            regular_measure(2, 0, 1),
        ]);
        let opts = LayoutOptions {
            page_width_pt: 260.0,
            ..LayoutOptions::default()
        };

        let scene = build_layout_scene(&score, &opts);
        assert_eq!(scene.pages[0].systems.len(), 1);
        assert_eq!(
            scene.pages[0].systems[0].measure_ids,
            vec!["measure-0", "measure-1", "measure-2"]
        );
    }

    #[test]
    fn test_each_paragraph_becomes_its_own_system() {
        let score = simple_layout_score(vec![regular_measure(0, 0, 1), regular_measure(1, 1, 1)]);
        let opts = LayoutOptions {
            page_width_pt: 240.0,
            left_margin_pt: 20.0,
            right_margin_pt: 20.0,
            px_per_quarter: 10.0,
            ..LayoutOptions::default()
        };

        let scene = build_layout_scene(&score, &opts);
        assert_eq!(
            scene.pages[0].systems.len(),
            2,
            "each paragraph must map to its own system"
        );
        assert_eq!(scene.pages[0].systems[0].measure_ids, vec!["measure-0"]);
        assert_eq!(scene.pages[0].systems[1].measure_ids, vec!["measure-1"]);
    }

    #[test]
    fn test_compact_structural_measure_is_narrower_than_regular_measure() {
        let mut compact = regular_measure(1, 0, 1);
        compact.events.clear();
        compact.multi_rest_count = Some(4);
        let score = simple_layout_score(vec![regular_measure(0, 0, 4), compact]);

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        let regular_width = scene.pages[0]
            .measures
            .iter()
            .find(|measure| measure.id == "measure-0")
            .unwrap()
            .width_pt;
        let compact_width = scene.pages[0]
            .measures
            .iter()
            .find(|measure| measure.id == "measure-1")
            .unwrap()
            .width_pt;

        assert!(compact_width < regular_width);
    }

    fn notehead_positions(scene: &LayoutScene, measure_id: &str) -> Vec<f32> {
        let mut positions = scene.pages[0]
            .items
            .iter()
            .filter(|item| {
                item.role == "notehead" && item.measure_id.as_deref() == Some(measure_id)
            })
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::TextRun(text) => Some(text.x_pt),
                _ => None,
            })
            .collect::<Vec<_>>();
        positions.sort_by(|a, b| a.partial_cmp(b).unwrap());
        positions
    }

    fn items_by_role<'a>(scene: &'a LayoutScene, role: &str) -> Vec<&'a SceneItem> {
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == role)
            .collect()
    }

    fn text_y_by_role(scene: &LayoutScene, role: &str) -> f32 {
        let item = items_by_role(scene, role)
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("expected {role} text item"));
        let ScenePrimitive::TextRun(text) = &item.primitive else {
            panic!("expected {role} to be text");
        };
        text.y_pt
    }

    fn item_visual_center_x(item: &SceneItem) -> f32 {
        match &item.primitive {
            ScenePrimitive::GlyphRun(glyph) => {
                glyph.x_pt
                    + glyph_bbox_center_x_offset(
                        canonical_glyph_metric(glyph.glyph_role),
                        glyph.font_size_pt,
                    )
            }
            ScenePrimitive::TextRun(text) => {
                let glyph_role = text
                    .text
                    .chars()
                    .next()
                    .map(|ch| glyph_role_for_codepoint(ch as u32))
                    .unwrap_or_else(|| panic!("expected SMuFL glyph text for role {}", item.role));
                text.x_pt
                    + glyph_bbox_center_x_offset(
                        canonical_glyph_metric(glyph_role),
                        text.font_size_pt,
                    )
            }
            _ => panic!("expected glyph or text item for role {}", item.role),
        }
    }

    fn test_hit(track: &str, start: Fraction, duration: Fraction, voice: u8) -> RenderEvent {
        RenderEvent {
            track: track.into(),
            track_family: track_family(track).into(),
            start,
            duration,
            visual_duration: duration,
            kind: EventKind::Hit,
            glyph: if track_family(track) == "cymbal" {
                "x".into()
            } else {
                "d".into()
            },
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice,
            beam: "none".into(),
            tuplet: None,
        }
    }

    fn test_rest(start: Fraction, duration: Fraction, voice: u8) -> RenderEvent {
        RenderEvent {
            track: "HH".into(),
            track_family: "cymbal".into(),
            start,
            duration,
            visual_duration: duration,
            kind: EventKind::Rest,
            glyph: "r".into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice,
            beam: "none".into(),
            tuplet: None,
        }
    }

    #[test]
    fn test_simple_four_four_spacing_is_even() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 2,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 3,
                        denominator: 4,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let score = simple_layout_score(vec![measure]);
        let scene = build_layout_scene(&score, &LayoutOptions::default());
        let measure_box = scene.pages[0]
            .measures
            .iter()
            .find(|measure| measure.id == "measure-0")
            .unwrap();
        let xs = notehead_positions(&scene, "measure-0");
        let gaps = xs
            .windows(2)
            .map(|pair| pair[1] - pair[0])
            .collect::<Vec<_>>();
        assert_eq!(xs.len(), 4);
        assert!(
            (gaps[0] - gaps[1]).abs() < 0.5,
            "quarter-note gaps should match: {gaps:?}"
        );
        assert!(
            (gaps[1] - gaps[2]).abs() < 0.5,
            "quarter-note gaps should match: {gaps:?}"
        );

        let mut note_centers = scene.pages[0]
            .items
            .iter()
            .filter(|item| {
                item.role == "notehead" && item.measure_id.as_deref() == Some("measure-0")
            })
            .filter_map(|item| item_bounds(item).map(|(x, _, width, _)| x + width * 0.5))
            .collect::<Vec<_>>();
        note_centers.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let inner_left = measure_box.x_pt + measure_left_pad(0, true, Some("regular"));
        let inner_right =
            measure_box.x_pt + measure_box.width_pt - measure_right_pad(Some("final"));
        let left_edge_gap = note_centers[0] - inner_left;
        let right_edge_gap = inner_right - note_centers[3];
        assert!(
            right_edge_gap - left_edge_gap < 8.0,
            "first/last quarter notes should have balanced edge gaps: left={left_edge_gap:.2} right={right_edge_gap:.2} centers={note_centers:?}"
        );
    }

    #[test]
    fn test_silent_measure_rest_aligns_with_first_beat_grid() {
        let silent_measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![test_rest(
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 1,
                },
                1,
            )],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        };
        let note_measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 2,
                    },
                    2,
                ),
                test_rest(
                    Fraction {
                        numerator: 3,
                        denominator: 4,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        };

        let mut silent_score = simple_layout_score(vec![silent_measure]);
        silent_score.header.note_value = 4;
        silent_score.header.divisions = 4;
        silent_score.header.grouping = vec![4];
        let silent_scene = build_layout_scene(&silent_score, &LayoutOptions::default());

        let mut note_score = simple_layout_score(vec![note_measure]);
        note_score.header.note_value = 4;
        note_score.header.divisions = 4;
        note_score.header.grouping = vec![4];
        let note_scene = build_layout_scene(&note_score, &LayoutOptions::default());

        let rest = silent_scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "rest" && item.measure_id.as_deref() == Some("measure-0"))
            .expect("expected whole-measure rest");
        let note = note_scene.pages[0]
            .items
            .iter()
            .find(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-0"))
            .expect("expected first notehead");

        let rest_x = item_visual_center_x(rest);
        let note_x = item_visual_center_x(note);
        assert!(
            (rest_x - note_x).abs() < 0.75,
            "whole-measure rest should align with the first beat grid: rest_x={rest_x:.2} note_x={note_x:.2}"
        );
    }

    #[test]
    fn test_alternating_two_voice_rests_share_slot_centers_with_opposite_voice_hits() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 3,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 1,
                        denominator: 2,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 5,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
                test_hit(
                    "BD",
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
                test_rest(
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
                test_hit(
                    "BD",
                    Fraction {
                        numerator: 3,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
                test_rest(
                    Fraction {
                        numerator: 1,
                        denominator: 2,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
                test_hit(
                    "BD",
                    Fraction {
                        numerator: 5,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };

        let mut score = simple_layout_score(vec![measure]);
        score.header.time_beats = 6;
        score.header.time_beat_unit = 8;
        score.header.note_value = 8;
        score.header.divisions = 6;
        score.header.grouping = vec![3, 3];
        let scene = build_layout_scene(&score, &LayoutOptions::default());

        let role_measure = |role: &str| {
            scene.pages[0]
                .items
                .iter()
                .filter(|item| item.role == role && item.measure_id.as_deref() == Some("measure-0"))
                .collect::<Vec<_>>()
        };
        let rests = role_measure("rest");
        let notes = role_measure("notehead");
        let mut rest_centers = rests
            .iter()
            .map(|item| item_visual_center_x(item))
            .collect::<Vec<_>>();
        let mut note_centers = notes
            .iter()
            .map(|item| item_visual_center_x(item))
            .collect::<Vec<_>>();
        rest_centers.sort_by(|a, b| a.partial_cmp(b).unwrap());
        note_centers.sort_by(|a, b| a.partial_cmp(b).unwrap());

        assert_eq!(rest_centers.len(), 6);
        assert_eq!(note_centers.len(), 6);
        for (index, (rest_center, note_center)) in
            rest_centers.iter().zip(note_centers.iter()).enumerate()
        {
            assert!(
                (rest_center - note_center).abs() < 0.75,
                "rest/note pair {index} should share a slot center: rest={rest_center:.2} note={note_center:.2}"
            );
        }
    }

    #[test]
    fn test_same_slot_rest_avoids_notehead_and_stem_bounds() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    2,
                ),
                test_hit(
                    "HH",
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let items = scene.pages[0]
            .items
            .iter()
            .filter(|item| item.measure_id.as_deref() == Some("measure-0"))
            .collect::<Vec<_>>();
        let rest = items.iter().find(|item| item.role == "rest").unwrap();
        let notehead = items.iter().find(|item| item.role == "notehead").unwrap();
        let stem = items.iter().find(|item| item.role == "stem").unwrap();
        let rest_bounds = item_bounds(rest).unwrap();
        let note_bounds = item_bounds(notehead).unwrap();
        let stem_bounds = item_bounds(stem).unwrap();
        assert!(
            !rects_intersect(
                rect_obstacle_from_bounds(rest_bounds),
                rect_obstacle_from_bounds(note_bounds)
            ),
            "rest should not intersect same-slot notehead: rest={rest_bounds:?} note={note_bounds:?}"
        );
        assert!(
            !rects_intersect(
                rect_obstacle_from_bounds(rest_bounds),
                rect_obstacle_from_bounds(stem_bounds)
            ),
            "rest should not intersect same-slot stem: rest={rest_bounds:?} stem={stem_bounds:?}"
        );
    }

    #[test]
    fn test_same_slot_rest_avoids_accent_bounds() {
        let mut hit = test_hit(
            "SD",
            Fraction {
                numerator: 0,
                denominator: 1,
            },
            Fraction {
                numerator: 1,
                denominator: 4,
            },
            1,
        );
        hit.modifiers = vec!["accent".into()];
        hit.modifier = Some("accent".into());
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                hit,
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let items = scene.pages[0]
            .items
            .iter()
            .filter(|item| item.measure_id.as_deref() == Some("measure-0"))
            .collect::<Vec<_>>();
        let rest = items.iter().find(|item| item.role == "rest").unwrap();
        let accent = items.iter().find(|item| item.role == "accent").unwrap();
        assert!(
            !rects_intersect(
                rect_obstacle_from_bounds(item_bounds(rest).unwrap()),
                rect_obstacle_from_bounds(item_bounds(accent).unwrap())
            ),
            "rest should not intersect same-slot accent"
        );
    }

    #[test]
    fn test_dual_visible_rests_in_same_slot_resolve_to_distinct_vertical_lanes() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let rest_centers = scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "rest" && item.measure_id.as_deref() == Some("measure-0"))
            .map(|item| {
                let (_, y, _, h) = item_bounds(item).unwrap();
                y + h * 0.5
            })
            .collect::<Vec<_>>();
        assert_eq!(rest_centers.len(), 2);
        assert!(
            (rest_centers[0] - rest_centers[1]).abs() > 0.5,
            "same-slot rests should occupy distinct vertical lanes: {rest_centers:?}"
        );
    }

    #[test]
    fn test_hide_voice2_rests_omits_secondary_voice_rests() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    1,
                ),
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        };
        let score = simple_layout_score(vec![measure]);
        let visible = build_layout_scene(
            &score,
            &LayoutOptions {
                hide_voice2_rests: false,
                ..LayoutOptions::default()
            },
        );
        let hidden = build_layout_scene(
            &score,
            &LayoutOptions {
                hide_voice2_rests: true,
                ..LayoutOptions::default()
            },
        );
        let visible_rests = visible.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "rest" && item.measure_id.as_deref() == Some("measure-0"))
            .count();
        let hidden_rests = hidden.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "rest" && item.measure_id.as_deref() == Some("measure-0"))
            .count();
        assert_eq!(visible_rests, 2);
        assert_eq!(hidden_rests, 1);
    }

    #[test]
    fn test_resolve_rest_placement_emits_fallback_diagnostic_when_all_lanes_collide() {
        let event = test_rest(
            Fraction {
                numerator: 0,
                denominator: 1,
            },
            Fraction {
                numerator: 1,
                denominator: 4,
            },
            1,
        );
        let slot = SlotEvent {
            start: event.start,
            event_x: 100.0,
            event: &event,
        };
        let blocking = RectObstacle {
            x1: -1000.0,
            x2: 1000.0,
            y1: -1000.0,
            y2: 1000.0,
        };
        let (_, diagnostic) = resolve_rest_placement(
            &slot,
            100.0,
            80.0,
            rest_glyph_for_fraction(event.duration),
            BASE_FONT_SIZE_PT,
            false,
            &[blocking],
            &[],
        );
        assert!(
            diagnostic.is_some(),
            "all-lane collision should return fallback diagnostic metadata"
        );
    }

    #[test]
    fn test_same_slot_rest_avoids_continued_beam_bounds() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                test_hit(
                    "SD",
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 16,
                    },
                    2,
                ),
                test_rest(
                    Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    1,
                ),
                test_hit(
                    "SD",
                    Fraction {
                        numerator: 1,
                        denominator: 16,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 16,
                    },
                    2,
                ),
                test_hit(
                    "SD",
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 16,
                    },
                    2,
                ),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let items = scene.pages[0]
            .items
            .iter()
            .filter(|item| item.measure_id.as_deref() == Some("measure-0"))
            .collect::<Vec<_>>();
        let rest = items.iter().find(|item| item.role == "rest").unwrap();
        let beam = items.iter().find(|item| item.role == "beam").unwrap();
        assert!(
            !rects_intersect(
                rect_obstacle_from_bounds(item_bounds(rest).unwrap()),
                rect_obstacle_from_bounds(item_bounds(beam).unwrap())
            ),
            "rest should not intersect continued beam bounds"
        );
    }

    #[test]
    fn test_grouping_allocates_more_width_to_dense_first_half() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Rest,
                    glyph: "r".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 3,
                        denominator: 8,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Rest,
                    glyph: "r".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 2,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 3,
                        denominator: 4,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 4,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let mut score = simple_layout_score(vec![measure]);
        score.header.grouping = vec![2, 2];
        let scene = build_layout_scene(&score, &LayoutOptions::default());
        let measure_box = scene.pages[0]
            .measures
            .iter()
            .find(|measure| measure.id == "measure-0")
            .unwrap();
        let xs = notehead_positions(&scene, "measure-0");
        let midpoint = measure_box.x_pt + measure_box.width_pt * 0.5;
        let first_group_gap = xs[1] - xs[0];
        let second_group_gap = xs[3] - xs[2];

        assert_eq!(xs.len(), 4);
        assert!(
            xs[2] > midpoint,
            "the beat-3 note should start past the visual midpoint when the first group is denser"
        );
        assert!(
            first_group_gap > second_group_gap + 1.0,
            "dense first-half grouping should allocate wider beat spacing: {xs:?}"
        );
    }

    #[test]
    fn test_header_height_and_gap_match_ts_system_start_semantics() {
        let mut score = simple_layout_score(vec![regular_measure(0, 0, 1)]);
        score.header.title = Some("Title".into());
        score.header.subtitle = Some("Subtitle".into());
        score.header.composer = Some("Composer".into());

        let baseline = build_layout_scene(&score, &LayoutOptions::default());
        let custom_height = build_layout_scene(
            &score,
            &LayoutOptions {
                header_height_pt: 80.0,
                ..LayoutOptions::default()
            },
        );
        let custom_gap = build_layout_scene(
            &score,
            &LayoutOptions {
                header_staff_spacing_pt: 20.0,
                ..LayoutOptions::default()
            },
        );

        assert!(baseline.pages[0].systems[0].y_pt > 140.0);
        assert!(custom_height.pages[0].systems[0].y_pt > baseline.pages[0].systems[0].y_pt);
        assert!(custom_gap.pages[0].systems[0].y_pt < baseline.pages[0].systems[0].y_pt);

        assert_eq!(
            text_y_by_role(&baseline, "title"),
            text_y_by_role(&custom_height, "title")
        );
        assert_eq!(
            text_y_by_role(&custom_height, "subtitle") - text_y_by_role(&baseline, "subtitle"),
            30.0
        );
        assert_eq!(
            text_y_by_role(&custom_height, "composer") - text_y_by_role(&baseline, "composer"),
            30.0
        );
        assert_eq!(
            text_y_by_role(&custom_gap, "subtitle"),
            text_y_by_role(&baseline, "subtitle")
        );
    }

    #[test]
    fn test_six_eighth_notes_in_6_8_grouping_3_plus_3_beam_by_half_bar() {
        let starts = [0_u32, 1, 2, 3, 4, 5];
        let mut measure = regular_measure(0, 0, 0);
        measure.events = starts
            .into_iter()
            .map(|index| {
                test_hit(
                    "SD",
                    Fraction {
                        numerator: index,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                )
            })
            .collect();
        let mut score = simple_layout_score(vec![measure]);
        score.header.time_beats = 6;
        score.header.time_beat_unit = 8;
        score.header.divisions = 6;
        score.header.note_value = 8;
        score.header.grouping = vec![3, 3];

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        assert_eq!(
            items_by_role(&scene, "beam").len(),
            2,
            "expected one beam per grouping segment"
        );
        assert_eq!(
            items_by_role(&scene, "flag").len(),
            0,
            "beamed eighths should not show flags"
        );
        assert_eq!(items_by_role(&scene, "tuplet-label").len(), 0);
    }

    #[test]
    fn test_six_eighth_notes_in_6_8_grouping_3_plus_3_beam_with_hidden_cross_track_rests() {
        let starts = [0_u32, 1, 2, 3, 4, 5];
        let mut measure = regular_measure(0, 0, 0);
        let mut events = starts
            .into_iter()
            .map(|index| {
                test_hit(
                    "SD",
                    Fraction {
                        numerator: index,
                        denominator: 8,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    1,
                )
            })
            .collect::<Vec<_>>();
        for index in 0..3 {
            events.push(test_rest(
                Fraction {
                    numerator: index,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ));
        }
        for index in 3..6 {
            events.push(test_hit(
                "HH",
                Fraction {
                    numerator: index,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ));
        }
        measure.events = events;
        let mut score = simple_layout_score(vec![measure]);
        score.tracks.push(RenderTrack {
            id: "SD".into(),
            family: "snare".into(),
        });
        score.header.time_beats = 6;
        score.header.time_beat_unit = 8;
        score.header.divisions = 6;
        score.header.note_value = 8;
        score.header.grouping = vec![3, 3];

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        assert_eq!(
            items_by_role(&scene, "beam").len(),
            2,
            "cross-track rests hidden by same-voice hits must not break beaming"
        );
        assert_eq!(items_by_role(&scene, "flag").len(), 0);
    }

    #[test]
    fn test_beams_follow_grouping_segments() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = vec![
            test_hit(
                "HH",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 1,
                    denominator: 2,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 5,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
        ];
        let mut score = simple_layout_score(vec![measure]);
        score.header.grouping = vec![2, 2];

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        assert_eq!(items_by_role(&scene, "beam").len(), 2);
        assert_eq!(items_by_role(&scene, "flag").len(), 0);
    }

    #[test]
    fn test_tuplet_quarter_visual_duration_draws_bracket_without_beam() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = [0_u32, 1, 2]
            .into_iter()
            .map(|index| {
                let mut hit = test_hit(
                    if index == 1 { "SD" } else { "T1" },
                    Fraction {
                        numerator: index,
                        denominator: 12,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 12,
                    },
                    1,
                );
                hit.visual_duration = Fraction {
                    numerator: 1,
                    denominator: 4,
                };
                hit.tuplet = Some((3, 2));
                hit
            })
            .collect();

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        assert_eq!(items_by_role(&scene, "tuplet-label").len(), 1);
        assert_eq!(items_by_role(&scene, "beam").len(), 0);
        assert_eq!(items_by_role(&scene, "flag").len(), 0);
        assert_eq!(items_by_role(&scene, "stem").len(), 3);
    }

    #[test]
    fn test_parallel_tuplets_share_one_bracket() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = ["SD", "T1"]
            .into_iter()
            .flat_map(|track| {
                [0_u32, 1, 2].into_iter().map(move |index| {
                    let mut hit = test_hit(
                        track,
                        Fraction {
                            numerator: index,
                            denominator: 12,
                        },
                        Fraction {
                            numerator: 1,
                            denominator: 12,
                        },
                        1,
                    );
                    hit.visual_duration = Fraction {
                        numerator: 1,
                        denominator: 8,
                    };
                    hit.tuplet = Some((3, 2));
                    hit
                })
            })
            .collect();

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        assert_eq!(items_by_role(&scene, "tuplet-label").len(), 1);
        assert_eq!(items_by_role(&scene, "tuplet-bracket").len(), 2);
        assert_eq!(items_by_role(&scene, "tuplet-hook").len(), 2);
    }

    #[test]
    fn test_duplet_group_skips_tuplet_label() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = [0_u32, 1]
            .into_iter()
            .map(|index| {
                let mut hit = test_hit(
                    "SD",
                    Fraction {
                        numerator: index,
                        denominator: 16,
                    },
                    Fraction {
                        numerator: 1,
                        denominator: 16,
                    },
                    1,
                );
                hit.visual_duration = Fraction {
                    numerator: 1,
                    denominator: 16,
                };
                hit.tuplet = Some((2, 1));
                hit
            })
            .collect();

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        assert_eq!(items_by_role(&scene, "tuplet-label").len(), 0);
        assert_eq!(items_by_role(&scene, "beam").len(), 1);
    }

    #[test]
    fn test_dotted_rest_renders_augmentation_dot() {
        let mut measure = regular_measure(0, 0, 0);
        let mut rest = test_rest(
            Fraction {
                numerator: 0,
                denominator: 1,
            },
            Fraction {
                numerator: 3,
                denominator: 8,
            },
            1,
        );
        rest.dot_count = 1;
        measure.events = vec![rest];

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        assert_eq!(items_by_role(&scene, "rest").len(), 1);
        assert_eq!(items_by_role(&scene, "augmentation-dot").len(), 1);
    }

    #[test]
    fn test_same_voice_rest_hidden_when_hit_occupies_slot() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = vec![
            test_hit(
                "SD",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_rest(
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
        ];

        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        assert_eq!(items_by_role(&scene, "notehead").len(), 1);
        assert_eq!(items_by_role(&scene, "rest").len(), 0);
    }

    #[test]
    fn test_secondary_beams_break_around_eighth_notes() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = vec![
            test_hit(
                "SD",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 16,
                },
                1,
            ),
            test_hit(
                "SD",
                Fraction {
                    numerator: 1,
                    denominator: 16,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "SD",
                Fraction {
                    numerator: 3,
                    denominator: 16,
                },
                Fraction {
                    numerator: 1,
                    denominator: 16,
                },
                1,
            ),
        ];
        let mut score = simple_layout_score(vec![measure]);
        score.header.grouping = vec![4];

        let scene = build_layout_scene(&score, &LayoutOptions::default());

        assert_eq!(items_by_role(&scene, "beam").len(), 1);
        assert_eq!(items_by_role(&scene, "beam-secondary").len(), 2);
    }

    #[test]
    fn test_fractional_subdivision_starts_do_not_collapse_inside_grouping_segment() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = vec![
            test_hit(
                "SD",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "T3",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "SD",
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "SD",
                Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "T2",
                Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 3,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 1,
                    denominator: 2,
                },
                Fraction {
                    numerator: 1,
                    denominator: 16,
                },
                1,
            ),
            test_hit(
                "SD",
                Fraction {
                    numerator: 9,
                    denominator: 16,
                },
                Fraction {
                    numerator: 1,
                    denominator: 16,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 5,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
        ];
        let mut score = simple_layout_score(vec![measure]);
        score.header.time_beats = 6;
        score.header.time_beat_unit = 8;
        score.header.divisions = 6;
        score.header.note_value = 8;
        score.header.grouping = vec![3, 3];

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        let stems = items_by_role(&scene, "stem");

        assert_eq!(
            stems.len(),
            7,
            "fractional starts inside a 6/8 grouping segment should render as separate rhythmic positions"
        );

        let mut stem_xs = stems
            .iter()
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::LineSegment(line) => Some(line.x1_pt),
                _ => None,
            })
            .collect::<Vec<_>>();
        stem_xs.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let pair_gap = stem_xs[5] - stem_xs[4];
        let tail_gap = stem_xs[6] - stem_xs[5];
        assert!(
            pair_gap > 0.01 && tail_gap > 0.01,
            "split 16th starts and the trailing 8th must all keep distinct x positions: {stem_xs:?}"
        );
    }

    #[test]
    fn test_rests_break_grouping_beams() {
        let mut measure = regular_measure(0, 0, 0);
        measure.events = vec![
            test_hit(
                "HH",
                Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_rest(
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
            test_hit(
                "HH",
                Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                1,
            ),
        ];
        let mut score = simple_layout_score(vec![measure]);
        score.header.grouping = vec![4];

        let scene = build_layout_scene(&score, &LayoutOptions::default());
        assert_eq!(items_by_role(&scene, "beam").len(), 0);
        assert_eq!(items_by_role(&scene, "flag").len(), 2);
    }

    #[test]
    fn test_combined_hit_shares_a_single_stem() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "begin".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "begin".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let noteheads = items_by_role(&scene, "notehead");
        let stems = items_by_role(&scene, "stem");

        assert_eq!(noteheads.len(), 2);
        assert_eq!(
            stems.len(),
            1,
            "combined hits in the same voice should share one stem"
        );
        assert!(
            stems[0].anchor_item_id.is_some(),
            "shared stem should anchor to a notehead"
        );

        let stem = match &stems[0].primitive {
            ScenePrimitive::LineSegment(line) => line,
            _ => panic!("stem should be a line"),
        };
        let note_ys = noteheads
            .iter()
            .filter_map(|item| item_bounds(item).map(|(_, y, _, _)| y))
            .collect::<Vec<_>>();
        let lowest_note_y = note_ys
            .into_iter()
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .expect("expected noteheads");
        assert!(
            stem.y2_pt >= lowest_note_y - 2.0,
            "shared up-stem should extend through the lower notehead: stem_bottom={:.2} lowest_note_y={lowest_note_y:.2}",
            stem.y2_pt
        );
    }

    #[test]
    fn test_same_position_same_voice_hits_share_single_stem_without_horizontal_split() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let noteheads = items_by_role(&scene, "notehead");
        let stems = items_by_role(&scene, "stem");
        let xs = noteheads
            .iter()
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::TextRun(text) => Some(text.x_pt),
                _ => None,
            })
            .collect::<Vec<_>>();

        assert_eq!(noteheads.len(), 2);
        assert_eq!(stems.len(), 1);
        assert!(
            (xs[0] - xs[1]).abs() < 0.01,
            "same-position hits should not split horizontally: {xs:?}"
        );
    }

    #[test]
    fn test_two_voice_collision_case_preserves_attachment_anchors() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec!["accent".into()],
                    dot_count: 0,
                    modifier: Some("accent".into()),
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "BD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec!["accent".into()],
                    dot_count: 0,
                    modifier: Some("accent".into()),
                    voice: 2,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "ST".into(),
                    track_family: "text".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Sticking,
                    glyph: "R".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let noteheads = items_by_role(&scene, "notehead");
        let stems = items_by_role(&scene, "stem");
        let accents = items_by_role(&scene, "accent");
        let sticking = items_by_role(&scene, "sticking")
            .into_iter()
            .next()
            .expect("expected sticking");
        let mut xs = noteheads
            .iter()
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::TextRun(_) => Some(item_visual_center_x(item)),
                _ => None,
            })
            .collect::<Vec<_>>();
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap());

        assert_eq!(noteheads.len(), 2);
        assert_eq!(stems.len(), 2, "opposing voices should keep separate stems");
        assert!(
            (xs[0] - xs[1]).abs() < 0.75,
            "opposing voices on the same slot should share horizontal center alignment: {xs:?}"
        );
        assert!(
            accents.iter().all(|accent| accent.anchor_item_id.is_some()),
            "accents should preserve their note anchors"
        );
        let accent_roles = accents
            .iter()
            .map(|accent| match &accent.primitive {
                ScenePrimitive::GlyphRun(glyph) => glyph.glyph_role,
                _ => panic!("accent should be glyph"),
            })
            .collect::<Vec<_>>();
        assert_eq!(
            accent_roles,
            vec![GlyphRole::ArticAccentAbove, GlyphRole::ArticAccentBelow]
        );
        assert!(
            sticking.anchor_item_id.is_some(),
            "sticking should preserve its anchor"
        );
        assert!(
            stems.iter().all(|stem| stem.anchor_item_id.is_some()),
            "stems should preserve note anchors"
        );
    }

    #[test]
    fn sticking_clears_quarter_note_stem_in_alternating_st_sd_pattern() {
        let quarter = |start_num: u32, kind: EventKind, track: &str, glyph: &str| RenderEvent {
            track: track.into(),
            track_family: if track == "ST" {
                "text".into()
            } else {
                "drum".into()
            },
            start: Fraction {
                numerator: start_num,
                denominator: 4,
            },
            duration: Fraction {
                numerator: 1,
                denominator: 4,
            },
            visual_duration: Fraction {
                numerator: 1,
                denominator: 4,
            },
            kind,
            glyph: glyph.into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice: 1,
            beam: "none".into(),
            tuplet: None,
        };
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                quarter(0, EventKind::Sticking, "ST", "R"),
                quarter(0, EventKind::Hit, "SD", "d"),
                quarter(2, EventKind::Sticking, "ST", "L"),
                quarter(2, EventKind::Hit, "SD", "d"),
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        };
        let mut score = simple_layout_score(vec![measure]);
        score.header.note_value = 4;
        score.header.grouping = vec![1, 1, 1, 1];
        score.tracks = vec![
            RenderTrack {
                id: "SD".into(),
                family: "drum".into(),
            },
            RenderTrack {
                id: "ST".into(),
                family: "text".into(),
            },
        ];
        let scene = build_layout_scene(&score, &LayoutOptions::default());
        let stickings = items_by_role(&scene, "sticking");
        let stems = items_by_role(&scene, "stem");
        assert_eq!(stickings.len(), 2);
        assert_eq!(stems.len(), 2);
        for sticking in stickings {
            let anchor = sticking.anchor_item_id.as_deref().expect("sticking anchor");
            let stem = stems
                .iter()
                .find(|stem| stem.anchor_item_id.as_deref() == Some(anchor))
                .expect("matching stem");
            let stem_top = item_bounds(stem).expect("stem bounds").1;
            let (_, sticking_top, _, sticking_height) =
                item_bounds(sticking).expect("sticking bounds");
            let sticking_bottom = sticking_top + sticking_height;
            assert!(
                sticking_bottom <= stem_top + 0.01,
                "sticking should sit above its stem tip"
            );
        }
    }

    #[test]
    fn dense_sticking_on_second_system_does_not_inflate_visual_height() {
        let hit = |start_num: u32, track: &str, glyph: &str| RenderEvent {
            track: track.into(),
            track_family: if track == "ST" {
                "text".into()
            } else {
                "drum".into()
            },
            start: Fraction {
                numerator: start_num,
                denominator: 16,
            },
            duration: Fraction {
                numerator: 1,
                denominator: 16,
            },
            visual_duration: Fraction {
                numerator: 1,
                denominator: 16,
            },
            kind: EventKind::Hit,
            glyph: glyph.into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice: 1,
            beam: "none".into(),
            tuplet: None,
        };
        let sticking = |start_num: u32, glyph: &str| RenderEvent {
            track: "ST".into(),
            track_family: "text".into(),
            start: Fraction {
                numerator: start_num,
                denominator: 16,
            },
            duration: Fraction {
                numerator: 1,
                denominator: 16,
            },
            visual_duration: Fraction {
                numerator: 1,
                denominator: 16,
            },
            kind: EventKind::Sticking,
            glyph: glyph.into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice: 1,
            beam: "none".into(),
            tuplet: None,
        };
        let filler = regular_measure;
        let mut measures = (0..6)
            .map(|index| {
                let mut measure = filler(index, 0, 4);
                measure.events = vec![hit(0, "SD", "d")];
                measure.note_value = 4;
                measure
            })
            .collect::<Vec<_>>();
        for (offset, glyphs) in [(0, "RLRL"), (4, "RLRL")] {
            let mut measure = filler(measures.len() as u32, 1, 4);
            measure.note_value = 16;
            measure.events = glyphs
                .chars()
                .enumerate()
                .flat_map(|(index, glyph)| {
                    let start = offset + index as u32;
                    vec![sticking(start, &glyph.to_string()), hit(start, "SD", "d")]
                })
                .collect();
            measures.push(measure);
        }
        let mut score = simple_layout_score(measures);
        score.header.note_value = 4;
        score.header.grouping = vec![1, 1, 1, 1];
        score.tracks = vec![
            RenderTrack {
                id: "SD".into(),
                family: "drum".into(),
            },
            RenderTrack {
                id: "ST".into(),
                family: "text".into(),
            },
        ];
        let scene = build_layout_scene(&score, &LayoutOptions::default());
        assert!(
            scene.pages[0].systems.len() >= 2,
            "expected a second system for dense sticking measures"
        );
        let last_system = scene.pages[0]
            .systems
            .last()
            .expect("last system");
        let last_measure_ids = last_system
            .measure_ids
            .iter()
            .cloned()
            .collect::<std::collections::BTreeSet<_>>();
        let mut sticking_ys = scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "sticking")
            .filter(|item| {
                item.measure_id
                    .as_ref()
                    .is_some_and(|id| last_measure_ids.contains(id))
            })
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::TextRun(text) => Some(text.y_pt),
                _ => None,
            })
            .collect::<Vec<_>>();
        sticking_ys.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert!(
            !sticking_ys.is_empty(),
            "expected sticking labels on the last system"
        );
        let spread = sticking_ys.last().unwrap() - sticking_ys.first().unwrap();
        assert!(
            spread < 24.0,
            "sticking labels on one system should stay in a tight band, spread={spread:?} ys={sticking_ys:?}"
        );
        let first_system = &scene.pages[0].systems[0];
        let first_system_bottom = first_system.y_pt + first_system.height_pt;
        let min_sticking_top = sticking_ys
            .iter()
            .map(|y| y - 9.0)
            .fold(f32::INFINITY, f32::min);
        assert!(
            min_sticking_top > first_system_bottom - 8.0,
            "sticking must not leak into the previous system band: first_bottom={first_system_bottom} min_top={min_sticking_top}"
        );
        let staff_top = last_system.y_pt + 10.0;
        assert!(
            *sticking_ys.first().unwrap() < staff_top + 20.0,
            "sticking should sit just above the staff, not far below it"
        );
    }

    #[test]
    fn test_same_voice_adjacent_chord_noteheads_stagger_higher_right_lower_left() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "T2".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let noteheads = items_by_role(&scene, "notehead");
        let stems = items_by_role(&scene, "stem");

        assert_eq!(noteheads.len(), 2);
        assert_eq!(
            stems.len(),
            1,
            "same-voice chord should keep one shared stem"
        );

        let mut positioned = noteheads
            .iter()
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::TextRun(text) => {
                    let bounds = item_bounds(item)?;
                    Some((text.x_pt, bounds.1, bounds.0 + bounds.2))
                }
                _ => None,
            })
            .collect::<Vec<_>>();
        positioned.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        let upper_x = positioned[0].0;
        let lower_x = positioned[1].0;
        assert!(
            upper_x > lower_x + 6.0,
            "adjacent same-voice chord noteheads should stagger with the higher note on the right: upper_x={upper_x:.2} lower_x={lower_x:.2}"
        );

        let stem = stems[0];
        let stem_x = match &stem.primitive {
            ScenePrimitive::LineSegment(line) => line.x1_pt,
            _ => panic!("stem should be line"),
        };
        assert!(
            (stem_x - positioned[0].0).abs() < 0.01,
            "staggered seconds should place the shared stem at the center boundary: stem_x={stem_x:.2} upper_left={:.2} lower_right={:.2}",
            positioned[0].0,
            positioned[1].2
        );
    }

    #[test]
    fn test_beamed_shared_stem_chord_tail_stops_at_beam() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "begin".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "begin".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "end".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "SD".into(),
                    track_family: "drum".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "d".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "end".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let stems = items_by_role(&scene, "stem");
        let beam = items_by_role(&scene, "beam")
            .into_iter()
            .next()
            .expect("expected beam");

        assert_eq!(
            stems.len(),
            2,
            "two beamed chord slots should produce two shared stems"
        );
        let right_stem = stems
            .iter()
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::LineSegment(line) => Some((line.x1_pt, line.y1_pt)),
                _ => None,
            })
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap())
            .expect("expected right stem");
        let beam_path = match &beam.primitive {
            ScenePrimitive::Path(path) => path.d.as_str(),
            _ => panic!("beam should be path"),
        };
        let tokens = beam_path.split_whitespace().collect::<Vec<_>>();
        let beam_end_y: f32 = tokens[5].parse().expect("beam end y");

        assert!(
            (right_stem.1 - beam_end_y).abs() < 0.01,
            "tail shared stem should stop at beam: stem_tip_y={:.2} beam_end_y={beam_end_y:.2}",
            right_stem.1
        );
    }

    #[test]
    fn test_accent_uses_smufl_glyph_centered_on_notehead_and_clears_stem_tip() {
        let measure = RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec!["accent".into()],
                    dot_count: 0,
                    modifier: Some("accent".into()),
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
                RenderEvent {
                    track: "HH".into(),
                    track_family: "cymbal".into(),
                    start: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    visual_duration: Fraction {
                        numerator: 1,
                        denominator: 8,
                    },
                    kind: EventKind::Hit,
                    glyph: "x".into(),
                    modifiers: vec![],
                    dot_count: 0,
                    modifier: None,
                    voice: 1,
                    beam: "none".into(),
                    tuplet: None,
                },
            ],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        };
        let scene = build_layout_scene(
            &simple_layout_score(vec![measure]),
            &LayoutOptions::default(),
        );
        let accent = items_by_role(&scene, "accent")
            .into_iter()
            .next()
            .expect("expected accent");
        let notehead = items_by_role(&scene, "notehead")
            .into_iter()
            .next()
            .expect("expected notehead");
        let stem = items_by_role(&scene, "stem")
            .into_iter()
            .next()
            .expect("expected stem");

        let ScenePrimitive::GlyphRun(accent_glyph) = &accent.primitive else {
            panic!("accent should be glyph");
        };
        let ScenePrimitive::TextRun(note_text) = &notehead.primitive else {
            panic!("notehead should be text");
        };
        let ScenePrimitive::LineSegment(stem_line) = &stem.primitive else {
            panic!("stem should be line");
        };

        assert_eq!(accent_glyph.glyph_role, GlyphRole::ArticAccentAbove);
        let note_center = note_text.x_pt
            + rendered_glyph_width(GlyphRole::NoteheadX, note_text.font_size_pt) * 0.5;
        let accent_center = accent_glyph.x_pt
            + rendered_glyph_width(GlyphRole::ArticAccentAbove, accent_glyph.font_size_pt) * 0.5;
        assert!((note_center - accent_center).abs() < 0.01);
        assert!(accent_glyph.y_pt < stem_line.y1_pt);
    }
}

// ── LayoutPlan Tests ─────────────────────────────────────────────

#[test]
fn test_slot_mapper() {
    let m = SlotMapper::new(80.0);
    let width = m.measure_width(16, 4, false);
    assert!(width > 200.0, "measure with 16 slots should be >200px");
}

#[test]
fn test_place_notes() {
    let measure = NormalizedMeasure {
        index: 0,
        global_index: 0,
        paragraph_index: 0,
        measure_in_paragraph: 0,
        source_line: 1,
        events: vec![NormalizedEvent {
            track: "HH".into(),
            start: Fraction {
                numerator: 0,
                denominator: 1,
            },
            track_family: "cymbal".into(),
            duration: Fraction {
                numerator: 1,
                denominator: 8,
            },
            visual_duration: Fraction {
                numerator: 1,
                denominator: 8,
            },
            kind: EventKind::Hit,
            glyph: "x".into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice: 1,
            beam: "none".into(),
            tuplet: None,
        }],
        barline: Some("regular".into()),
        closing_barline: Some("regular".into()),
        start_nav: None,
        end_nav: None,
        volta_indices: None,
        hairpins: vec![],
        dynamics: vec![],
        measure_repeat_slashes: None,
        multi_rest_count: None,
        note_value: 8,
        volta_terminator: false,
    };
    let mapper = SlotMapper::new(80.0);
    let opts = LayoutOptions::default();
    let elements = place_notes(&measure, &mapper, &opts);
    assert_eq!(elements.len(), 1);
    assert_eq!(elements[0].kind, ElementKind::Note);
    assert_eq!(elements[0].smufl_codepoint, Some(0xE0A9));
}

#[test]
fn test_stacking_no_overlap() {
    let mut elements = vec![
        LayoutElement {
            kind: ElementKind::NavMarker,
            x: 50.0,
            y: -15.0,
            width: 10.0,
            height: 10.0,
            smufl_codepoint: None,
            voice: None,
            stem_up: None,
            barline_type: None,
            text: None,
            from_x: None,
            to_x: None,
            priority: 6,
            can_shift_y: true,
            can_shift_x: false,
        },
        LayoutElement {
            kind: ElementKind::Volta,
            x: 50.0,
            y: -20.0,
            width: 100.0,
            height: 8.0,
            smufl_codepoint: None,
            voice: None,
            stem_up: None,
            barline_type: None,
            text: None,
            from_x: None,
            to_x: None,
            priority: 7,
            can_shift_y: false,
            can_shift_x: false,
        },
    ];
    let warnings = stack_edge_elements(&mut elements, 4.0);
    assert!(warnings.is_empty(), "unexpected warnings: {:?}", warnings);
    // Nav should be pushed above volta
    assert!(elements[0].y < -20.0, "nav should be above volta");
}

#[test]
fn test_barlines() {
    let measure = NormalizedMeasure {
        index: 0,
        global_index: 0,
        paragraph_index: 0,
        measure_in_paragraph: 0,
        source_line: 1,
        events: vec![],
        barline: Some("|:".into()),
        closing_barline: Some("|:".into()),
        start_nav: None,
        end_nav: None,
        volta_indices: None,
        hairpins: vec![],
        dynamics: vec![],
        measure_repeat_slashes: None,
        multi_rest_count: None,
        note_value: 8,
        volta_terminator: false,
    };
    let elements = place_barlines(&measure, 50.0);
    assert_eq!(elements.len(), 1);
    assert_eq!(elements[0].kind, ElementKind::Barline);
    assert_eq!(elements[0].barline_type.as_deref(), Some("|:"));
}

#[test]
fn test_contract_scene_smoke() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: Some("Smoke".into()),
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "HH".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("regular".into()),
            closing_barline: Some("regular".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![RepeatSpan {
            start_measure: 0,
            end_measure: 0,
            times: 2,
        }],
    };
    let scene = build_layout_scene(&score, &LayoutOptions::default());
    assert_eq!(scene.version, LAYOUT_SCENE_VERSION);
    assert_eq!(scene.metrics_version, CANONICAL_METRICS_VERSION);
    assert_eq!(scene.pages.len(), 1);
    assert_eq!(scene.pages[0].systems.len(), 1);
    assert_eq!(scene.pages[0].measures.len(), 1);
    assert_eq!(scene.pages[0].measures[0].index, 0);
    assert!(scene.pages[0]
        .composites
        .iter()
        .all(|c| c.kind != CompositeKind::RepeatSpan));
    assert!(scene.pages[0]
        .items
        .iter()
        .all(|item| !item.role.starts_with("repeat-span")));
    assert!(scene.pages[0]
        .composites
        .iter()
        .any(|c| c.kind == CompositeKind::TextBlock && c.label.as_deref() == Some("title")));
    assert!(scene.pages[0]
        .composites
        .iter()
        .any(|c| c.kind == CompositeKind::TextBlock && c.label.as_deref() == Some("tempo")));
    assert!(scene.pages[0]
        .items
        .iter()
        .filter(|item| { matches!(item.role.as_str(), "tempo-glyph" | "tempo-equals" | "tempo") })
        .all(|item| item.measure_id.as_deref() == Some("measure-0")));
}

#[test]
fn test_system_box_pagination_contracts_and_overflow_warning_schema() {
    let system_box = SystemLayoutBox {
        system_index: 2,
        system_id: "system-2".into(),
        local_system_origin_y: 12.0,
        staff_top: 22.0,
        staff_bottom: 62.0,
        visual_top: -8.0,
        visual_bottom: 80.0,
        width_pt: 500.0,
        measures: vec![SceneMeasure {
            id: "measure-7".into(),
            index: 7,
            global_index: 7,
            system_id: "system-2".into(),
            x_pt: 0.0,
            y_pt: 12.0,
            width_pt: 100.0,
            height_pt: 50.0,
        }],
        systems: vec![SceneSystem {
            id: "system-2".into(),
            index: 2,
            page_index: 0,
            x_pt: 0.0,
            y_pt: 12.0,
            width_pt: 500.0,
            height_pt: 50.0,
            measure_ids: vec!["measure-7".into()],
        }],
        items: Vec::new(),
        composites: Vec::new(),
    };
    assert_eq!(system_box.visual_bottom - system_box.visual_top, 88.0);
    assert_eq!(system_box.local_system_origin_y, 12.0);

    let header_box = HeaderLayoutBox {
        items: Vec::new(),
        composites: Vec::new(),
        visual_top: 10.0,
        visual_bottom: 92.0,
    };
    assert_eq!(header_box.visual_bottom, 92.0);

    let placed = PlacedSystemBox {
        system_index: system_box.system_index,
        system_id: system_box.system_id.clone(),
        page_index: 1,
        page_x: 50.0,
        page_y: 120.0,
        local_visual_top: system_box.visual_top,
        local_system_origin_y: system_box.local_system_origin_y,
        width_pt: system_box.width_pt,
        measure_ids: system_box.systems[0].measure_ids.clone(),
    };
    assert_eq!(placed.page_x, 50.0);
    assert_eq!(placed.measure_ids, ["measure-7"]);

    let mut issues = vec!["Line 1: existing parser issue".to_string()];
    issues.push(layout_overflow_warning(1, &placed.system_id, 900.0, 700.0));
    assert_eq!(issues[0], "Line 1: existing parser issue");
    assert_eq!(
        issues[1],
        "LAYOUT_WARNING overflow page=1 system=system-2 visualHeight=900.00 availableHeight=700.00"
    );
}

#[test]
fn test_header_layout_box_bounds_and_page0_cursor_use_actual_visual_bottom() {
    let header = RenderHeader {
        tempo: 120,
        time_beats: 4,
        time_beat_unit: 4,
        divisions: 16,
        note_value: 8,
        grouping: vec![1, 1, 1, 1],
        title: Some("Title".into()),
        subtitle: Some("Subtitle".into()),
        composer: Some("Composer".into()),
    };
    let opts = LayoutOptions {
        top_margin_pt: 10.0,
        header_height_pt: 20.0,
        header_staff_spacing_pt: 8.0,
        tempo_offset_y: 40.0,
        ..LayoutOptions::default()
    };
    let header_box = render_header_layout_box(&header, &opts);

    assert_eq!(header_box.items.len(), 6);
    assert!(header_box
        .composites
        .iter()
        .any(|composite| composite.label.as_deref() == Some("tempo")));
    assert!(header_box.visual_bottom > opts.top_margin_pt + opts.header_height_pt);

    let fixed_cursor = opts.top_margin_pt + opts.header_height_pt + opts.header_staff_spacing_pt;
    let cursor = page0_first_system_cursor(&opts, &header_box);
    assert!(cursor > fixed_cursor);
    assert_eq!(
        cursor,
        header_box.visual_bottom + opts.header_staff_spacing_pt
    );

    let empty_header = RenderHeader {
        tempo: 0,
        title: None,
        subtitle: None,
        composer: None,
        ..header
    };
    let empty_box = render_header_layout_box(&empty_header, &opts);
    assert!(empty_box.items.is_empty());
    assert_eq!(page0_first_system_cursor(&opts, &empty_box), fixed_cursor);
}

#[test]
fn test_paginate_system_boxes_with_mock_boxes() {
    fn mock_box(index: u32, height: f32) -> SystemLayoutBox {
        let measure_id = format!("measure-{index}");
        SystemLayoutBox {
            system_index: index,
            system_id: format!("system-{index}"),
            local_system_origin_y: 10.0,
            staff_top: 20.0,
            staff_bottom: 60.0,
            visual_top: -5.0,
            visual_bottom: height - 5.0,
            width_pt: 160.0,
            measures: vec![SceneMeasure {
                id: measure_id.clone(),
                index,
                global_index: index,
                system_id: format!("system-{index}"),
                x_pt: 0.0,
                y_pt: 10.0,
                width_pt: 160.0,
                height_pt: 50.0,
            }],
            systems: Vec::new(),
            items: Vec::new(),
            composites: Vec::new(),
        }
    }

    let opts = LayoutOptions {
        page_width_pt: 200.0,
        page_height_pt: 220.0,
        top_margin_pt: 20.0,
        bottom_margin_pt: 20.0,
        left_margin_pt: 12.0,
        header_height_pt: 30.0,
        header_staff_spacing_pt: 10.0,
        system_spacing_pt: 8.0,
        ..LayoutOptions::default()
    };
    let header = HeaderLayoutBox {
        items: Vec::new(),
        composites: Vec::new(),
        visual_top: 0.0,
        visual_bottom: 80.0,
    };

    let result = paginate_system_boxes(
        &[mock_box(0, 40.0), mock_box(1, 60.0), mock_box(2, 60.0)],
        &header,
        &opts,
    );
    assert_eq!(result.issues, Vec::<String>::new());
    assert_eq!(result.placements[0].page_index, 0);
    assert_eq!(result.placements[0].page_y, 90.0);
    assert_eq!(result.placements[0].page_x, 12.0);
    assert_eq!(result.placements[1].page_index, 0);
    assert_eq!(result.placements[1].page_y, 138.0);
    assert_eq!(result.placements[2].page_index, 1);
    assert_eq!(result.placements[2].page_y, 20.0);

    let overflow = paginate_system_boxes(&[mock_box(9, 250.0)], &header, &opts);
    assert_eq!(overflow.placements[0].page_index, 0);
    assert_eq!(
        overflow.issues,
        ["LAYOUT_WARNING overflow page=0 system=system-9 visualHeight=250.00 availableHeight=180.00"]
    );
}

#[test]
fn test_final_scene_validator_checks_ids_and_page_local_references() {
    let mut scene = LayoutScene {
        version: LAYOUT_SCENE_VERSION.to_string(),
        metrics_version: CANONICAL_METRICS_VERSION.to_string(),
        pages: vec![ScenePage {
            index: 0,
            width_pt: 200.0,
            height_pt: 200.0,
            systems: vec![SceneSystem {
                id: "system-0".into(),
                index: 0,
                page_index: 0,
                x_pt: 10.0,
                y_pt: 40.0,
                width_pt: 100.0,
                height_pt: 50.0,
                measure_ids: vec!["measure-0".into()],
            }],
            measures: vec![SceneMeasure {
                id: "measure-0".into(),
                index: 0,
                global_index: 0,
                system_id: "system-0".into(),
                x_pt: 10.0,
                y_pt: 40.0,
                width_pt: 100.0,
                height_pt: 50.0,
            }],
            items: vec![SceneItem {
                id: "item-0".into(),
                measure_id: Some("measure-0".into()),
                anchor_item_id: None,
                measure_local_fraction: None,
                role: "staff-line".into(),
                kind: SceneItemKind::LineSegment,
                z_index: 0,
                primitive: ScenePrimitive::LineSegment(LineSegment {
                    x1_pt: 10.0,
                    y1_pt: 50.0,
                    x2_pt: 110.0,
                    y2_pt: 50.0,
                    stroke: "#333".into(),
                    stroke_width: 1.0,
                    stroke_line_cap: None,
                }),
            }],
            composites: vec![SceneComposite {
                id: "composite-0".into(),
                kind: CompositeKind::Volta,
                fragment: SpanFragmentKind::SingleSegment,
                child_item_ids: vec!["item-0".into()],
                label: Some("1.".into()),
                count: None,
                start_anchor_id: Some("measure-0".into()),
                end_anchor_id: Some("measure-0".into()),
            }],
        }],
        issues: Vec::new(),
    };
    assert!(validate_layout_scene(&scene).is_empty());

    scene.pages[0].items[0].anchor_item_id = Some("missing".into());
    scene.pages[0].composites[0].end_anchor_id = Some("item-0".into());
    let duplicate_item = scene.pages[0].items[0].clone();
    scene.pages[0].items.push(duplicate_item);
    let diagnostics = validate_layout_scene(&scene).join("\n");
    assert!(diagnostics.contains("LAYOUT_ERROR item-anchor"));
    assert!(diagnostics.contains("LAYOUT_ERROR composite-anchor"));
    assert!(diagnostics.contains("LAYOUT_ERROR duplicate-item"));
}

#[test]
fn test_final_scene_validator_suppresses_only_named_overflow_system_bounds() {
    let mut scene = LayoutScene {
        version: LAYOUT_SCENE_VERSION.to_string(),
        metrics_version: CANONICAL_METRICS_VERSION.to_string(),
        pages: vec![ScenePage {
            index: 0,
            width_pt: 100.0,
            height_pt: 100.0,
            systems: vec![
                SceneSystem {
                    id: "system-0".into(),
                    index: 0,
                    page_index: 0,
                    x_pt: 0.0,
                    y_pt: 0.0,
                    width_pt: 100.0,
                    height_pt: 200.0,
                    measure_ids: vec!["measure-0".into()],
                },
                SceneSystem {
                    id: "system-1".into(),
                    index: 1,
                    page_index: 0,
                    x_pt: 0.0,
                    y_pt: 0.0,
                    width_pt: 100.0,
                    height_pt: 50.0,
                    measure_ids: vec!["measure-1".into()],
                },
            ],
            measures: vec![
                SceneMeasure {
                    id: "measure-0".into(),
                    index: 0,
                    global_index: 0,
                    system_id: "system-0".into(),
                    x_pt: 0.0,
                    y_pt: 0.0,
                    width_pt: 100.0,
                    height_pt: 200.0,
                },
                SceneMeasure {
                    id: "measure-1".into(),
                    index: 1,
                    global_index: 1,
                    system_id: "system-1".into(),
                    x_pt: 0.0,
                    y_pt: 0.0,
                    width_pt: 100.0,
                    height_pt: 50.0,
                },
            ],
            items: vec![
                SceneItem {
                    id: "system-0-item-0".into(),
                    measure_id: Some("measure-0".into()),
                    anchor_item_id: None,
                    measure_local_fraction: None,
                    role: "staff-line".into(),
                    kind: SceneItemKind::LineSegment,
                    z_index: 0,
                    primitive: ScenePrimitive::LineSegment(LineSegment {
                        x1_pt: 0.0,
                        y1_pt: 150.0,
                        x2_pt: 80.0,
                        y2_pt: 150.0,
                        stroke: "#333".into(),
                        stroke_width: 1.0,
                        stroke_line_cap: None,
                    }),
                },
                SceneItem {
                    id: "system-1-item-0".into(),
                    measure_id: Some("measure-1".into()),
                    anchor_item_id: None,
                    measure_local_fraction: None,
                    role: "staff-line".into(),
                    kind: SceneItemKind::LineSegment,
                    z_index: 0,
                    primitive: ScenePrimitive::LineSegment(LineSegment {
                        x1_pt: 0.0,
                        y1_pt: 120.0,
                        x2_pt: 80.0,
                        y2_pt: 120.0,
                        stroke: "#333".into(),
                        stroke_width: 1.0,
                        stroke_line_cap: None,
                    }),
                },
            ],
            composites: Vec::new(),
        }],
        issues: vec![layout_overflow_warning(0, "system-0", 200.0, 100.0)],
    };

    let diagnostics = validate_layout_scene(&scene).join("\n");
    assert!(!diagnostics.contains("system-0-item-0"));
    assert!(diagnostics.contains("system-1-item-0"));

    scene.issues.clear();
    let diagnostics = validate_layout_scene(&scene).join("\n");
    assert!(diagnostics.contains("system-0-item-0"));
    assert!(diagnostics.contains("system-1-item-0"));
}

#[test]
fn test_system_box_orchestrator_outputs_multiple_pages_for_long_scores() {
    let event = RenderEvent {
        track: "HH".into(),
        track_family: "cymbal".into(),
        start: Fraction {
            numerator: 0,
            denominator: 1,
        },
        duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        visual_duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        kind: EventKind::Hit,
        glyph: "x".into(),
        modifiers: vec![],
        dot_count: 0,
        modifier: None,
        voice: 1,
        beam: "none".into(),
        tuplet: None,
    };
    let measures = (0..8)
        .map(|index| RenderMeasure {
            index,
            global_index: index,
            paragraph_index: index,
            measure_in_paragraph: 0,
            source_line: index + 1,
            events: vec![event.clone()],
            barline: Some("regular".into()),
            closing_barline: Some("regular".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        })
        .collect::<Vec<_>>();
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 4,
            note_value: 4,
            grouping: vec![1, 1, 1, 1],
            title: Some("Long".into()),
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures,
        errors: vec!["existing issue".into()],
        repeat_spans: vec![],
    };
    let scene = build_layout_scene(&score, &LayoutOptions::default());
    assert!(scene.pages.len() > 1);
    assert!(scene.issues.contains(&"existing issue".to_string()));
    assert!(!scene
        .issues
        .iter()
        .any(|issue| issue.starts_with("LAYOUT_ERROR")));
}

#[test]
fn test_volta_composites_are_emitted() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![
            RenderMeasure {
                index: 0,
                global_index: 0,
                paragraph_index: 0,
                measure_in_paragraph: 0,
                source_line: 1,
                events: vec![],
                barline: Some("repeat-start".into()),
                closing_barline: Some("repeat-start".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: Some(vec![1]),
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
            RenderMeasure {
                index: 1,
                global_index: 1,
                paragraph_index: 0,
                measure_in_paragraph: 1,
                source_line: 1,
                events: vec![],
                barline: Some("repeat-end".into()),
                closing_barline: Some("repeat-end".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: Some(vec![1]),
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: true,
            },
        ],
        errors: vec![],
        repeat_spans: vec![RepeatSpan {
            start_measure: 0,
            end_measure: 1,
            times: 2,
        }],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let voltas = scene.pages[0]
        .composites
        .iter()
        .filter(|composite| composite.kind == CompositeKind::Volta)
        .collect::<Vec<_>>();
    assert_eq!(voltas.len(), 1);
    assert_eq!(voltas[0].label.as_deref(), Some("1."));
    assert_eq!(voltas[0].fragment, SpanFragmentKind::SingleSegment);
    assert_eq!(voltas[0].start_anchor_id.as_deref(), Some("measure-0"));
    assert_eq!(voltas[0].end_anchor_id.as_deref(), Some("measure-1"));
}

#[test]
fn test_adjacent_voltas_share_y_and_positive_offset_moves_up() {
    let event = RenderEvent {
        track: "HH".into(),
        track_family: "cymbal".into(),
        start: Fraction {
            numerator: 0,
            denominator: 1,
        },
        duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        visual_duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        kind: EventKind::Hit,
        glyph: "x".into(),
        modifiers: vec![],
        dot_count: 0,
        modifier: None,
        voice: 1,
        beam: "none".into(),
        tuplet: None,
    };
    let measure = |index: u32, volta: u32| RenderMeasure {
        index,
        global_index: index,
        paragraph_index: 0,
        measure_in_paragraph: index,
        source_line: 1,
        events: vec![event.clone()],
        barline: Some("regular".into()),
        closing_barline: Some("regular".into()),
        start_nav: None,
        end_nav: None,
        volta_indices: Some(vec![volta]),
        hairpins: vec![],
        dynamics: vec![],
        measure_repeat_slashes: None,
        multi_rest_count: None,
        note_value: 4,
        volta_terminator: false,
    };
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 4,
            note_value: 4,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![measure(0, 1), measure(1, 2)],
        errors: vec![],
        repeat_spans: vec![],
    };

    let line_ys = |scene: &LayoutScene| {
        scene
            .pages
            .iter()
            .flat_map(|page| page.items.iter())
            .filter(|item| item.role == "volta-line")
            .filter_map(|item| match &item.primitive {
                ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
                _ => None,
            })
            .collect::<Vec<_>>()
    };

    let default_scene = build_layout_scene(&score, &LayoutOptions::default());
    let default_ys = line_ys(&default_scene);
    assert_eq!(default_ys.len(), 2);
    assert!((default_ys[0] - default_ys[1]).abs() < 0.01);
    let stem_top = default_scene.pages[0]
        .items
        .iter()
        .filter(|item| item.role == "stem")
        .filter_map(|item| match &item.primitive {
            ScenePrimitive::LineSegment(line) => Some(line.y1_pt.min(line.y2_pt)),
            _ => None,
        })
        .fold(f32::INFINITY, f32::min);
    assert!(
        default_ys[0] <= stem_top - VOLTA_SKYLINE_GAP_PT - VOLTA_LINE_THICKNESS_PT + 0.01,
        "volta line should clear the note skyline"
    );
    assert!(
        default_ys[0] > stem_top - (VOLTA_LINE_HEIGHT_PT + VOLTA_TEXT_SIZE_PT + 2.0),
        "volta line should not reserve hook and text height above the skyline"
    );

    let spaced_opts = LayoutOptions {
        volta_offset_y: 10.0,
        ..LayoutOptions::default()
    };
    let spaced_scene = build_layout_scene(&score, &spaced_opts);
    let spaced_ys = line_ys(&spaced_scene);
    assert_eq!(spaced_ys.len(), 2);
    assert!((spaced_ys[0] - spaced_ys[1]).abs() < 0.01);
    assert!(spaced_ys[0].is_finite());
}

#[test]
fn test_two_bar_measure_repeat_expands_into_two_display_measures() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![
            RenderMeasure {
                index: 0,
                global_index: 0,
                paragraph_index: 0,
                measure_in_paragraph: 0,
                source_line: 1,
                events: vec![],
                barline: Some("regular".into()),
                closing_barline: Some("regular".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
            RenderMeasure {
                index: 1,
                global_index: 1,
                paragraph_index: 0,
                measure_in_paragraph: 1,
                source_line: 1,
                events: vec![],
                barline: Some("regular".into()),
                closing_barline: Some("final".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: Some(2),
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
        ],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    assert_eq!(scene.pages[0].measures.len(), 3);
    let repeat_items = scene.pages[0]
        .items
        .iter()
        .filter_map(|item| match &item.primitive {
            ScenePrimitive::GlyphRun(glyph) if item.role == "measure-repeat" => Some(glyph),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(repeat_items.len(), 1);
    assert_eq!(
        repeat_items[0].glyph_role,
        GlyphRole::MeasureRepeatMark2Bars
    );
    let repeat_composite = scene.pages[0]
        .composites
        .iter()
        .find(|composite| composite.kind == CompositeKind::MeasureRepeat)
        .expect("expected measure-repeat composite");
    assert_eq!(repeat_composite.count, Some(2));
    assert_eq!(
        repeat_composite.start_anchor_id.as_deref(),
        Some("measure-1")
    );
    assert_eq!(repeat_composite.end_anchor_id.as_deref(), Some("measure-2"));
}

#[test]
fn test_structural_composites_are_emitted() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![
            RenderMeasure {
                index: 0,
                global_index: 0,
                paragraph_index: 0,
                measure_in_paragraph: 0,
                source_line: 1,
                events: vec![],
                barline: Some("regular".into()),
                closing_barline: Some("regular".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![HairpinSpan {
                    kind: HairpinKind::Crescendo,
                    start: Fraction {
                        numerator: 0,
                        denominator: 1,
                    },
                    end: Fraction {
                        numerator: 1,
                        denominator: 1,
                    },
                    start_measure_index: 0,
                    end_measure_index: 1,
                }],
                dynamics: vec![],
                measure_repeat_slashes: Some(2),
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
            RenderMeasure {
                index: 1,
                global_index: 1,
                paragraph_index: 0,
                measure_in_paragraph: 1,
                source_line: 1,
                events: vec![],
                barline: Some("regular".into()),
                closing_barline: Some("regular".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: Some(4),
                note_value: 8,
                volta_terminator: false,
            },
        ],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let hairpin = scene.pages[0]
        .composites
        .iter()
        .find(|c| c.kind == CompositeKind::Hairpin)
        .expect("expected hairpin composite");
    assert_eq!(hairpin.fragment, SpanFragmentKind::SingleSegment);
    assert_eq!(hairpin.label.as_deref(), Some("crescendo"));
    assert_eq!(hairpin.start_anchor_id.as_deref(), Some("measure-0"));
    assert_eq!(hairpin.end_anchor_id.as_deref(), Some("measure-2"));
    assert!(scene.pages[0]
        .composites
        .iter()
        .any(|c| c.kind == CompositeKind::MeasureRepeat && c.count == Some(2)));
    assert!(scene.pages[0]
        .composites
        .iter()
        .any(|c| c.kind == CompositeKind::MultiRest && c.count == Some(4)));
}

#[test]
fn test_system_boundaries_align_with_staff_edges() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "HH".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("regular".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let opts = LayoutOptions::default();
    let scene = build_layout_scene(&score, &opts);
    let opening = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "opening-barline")
        .expect("expected opening barline");
    let final_thick = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "final-barline-thick")
        .expect("expected final thick barline");

    match (&opening.primitive, &final_thick.primitive) {
        (ScenePrimitive::Rect(opening_rect), ScenePrimitive::Rect(final_rect)) => {
            assert!((opening_rect.x_pt - opts.left_margin_pt).abs() < 0.01);
            assert!(
                ((final_rect.x_pt + final_rect.width_pt)
                    - (opts.page_width_pt - opts.right_margin_pt))
                    .abs()
                    < 0.01
            );
        }
        _ => panic!("barlines should be rectangles"),
    }
}

#[test]
fn test_first_measure_repeat_start_sits_after_system_preamble() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "SD".into(),
            family: "drum".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "SD".into(),
                track_family: "drum".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "d".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("repeat-start".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let opts = LayoutOptions::default();
    let scene = build_layout_scene(&score, &opts);
    let opening = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "opening-barline")
        .expect("expected system opening barline");
    let repeat_start = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "repeat-start")
        .expect("expected start repeat barline");
    let notehead = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead")
        .expect("expected notehead");

    let ScenePrimitive::Rect(opening_rect) = &opening.primitive else {
        panic!("opening barline should be a rect");
    };
    let ScenePrimitive::GlyphRun(repeat_glyph) = &repeat_start.primitive else {
        panic!("repeat start should be a glyph");
    };
    let (note_x, _, _, _) = item_bounds(notehead).expect("notehead should have bounds");
    let repeat_top = repeat_glyph.y_pt - repeat_barline_rendered_height(GlyphRole::RepeatLeft);
    let repeat_bottom = repeat_glyph.y_pt;

    assert!((opening_rect.x_pt - opts.left_margin_pt).abs() < 0.01);
    assert_eq!(repeat_glyph.glyph_role, GlyphRole::RepeatLeft);
    assert_eq!(repeat_glyph.font_size_pt, REPEAT_BARLINE_FONT_SIZE_PT);
    assert!(repeat_glyph.x_pt > opening_rect.x_pt + 60.0);
    assert!((repeat_top - opening_rect.y_pt).abs() < 0.01);
    assert!((repeat_bottom - (opening_rect.y_pt + opening_rect.height_pt - 1.0)).abs() < 0.01);
    assert!(note_x > repeat_glyph.x_pt + repeat_barline_rendered_width(GlyphRole::RepeatLeft));
    assert!(
        note_x - (repeat_glyph.x_pt + repeat_barline_rendered_width(GlyphRole::RepeatLeft))
            >= 10.0,
        "first note should have visual clearance after the start repeat: repeat_x={:.2} note_x={note_x:.2}",
        repeat_glyph.x_pt
    );
}

#[cfg(test)]
fn edge_padding_measure(index: u32, event_count: u32) -> RenderMeasure {
    let events = (0..event_count)
        .map(|event_index| RenderEvent {
            track: "HH".into(),
            track_family: "cymbal".into(),
            start: Fraction {
                numerator: event_index,
                denominator: event_count.max(1),
            },
            duration: Fraction {
                numerator: 1,
                denominator: event_count.max(1),
            },
            visual_duration: Fraction {
                numerator: 1,
                denominator: event_count.max(1),
            },
            kind: EventKind::Hit,
            glyph: "x".into(),
            modifiers: vec![],
            dot_count: 0,
            modifier: None,
            voice: 1,
            beam: "none".into(),
            tuplet: None,
        })
        .collect::<Vec<_>>();

    RenderMeasure {
        index,
        global_index: index,
        paragraph_index: 0,
        measure_in_paragraph: index,
        source_line: index + 1,
        events,
        barline: Some("regular".into()),
        closing_barline: Some("regular".into()),
        start_nav: None,
        end_nav: None,
        volta_indices: None,
        hairpins: vec![],
        dynamics: vec![],
        measure_repeat_slashes: None,
        multi_rest_count: None,
        note_value: 8,
        volta_terminator: false,
    }
}

#[cfg(test)]
fn edge_padding_score(measures: Vec<RenderMeasure>) -> RenderScore {
    RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures,
        errors: vec![],
        repeat_spans: vec![],
    }
}

#[test]
fn test_non_initial_repeat_start_reserves_content_gap() {
    let mut first = edge_padding_measure(0, 16);
    first.closing_barline = Some("regular".into());
    let mut second = edge_padding_measure(1, 16);
    second.barline = Some("repeat-start".into());
    second.closing_barline = Some("final".into());

    let scene = build_layout_scene(
        &edge_padding_score(vec![first, second]),
        &LayoutOptions::default(),
    );
    let repeat_start = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "repeat-start" && item.measure_id.as_deref() == Some("measure-1"))
        .expect("expected non-initial start repeat");
    let first_note = scene.pages[0]
        .items
        .iter()
        .filter(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-1"))
        .min_by(|a, b| {
            let ax = item_bounds(a)
                .map(|(x, _, _, _)| x)
                .unwrap_or(f32::INFINITY);
            let bx = item_bounds(b)
                .map(|(x, _, _, _)| x)
                .unwrap_or(f32::INFINITY);
            ax.partial_cmp(&bx).unwrap()
        })
        .expect("expected first notehead in second measure");

    let (repeat_x, _, repeat_w, _) = item_bounds(repeat_start).expect("repeat should have bounds");
    let (note_x, _, _, _) = item_bounds(first_note).expect("notehead should have bounds");
    let gap = note_x - (repeat_x + repeat_w);

    assert!(
        gap >= 10.0,
        "non-initial start repeat should reserve visual content gap: gap={gap:.2}"
    );
}

#[test]
fn test_repeat_end_reserves_content_gap_before_right_barline() {
    let mut measure = edge_padding_measure(0, 16);
    measure.closing_barline = Some("repeat-end".into());

    let scene = build_layout_scene(
        &edge_padding_score(vec![measure]),
        &LayoutOptions::default(),
    );
    let repeat_end = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "repeat-end" && item.measure_id.as_deref() == Some("measure-0"))
        .expect("expected repeat end");
    let last_note = scene.pages[0]
        .items
        .iter()
        .filter(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-0"))
        .max_by(|a, b| {
            let ax = item_bounds(a)
                .map(|(x, _, width, _)| x + width)
                .unwrap_or(f32::NEG_INFINITY);
            let bx = item_bounds(b)
                .map(|(x, _, width, _)| x + width)
                .unwrap_or(f32::NEG_INFINITY);
            ax.partial_cmp(&bx).unwrap()
        })
        .expect("expected last notehead");

    let (repeat_x, _, _, _) = item_bounds(repeat_end).expect("repeat should have bounds");
    let (note_x, _, note_w, _) = item_bounds(last_note).expect("notehead should have bounds");
    let gap = repeat_x - (note_x + note_w);

    assert!(
        gap >= 10.0,
        "repeat end should reserve visual content gap before the barline: gap={gap:.2}"
    );
}

#[test]
fn test_adjacent_repeat_end_start_uses_smufl_right_left_glyph() {
    fn repeat_measure(index: u32) -> RenderMeasure {
        RenderMeasure {
            index,
            global_index: index,
            paragraph_index: 0,
            measure_in_paragraph: index,
            source_line: 1,
            events: vec![RenderEvent {
                track: "HH".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("repeat-start".into()),
            closing_barline: Some("repeat-end".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 4,
            volta_terminator: false,
        }
    }

    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 4,
            note_value: 4,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![repeat_measure(0), repeat_measure(1)],
        errors: vec![],
        repeat_spans: vec![],
    };
    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let page = &scene.pages[0];
    let shared_repeat = page
        .items
        .iter()
        .find(|item| item.role == "repeat-end-start")
        .expect("expected shared repeat boundary glyph");
    let ScenePrimitive::GlyphRun(shared_glyph) = &shared_repeat.primitive else {
        panic!("shared repeat boundary should be a glyph");
    };

    assert_eq!(shared_glyph.glyph_role, GlyphRole::RepeatRightLeft);
    assert_eq!(shared_glyph.font_size_pt, REPEAT_BARLINE_FONT_SIZE_PT);
    assert_eq!(
        page.items
            .iter()
            .filter(|item| item.role == "repeat-start")
            .count(),
        1,
        "the second measure's left repeat should be represented by repeatRightLeft"
    );
}

#[test]
fn test_later_system_uses_smaller_start_zone_than_first_system() {
    let measures = [0_u32, 1_u32]
        .into_iter()
        .map(|index| RenderMeasure {
            index,
            global_index: index,
            paragraph_index: index,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "HH".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("regular".into()),
            closing_barline: Some(if index == 1 {
                "final".into()
            } else {
                "regular".into()
            }),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        })
        .collect();

    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures,
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let first_x = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-0"))
        .and_then(|item| match &item.primitive {
            ScenePrimitive::TextRun(text) => Some(text.x_pt),
            _ => None,
        })
        .expect("expected first-system notehead");
    let second_x = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead" && item.measure_id.as_deref() == Some("measure-1"))
        .and_then(|item| match &item.primitive {
            ScenePrimitive::TextRun(text) => Some(text.x_pt),
            _ => None,
        })
        .expect("expected later-system notehead");

    assert!(
        second_x < first_x,
        "later systems should not retain first-system time-signature padding"
    );
}

#[test]
fn test_later_system_measure_number_uses_absolute_measure_index() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "HH".into(),
            family: "cymbal".into(),
        }],
        measures: vec![
            RenderMeasure {
                index: 3,
                global_index: 3,
                paragraph_index: 0,
                measure_in_paragraph: 0,
                source_line: 1,
                events: vec![],
                barline: Some("regular".into()),
                closing_barline: Some("regular".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
            RenderMeasure {
                index: 7,
                global_index: 7,
                paragraph_index: 1,
                measure_in_paragraph: 0,
                source_line: 2,
                events: vec![],
                barline: Some("final".into()),
                closing_barline: Some("final".into()),
                start_nav: None,
                end_nav: None,
                volta_indices: None,
                hairpins: vec![],
                dynamics: vec![],
                measure_repeat_slashes: None,
                multi_rest_count: None,
                note_value: 8,
                volta_terminator: false,
            },
        ],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let measure_number = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "measure-number")
        .expect("expected measure number on later system");
    let ScenePrimitive::TextRun(text) = &measure_number.primitive else {
        panic!("measure number should be text");
    };
    assert_eq!(text.text, "8");
}

#[test]
fn test_down_stem_keeps_notehead_on_right_and_flag_on_stem_right_side() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "BD".into(),
            family: "drum".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "BD".into(),
                track_family: "drum".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                kind: EventKind::Hit,
                glyph: "d".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 2,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("final".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let notehead = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead")
        .expect("expected notehead");
    let stem = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "stem")
        .expect("expected stem");
    let flag = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "flag")
        .expect("expected flag");

    let note_x = match &notehead.primitive {
        ScenePrimitive::TextRun(text) => text.x_pt,
        _ => panic!("notehead should be text"),
    };
    let stem_x = match &stem.primitive {
        ScenePrimitive::LineSegment(line) => line.x1_pt,
        _ => panic!("stem should be line"),
    };
    let (flag_x, flag_role) = match &flag.primitive {
        ScenePrimitive::GlyphRun(glyph) => (glyph.x_pt, glyph.glyph_role),
        _ => panic!("flag should be glyph"),
    };

    assert!(
        stem_x < note_x + 4.0,
        "down stem should anchor on the notehead left side"
    );
    assert!(
        flag_x >= stem_x - 0.75,
        "down flag glyph should start on the stem and extend on its right side"
    );
    assert_eq!(flag_role, GlyphRole::Flag8thDown);
}

#[test]
fn test_crash_maps_to_top_ledger_line() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "C".into(),
            family: "cymbal".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "C".into(),
                track_family: "cymbal".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "x".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("final".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let notehead_y = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::TextRun(text) => Some(text.y_pt),
            _ => None,
        })
        .expect("expected crash notehead");
    let staff_top = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "staff-line")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
            _ => None,
        })
        .expect("expected staff line");
    let ledger_y = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "ledger-line")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
            _ => None,
        })
        .expect("expected top ledger line");
    let notehead = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead")
        .expect("expected crash notehead");
    let ledger = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "ledger-line")
        .expect("expected top ledger line");
    let ledger_center_x = match &ledger.primitive {
        ScenePrimitive::LineSegment(line) => (line.x1_pt + line.x2_pt) * 0.5,
        _ => panic!("expected ledger line segment"),
    };
    let notehead_center_x = match &notehead.primitive {
        ScenePrimitive::TextRun(text) => {
            let glyph_role = text
                .text
                .chars()
                .next()
                .map(|ch| glyph_role_for_codepoint(ch as u32))
                .expect("expected SMuFL notehead glyph");
            text.x_pt
                + glyph_bbox_center_x_offset(canonical_glyph_metric(glyph_role), text.font_size_pt)
        }
        _ => panic!("expected notehead text"),
    };

    assert!((notehead_y - (staff_top - 10.0)).abs() < 0.01);
    assert!((ledger_y - (staff_top - 10.0)).abs() < 0.01);
    assert!((ledger_center_x - notehead_center_x).abs() < 0.01);
}

#[test]
fn test_bottom_ledger_lines_render_for_notes_below_staff() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "WB".into(),
            family: "percussion".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "WB".into(),
                track_family: "percussion".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 4,
                },
                kind: EventKind::Hit,
                glyph: "d".into(),
                modifiers: vec![],
                dot_count: 0,
                modifier: None,
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("final".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let staff_top = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "staff-line")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
            _ => None,
        })
        .expect("expected staff line");
    let ledger_ys = scene.pages[0]
        .items
        .iter()
        .filter(|item| item.role == "ledger-line")
        .filter_map(|item| match &item.primitive {
            ScenePrimitive::LineSegment(line) => Some(line.y1_pt),
            _ => None,
        })
        .collect::<Vec<_>>();

    assert_eq!(ledger_ys.len(), 2);
    assert!(ledger_ys
        .iter()
        .any(|y| (*y - (staff_top + 50.0)).abs() < 0.01));
    assert!(ledger_ys
        .iter()
        .any(|y| (*y - (staff_top + 60.0)).abs() < 0.01));
}

#[test]
fn test_flam_renders_grace_notehead_stem_and_slash() {
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "SD".into(),
            family: "drum".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "SD".into(),
                track_family: "drum".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                visual_duration: Fraction {
                    numerator: 1,
                    denominator: 8,
                },
                kind: EventKind::Hit,
                glyph: "d".into(),
                modifiers: vec!["flam".into()],
                dot_count: 0,
                modifier: Some("flam".into()),
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("final".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    };

    let scene = build_layout_scene(&score, &LayoutOptions::default());
    let count_role = |role: &str| {
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == role)
            .count()
    };
    let main_note_x = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "notehead")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::TextRun(text) => Some(text.x_pt),
            _ => None,
        })
        .expect("expected main notehead");
    let grace_note_x = scene.pages[0]
        .items
        .iter()
        .find(|item| item.role == "grace-notehead")
        .and_then(|item| match &item.primitive {
            ScenePrimitive::TextRun(text) => Some(text.x_pt),
            _ => None,
        })
        .expect("expected grace notehead");

    assert_eq!(count_role("grace-notehead"), 1);
    assert_eq!(count_role("grace-stem"), 1);
    assert_eq!(count_role("grace-slash"), 1);
    assert_eq!(count_role("grace-flag"), 1);
    assert!(grace_note_x < main_note_x);
}

#[test]
fn test_flam_defaults_grace_flag_to_eighth_note() {
    let scene = build_layout_scene(
        &grace_modifier_score(
            "flam",
            Fraction {
                numerator: 1,
                denominator: 4,
            },
        ),
        &LayoutOptions::default(),
    );
    let flag_roles = scene.pages[0]
        .items
        .iter()
        .filter(|item| item.role == "grace-flag")
        .map(|item| match &item.primitive {
            ScenePrimitive::GlyphRun(glyph) => glyph.glyph_role,
            _ => panic!("grace flag should be a glyph"),
        })
        .collect::<Vec<_>>();

    assert_eq!(flag_roles, vec![GlyphRole::Flag8thUp]);
}

#[test]
fn test_flam_uses_matching_grace_flags_for_sixteenth_and_thirty_second_notes() {
    let sixteenth = build_layout_scene(
        &grace_modifier_score(
            "flam",
            Fraction {
                numerator: 1,
                denominator: 16,
            },
        ),
        &LayoutOptions::default(),
    );
    let thirty_second = build_layout_scene(
        &grace_modifier_score(
            "flam",
            Fraction {
                numerator: 1,
                denominator: 32,
            },
        ),
        &LayoutOptions::default(),
    );

    assert!(sixteenth.pages[0].items.iter().any(|item| {
        item.role == "grace-flag"
            && matches!(
                &item.primitive,
                ScenePrimitive::GlyphRun(GlyphRun {
                    glyph_role: GlyphRole::Flag16thUp,
                    ..
                })
            )
    }));
    assert!(thirty_second.pages[0].items.iter().any(|item| {
        item.role == "grace-flag"
            && matches!(
                &item.primitive,
                ScenePrimitive::GlyphRun(GlyphRun {
                    glyph_role: GlyphRole::Flag32ndUp,
                    ..
                })
            )
    }));
}

#[test]
fn test_drag_renders_two_beamed_sixteenth_grace_notes_without_slashes() {
    let scene = build_layout_scene(
        &grace_modifier_score(
            "drag",
            Fraction {
                numerator: 1,
                denominator: 16,
            },
        ),
        &LayoutOptions::default(),
    );

    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-notehead")
            .count(),
        2
    );
    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-stem")
            .count(),
        2
    );
    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-slash")
            .count(),
        0
    );
    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-flag")
            .count(),
        0
    );
    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-beam")
            .count(),
        1
    );
    assert_eq!(
        scene.pages[0]
            .items
            .iter()
            .filter(|item| item.role == "grace-beam-secondary")
            .count(),
        1
    );
}

#[cfg(test)]
fn grace_modifier_score(modifier: &str, visual_duration: Fraction) -> RenderScore {
    RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 16,
            note_value: 8,
            grouping: vec![1, 1, 1, 1],
            title: None,
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "SD".into(),
            family: "drum".into(),
        }],
        measures: vec![RenderMeasure {
            index: 0,
            global_index: 0,
            paragraph_index: 0,
            measure_in_paragraph: 0,
            source_line: 1,
            events: vec![RenderEvent {
                track: "SD".into(),
                track_family: "drum".into(),
                start: Fraction {
                    numerator: 0,
                    denominator: 1,
                },
                duration: visual_duration,
                visual_duration,
                kind: EventKind::Hit,
                glyph: "d".into(),
                modifiers: vec![modifier.into()],
                dot_count: 0,
                modifier: Some(modifier.into()),
                voice: 1,
                beam: "none".into(),
                tuplet: None,
            }],
            barline: Some("final".into()),
            closing_barline: Some("final".into()),
            start_nav: None,
            end_nav: None,
            volta_indices: None,
            hairpins: vec![],
            dynamics: vec![],
            measure_repeat_slashes: None,
            multi_rest_count: None,
            note_value: 8,
            volta_terminator: false,
        }],
        errors: vec![],
        repeat_spans: vec![],
    }
}
// PATCH_INSERT_FOR_GOLDEN_REGENERATION
