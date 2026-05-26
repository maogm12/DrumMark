use drummark_core::{musicxml, normalize, parser, render_score};
use drummark_layout::{build_layout_scene, LayoutOptions};

use crate::args::{Cli, OutputFormat};

pub struct CliOutput {
    pub bytes: Vec<u8>,
    pub warnings: Vec<String>,
}

pub fn build_output(source: &str, cli: &Cli) -> Result<CliOutput, String> {
    let parser = parser::Parser::new(source);
    let doc = parser.parse_lossy();
    let score = normalize::normalize_document(&doc);
    let warnings = score
        .errors
        .iter()
        .map(|error| format!("Line warning: {error}"))
        .collect::<Vec<_>>();

    let result = match cli.format {
        OutputFormat::Musicxml => musicxml::build_music_xml(&score, false).into_bytes(),
        OutputFormat::Ast => crate::json::ast_json(&doc)?.into_bytes(),
        OutputFormat::Ir => crate::json::normalized_json(&score)?.into_bytes(),
        OutputFormat::Svg | OutputFormat::Pdf | OutputFormat::Scene => {
            let render_score = render_score::derive_render_score(&score);
            let scene = build_layout_scene(&render_score, &layout_options(cli));
            match cli.format {
                OutputFormat::Svg => crate::svg::render_scene_to_svg(&scene).into_bytes(),
                OutputFormat::Pdf => crate::pdf::render_scene_to_pdf(&scene, cli)?,
                OutputFormat::Scene => crate::json::scene_json(&scene)?.into_bytes(),
                _ => unreachable!(),
            }
        }
    };

    Ok(CliOutput {
        bytes: result,
        warnings,
    })
}

fn layout_options(cli: &Cli) -> LayoutOptions {
    let margin = cli.margin.unwrap_or(LayoutOptions::default().top_margin_pt);
    LayoutOptions {
        page_width_pt: cli.page_width,
        page_height_pt: cli.page_height,
        top_margin_pt: margin,
        right_margin_pt: margin,
        bottom_margin_pt: margin,
        left_margin_pt: margin,
        ..Default::default()
    }
}
