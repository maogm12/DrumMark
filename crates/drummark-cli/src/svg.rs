use drummark_layout::{LayoutScene, ScenePrimitive};

const PAGE_GAP_PT: f32 = 24.0;

pub fn render_scene_to_svg(scene: &LayoutScene) -> String {
    let width = scene
        .pages
        .iter()
        .map(|page| page.width_pt)
        .fold(0.0_f32, f32::max)
        .max(1.0);
    let height = scene
        .pages
        .iter()
        .map(|page| page.height_pt)
        .sum::<f32>()
        + PAGE_GAP_PT * scene.pages.len().saturating_sub(1) as f32;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{:.0}" height="{:.0}" viewBox="0 0 {:.3} {:.3}">"#,
        width, height.max(1.0), width, height.max(1.0)
    );

    let mut y_offset = 0.0_f32;
    for page in &scene.pages {
        svg.push_str(&format!(
            r#"<g data-role="page" data-page-index="{}" transform="translate(0 {:.3})">"#,
            page.index, y_offset
        ));
        for item in page.items.iter().collect::<Vec<_>>() {
            svg.push_str(&render_item(item));
        }
        svg.push_str("</g>");
        y_offset += page.height_pt + PAGE_GAP_PT;
    }

    svg.push_str("</svg>");
    svg
}

fn render_item(item: &drummark_layout::SceneItem) -> String {
    let role = format!(r#" data-role="{}""#, esc(&item.role));
    let measure = item
        .measure_id
        .as_ref()
        .map(|id| format!(r#" data-measure-id="{}""#, esc(id)))
        .unwrap_or_default();
    match &item.primitive {
        ScenePrimitive::GlyphRun(glyph) => {
            let text = glyph
                .smufl_codepoint
                .and_then(char::from_u32)
                .map(|ch| ch.to_string())
                .unwrap_or_default();
            format!(
                r#"<text{}{} x="{:.3}" y="{:.3}" font-family="{}" font-size="{:.3}pt" fill="{}">{}</text>"#,
                role,
                measure,
                glyph.x_pt,
                glyph.y_pt,
                esc(&glyph.font_family),
                glyph.font_size_pt,
                esc(&glyph.fill),
                esc(&text),
            )
        }
        ScenePrimitive::TextRun(text) => {
            let anchor = text
                .text_anchor
                .as_ref()
                .map(|anchor| format!(r#" text-anchor="{}""#, esc(anchor)))
                .unwrap_or_default();
            let weight = text
                .font_weight
                .as_ref()
                .map(|weight| format!(r#" font-weight="{}""#, esc(weight)))
                .unwrap_or_default();
            let style = text
                .font_style
                .as_ref()
                .map(|style| format!(r#" font-style="{}""#, esc(style)))
                .unwrap_or_default();
            format!(
                r#"<text{}{} x="{:.3}" y="{:.3}" font-family="{}" font-size="{:.3}pt" fill="{}"{}{}{}>{}</text>"#,
                role,
                measure,
                text.x_pt,
                text.y_pt,
                esc(&text.font_family),
                text.font_size_pt,
                esc(&text.fill),
                anchor,
                weight,
                style,
                esc(&text.text),
            )
        }
        ScenePrimitive::LineSegment(line) => {
            let cap = line
                .stroke_line_cap
                .as_ref()
                .map(|cap| format!(r#" stroke-linecap="{}""#, esc(cap)))
                .unwrap_or_default();
            format!(
                r#"<line{}{} x1="{:.3}" y1="{:.3}" x2="{:.3}" y2="{:.3}" stroke="{}" stroke-width="{:.3}"{} />"#,
                role,
                measure,
                line.x1_pt,
                line.y1_pt,
                line.x2_pt,
                line.y2_pt,
                esc(&line.stroke),
                line.stroke_width,
                cap,
            )
        }
        ScenePrimitive::Rect(rect) => {
            let stroke = rect
                .stroke
                .as_ref()
                .map(|stroke| {
                    format!(
                        r#" stroke="{}" stroke-width="{:.3}""#,
                        esc(stroke),
                        rect.stroke_width.unwrap_or(1.0)
                    )
                })
                .unwrap_or_default();
            format!(
                r#"<rect{}{} x="{:.3}" y="{:.3}" width="{:.3}" height="{:.3}" fill="{}"{} />"#,
                role,
                measure,
                rect.x_pt,
                rect.y_pt,
                rect.width_pt,
                rect.height_pt,
                esc(&rect.fill),
                stroke,
            )
        }
        ScenePrimitive::Polyline(polyline) => {
            let points = polyline
                .points_pt
                .iter()
                .map(|(x, y)| format!("{x:.3},{y:.3}"))
                .collect::<Vec<_>>()
                .join(" ");
            format!(
                r##"<polyline{}{} points="{}" fill="none" stroke="#333" stroke-width="1" />"##,
                role, measure, points
            )
        }
        ScenePrimitive::Path(path) => {
            let stroke = path
                .stroke
                .as_ref()
                .map(|stroke| {
                    format!(
                        r#" stroke="{}" stroke-width="{:.3}""#,
                        esc(stroke),
                        path.stroke_width.unwrap_or(1.0)
                    )
                })
                .unwrap_or_default();
            format!(
                r#"<path{}{} d="{}" fill="{}"{} />"#,
                role,
                measure,
                esc(&path.d),
                esc(&path.fill),
                stroke,
            )
        }
    }
}

fn esc(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
