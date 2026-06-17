//! Compare Bravura full vs hb-subset glyph metrics used by PDF export.
use std::collections::BTreeSet;
use std::path::PathBuf;

use ttf_parser::{Face, OutlineBuilder, Rect};

fn font_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../public/fonts/bravura.otf")
}

struct BoundsBuilder {
    rect: Option<Rect>,
}

impl OutlineBuilder for BoundsBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.push(x, y);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.push(x, y);
    }
    fn quad_to(&mut self, x: f32, y: f32, _: f32, _: f32) {
        self.push(x, y);
    }
    fn curve_to(&mut self, x: f32, y: f32, _: f32, _: f32, _: f32, _: f32) {
        self.push(x, y);
    }
    fn close(&mut self) {}
}

impl BoundsBuilder {
    fn push(&mut self, x: f32, y: f32) {
        let x = x.round() as i16;
        let y = y.round() as i16;
        self.rect = Some(match self.rect {
            Some(r) => Rect {
                x_min: r.x_min.min(x),
                y_min: r.y_min.min(y),
                x_max: r.x_max.max(x),
                y_max: r.y_max.max(y),
            },
            None => Rect {
                x_min: x,
                y_min: y,
                x_max: x,
                y_max: y,
            },
        });
    }
}

fn glyph_bounds(face: &Face<'_>, ch: char) -> Option<Rect> {
    let gid = face.glyph_index(ch)?;
    let mut builder = BoundsBuilder { rect: None };
    face.outline_glyph(gid, &mut builder)?;
    builder.rect
}

#[test]
fn hb_subset_preserves_notehead_outline_scale() {
    let bytes = std::fs::read(font_path()).expect("bravura.otf");
    let full = Face::parse(&bytes, 0).expect("parse full font");
    let ch = '\u{E0A4}';
    let full_bounds = glyph_bounds(&full, ch).expect("notehead bounds");

    let mut chars = BTreeSet::new();
    chars.insert(ch);
    let subset_bytes = hb_subset::subset(&bytes, chars.iter().copied()).expect("subset");
    let sub = Face::parse(&subset_bytes, 0).expect("parse subset");
    assert_eq!(full.units_per_em(), sub.units_per_em(), "UPM must match");
    let sub_bounds = glyph_bounds(&sub, ch).expect("subset notehead bounds");

    let full_h = (full_bounds.y_max - full_bounds.y_min) as f32;
    let sub_h = (sub_bounds.y_max - sub_bounds.y_min) as f32;
    eprintln!("full height upem={full_h} subset height upem={sub_h}");
    assert!(
        (full_h - sub_h).abs() < 0.5,
        "subset changed notehead height: full={full_h} sub={sub_h}"
    );

    let font_size_pt = 15.0_f32;
    let upm = full.units_per_em() as f32;
    let full_h_pt = full_h / upm * font_size_pt;
    let sub_h_pt = sub_h / upm * font_size_pt;
    eprintln!("at 15pt: full_h_pt={full_h_pt} sub_h_pt={sub_h_pt} staff_gap=5");
    assert!((full_h_pt - sub_h_pt).abs() < 0.01);
}
