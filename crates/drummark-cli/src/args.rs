use std::fmt;
use std::path::PathBuf;

use clap::{Parser, ValueEnum};

#[derive(Debug, Parser)]
#[command(
    name = "drummark",
    about = "Render DrumMark notation from native Rust",
    after_help = "Developer formats ast, ir, and scene are debug JSON outputs with unstable schemas."
)]
pub struct Cli {
    pub input: Option<PathBuf>,

    #[arg(long)]
    pub stdin: bool,

    #[arg(short, long, value_enum, default_value_t = OutputFormat::Musicxml)]
    pub format: OutputFormat,

    #[arg(short, long)]
    pub output: Option<PathBuf>,

    #[arg(long, help = "Bravura font path for notation and covered text glyphs")]
    pub font: Option<PathBuf>,

    #[arg(
        long,
        help = "Fallback Hei/CJK sans font for text glyphs missing from Bravura"
    )]
    pub fallback_font: Option<PathBuf>,

    #[arg(long, default_value_t = 612.0)]
    pub page_width: f32,

    #[arg(long, default_value_t = 792.0)]
    pub page_height: f32,

    #[arg(long)]
    pub margin: Option<f32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
pub enum OutputFormat {
    Musicxml,
    Svg,
    Pdf,
    Ast,
    Ir,
    Scene,
}

impl OutputFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            OutputFormat::Musicxml => "musicxml",
            OutputFormat::Svg => "svg",
            OutputFormat::Pdf => "pdf",
            OutputFormat::Ast => "ast",
            OutputFormat::Ir => "ir",
            OutputFormat::Scene => "scene",
        }
    }
}

impl fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
