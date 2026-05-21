use std::env;
use std::fs;
use std::io::{self, Read};
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut format = "json";
    let mut input_path: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--format" | "-f" => {
                i += 1;
                if i < args.len() {
                    format = &args[i];
                }
            }
            "--help" | "-h" => {
                eprintln!(
                    "Usage: drummark [OPTIONS] [FILE]\n\n\
                     Parse DrumMark notation and output the AST as JSON.\n\n\
                     Options:\n  --format, -f FORMAT  Output format (json, ast) [default: json]\n  --help, -h          Show this help\n\n\
                     If FILE is omitted, reads from stdin."
                );
                process::exit(0);
            }
            arg if !arg.starts_with('-') => {
                input_path = Some(arg.to_string());
            }
            _ => {
                eprintln!("Unknown option: {}", args[i]);
                process::exit(1);
            }
        }
        i += 1;
    }

    let source = match &input_path {
        Some(path) => fs::read_to_string(path).unwrap_or_else(|e| {
            eprintln!("Error reading {}: {}", path, e);
            process::exit(1);
        }),
        None => {
            let mut buf = String::new();
            io::stdin().read_to_string(&mut buf).unwrap_or_else(|e| {
                eprintln!("Error reading stdin: {}", e);
                process::exit(1);
            });
            buf
        }
    };

    let parser = drummark_core::parser::Parser::new(&source);
    match parser.parse() {
        Ok(doc) => match format {
            "json" | "ast" => {
                // Print AST as JSON via serde_json for native binary
                // For now, print a simple representation
                println!("{{");
                println!("  \"headers\": {{");
                if let Some(ref t) = doc.headers.title {
                    println!("    \"title\": \"{}\",", t);
                }
                if let Some(t) = doc.headers.tempo {
                    println!("    \"tempo\": {},", t);
                }
                if let Some((b, u)) = doc.headers.time {
                    println!("    \"time\": [{}, {}],", b, u);
                }
                if let Some(ref g) = doc.headers.grouping {
                    println!("    \"grouping\": {:?},", g);
                }
                if let Some(d) = doc.headers.divisions {
                    println!("    \"divisions\": {},", d);
                }
                println!("    \"_ok\": true");
                println!("  }},");
                println!("  \"paragraphs_count\": {},", doc.paragraphs.len());
                println!("  \"errors_count\": {}", doc.errors.len());
                println!("}}");
            }
            _ => {
                eprintln!("Unsupported format: {}. Use --format json", format);
                process::exit(1);
            }
        },
        Err(errors) => {
            for e in &errors {
                eprintln!("Error at {}:{}: {}", e.line, e.column, e.message);
            }
            process::exit(1);
        }
    }
}
