use drummark_layout::*;

fn sample_fraction() -> Fraction {
    Fraction {
        numerator: 0,
        denominator: 1,
    }
}

#[test]
fn crate_root_public_api_smoke() {
    assert_eq!(RENDER_SCORE_VERSION, "2");
    assert_eq!(LAYOUT_SCENE_VERSION, "2");
    assert!(!CANONICAL_METRICS_VERSION.is_empty());

    let hit = RenderEvent {
        track: "SD".to_string(),
        track_family: track_family("SD").to_string(),
        start: sample_fraction(),
        duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        visual_duration: Fraction {
            numerator: 1,
            denominator: 4,
        },
        kind: EventKind::Hit,
        glyph: "d".to_string(),
        modifiers: Vec::new(),
        dot_count: 0,
        modifier: None,
        voice: 1,
        beam: "none".to_string(),
        tuplet: None,
    };
    let measure = RenderMeasure {
        index: 0,
        global_index: 0,
        paragraph_index: 0,
        measure_in_paragraph: 0,
        source_line: 1,
        events: vec![hit],
        barline: Some("regular".to_string()),
        closing_barline: Some("final".to_string()),
        start_nav: Some(NavMarker::Segno),
        end_nav: Some(NavJump::Fine),
        volta_indices: None,
        hairpins: vec![HairpinSpan {
            kind: HairpinKind::Crescendo,
            start: sample_fraction(),
            end: Fraction {
                numerator: 1,
                denominator: 1,
            },
            start_measure_index: 0,
            end_measure_index: 0,
        }],
        dynamics: vec![DynamicMark {
            level: DynamicLevel::Mf,
            at: sample_fraction(),
        }],
        measure_repeat_slashes: None,
        multi_rest_count: None,
        note_value: 8,
        volta_terminator: false,
    };
    let score = RenderScore {
        version: RENDER_SCORE_VERSION.to_string(),
        header: RenderHeader {
            tempo: 120,
            time_beats: 4,
            time_beat_unit: 4,
            divisions: 4,
            note_value: 8,
            grouping: vec![2, 2],
            title: Some("Smoke".to_string()),
            subtitle: None,
            composer: None,
        },
        tracks: vec![RenderTrack {
            id: "SD".to_string(),
            family: "drum".to_string(),
        }],
        measures: vec![measure],
        errors: Vec::new(),
        repeat_spans: vec![RepeatSpan {
            start_measure: 0,
            end_measure: 0,
            times: 2,
        }],
    };

    let opts = LayoutOptions::default();
    let scene = build_layout_scene(&score, &opts);
    assert_eq!(scene.version, LAYOUT_SCENE_VERSION);
    assert!(!layout_scene_snapshot(&scene).is_empty());

    let staff_space = StaffSpace::default();
    assert_eq!(staff_space.to_pt(2.0), 10.0);
    assert_eq!(staff_y_for_track("SD"), 1.5);

    let note_metric = notehead_glyph("SD", &[], "d");
    assert_eq!(note_metric.role, GlyphRole::NoteheadBlack);
    assert!(canonical_glyph_metric(GlyphRole::RestQuarter).width_ss() > 0.0);
    assert!(canonical_text_metric(TextRole::Tempo, 10.0).font_size_pt > 0.0);
    assert!(!canonical_flag_path(FlagPathRole::EighthUp, 10.0, 20.0).is_empty());
    assert_eq!(
        rest_glyph_for_fraction(Fraction {
            numerator: 1,
            denominator: 8,
        })
        .role,
        GlyphRole::RestEighth
    );
    assert_eq!(rest_glyph(4).role, GlyphRole::RestQuarter);
    assert!(glyph_metrics(0xE0A4).0 > 0.0);

    let mapper = SlotMapper::new(80.0);
    let mut elements = place_notes(&score.measures[0], &mapper, &opts);
    elements.extend(place_barlines(&score.measures[0], 50.0, &opts));
    let warnings = stack_edge_elements(&mut elements, 4.0);
    assert!(warnings.is_empty());
    assert_eq!(build_systems(&score, &opts).len(), 1);

    let _to_js: fn(&LayoutScene) -> wasm_bindgen::JsValue = layout_scene_to_js;
}
