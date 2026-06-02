/// Gap from the system/page left margin to the first preamble glyph, and between preamble glyphs.
pub(crate) const SYSTEM_PREAMBLE_SIDE_GAP_PT: f32 = 5.0;

/// Default trailing whitespace after regular barlines before the next measure's content.
pub(crate) const MEASURE_RIGHT_PAD_PT: f32 = 10.0;
/// Default left whitespace before non-initial measure content when no special barline is present.
pub(crate) const NON_INITIAL_MEASURE_LEFT_PAD_PT: f32 = 10.0;
/// Visual gap between compact-measure content (multi-rest / repeat slash) and adjacent barlines.
pub(crate) const COMPACT_MEASURE_EDGE_GAP_PT: f32 = 8.0;
/// Extra trailing gap after final or double barlines.
pub(crate) const COMPLEX_BARLINE_TRAILING_CONTENT_GAP_PT: f32 = 8.0;
/// Default pull-back applied when a first-system start repeat shares space with the preamble.
pub(crate) const FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT: f32 = 10.0;
/// Content gap kept after a rendered start or end repeat barline glyph.
pub(crate) const START_REPEAT_TRAILING_GAP_PT: f32 = 10.0;

/// Inner inset from a final/double barline pair to compact-measure content.
pub(crate) const FINAL_OR_DOUBLE_BARLINE_INNER_RIGHT_INSET_PT: f32 = 4.0;
/// Opening/system barlines reuse the standard engraving barline thickness.
pub(crate) const OPENING_BARLINE_THICKNESS_PT: f32 = crate::ENGRAVING_BARLINE_WIDTH_PT;
/// Minimum width the planner should assume remains available for a system body.
pub(crate) const MIN_SYSTEM_AVAILABLE_WIDTH_PT: f32 = 100.0;

/// Scene coordinates and SVG `font-size` both use layout points (1 user unit = 1 pt).
pub(crate) const SVG_POINT_TO_USER_UNIT: f32 = 1.0;
/// Volta brackets use the shared engraving stroke width.
pub(crate) const VOLTA_LINE_THICKNESS_PT: f32 = crate::ENGRAVING_STROKE_WIDTH_PT;

/// Multi-rest horizontal bar inset as a fraction of the compact lane width.
pub(crate) const MULTI_REST_INNER_PAD_RATIO: f32 = 0.1;
/// Minimum multi-rest horizontal inset so short compact measures still breathe.
pub(crate) const MULTI_REST_INNER_PAD_MIN_PT: f32 = 8.0;
