pub const TITLE: &str = "title";
pub const SUBTITLE: &str = "subtitle";
pub const COMPOSER: &str = "composer";
pub const TEMPO_GLYPH: &str = "tempo-glyph";
pub const TEMPO_EQUALS: &str = "tempo-equals";
pub const TEMPO: &str = "tempo";
pub const STAFF_LINE: &str = "staff-line";
pub const PERCUSSION_CLEF: &str = "percussion-clef";
pub const TIME_SIGNATURE_DIGIT: &str = "time-signature-digit";
pub const MEASURE_NUMBER: &str = "measure-number";
pub const DYNAMIC: &str = "dynamic";

pub fn is_decoration_role(role: &str) -> bool {
    matches!(
        role,
        TEMPO_GLYPH
            | TEMPO_EQUALS
            | TEMPO
            | STAFF_LINE
            | PERCUSSION_CLEF
            | TIME_SIGNATURE_DIGIT
            | MEASURE_NUMBER
            | TITLE
            | SUBTITLE
            | COMPOSER
    )
}

pub fn is_volta_role(role: &str) -> bool {
    role.starts_with("volta")
}

pub fn is_hairpin_role(role: &str) -> bool {
    role.starts_with("hairpin")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_helpers_cover_scene_role_surface() {
        assert_eq!(TITLE, "title");
        assert_eq!(MEASURE_NUMBER, "measure-number");
        assert!(is_decoration_role(TEMPO));
        assert!(is_volta_role("volta-line"));
        assert!(is_hairpin_role("hairpin-top"));
        assert!(!is_decoration_role("notehead"));
    }
}
