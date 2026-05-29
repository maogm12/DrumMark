use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use drummark_layout::{LayoutScene, ScenePrimitive};
use printpdf::{
    Color, Line, LineCapStyle, LinePoint, Mm, Op, PaintMode, ParsedFont, PdfDocument, PdfFontHandle,
    PdfPage, PdfSaveOptions, Point, Polygon, PolygonRing, Pt, Rect, Rgb, TextItem, WindingOrder,
};
use ttf_parser::Face;

use crate::args::Cli;

pub fn render_scene_to_pdf(scene: &LayoutScene, cli: &Cli) -> Result<Vec<u8>, String> {
    let bravura = load_bravura(cli.font.as_deref())?;
    let fallback_needed = scene_text_requires_fallback(scene, &bravura)?;
    let fallback = if fallback_needed {
        Some(load_fallback(cli.fallback_font.as_deref())?)
    } else {
        None
    };
    let used_chars = collect_used_font_chars(scene, &bravura, fallback.as_ref())?;
    let bravura = bravura.subset_for_chars(&used_chars.bravura)?;
    let fallback = fallback
        .map(|font| font.subset_for_chars(&used_chars.fallback))
        .transpose()?;

    let mut doc = PdfDocument::new("DrumMark");
    let mut warnings = Vec::new();
    let bravura_font = ParsedFont::from_bytes(&bravura.bytes, 0, &mut warnings)
        .ok_or_else(|| format!("failed to parse Bravura font {}", bravura.path.display()))?;
    let fallback_font = fallback
        .as_ref()
        .map(|font| {
            ParsedFont::from_bytes(&font.bytes, 0, &mut warnings).ok_or_else(|| {
                format!("failed to parse fallback font {}", font.path.display())
            })
        })
        .transpose()?;
    let bravura_id = doc.add_font(&bravura_font);
    let fallback_id = fallback_font.as_ref().map(|font| doc.add_font(font));

    let pages = scene
        .pages
        .iter()
        .map(|page| {
            let mut ops = Vec::new();
            let mut items: Vec<_> = drummark_layout::page_all_items(page).collect();
            items.sort_by_key(|item| item.z_index);
            for item in items {
                emit_item(
                    &mut ops,
                    page.height_pt,
                    &item.primitive,
                    &bravura,
                    &bravura_id,
                    fallback.as_ref(),
                    fallback_id.as_ref(),
                )?;
            }
            Ok(PdfPage::new(
                Mm::from(Pt(page.width_pt)),
                Mm::from(Pt(page.height_pt)),
                ops,
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;

    let mut save_warnings = Vec::new();
    let bytes = doc.with_pages(pages).save(
        &PdfSaveOptions {
            subset_fonts: true,
            ..Default::default()
        },
        &mut save_warnings,
    );
    if !bytes.starts_with(b"%PDF") {
        return Err("PDF writer returned bytes without a %PDF header".to_string());
    }
    Ok(bytes)
}

fn emit_item(
    ops: &mut Vec<Op>,
    page_height_pt: f32,
    primitive: &ScenePrimitive,
    bravura: &FontFace,
    bravura_id: &printpdf::FontId,
    fallback: Option<&FontFace>,
    fallback_id: Option<&printpdf::FontId>,
) -> Result<(), String> {
    match primitive {
        ScenePrimitive::GlyphRun(glyph) => {
            let ch = glyph
                .smufl_codepoint
                .and_then(char::from_u32)
                .ok_or_else(|| "glyph run missing SMuFL codepoint".to_string())?;
            if !bravura.covers(ch)? {
                return Err(format!("Bravura does not cover notation glyph U+{:04X}", ch as u32));
            }
            emit_text(
                ops,
                page_height_pt,
                glyph.x_pt,
                glyph.y_pt,
                glyph.font_size_pt,
                &ch.to_string(),
                bravura_id,
            );
        }
        ScenePrimitive::TextRun(text) => {
            let runs = split_text_runs(&text.text, text.font_size_pt, bravura, fallback)?;
            let total_advance = runs.iter().map(|run| run.advance_pt).sum::<f32>();
            let mut x = match text.text_anchor.as_deref() {
                Some("middle") => text.x_pt - total_advance / 2.0,
                Some("end") => text.x_pt - total_advance,
                _ => text.x_pt,
            };
            for run in runs {
                let font_id = match run.font {
                    TextFont::Bravura => bravura_id,
                    TextFont::Fallback => fallback_id
                        .ok_or_else(|| "text requires fallback font but none was loaded".to_string())?,
                };
                emit_text(
                    ops,
                    page_height_pt,
                    x,
                    text.y_pt,
                    text.font_size_pt,
                    &run.text,
                    font_id,
                );
                x += run.advance_pt;
            }
        }
        ScenePrimitive::LineSegment(line) => {
            ops.push(Op::SetOutlineColor {
                col: parse_color(&line.stroke),
            });
            ops.push(Op::SetOutlineThickness {
                pt: Pt(line.stroke_width),
            });
            if matches!(line.stroke_line_cap.as_deref(), Some("round")) {
                ops.push(Op::SetLineCapStyle {
                    cap: LineCapStyle::Round,
                });
            }
            ops.push(Op::DrawLine {
                line: Line {
                    points: vec![
                        LinePoint {
                            p: pdf_point(line.x1_pt, line.y1_pt, page_height_pt),
                            bezier: false,
                        },
                        LinePoint {
                            p: pdf_point(line.x2_pt, line.y2_pt, page_height_pt),
                            bezier: false,
                        },
                    ],
                    is_closed: false,
                },
            });
        }
        ScenePrimitive::Rect(rect) => {
            ops.push(Op::SetFillColor {
                col: parse_color(&rect.fill),
            });
            if let Some(stroke) = &rect.stroke {
                ops.push(Op::SetOutlineColor {
                    col: parse_color(stroke),
                });
                ops.push(Op::SetOutlineThickness {
                    pt: Pt(rect.stroke_width.unwrap_or(1.0)),
                });
            }
            let mut shape = Rect::from_xywh(
                Pt(rect.x_pt),
                Pt(page_height_pt - rect.y_pt - rect.height_pt),
                Pt(rect.width_pt),
                Pt(rect.height_pt),
            );
            shape.mode = Some(if rect.stroke.is_some() {
                PaintMode::FillStroke
            } else {
                PaintMode::Fill
            });
            ops.push(Op::DrawRectangle { rectangle: shape });
        }
        ScenePrimitive::Polyline(polyline) => {
            let points = polyline
                .points_pt
                .iter()
                .map(|(x, y)| LinePoint {
                    p: pdf_point(*x, *y, page_height_pt),
                    bezier: false,
                })
                .collect();
            ops.push(Op::DrawLine {
                line: Line {
                    points,
                    is_closed: false,
                },
            });
        }
        ScenePrimitive::Path(path) => {
            if let Some(points) = parse_simple_path_points(&path.d) {
                ops.push(Op::SetFillColor {
                    col: parse_color(&path.fill),
                });
                if let Some(stroke) = &path.stroke {
                    ops.push(Op::SetOutlineColor {
                        col: parse_color(stroke),
                    });
                    ops.push(Op::SetOutlineThickness {
                        pt: Pt(path.stroke_width.unwrap_or(1.0)),
                    });
                }
                let mode = if path.stroke.is_some() && path.fill != "none" {
                    PaintMode::FillStroke
                } else if path.stroke.is_some() {
                    PaintMode::Stroke
                } else {
                    PaintMode::Fill
                };
                ops.push(Op::DrawPolygon {
                    polygon: Polygon {
                        rings: vec![PolygonRing {
                            points: points
                                .into_iter()
                                .map(|(x, y)| LinePoint {
                                    p: pdf_point(x, y, page_height_pt),
                                    bezier: false,
                                })
                                .collect(),
                        }],
                        mode,
                        winding_order: WindingOrder::NonZero,
                    },
                });
            }
        }
    }
    Ok(())
}

fn emit_text(
    ops: &mut Vec<Op>,
    page_height_pt: f32,
    x_pt: f32,
    y_pt: f32,
    size_pt: f32,
    text: &str,
    font_id: &printpdf::FontId,
) {
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont {
        font: PdfFontHandle::External(font_id.clone()),
        size: Pt(size_pt),
    });
    ops.push(Op::SetTextCursor {
        pos: pdf_point(x_pt, y_pt, page_height_pt),
    });
    ops.push(Op::ShowText {
        items: vec![TextItem::Text(text.to_string())],
    });
    ops.push(Op::EndTextSection);
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TextFont {
    Bravura,
    Fallback,
}

struct TextRun {
    font: TextFont,
    text: String,
    advance_pt: f32,
}

fn split_text_runs(
    text: &str,
    size_pt: f32,
    bravura: &FontFace,
    fallback: Option<&FontFace>,
) -> Result<Vec<TextRun>, String> {
    let mut runs = Vec::<TextRun>::new();
    let mut current_font: Option<TextFont> = None;
    let mut current_text = String::new();
    let mut current_advance = 0.0_f32;

    for ch in text.chars() {
        let (font, advance) = if bravura.covers(ch)? {
            (TextFont::Bravura, bravura.advance_pt(ch, size_pt)?)
        } else {
            let fallback = fallback.ok_or_else(|| {
                format!(
                    "text glyph U+{:04X} requires --fallback-font or a usable platform fallback",
                    ch as u32
                )
            })?;
            if !fallback.covers(ch)? {
                return Err(format!(
                    "fallback font {} does not cover text glyph U+{:04X}",
                    fallback.path.display(),
                    ch as u32
                ));
            }
            (TextFont::Fallback, fallback.advance_pt(ch, size_pt)?)
        };
        if current_font.is_some_and(|existing| existing != font) {
            runs.push(TextRun {
                font: current_font.unwrap(),
                text: std::mem::take(&mut current_text),
                advance_pt: current_advance,
            });
            current_advance = 0.0;
        }
        current_font = Some(font);
        current_text.push(ch);
        current_advance += advance;
    }

    if let Some(font) = current_font {
        runs.push(TextRun {
            font,
            text: current_text,
            advance_pt: current_advance,
        });
    }

    Ok(runs)
}

fn scene_text_requires_fallback(scene: &LayoutScene, bravura: &FontFace) -> Result<bool, String> {
    for page in &scene.pages {
        for item in drummark_layout::page_all_items(page) {
            if let ScenePrimitive::TextRun(text) = &item.primitive {
                for ch in text.text.chars() {
                    if !bravura.covers(ch)? {
                        return Ok(true);
                    }
                }
            }
        }
    }
    Ok(false)
}

struct UsedFontChars {
    bravura: BTreeSet<char>,
    fallback: BTreeSet<char>,
}

fn collect_used_font_chars(
    scene: &LayoutScene,
    bravura: &FontFace,
    fallback: Option<&FontFace>,
) -> Result<UsedFontChars, String> {
    let mut used = UsedFontChars {
        bravura: BTreeSet::new(),
        fallback: BTreeSet::new(),
    };
    for page in &scene.pages {
        for item in drummark_layout::page_all_items(page) {
            match &item.primitive {
                ScenePrimitive::GlyphRun(glyph) => {
                    let ch = glyph
                        .smufl_codepoint
                        .and_then(char::from_u32)
                        .ok_or_else(|| "glyph run missing SMuFL codepoint".to_string())?;
                    if !bravura.covers(ch)? {
                        return Err(format!("Bravura does not cover notation glyph U+{:04X}", ch as u32));
                    }
                    used.bravura.insert(ch);
                }
                ScenePrimitive::TextRun(text) => {
                    for ch in text.text.chars() {
                        if bravura.covers(ch)? {
                            used.bravura.insert(ch);
                        } else {
                            let fallback = fallback.ok_or_else(|| {
                                format!(
                                    "text glyph U+{:04X} requires --fallback-font or a usable platform fallback",
                                    ch as u32
                                )
                            })?;
                            if !fallback.covers(ch)? {
                                return Err(format!(
                                    "fallback font {} does not cover text glyph U+{:04X}",
                                    fallback.path.display(),
                                    ch as u32
                                ));
                            }
                            used.fallback.insert(ch);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    Ok(used)
}

struct FontFace {
    path: PathBuf,
    bytes: Vec<u8>,
}

impl FontFace {
    fn load(path: &Path) -> Result<Self, String> {
        let bytes = fs::read(path)
            .map_err(|error| format!("failed to read font {}: {error}", path.display()))?;
        Face::parse(&bytes, 0)
            .map_err(|error| format!("failed to parse font {}: {error:?}", path.display()))?;
        Ok(Self {
            path: path.to_path_buf(),
            bytes,
        })
    }

    fn covers(&self, ch: char) -> Result<bool, String> {
        Ok(Face::parse(&self.bytes, 0)
            .map_err(|error| format!("failed to parse font {}: {error:?}", self.path.display()))?
            .glyph_index(ch)
            .is_some())
    }

    fn advance_pt(&self, ch: char, size_pt: f32) -> Result<f32, String> {
        let face = Face::parse(&self.bytes, 0)
            .map_err(|error| format!("failed to parse font {}: {error:?}", self.path.display()))?;
        let glyph = face
            .glyph_index(ch)
            .ok_or_else(|| format!("font {} does not cover U+{:04X}", self.path.display(), ch as u32))?;
        let advance = face.glyph_hor_advance(glyph).unwrap_or(face.units_per_em());
        Ok(advance as f32 / face.units_per_em() as f32 * size_pt)
    }

    fn subset_for_chars(&self, chars: &BTreeSet<char>) -> Result<Self, String> {
        if chars.is_empty() {
            return Ok(Self {
                path: self.path.clone(),
                bytes: self.bytes.clone(),
            });
        }
        let subset = hb_subset::subset(&self.bytes, chars.iter().copied())
            .map_err(|error| format!("failed to subset font {}: {error}", self.path.display()))?;
        if subset.len() >= self.bytes.len() {
            return Err(format!(
                "font subsetting did not reduce {} (source={} bytes, subset={} bytes)",
                self.path.display(),
                self.bytes.len(),
                subset.len()
            ));
        }
        let subset_face = Self {
            path: self.path.clone(),
            bytes: subset,
        };
        parse_printpdf_font(&subset_face)?;
        for ch in chars {
            if !subset_face.covers(*ch)? {
                return Err(format!(
                    "subset font {} lost required glyph U+{:04X}",
                    self.path.display(),
                    *ch as u32
                ));
            }
        }
        Ok(subset_face)
    }
}

fn parse_printpdf_font(font: &FontFace) -> Result<ParsedFont, String> {
    let mut warnings = Vec::new();
    ParsedFont::from_bytes(&font.bytes, 0, &mut warnings)
        .ok_or_else(|| format!("failed to parse font {}", font.path.display()))
}

fn load_bravura(explicit: Option<&Path>) -> Result<FontFace, String> {
    if let Some(path) = explicit {
        return FontFace::load(path);
    }
    for path in workspace_font_candidates("public/fonts/bravura.otf")? {
        if path.is_file() {
            return FontFace::load(&path);
        }
    }
    Err("failed to find Bravura font; use --font <PATH>".to_string())
}

fn load_fallback(explicit: Option<&Path>) -> Result<FontFace, String> {
    if let Some(path) = explicit {
        return FontFace::load(path);
    }
    let mut candidates = Vec::new();
    if let Ok(path) = env::var("DRUMMARK_TEST_FALLBACK_FONT") {
        candidates.push(PathBuf::from(path));
    }
    candidates.extend([
        PathBuf::from("/Library/Fonts/Arial Unicode.ttf"),
        PathBuf::from("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        PathBuf::from("/System/Library/Fonts/STHeiti Medium.ttc"),
    ]);
    for path in candidates {
        if path.is_file() {
            if let Ok(font) = FontFace::load(&path) {
                return Ok(font);
            }
        }
    }
    Err("text requires fallback glyphs; use --fallback-font <PATH>".to_string())
}

fn workspace_font_candidates(relative: &str) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let mut dir = env::current_dir().map_err(|error| format!("failed to read cwd: {error}"))?;
    loop {
        candidates.push(dir.join(relative));
        if !dir.pop() {
            break;
        }
    }
    Ok(candidates)
}

fn pdf_point(x_pt: f32, y_pt_top_origin: f32, page_height_pt: f32) -> Point {
    Point {
        x: Pt(x_pt),
        y: Pt(page_height_pt - y_pt_top_origin),
    }
}

fn parse_color(value: &str) -> Color {
    if let Some(hex) = value.strip_prefix('#') {
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
            return Color::Rgb(Rgb::new(r, g, b, None));
        }
    }
    Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None))
}

fn parse_simple_path_points(d: &str) -> Option<Vec<(f32, f32)>> {
    let numbers = d
        .split(|ch: char| !(ch.is_ascii_digit() || ch == '.' || ch == '-'))
        .filter(|segment| !segment.is_empty())
        .filter_map(|segment| segment.parse::<f32>().ok())
        .collect::<Vec<_>>();
    if numbers.len() < 4 || numbers.len() % 2 != 0 {
        return None;
    }
    Some(
        numbers
            .chunks(2)
            .filter_map(|pair| Some((*pair.first()?, *pair.get(1)?)))
            .collect(),
    )
}
