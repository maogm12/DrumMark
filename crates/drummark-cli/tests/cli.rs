use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

use tempfile::tempdir;

const OVERVIEW: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../docs/examples/overview.drum");

fn drummark() -> Command {
    Command::new(env!("CARGO_BIN_EXE_drummark"))
}

fn run(args: &[&str]) -> Output {
    drummark()
        .args(args)
        .output()
        .expect("failed to run drummark")
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

#[test]
fn musicxml_svg_and_debug_json_formats_work() {
    let musicxml = run(&[OVERVIEW, "--format", "musicxml"]);
    assert!(
        musicxml.status.success(),
        "musicxml failed: {}",
        stderr(&musicxml)
    );
    assert!(stdout(&musicxml).contains("<score-partwise"));

    let svg = run(&[OVERVIEW, "--format", "svg"]);
    assert!(svg.status.success(), "svg failed: {}", stderr(&svg));
    let svg_text = stdout(&svg);
    assert!(svg_text.contains("<svg"));
    assert!(svg_text.contains("data-role=\"notehead\""));
    assert!(svg_text.contains("data-role=\"page\""));

    for format in ["ast", "ir", "scene"] {
        let output = run(&[OVERVIEW, "--format", format]);
        assert!(output.status.success(), "{format} failed: {}", stderr(&output));
        let value: serde_json::Value =
            serde_json::from_slice(&output.stdout).expect("debug JSON should parse");
        match format {
            "ast" => assert!(value["paragraphs"].is_array()),
            "ir" => assert!(value["measures"].is_array()),
            "scene" => assert!(value["pages"].is_array()),
            _ => unreachable!(),
        }
    }
}

#[test]
fn xml_alias_is_rejected() {
    let output = run(&[OVERVIEW, "--format", "xml"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("invalid value"));
}

#[test]
fn stdin_and_output_file_work() {
    let dir = tempdir().expect("tempdir");
    let output_path = dir.path().join("overview.musicxml");
    let source = fs::read_to_string(OVERVIEW).expect("overview fixture");
    let mut child = drummark()
        .args([
            "--stdin",
            "--format",
            "musicxml",
            "--output",
            output_path.to_str().unwrap(),
        ])
        .stdin(Stdio::piped())
        .spawn()
        .expect("failed to spawn drummark");
    child
        .stdin
        .as_mut()
        .expect("stdin should be piped")
        .write_all(source.as_bytes())
        .expect("failed to write stdin");
    let output = child.wait_with_output().expect("failed to wait");
    assert!(output.status.success(), "stdin failed: {}", stderr(&output));
    assert!(fs::read_to_string(output_path).unwrap().contains("<score-partwise"));
}

#[test]
fn pdf_subsets_fonts_when_fallback_font_is_available() {
    let Some(fallback_font) = fallback_font() else {
        eprintln!("skipping PDF success test: no documented fallback font found");
        return;
    };
    let dir = tempdir().expect("tempdir");
    let output_path = dir.path().join("overview.pdf");
    let output = run(&[
        OVERVIEW,
        "--format",
        "pdf",
        "--fallback-font",
        fallback_font.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
    ]);
    assert!(output.status.success(), "pdf failed: {}", stderr(&output));
    let bytes = fs::read(output_path).expect("pdf output");
    assert!(bytes.starts_with(b"%PDF"));
    assert!(
        bytes.len() < 1_000_000,
        "expected subsetted PDF under 1 MB, got {} bytes",
        bytes.len()
    );
    assert!(bytes.windows(b"Bravura".len()).any(|w| w == b"Bravura"));
}

#[test]
fn invalid_explicit_font_paths_fail() {
    let dir = tempdir().expect("tempdir");
    let output_path = dir.path().join("out.pdf");
    let output = run(&[
        OVERVIEW,
        "--format",
        "pdf",
        "--font",
        dir.path().join("missing.otf").to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
    ]);
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("failed to read font"));

    let output = run(&[
        OVERVIEW,
        "--format",
        "pdf",
        "--fallback-font",
        dir.path().join("missing.ttf").to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
    ]);
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("failed to read font"));
}

#[test]
fn staff_size_affects_notehead_font_size() {
    let scene_at_10 = run(&[OVERVIEW, "--format", "scene", "--staff-size", "10"]);
    assert!(scene_at_10.status.success(), "scene failed at staff-size 10: {}", stderr(&scene_at_10));
    let v10: serde_json::Value = serde_json::from_slice(&scene_at_10.stdout).unwrap();
    let font_10 = v10["pages"][0]["items"]
        .as_array().unwrap().iter()
        .find(|i| i["role"] == "notehead")
        .and_then(|i| i["primitive"]["fontSizePt"].as_f64())
        .expect("notehead fontSizePt");
    assert!((font_10 - 30.0).abs() < 1.0, "expected notehead fontSizePt ~30 at staff-size 10, got {font_10}");


    let scene_at_8 = run(&[OVERVIEW, "--format", "scene", "--staff-size", "8"]);
    assert!(scene_at_8.status.success(), "scene failed at staff-size 8: {}", stderr(&scene_at_8));
    let v8: serde_json::Value = serde_json::from_slice(&scene_at_8.stdout).unwrap();
    let font_8 = v8["pages"][0]["items"]
        .as_array().unwrap().iter()
        .find(|i| i["role"] == "notehead")
        .and_then(|i| i["primitive"]["fontSizePt"].as_f64())
        .expect("notehead fontSizePt");
    assert!((font_8 - 24.0).abs() < 1.0, "expected notehead fontSizePt ~24 at staff-size 8, got {font_8}");
}

fn fallback_font() -> Option<PathBuf> {
    std::env::var_os("DRUMMARK_TEST_FALLBACK_FONT")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .or_else(|| first_existing(&[
            "/Library/Fonts/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            "/System/Library/Fonts/STHeiti Medium.ttc",
        ]))
}

fn first_existing(paths: &[&str]) -> Option<PathBuf> {
    paths
        .iter()
        .map(Path::new)
        .find(|path| path.is_file())
        .map(Path::to_path_buf)
}
