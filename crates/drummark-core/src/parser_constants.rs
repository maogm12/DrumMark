/// Bare `--1--` is rejected; multi-rest shorthand starts at two measures.
pub const MULTI_REST_MIN_COUNT: u32 = 2;

/// Supported `note 1/N` denominators. These match the notation/export set currently handled
/// across normalization, layout, and MusicXML generation.
pub const SUPPORTED_NOTE_DENOMINATORS: [u32; 8] = [1, 2, 4, 8, 16, 32, 64, 128];
