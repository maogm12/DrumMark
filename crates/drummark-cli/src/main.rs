mod args;
mod export;
mod json;
mod pdf;
mod svg;

use std::fs;
use std::io::{self, Read, Write};
use std::process;

use args::{Cli, OutputFormat};
use clap::Parser;

fn main() {
    let cli = Cli::parse();
    if let Err(error) = run(cli) {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run(cli: Cli) -> Result<(), String> {
    let source = read_source(&cli)?;
    let output = export::build_output(&source, &cli)?;

    for warning in &output.warnings {
        eprintln!("{warning}");
    }

    match (&cli.output, cli.format) {
        (Some(path), _) => {
            fs::write(path, &output.bytes)
                .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
            eprintln!("Saved {} to {}", cli.format.as_str(), path.display());
        }
        (None, OutputFormat::Pdf) => {
            return Err("PDF output requires --output".to_string());
        }
        (None, _) => {
            io::stdout()
                .write_all(&output.bytes)
                .map_err(|error| format!("failed to write stdout: {error}"))?;
            if !output.bytes.ends_with(b"\n") {
                println!();
            }
        }
    }

    Ok(())
}

fn read_source(cli: &Cli) -> Result<String, String> {
    match (&cli.input, cli.stdin) {
        (Some(_), true) => Err("cannot use both INPUT and --stdin".to_string()),
        (Some(path), false) => fs::read_to_string(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display())),
        (None, _) => {
            let mut source = String::new();
            io::stdin()
                .read_to_string(&mut source)
                .map_err(|error| format!("failed to read stdin: {error}"))?;
            Ok(source)
        }
    }
}
