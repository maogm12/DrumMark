use crate::contract::Fraction;
use crate::instruments::track_family;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GlyphRole {
    NoteheadBlack,
    NoteheadX,
    NoteheadDiamond,
    NoteheadCircleX,
    NoteheadRim,
    NoteheadBlackParens,
    Flag8thUp,
    Flag8thDown,
    Flag16thUp,
    Flag16thDown,
    Flag32ndUp,
    Flag32ndDown,
    PercussionClef,
    TimeSignatureDigit,
    RestWhole,
    RestHalf,
    RestQuarter,
    RestEighth,
    RestSixteenth,
    RestThirtySecond,
    RepeatLeft,
    RepeatRight,
    RepeatRightLeft,
    RepeatDot,
    ArticAccentAbove,
    ArticAccentBelow,
    MeasureRepeatMark1Bar,
    MeasureRepeatMark2Bars,
    MultiRestBar,
    NavigationSegno,
    NavigationCoda,
    MetNoteQuarterUp,
    AugmentationDot,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextRole {
    Title,
    Subtitle,
    Composer,
    Tempo,
    PercussionClef,
    TimeSignatureDigit,
    Sticking,
    CountLabel,
    MeasureNumber,
    Dynamic,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GlyphPoint {
    pub x_ss: f32,
    pub y_ss: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CanonicalGlyphMetric {
    pub role: GlyphRole,
    pub smufl_codepoint: u32,
    pub smufl_ligature: Option<&'static [u32]>,
    pub width_ss: f32,
    pub bbox_sw_x_ss: f32,
    pub bbox_sw_y_ss: f32,
    pub bbox_ne_x_ss: f32,
    pub bbox_ne_y_ss: f32,
    pub stem_up_anchor_ss: Option<GlyphPoint>,
    pub stem_down_anchor_ss: Option<GlyphPoint>,
}

impl CanonicalGlyphMetric {
    fn ss_to_pt(ss: f32, font_size_pt: f32) -> f32 {
        ss * font_size_pt / 4.0
    }

    pub fn width_ss(&self) -> f32 {
        self.width_ss
    }

    pub fn bbox_width_ss(&self) -> f32 {
        self.bbox_ne_x_ss - self.bbox_sw_x_ss
    }

    pub fn bbox_height_ss(&self) -> f32 {
        self.bbox_ne_y_ss - self.bbox_sw_y_ss
    }

    pub fn bbox_center_x_ss(&self) -> f32 {
        (self.bbox_sw_x_ss + self.bbox_ne_x_ss) / 2.0
    }

    pub fn bbox_center_y_ss(&self) -> f32 {
        (self.bbox_sw_y_ss + self.bbox_ne_y_ss) / 2.0
    }

    pub fn width_pt(&self, font_size_pt: f32) -> f32 {
        Self::ss_to_pt(self.width_ss(), font_size_pt)
    }

    pub fn bbox_height_pt(&self, font_size_pt: f32) -> f32 {
        Self::ss_to_pt(self.bbox_height_ss(), font_size_pt)
    }

    pub fn bbox_center_x_pt(&self, font_size_pt: f32) -> f32 {
        Self::ss_to_pt(self.bbox_center_x_ss(), font_size_pt)
    }

    pub fn bbox_center_y_pt(&self, font_size_pt: f32) -> f32 {
        Self::ss_to_pt(self.bbox_center_y_ss(), font_size_pt)
    }

    pub fn render_text(&self) -> String {
        if let Some(codepoints) = self.smufl_ligature {
            return codepoints
                .iter()
                .map(|&cp| char::from_u32(cp).unwrap_or('?'))
                .collect();
        }
        char::from_u32(self.smufl_codepoint)
            .unwrap_or('?')
            .to_string()
    }

    pub fn stem_anchor_for_direction(&self, stem_up: bool) -> Option<GlyphPoint> {
        if stem_up {
            self.stem_up_anchor_ss
        } else {
            self.stem_down_anchor_ss
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CanonicalTextMetric {
    pub role: TextRole,
    pub font_family: &'static str,
    pub font_size_pt: f32,
    pub line_height_pt: f32,
    pub average_advance_pt: f32,
    pub ascent_pt: f32,
    pub descent_pt: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlagPathRole {
    EighthUp,
    EighthDown,
    SixteenthUp,
    SixteenthDown,
    ThirtySecondUp,
    ThirtySecondDown,
}

fn glyph_metric(
    role: GlyphRole,
    smufl_codepoint: u32,
    smufl_ligature: Option<&'static [u32]>,
    bbox_sw: [f32; 2],
    bbox_ne: [f32; 2],
    stem_up_anchor: Option<[f32; 2]>,
    stem_down_anchor: Option<[f32; 2]>,
) -> CanonicalGlyphMetric {
    CanonicalGlyphMetric {
        role,
        smufl_codepoint,
        smufl_ligature,
        width_ss: bbox_ne[0] - bbox_sw[0],
        bbox_sw_x_ss: bbox_sw[0],
        bbox_sw_y_ss: bbox_sw[1],
        bbox_ne_x_ss: bbox_ne[0],
        bbox_ne_y_ss: bbox_ne[1],
        stem_up_anchor_ss: stem_up_anchor.map(|point| GlyphPoint {
            x_ss: point[0],
            y_ss: point[1],
        }),
        stem_down_anchor_ss: stem_down_anchor.map(|point| GlyphPoint {
            x_ss: point[0],
            y_ss: point[1],
        }),
    }
}

pub fn canonical_glyph_metric(role: GlyphRole) -> CanonicalGlyphMetric {
    match role {
        GlyphRole::NoteheadBlack => glyph_metric(
            role,
            0xE0A4,
            None,
            [0.0, -0.5],
            [1.18, 0.5],
            Some([1.18, 0.168]),
            Some([0.0, -0.168]),
        ),
        GlyphRole::NoteheadX => glyph_metric(
            role,
            0xE0A9,
            None,
            [0.0, -0.5],
            [1.16, 0.5],
            Some([1.16, 0.444]),
            Some([0.0, -0.44]),
        ),
        GlyphRole::NoteheadDiamond => glyph_metric(
            role,
            0xE0DB,
            None,
            [0.0, -0.5],
            [1.0, 0.5],
            Some([1.0, 0.0]),
            Some([0.0, 0.0]),
        ),
        GlyphRole::NoteheadCircleX => glyph_metric(
            role,
            0xE0B3,
            None,
            [0.0, -0.5],
            [0.996, 0.5],
            Some([0.996, 0.0]),
            Some([0.0, 0.0]),
        ),
        GlyphRole::NoteheadRim => glyph_metric(
            role,
            0xE0D0,
            None,
            [-0.32, -0.66],
            [1.5, 0.668],
            Some([1.18, 0.164]),
            Some([0.0, -0.172]),
        ),
        GlyphRole::NoteheadBlackParens => glyph_metric(
            role,
            0xE0A4,
            Some(&[0xE0F5, 0xE0A4, 0xE0F6]),
            [0.0, -0.724],
            [1.832, 0.724],
            Some([1.86, 0.168]),
            Some([0.48, -0.168]),
        ),
        GlyphRole::Flag8thUp => glyph_metric(
            role,
            0xE240,
            None,
            [0.0, -3.2407685],
            [1.056, 0.036],
            Some([0.0, -0.04]),
            None,
        ),
        GlyphRole::Flag8thDown => glyph_metric(
            role,
            0xE241,
            None,
            [0.0, -0.056],
            [1.224, 3.2328966],
            None,
            Some([0.0, 0.132]),
        ),
        GlyphRole::Flag16thUp => glyph_metric(
            role,
            0xE242,
            None,
            [0.0, -3.252],
            [1.116, 0.008],
            Some([0.0, -0.088]),
            None,
        ),
        GlyphRole::Flag16thDown => glyph_metric(
            role,
            0xE243,
            None,
            [0.0, -0.036],
            [1.1635807, 3.2480257],
            None,
            Some([0.0, 0.128]),
        ),
        GlyphRole::Flag32ndUp => glyph_metric(
            role,
            0xE244,
            None,
            [0.0, -3.248],
            [1.044, 0.596],
            Some([0.0, 0.376]),
            None,
        ),
        GlyphRole::Flag32ndDown => glyph_metric(
            role,
            0xE245,
            None,
            [0.0, -0.688],
            [1.092, 3.248],
            None,
            Some([0.0, -0.448]),
        ),
        GlyphRole::PercussionClef => {
            glyph_metric(role, 0xE069, None, [0.0, -1.0], [1.528, 1.0], None, None)
        }
        GlyphRole::TimeSignatureDigit => {
            glyph_metric(role, 0xE080, None, [0.08, -1.0], [1.8, 1.004], None, None)
        }
        GlyphRole::RestWhole => {
            glyph_metric(role, 0xE4E3, None, [0.0, -0.54], [1.128, 0.036], None, None)
        }
        GlyphRole::RestHalf => glyph_metric(
            role,
            0xE4E4,
            None,
            [0.0, -0.008],
            [1.128, 0.568],
            None,
            None,
        ),
        GlyphRole::RestQuarter => {
            glyph_metric(role, 0xE4E5, None, [0.004, -1.5], [1.08, 1.492], None, None)
        }
        GlyphRole::RestEighth => glyph_metric(
            role,
            0xE4E6,
            None,
            [0.0, -1.004],
            [0.988, 0.696],
            None,
            None,
        ),
        GlyphRole::RestSixteenth => {
            glyph_metric(role, 0xE4E7, None, [0.0, -2.0], [1.28, 0.716], None, None)
        }
        GlyphRole::RestThirtySecond => {
            glyph_metric(role, 0xE4E8, None, [0.0, -2.0], [1.452, 1.704], None, None)
        }
        GlyphRole::RepeatLeft => {
            glyph_metric(role, 0xE040, None, [0.0, 0.0], [1.464, 4.0], None, None)
        }
        GlyphRole::RepeatRight => {
            glyph_metric(role, 0xE041, None, [0.004, 0.0], [1.468, 4.0], None, None)
        }
        GlyphRole::RepeatRightLeft => {
            glyph_metric(role, 0xE042, None, [0.004, 0.0], [2.432, 4.0], None, None)
        }
        GlyphRole::RepeatDot => {
            glyph_metric(role, 0xE044, None, [0.0, -0.2], [0.4, 0.2], None, None)
        }
        GlyphRole::ArticAccentAbove => {
            glyph_metric(role, 0xE4A0, None, [0.0, 0.004], [1.356, 0.98], None, None)
        }
        GlyphRole::ArticAccentBelow => {
            glyph_metric(role, 0xE4A1, None, [0.0, -0.976], [1.356, 0.0], None, None)
        }
        GlyphRole::MeasureRepeatMark1Bar => {
            glyph_metric(role, 0xE500, None, [0.0, -1.0], [2.128, 1.116], None, None)
        }
        GlyphRole::MeasureRepeatMark2Bars => {
            glyph_metric(role, 0xE501, None, [0.0, -1.0], [3.048, 1.116], None, None)
        }
        GlyphRole::MultiRestBar => glyph_metric(
            role,
            0xE4EE,
            None,
            [0.0, -1.084],
            [3.128, 1.044],
            None,
            None,
        ),
        GlyphRole::NavigationSegno => glyph_metric(
            role,
            0xE047,
            None,
            [0.016, -0.108],
            [2.2, 3.036],
            None,
            None,
        ),
        GlyphRole::NavigationCoda => glyph_metric(
            role,
            0xE048,
            None,
            [-0.016, -0.632],
            [3.82, 3.592],
            None,
            None,
        ),
        GlyphRole::MetNoteQuarterUp => glyph_metric(
            role,
            0xE1D5,
            None,
            [0.0, -0.564],
            [1.328, 2.752],
            None,
            None,
        ),
        GlyphRole::AugmentationDot => {
            glyph_metric(role, 0xE1E7, None, [0.0, 0.0], [0.5, 0.5], None, None)
        }
    }
}

pub fn canonical_text_metric(role: TextRole, staff_space_pt: f32) -> CanonicalTextMetric {
    match role {
        TextRole::Title => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: 18.0,
            line_height_pt: 21.0,
            average_advance_pt: 8.25,
            ascent_pt: 13.5,
            descent_pt: 4.5,
        },
        TextRole::Subtitle => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: 14.0,
            line_height_pt: 17.0,
            average_advance_pt: 6.0,
            ascent_pt: 10.0,
            descent_pt: 3.0,
        },
        TextRole::Composer => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: 11.0,
            line_height_pt: 14.0,
            average_advance_pt: 5.25,
            ascent_pt: 8.25,
            descent_pt: 2.25,
        },
        TextRole::Tempo => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: staff_space_pt * 1.4,
            line_height_pt: staff_space_pt * 1.8,
            average_advance_pt: staff_space_pt * 0.9,
            ascent_pt: staff_space_pt * 0.9,
            descent_pt: staff_space_pt * -0.2,
        },
        TextRole::PercussionClef => CanonicalTextMetric {
            role,
            font_family: "Bravura",
            font_size_pt: staff_space_pt * 3.0,
            line_height_pt: staff_space_pt * 3.2,
            average_advance_pt: staff_space_pt * 2.0,
            ascent_pt: staff_space_pt * 1.7,
            descent_pt: staff_space_pt * -0.4,
        },
        TextRole::TimeSignatureDigit => CanonicalTextMetric {
            role,
            font_family: "Bravura",
            font_size_pt: staff_space_pt * 3.0,
            line_height_pt: staff_space_pt * 3.2,
            average_advance_pt: staff_space_pt * 1.8,
            ascent_pt: staff_space_pt * 1.7,
            descent_pt: staff_space_pt * -0.4,
        },
        TextRole::Sticking => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: staff_space_pt * 1.2,
            line_height_pt: staff_space_pt * 1.4,
            average_advance_pt: staff_space_pt * 0.75,
            ascent_pt: staff_space_pt * 0.7,
            descent_pt: staff_space_pt * -0.2,
        },
        TextRole::CountLabel => CanonicalTextMetric {
            role,
            font_family: "Bravura",
            font_size_pt: staff_space_pt * 1.2,
            line_height_pt: staff_space_pt * 1.4,
            average_advance_pt: staff_space_pt * 0.75,
            ascent_pt: staff_space_pt * 0.7,
            descent_pt: staff_space_pt * -0.2,
        },
        TextRole::MeasureNumber => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: staff_space_pt * 1.0,
            line_height_pt: staff_space_pt * 1.2,
            average_advance_pt: staff_space_pt * 0.6,
            ascent_pt: staff_space_pt * 0.6,
            descent_pt: staff_space_pt * -0.2,
        },
        TextRole::Dynamic => CanonicalTextMetric {
            role,
            font_family: "Academico",
            font_size_pt: staff_space_pt * 1.3,
            line_height_pt: staff_space_pt * 1.5,
            average_advance_pt: staff_space_pt * 0.7,
            ascent_pt: staff_space_pt * 0.75,
            descent_pt: staff_space_pt * -0.2,
        },
    }
}

pub fn canonical_text_width(role: TextRole, text: &str, staff_space_pt: f32) -> f32 {
    let metric = canonical_text_metric(role, staff_space_pt);
    metric.average_advance_pt * text.chars().count() as f32
}

pub fn canonical_flag_path(
    role: FlagPathRole,
    stem_x: f32,
    stem_tip_y: f32,
) -> Vec<Vec<(f32, f32)>> {
    match role {
        FlagPathRole::EighthUp => vec![vec![
            (stem_x, stem_tip_y),
            (stem_x + 5.0, stem_tip_y + 1.5),
            (stem_x + 8.0, stem_tip_y + 6.0),
            (stem_x + 4.0, stem_tip_y + 9.5),
        ]],
        FlagPathRole::EighthDown => vec![vec![
            (stem_x, stem_tip_y),
            (stem_x + 5.0, stem_tip_y - 1.5),
            (stem_x + 8.0, stem_tip_y - 6.0),
            (stem_x + 4.0, stem_tip_y - 9.5),
        ]],
        FlagPathRole::SixteenthUp => vec![
            vec![
                (stem_x, stem_tip_y),
                (stem_x + 5.0, stem_tip_y + 1.5),
                (stem_x + 8.0, stem_tip_y + 6.0),
                (stem_x + 4.0, stem_tip_y + 9.5),
            ],
            vec![
                (stem_x, stem_tip_y + 5.0),
                (stem_x + 5.0, stem_tip_y + 6.5),
                (stem_x + 8.0, stem_tip_y + 11.0),
                (stem_x + 4.0, stem_tip_y + 14.5),
            ],
        ],
        FlagPathRole::SixteenthDown => vec![
            vec![
                (stem_x, stem_tip_y),
                (stem_x + 5.0, stem_tip_y - 1.5),
                (stem_x + 8.0, stem_tip_y - 6.0),
                (stem_x + 4.0, stem_tip_y - 9.5),
            ],
            vec![
                (stem_x, stem_tip_y - 5.0),
                (stem_x + 5.0, stem_tip_y - 6.5),
                (stem_x + 8.0, stem_tip_y - 11.0),
                (stem_x + 4.0, stem_tip_y - 14.5),
            ],
        ],
        FlagPathRole::ThirtySecondUp => vec![
            vec![
                (stem_x, stem_tip_y),
                (stem_x + 5.0, stem_tip_y + 1.5),
                (stem_x + 8.0, stem_tip_y + 6.0),
                (stem_x + 4.0, stem_tip_y + 9.5),
            ],
            vec![
                (stem_x, stem_tip_y + 5.0),
                (stem_x + 5.0, stem_tip_y + 6.5),
                (stem_x + 8.0, stem_tip_y + 11.0),
                (stem_x + 4.0, stem_tip_y + 14.5),
            ],
            vec![
                (stem_x, stem_tip_y + 10.0),
                (stem_x + 5.0, stem_tip_y + 11.5),
                (stem_x + 8.0, stem_tip_y + 16.0),
                (stem_x + 4.0, stem_tip_y + 19.5),
            ],
        ],
        FlagPathRole::ThirtySecondDown => vec![
            vec![
                (stem_x, stem_tip_y),
                (stem_x + 5.0, stem_tip_y - 1.5),
                (stem_x + 8.0, stem_tip_y - 6.0),
                (stem_x + 4.0, stem_tip_y - 9.5),
            ],
            vec![
                (stem_x, stem_tip_y - 5.0),
                (stem_x + 5.0, stem_tip_y - 6.5),
                (stem_x + 8.0, stem_tip_y - 11.0),
                (stem_x + 4.0, stem_tip_y - 14.5),
            ],
            vec![
                (stem_x, stem_tip_y - 10.0),
                (stem_x + 5.0, stem_tip_y - 11.5),
                (stem_x + 8.0, stem_tip_y - 16.0),
                (stem_x + 4.0, stem_tip_y - 19.5),
            ],
        ],
    }
}

pub fn notehead_glyph(track: &str, modifiers: &[String], _glyph: &str) -> CanonicalGlyphMetric {
    for modifier in modifiers {
        match modifier.as_str() {
            "ghost" => return canonical_glyph_metric(GlyphRole::NoteheadBlackParens),
            "open" => return canonical_glyph_metric(GlyphRole::NoteheadCircleX),
            "cross" => return canonical_glyph_metric(GlyphRole::NoteheadX),
            "bell" => return canonical_glyph_metric(GlyphRole::NoteheadDiamond),
            "rim" => return canonical_glyph_metric(GlyphRole::NoteheadRim),
            _ => {}
        }
    }

    let family = track_family(track);
    if family == "cymbal" || track == "HF" {
        return canonical_glyph_metric(GlyphRole::NoteheadX);
    }
    canonical_glyph_metric(GlyphRole::NoteheadBlack)
}

pub fn rest_glyph_for_fraction(duration: Fraction) -> CanonicalGlyphMetric {
    match (duration.numerator, duration.denominator) {
        (1, 1) => canonical_glyph_metric(GlyphRole::RestWhole),
        (1, 2) => canonical_glyph_metric(GlyphRole::RestHalf),
        (1, 4) => canonical_glyph_metric(GlyphRole::RestQuarter),
        (1, 8) => canonical_glyph_metric(GlyphRole::RestEighth),
        (1, 16) => canonical_glyph_metric(GlyphRole::RestSixteenth),
        (1, 32) => canonical_glyph_metric(GlyphRole::RestThirtySecond),
        (_, denominator) if denominator >= 32 => {
            canonical_glyph_metric(GlyphRole::RestThirtySecond)
        }
        (_, denominator) if denominator >= 16 => canonical_glyph_metric(GlyphRole::RestEighth),
        (_, denominator) if denominator >= 8 => canonical_glyph_metric(GlyphRole::RestQuarter),
        (_, denominator) if denominator >= 4 => canonical_glyph_metric(GlyphRole::RestHalf),
        _ => canonical_glyph_metric(GlyphRole::RestWhole),
    }
}

pub fn rest_glyph(denominator: u32) -> CanonicalGlyphMetric {
    rest_glyph_for_fraction(Fraction {
        numerator: 1,
        denominator,
    })
}

pub fn glyph_metrics(codepoint: u32) -> (f32, f32, f32) {
    match codepoint {
        0xE4E3 => (0.8, 1.0, 0.0),
        0xE4E4 => (0.8, 2.0, 0.0),
        0xE4E5 => (0.8, 1.5, 0.0),
        0xE4E6 => (0.8, 1.2, 0.0),
        0xE4E7 => (0.8, 1.2, 0.0),
        _ => (1.0, 1.0, 0.0),
    }
}
