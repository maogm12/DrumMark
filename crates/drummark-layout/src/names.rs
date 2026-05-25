use crate::contract::{CompositeKind, SceneItemKind, SpanFragmentKind};
use crate::metrics::{GlyphRole, TextRole};

pub fn scene_item_kind_name(kind: SceneItemKind) -> &'static str {
    match kind {
        SceneItemKind::GlyphRun => "glyphRun",
        SceneItemKind::TextRun => "textRun",
        SceneItemKind::LineSegment => "lineSegment",
        SceneItemKind::Rect => "rect",
        SceneItemKind::Polyline => "polyline",
        SceneItemKind::Path => "path",
    }
}

pub fn glyph_role_name(role: GlyphRole) -> &'static str {
    match role {
        GlyphRole::NoteheadBlack => "noteheadBlack",
        GlyphRole::NoteheadX => "noteheadX",
        GlyphRole::NoteheadDiamond => "noteheadDiamond",
        GlyphRole::NoteheadCircleX => "noteheadCircleX",
        GlyphRole::NoteheadRim => "noteheadRim",
        GlyphRole::Flag8thUp => "flag8thUp",
        GlyphRole::Flag8thDown => "flag8thDown",
        GlyphRole::Flag16thUp => "flag16thUp",
        GlyphRole::Flag16thDown => "flag16thDown",
        GlyphRole::Flag32ndUp => "flag32ndUp",
        GlyphRole::Flag32ndDown => "flag32ndDown",
        GlyphRole::PercussionClef => "percussionClef",
        GlyphRole::TimeSignatureDigit => "timeSignatureDigit",
        GlyphRole::RestWhole => "restWhole",
        GlyphRole::RestHalf => "restHalf",
        GlyphRole::RestQuarter => "restQuarter",
        GlyphRole::RestEighth => "restEighth",
        GlyphRole::RestSixteenth => "restSixteenth",
        GlyphRole::RestThirtySecond => "restThirtySecond",
        GlyphRole::RepeatLeft => "repeatLeft",
        GlyphRole::RepeatRight => "repeatRight",
        GlyphRole::RepeatRightLeft => "repeatRightLeft",
        GlyphRole::RepeatDot => "repeatDot",
        GlyphRole::ArticAccentAbove => "articAccentAbove",
        GlyphRole::ArticAccentBelow => "articAccentBelow",
        GlyphRole::MeasureRepeatMark1Bar => "measureRepeatMark1Bar",
        GlyphRole::MeasureRepeatMark2Bars => "measureRepeatMark2Bars",
        GlyphRole::MultiRestBar => "multiRestBar",
        GlyphRole::NavigationSegno => "navigationSegno",
        GlyphRole::NavigationCoda => "navigationCoda",
        GlyphRole::MetNoteQuarterUp => "metNoteQuarterUp",
        GlyphRole::AugmentationDot => "augmentationDot",
    }
}

pub fn text_role_name(role: TextRole) -> &'static str {
    match role {
        TextRole::Title => "title",
        TextRole::Subtitle => "subtitle",
        TextRole::Composer => "composer",
        TextRole::Tempo => "tempo",
        TextRole::PercussionClef => "percussionClef",
        TextRole::TimeSignatureDigit => "timeSignatureDigit",
        TextRole::Sticking => "sticking",
        TextRole::CountLabel => "countLabel",
        TextRole::MeasureNumber => "measureNumber",
        TextRole::Dynamic => "dynamic",
    }
}

pub fn composite_kind_name(kind: CompositeKind) -> &'static str {
    match kind {
        CompositeKind::RepeatSpan => "repeatSpan",
        CompositeKind::Volta => "volta",
        CompositeKind::Hairpin => "hairpin",
        CompositeKind::Navigation => "navigation",
        CompositeKind::MeasureRepeat => "measureRepeat",
        CompositeKind::MultiRest => "multiRest",
        CompositeKind::TextBlock => "textBlock",
    }
}

pub fn fragment_kind_name(kind: SpanFragmentKind) -> &'static str {
    match kind {
        SpanFragmentKind::SingleSegment => "singleSegment",
        SpanFragmentKind::Start => "start",
        SpanFragmentKind::Continuation => "continuation",
        SpanFragmentKind::End => "end",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_cover_serialized_enum_surface() {
        assert_eq!(scene_item_kind_name(SceneItemKind::GlyphRun), "glyphRun");
        assert_eq!(glyph_role_name(GlyphRole::NoteheadX), "noteheadX");
        assert_eq!(text_role_name(TextRole::MeasureNumber), "measureNumber");
        assert_eq!(composite_kind_name(CompositeKind::Hairpin), "hairpin");
        assert_eq!(
            fragment_kind_name(SpanFragmentKind::Continuation),
            "continuation"
        );
    }
}
