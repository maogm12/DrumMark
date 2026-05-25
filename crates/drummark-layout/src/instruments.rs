pub fn track_family(track: &str) -> &str {
    match track {
        "HH" | "RC" | "RC2" | "C" | "C2" | "SPL" | "CHN" => "cymbal",
        "SD" | "BD" | "BD2" | "T1" | "T2" | "T3" | "T4" | "ST" => "drum",
        "HF" => "pedal",
        "CB" | "WB" | "CL" => "percussion",
        _ => "auxiliary",
    }
}

/// Vertical position of each drum kit element in staff-space units
/// (0 = top staff line, positive = downward).
pub fn staff_y_for_track(track: &str) -> f32 {
    match track {
        "HH" => -0.5,
        "RC" => 0.0,
        "RC2" | "T1" => 0.5,
        "C" => -1.0,
        "C2" => -1.5,
        "SPL" => -2.5,
        "CHN" => -2.0,
        "SD" => 1.5,
        "T2" => 1.0,
        "T3" => 2.5,
        "T4" | "CL" => 3.0,
        "BD" => 3.5,
        "BD2" => 4.0,
        "HF" => 4.5,
        "CB" => 2.0,
        "WB" => 6.5,
        "ST" => -3.0,
        _ => 1.5,
    }
}

pub const STAFF_HEIGHT_SS: f32 = 8.0;
pub const STAFF_TOP_SS: f32 = 0.0;
pub const STAFF_BOTTOM_SS: f32 = STAFF_HEIGHT_SS;
