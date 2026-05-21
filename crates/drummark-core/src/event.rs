use crate::fraction::{Fraction, calculate_token_weight_as_fraction, fractions_equal};
use crate::resolve::{resolve_token, voice_for_track};
use crate::hairpin::HairpinKind;
use crate::ast::DynamicLevel;

// ── Normalized Event ─────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct NormalizedEvent {
    pub track: String,
    pub paragraph_index: u32,
    pub measure_index: u32,
    pub measure_in_paragraph: u32,
    pub start: Fraction,
    pub duration: Fraction,
    pub kind: EventKind,
    pub glyph: String,
    pub modifiers: Vec<String>,
    pub modifier: Option<String>,
    pub voice: u8,
    pub beam: String,
    pub tuplet: Option<(u32, u32)>, // (actual, normal)
    pub source_offset: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventKind {
    Hit,
    Rest,
    Sticking,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DynamicCandidate {
    pub level: DynamicLevel,
    pub at: Fraction,
}

// ── Internal Token Types (mirrors MeasureExpr from parser) ───────

#[derive(Debug, Clone)]
pub enum TokenGlyph {
    Basic {
        value: String,
        dots: u32,
        halves: u32,
        stars: u32,
        modifiers: Vec<String>,
        track_override: Option<String>,
    },
    Combined {
        items: Vec<TokenGlyph>,
    },
    Group {
        count: u32,
        span: u32,
        items: Vec<TokenGlyph>,
        modifiers: Vec<String>,
    },
    Braced {
        track: String,
        items: Vec<TokenGlyph>,
    },
    Crescendo,
    Decrescendo,
    HairpinEnd,
    Dynamic(DynamicLevel),
}

// ── Token → Event Expansion ─────────────────────────────────────

pub fn token_to_events(
    token: &TokenGlyph,
    start: Fraction,
    duration: Fraction,
    context_track: Option<&str>,
    paragraph_index: u32,
    measure_index: u32,
    measure_in_paragraph: u32,
    inherited_tuplet: Option<(u32, u32)>,
    source_offset: u32,
) -> Vec<NormalizedEvent> {
    match token {
        TokenGlyph::Basic { value, dots: _, halves: _, stars: _, modifiers, track_override } => {
            if value == "-" { return vec![]; }

            let resolved = resolve_token(value, context_track, track_override.as_deref(), modifiers);
            let resolved = match resolved {
                Some(r) => r,
                None => return vec![],
            };

            let primary_modifier = resolved.modifiers.iter()
                .find(|m| *m != "accent")
                .cloned();

            let kind = if resolved.track == "ST" { EventKind::Sticking } else { EventKind::Hit };

            let event = NormalizedEvent {
                track: resolved.track.clone(),
                paragraph_index,
                measure_index,
                measure_in_paragraph,
                start,
                duration,
                kind,
                glyph: resolved.glyph.clone(),
                modifiers: resolved.modifiers.clone(),
                modifier: primary_modifier,
                voice: voice_for_track(&resolved.track),
                beam: "none".to_string(),
                tuplet: inherited_tuplet,
                source_offset,
            };
            vec![event]
        }
        TokenGlyph::Combined { items } => {
            items.iter()
                .flat_map(|item| token_to_events(item, start, duration, context_track, paragraph_index, measure_index, measure_in_paragraph, inherited_tuplet, source_offset))
                .collect()
        }
        TokenGlyph::Braced { track, items } => {
            let mut events = Vec::new();
            let total_weight = braced_total_weight(items);

            if fractions_equal(total_weight, Fraction::zero()) {
                return events;
            }

            let mut current_start = start;
            for item in items {
                let item_weight = item_weight(item);
                let item_duration = duration
                    .multiply(item_weight)
                    .divide(total_weight);

                events.extend(token_to_events(
                    item,
                    current_start,
                    item_duration,
                    Some(track),
                    paragraph_index,
                    measure_index,
                    measure_in_paragraph,
                    inherited_tuplet,
                    source_offset,
                ));
                current_start = current_start.add(item_duration);
            }
            events
        }
        TokenGlyph::Group { count, span, items, modifiers } => {
            let mut events = Vec::new();
            let total_weight = group_total_weight(items);

            if fractions_equal(total_weight, Fraction::zero()) {
                return events;
            }

            let count = *count;
            let span = *span;
            let effective_count = if count == 0 { items.len() as u32 } else { count };
            let effective_span = span;
            // Only mark as tuplet if there's actual compression/expansion
            let group_tuplet = if effective_count != span && effective_count > effective_span
            {
                Some((effective_count, effective_span))
            } else {
                inherited_tuplet
            };

            let mut current_start = start;
            for item in items {
                let mut item = item.clone();
                // Apply group modifiers
                if !modifiers.is_empty() {
                    apply_modifiers(&mut item, modifiers);
                }
                let item_weight = item_weight(&item);
                let item_duration = duration
                    .multiply(item_weight)
                    .divide(total_weight);

                events.extend(token_to_events(
                    &item,
                    current_start,
                    item_duration,
                    context_track,
                    paragraph_index,
                    measure_index,
                    measure_in_paragraph,
                    group_tuplet,
                    source_offset,
                ));
                current_start = current_start.add(item_duration);
            }
            events
        }
        TokenGlyph::Crescendo | TokenGlyph::Decrescendo | TokenGlyph::HairpinEnd | TokenGlyph::Dynamic(_) => {
            vec![]
        }
    }
}

// ── Weight Helpers ───────────────────────────────────────────────

fn item_weight(token: &TokenGlyph) -> Fraction {
    match token {
        TokenGlyph::Basic { dots, halves, stars, .. } => {
            calculate_token_weight_as_fraction(*dots, *stars, *halves, None)
        }
        TokenGlyph::Group { span, .. } => {
            // Group weight = span (normal duration)
            Fraction::new(*span as u64, 1)
        }
        TokenGlyph::Combined { items } => {
            // max weight of items
            items.iter()
                .map(item_weight)
                .max_by(|a, b| a.compare(*b))
                .unwrap_or(Fraction::zero())
        }
        TokenGlyph::Braced { items, .. } => braced_total_weight(items),
        TokenGlyph::Crescendo | TokenGlyph::Decrescendo | TokenGlyph::HairpinEnd | TokenGlyph::Dynamic(_) => {
            Fraction::zero()
        }
    }
}

fn group_total_weight(items: &[TokenGlyph]) -> Fraction {
    items.iter()
        .map(item_weight)
        .fold(Fraction::zero(), |a, b| a.add(b))
}

fn braced_total_weight(items: &[TokenGlyph]) -> Fraction {
    items.iter()
        .map(item_weight)
        .fold(Fraction::zero(), |a, b| a.add(b))
}

fn apply_modifiers(token: &mut TokenGlyph, mods: &[String]) {
    if let TokenGlyph::Basic { modifiers, .. } = token {
        for m in mods {
            if !modifiers.contains(m) {
                modifiers.push(m.clone());
            }
        }
    }
}

// ── Hairpin scanning ─────────────────────────────────────────────

/// Scan a measure's tokens for hairpin events.
/// Returns list of (start, open_kind_or_none, close_or_none).
pub fn scan_hairpin_tokens(
    tokens: &[TokenGlyph],
    _measure_start: Fraction,
    _divisions: u32,
) -> Vec<(Fraction, Option<HairpinKind>, Option<()>)> {
    let mut results = Vec::new();
    let mut position = Fraction::zero();

    for token in tokens {
        match token {
            TokenGlyph::Crescendo => {
                results.push((position, Some(HairpinKind::Crescendo), None));
            }
            TokenGlyph::Decrescendo => {
                results.push((position, Some(HairpinKind::Decrescendo), None));
            }
            TokenGlyph::HairpinEnd => {
                results.push((position, None, Some(())));
            }
            TokenGlyph::Dynamic(_) => {}
            _ => {
                let w = item_weight(token);
                position = position.add(w);
            }
        }
    }

    results
}

// ── Dynamic scanning ─────────────────────────────────────────────

/// Scan a measure's tokens for score-level dynamic marks.
///
/// Returned positions are exact measure-local fractions where 0/1 is the
/// measure start and 1/1 is the measure end under the supplied divisions.
pub fn scan_dynamic_tokens(tokens: &[TokenGlyph], divisions: u32) -> Vec<DynamicCandidate> {
    let mut results = Vec::new();
    scan_dynamic_sequence(
        tokens,
        Fraction::zero(),
        Fraction::new(divisions as u64, 1),
        Fraction::new(divisions as u64, 1),
        &mut results,
    );
    results
}

fn scan_dynamic_sequence(
    tokens: &[TokenGlyph],
    start: Fraction,
    duration: Fraction,
    measure_duration: Fraction,
    results: &mut Vec<DynamicCandidate>,
) {
    let total_weight = sequence_total_weight(tokens);
    if fractions_equal(total_weight, Fraction::zero()) {
        for token in tokens {
            if let TokenGlyph::Dynamic(level) = token {
                results.push(DynamicCandidate {
                    level: level.clone(),
                    at: start.divide(measure_duration),
                });
            }
        }
        return;
    }

    let mut current_start = start;
    let mut index = 0usize;
    while index < tokens.len() {
        if matches!(tokens[index], TokenGlyph::Braced { .. }) {
            let cluster_start = index;
            while index < tokens.len() && matches!(tokens[index], TokenGlyph::Braced { .. }) {
                index += 1;
            }
            let cluster = &tokens[cluster_start..index];
            let cluster_weight = cluster
                .iter()
                .map(item_weight)
                .max_by(|a, b| a.compare(*b))
                .unwrap_or(Fraction::zero());
            let cluster_duration = duration.multiply(cluster_weight).divide(total_weight);
            for token in cluster {
                if let TokenGlyph::Braced { items, .. } = token {
                    scan_dynamic_sequence(items, current_start, cluster_duration, measure_duration, results);
                }
            }
            current_start = current_start.add(cluster_duration);
            continue;
        }

        let token = &tokens[index];
        match token {
            TokenGlyph::Dynamic(level) => {
                results.push(DynamicCandidate {
                    level: level.clone(),
                    at: current_start.divide(measure_duration),
                });
            }
            TokenGlyph::Group { items, .. } => {
                let item_duration = duration.multiply(item_weight(token)).divide(total_weight);
                scan_dynamic_sequence(items, current_start, item_duration, measure_duration, results);
                current_start = current_start.add(item_duration);
            }
            TokenGlyph::Braced { .. } => unreachable!("braced clusters are handled above"),
            _ => {
                let item_duration = duration.multiply(item_weight(token)).divide(total_weight);
                current_start = current_start.add(item_duration);
            }
        }
        index += 1;
    }
}

fn sequence_total_weight(tokens: &[TokenGlyph]) -> Fraction {
    let mut total = Fraction::zero();
    let mut index = 0usize;
    while index < tokens.len() {
        if matches!(tokens[index], TokenGlyph::Braced { .. }) {
            let mut cluster_weight = Fraction::zero();
            while index < tokens.len() && matches!(tokens[index], TokenGlyph::Braced { .. }) {
                let weight = item_weight(&tokens[index]);
                if weight.compare(cluster_weight).is_gt() {
                    cluster_weight = weight;
                }
                index += 1;
            }
            total = total.add(cluster_weight);
        } else {
            total = total.add(item_weight(&tokens[index]));
            index += 1;
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note() -> TokenGlyph {
        TokenGlyph::Basic {
            value: "d".to_string(),
            dots: 0,
            halves: 0,
            stars: 0,
            modifiers: vec![],
            track_override: None,
        }
    }

    fn dynamic(level: DynamicLevel) -> TokenGlyph {
        TokenGlyph::Dynamic(level)
    }

    #[test]
    fn scans_start_mid_and_end_dynamics() {
        let dynamics = scan_dynamic_tokens(
            &[
                dynamic(DynamicLevel::P),
                note(),
                note(),
                dynamic(DynamicLevel::F),
                note(),
                note(),
                dynamic(DynamicLevel::Ff),
            ],
            4,
        );

        assert_eq!(dynamics[0].at, Fraction::zero());
        assert_eq!(dynamics[1].at, Fraction::new(1, 2));
        assert_eq!(dynamics[2].at, Fraction::one());
    }

    #[test]
    fn scans_simultaneous_routed_block_cluster_and_advances_by_max_duration() {
        let sd = TokenGlyph::Braced {
            track: "SD".to_string(),
            items: vec![dynamic(DynamicLevel::P), note(), note()],
        };
        let bd = TokenGlyph::Braced {
            track: "BD".to_string(),
            items: vec![dynamic(DynamicLevel::F), note(), note()],
        };

        let dynamics = scan_dynamic_tokens(
            &[
                sd,
                bd,
                dynamic(DynamicLevel::Mp),
                note(),
            ],
            3,
        );

        assert_eq!(dynamics[0].at, Fraction::zero());
        assert_eq!(dynamics[1].at, Fraction::zero());
        assert_eq!(dynamics[2].at, Fraction::new(2, 3));
    }

    #[test]
    fn scans_nested_group_dynamics_after_recursive_scaling() {
        let nested = TokenGlyph::Group {
            count: 2,
            span: 2,
            items: vec![dynamic(DynamicLevel::P), note(), note()],
            modifiers: vec![],
        };
        let outer = TokenGlyph::Group {
            count: 3,
            span: 4,
            items: vec![note(), nested, note()],
            modifiers: vec![],
        };

        let dynamics = scan_dynamic_tokens(&[outer], 4);

        assert_eq!(dynamics.len(), 1);
        assert_eq!(dynamics[0].at, Fraction::new(1, 4));
    }
}
