//! Display-only measure expansion helpers extracted from lib.rs.

use crate::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MeasureRepeatDisplayPart {
    Single,
    TwoBarStart,
    TwoBarStop,
}

#[derive(Debug, Clone)]
pub(crate) struct DisplayMeasure<'a> {
    pub(crate) measure: &'a RenderMeasure,
    pub(crate) global_index: u32,
    pub(crate) paragraph_index: u32,
    pub(crate) barline: Option<String>,
    pub(crate) closing_barline: Option<String>,
    pub(crate) start_nav: Option<NavMarker>,
    pub(crate) end_nav: Option<NavJump>,
    pub(crate) hairpins: Vec<HairpinSpan>,
    pub(crate) repeat_part: Option<MeasureRepeatDisplayPart>,
}

#[derive(Debug, Clone)]
pub(crate) struct ExpandedLayoutData<'a> {
    pub(crate) measures: Vec<DisplayMeasure<'a>>,
}

pub(crate) fn left_edge_barline(barline: Option<&str>) -> Option<String> {
    match barline {
        Some("repeat-start") | Some("repeat-both") => Some("repeat-start".to_string()),
        _ => None,
    }
}

pub(crate) fn right_edge_barline(barline: Option<&str>) -> Option<String> {
    match barline {
        Some("repeat-end") | Some("repeat-both") => Some("repeat-end".to_string()),
        Some("double") => Some("double".to_string()),
        Some("final") => Some("final".to_string()),
        _ => None,
    }
}

pub(crate) fn expand_layout_data<'a>(score: &'a RenderScore) -> ExpandedLayoutData<'a> {
    let mut display_slots: Vec<Vec<u32>> = Vec::with_capacity(score.measures.len());
    let mut next_index = 0_u32;
    for measure in &score.measures {
        if measure.measure_repeat_slashes == Some(2) {
            display_slots.push(vec![next_index, next_index + 1]);
            next_index += 2;
        } else {
            display_slots.push(vec![next_index]);
            next_index += 1;
        }
    }

    let map_start = |original: u32| -> u32 {
        display_slots
            .get(original as usize)
            .and_then(|slots| slots.first().copied())
            .unwrap_or(original)
    };
    let map_end = |original: u32| -> u32 {
        display_slots
            .get(original as usize)
            .and_then(|slots| slots.last().copied())
            .unwrap_or(original)
    };
    let map_hairpins = |hairpins: &[HairpinSpan]| -> Vec<HairpinSpan> {
        hairpins
            .iter()
            .map(|hairpin| HairpinSpan {
                kind: hairpin.kind,
                start: hairpin.start,
                end: hairpin.end,
                start_measure_index: map_start(hairpin.start_measure_index),
                end_measure_index: map_end(hairpin.end_measure_index),
            })
            .collect()
    };

    let mut measures = Vec::new();
    let mut paragraph_measure_counts: std::collections::BTreeMap<u32, u32> =
        std::collections::BTreeMap::new();
    for (measure_index, measure) in score.measures.iter().enumerate() {
        let slots = &display_slots[measure_index];
        for (slot_index, display_index) in slots.iter().enumerate() {
            let paragraph_counter = paragraph_measure_counts
                .entry(measure.paragraph_index)
                .or_insert(0);
            *paragraph_counter += 1;

            let repeat_part = match measure.measure_repeat_slashes {
                Some(1) => Some(MeasureRepeatDisplayPart::Single),
                Some(2) if slot_index == 0 => Some(MeasureRepeatDisplayPart::TwoBarStart),
                Some(2) => Some(MeasureRepeatDisplayPart::TwoBarStop),
                _ => None,
            };

            let (barline, closing_barline, start_nav, end_nav, hairpins) = match repeat_part {
                Some(MeasureRepeatDisplayPart::TwoBarStart) => (
                    left_edge_barline(measure.barline.as_deref()),
                    left_edge_barline(measure.closing_barline.as_deref()),
                    measure.start_nav.clone(),
                    None,
                    map_hairpins(&measure.hairpins),
                ),
                Some(MeasureRepeatDisplayPart::TwoBarStop) => (
                    right_edge_barline(measure.barline.as_deref()),
                    right_edge_barline(measure.closing_barline.as_deref()),
                    None,
                    measure.end_nav.clone(),
                    Vec::new(),
                ),
                _ => (
                    measure.barline.clone(),
                    measure.closing_barline.clone(),
                    measure.start_nav.clone(),
                    measure.end_nav.clone(),
                    map_hairpins(&measure.hairpins),
                ),
            };

            measures.push(DisplayMeasure {
                measure,
                global_index: *display_index,
                paragraph_index: measure.paragraph_index,
                barline,
                closing_barline,
                start_nav,
                end_nav,
                hairpins,
                repeat_part,
            });
        }
    }

    ExpandedLayoutData { measures }
}
