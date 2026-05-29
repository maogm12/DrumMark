/// Default stem length before user offset, in staff-space units.
pub const DEFAULT_STEM_LEN_SS: f32 = 4.0;

#[derive(Debug, Clone)]
pub struct LayoutOptions {
    pub page_width_pt: f32,
    pub page_height_pt: f32,
    pub top_margin_pt: f32,
    pub bottom_margin_pt: f32,
    pub left_margin_pt: f32,
    pub right_margin_pt: f32,
    pub staff_space_pt: f32,
    pub px_per_quarter: f32,
    pub header_height_pt: f32,
    pub header_staff_spacing_pt: f32,
    pub volta_offset_y: f32,
    pub nav_offset_y: f32,
    pub hairpin_offset_y: f32,
    pub sticking_offset_y: f32,
    pub accent_offset_y: f32,
    pub text_offset_y: f32,
    pub tempo_offset_y: f32,
    pub measure_num_offset_y: f32,
    pub edge_padding: f32,
    /// Fine adjustment in pt added to [`DEFAULT_STEM_LEN_SS`] × [`staff_space_pt`].
    pub stem_len_offset_pt: f32,
    pub system_spacing_pt: f32,
    pub hide_voice2_rests: bool,
    pub duration_spacing_compression: f32,
    pub measure_width_compression: f32,
}

impl Default for LayoutOptions {
    fn default() -> Self {
        Self {
            page_width_pt: 612.0,
            page_height_pt: 792.0,
            top_margin_pt: 30.0,
            bottom_margin_pt: 30.0,
            left_margin_pt: 50.0,
            right_margin_pt: 50.0,
            staff_space_pt: 5.0,
            px_per_quarter: 80.0,
            header_height_pt: 50.0,
            header_staff_spacing_pt: 60.0,
            volta_offset_y: 0.0,
            nav_offset_y: -10.0,
            hairpin_offset_y: 0.0,
            sticking_offset_y: -8.0,
            accent_offset_y: -6.0,
            text_offset_y: -40.0,
            tempo_offset_y: -10.0,
            measure_num_offset_y: -4.0,
            edge_padding: 4.0,
            stem_len_offset_pt: 0.0,
            system_spacing_pt: 30.0,
            hide_voice2_rests: false,
            duration_spacing_compression: 0.6,
            measure_width_compression: 0.75,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct StaffSpace {
    pub pt_per_ss: f32,
}

impl Default for StaffSpace {
    fn default() -> Self {
        Self { pt_per_ss: 5.0 }
    }
}

pub fn stem_length_pt(opts: &LayoutOptions) -> f32 {
    opts.staff_space_pt * DEFAULT_STEM_LEN_SS + opts.stem_len_offset_pt
}

impl StaffSpace {
    pub fn to_pixels(&self, staff_height_px: f32) -> f32 {
        staff_height_px / 4.0
    }

    pub fn to_pt(&self, ss: f32) -> f32 {
        ss * self.pt_per_ss
    }

    pub fn from_pt(&self, pt: f32) -> f32 {
        pt / self.pt_per_ss
    }
}
