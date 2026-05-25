use crate::metrics::{GlyphRole, TextRole};

pub const RENDER_SCORE_VERSION: &str = "2";
pub const LAYOUT_SCENE_VERSION: &str = "1";
pub const CANONICAL_METRICS_VERSION: &str = "2026-05-13";

// ── Core Render Contract ────────────────────────────────────────

/// Musical fraction (numerator/denominator) for start times and durations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fraction {
    pub numerator: u32,
    pub denominator: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderScore {
    pub version: String,
    pub header: RenderHeader,
    pub tracks: Vec<RenderTrack>,
    pub measures: Vec<RenderMeasure>,
    pub errors: Vec<String>,
    pub repeat_spans: Vec<RepeatSpan>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderHeader {
    pub tempo: u32,
    pub time_beats: u32,
    pub time_beat_unit: u32,
    pub divisions: u32,
    pub note_value: u32,
    pub grouping: Vec<u32>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub composer: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderTrack {
    pub id: String,
    pub family: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderMeasure {
    pub index: u32,
    pub global_index: u32,
    pub paragraph_index: u32,
    pub measure_in_paragraph: u32,
    pub source_line: u32,
    pub events: Vec<RenderEvent>,
    pub barline: Option<String>,
    pub closing_barline: Option<String>,
    pub start_nav: Option<NavMarker>,
    pub end_nav: Option<NavJump>,
    pub volta_indices: Option<Vec<u32>>,
    pub hairpins: Vec<HairpinSpan>,
    pub dynamics: Vec<DynamicMark>,
    pub measure_repeat_slashes: Option<u32>,
    pub multi_rest_count: Option<u32>,
    pub note_value: u32,
    pub volta_terminator: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DynamicMark {
    pub level: DynamicLevel,
    pub at: Fraction,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DynamicLevel {
    Ppp,
    Pp,
    P,
    Mp,
    Mf,
    F,
    Ff,
    Fff,
}

impl DynamicLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            DynamicLevel::Ppp => "ppp",
            DynamicLevel::Pp => "pp",
            DynamicLevel::P => "p",
            DynamicLevel::Mp => "mp",
            DynamicLevel::Mf => "mf",
            DynamicLevel::F => "f",
            DynamicLevel::Ff => "ff",
            DynamicLevel::Fff => "fff",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderEvent {
    pub track: String,
    pub track_family: String,
    pub start: Fraction,
    pub duration: Fraction,
    pub visual_duration: Fraction,
    pub kind: EventKind,
    pub glyph: String,
    pub modifiers: Vec<String>,
    pub dot_count: u8,
    pub modifier: Option<String>,
    pub voice: u8,
    pub beam: String,
    pub tuplet: Option<(u32, u32)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepeatSpan {
    pub start_measure: u32,
    pub end_measure: u32,
    pub times: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventKind {
    Hit,
    Rest,
    Sticking,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NavMarker {
    Segno,
    Coda,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NavJump {
    Fine,
    DC,
    DS,
    DCalFine,
    DCalCoda,
    DSalFine,
    DSalCoda,
    ToCoda,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HairpinSpan {
    pub kind: HairpinKind,
    pub start: Fraction,
    pub end: Fraction,
    pub start_measure_index: u32,
    pub end_measure_index: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HairpinKind {
    Crescendo,
    Decrescendo,
}

// Compatibility aliases while the old source-driven path still exists.
pub type NormalizedScore = RenderScore;
pub type NormalizedHeader = RenderHeader;
pub type NormalizedTrack = RenderTrack;
pub type NormalizedMeasure = RenderMeasure;
pub type NormalizedEvent = RenderEvent;
pub type Hairpin = HairpinSpan;

// ── Platform-Neutral Scene Contract ─────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub struct LayoutScene {
    pub version: String,
    pub metrics_version: String,
    pub pages: Vec<ScenePage>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ScenePage {
    pub index: u32,
    pub width_pt: f32,
    pub height_pt: f32,
    pub systems: Vec<SceneSystem>,
    pub measures: Vec<SceneMeasure>,
    pub items: Vec<SceneItem>,
    pub composites: Vec<SceneComposite>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SceneSystem {
    pub id: String,
    pub index: u32,
    pub page_index: u32,
    pub x_pt: f32,
    pub y_pt: f32,
    pub width_pt: f32,
    pub height_pt: f32,
    pub measure_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SceneMeasure {
    pub id: String,
    pub index: u32,
    pub global_index: u32,
    pub system_id: String,
    pub x_pt: f32,
    pub y_pt: f32,
    pub width_pt: f32,
    pub height_pt: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SceneItemKind {
    GlyphRun,
    TextRun,
    LineSegment,
    Rect,
    Polyline,
    Path,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SceneItem {
    pub id: String,
    pub measure_id: Option<String>,
    pub anchor_item_id: Option<String>,
    pub measure_local_fraction: Option<Fraction>,
    pub role: String,
    pub kind: SceneItemKind,
    pub z_index: i32,
    pub primitive: ScenePrimitive,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ScenePrimitive {
    GlyphRun(GlyphRun),
    TextRun(TextRun),
    LineSegment(LineSegment),
    Rect(RectShape),
    Polyline(Polyline),
    Path(PathShape),
}

#[derive(Debug, Clone, PartialEq)]
pub struct GlyphRun {
    pub x_pt: f32,
    pub y_pt: f32,
    pub glyph_role: GlyphRole,
    pub glyph_count: u32,
    pub smufl_codepoint: Option<u32>,
    pub font_family: String,
    pub font_size_pt: f32,
    pub fill: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextRun {
    pub x_pt: f32,
    pub y_pt: f32,
    pub text_role: TextRole,
    pub text: String,
    pub font_family: String,
    pub font_size_pt: f32,
    pub fill: String,
    pub text_anchor: Option<String>,
    pub font_weight: Option<String>,
    pub font_style: Option<String>,
    pub accessible_label: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LineSegment {
    pub x1_pt: f32,
    pub y1_pt: f32,
    pub x2_pt: f32,
    pub y2_pt: f32,
    pub stroke: String,
    pub stroke_width: f32,
    pub stroke_line_cap: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RectShape {
    pub x_pt: f32,
    pub y_pt: f32,
    pub width_pt: f32,
    pub height_pt: f32,
    pub fill: String,
    pub stroke: Option<String>,
    pub stroke_width: Option<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Polyline {
    pub points_pt: Vec<(f32, f32)>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PathShape {
    pub d: String,
    pub fill: String,
    pub stroke: Option<String>,
    pub stroke_width: Option<f32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompositeKind {
    RepeatSpan,
    Volta,
    Hairpin,
    Navigation,
    MeasureRepeat,
    MultiRest,
    TextBlock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpanFragmentKind {
    SingleSegment,
    Start,
    Continuation,
    End,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SceneComposite {
    pub id: String,
    pub kind: CompositeKind,
    pub fragment: SpanFragmentKind,
    pub child_item_ids: Vec<String>,
    pub label: Option<String>,
    pub count: Option<u32>,
    pub start_anchor_id: Option<String>,
    pub end_anchor_id: Option<String>,
}
