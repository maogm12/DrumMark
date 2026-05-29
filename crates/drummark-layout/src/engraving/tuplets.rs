use crate::contract::Fraction;
use crate::fraction::{add_fractions, compare_fractions};
use crate::metrics::{canonical_text_metric, canonical_text_width, TextRole};
use crate::scene_builder::{LineItemSpec, SceneEmitSink, TextItemSpec};

use super::notes::SlotEvent;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct TupletRunKey {
    pub(crate) voice: u8,
    pub(crate) count: u32,
    pub(crate) span: u32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct TupletRun {
    pub(crate) key: TupletRunKey,
    pub(crate) end: Fraction,
    pub(crate) start_x: f32,
    pub(crate) end_x: f32,
}

pub(crate) fn render_tuplet_groups(
    sink: &mut SceneEmitSink<'_>,
    measure_id: &str,
    slot_events: &[SlotEvent<'_>],
    staff_top: f32,
) {
    let mut tuplet_events = slot_events
        .iter()
        .filter_map(|slot_event| {
            let (count, span) = slot_event.event.tuplet?;
            Some((
                TupletRunKey {
                    voice: slot_event.event.voice,
                    count,
                    span,
                },
                slot_event.start,
                add_fractions(slot_event.event.start, slot_event.event.duration),
                slot_event.event_x,
            ))
        })
        .collect::<Vec<_>>();
    tuplet_events.sort_by(|left, right| {
        left.0
            .voice
            .cmp(&right.0.voice)
            .then_with(|| compare_fractions(left.1, right.1))
            .then_with(|| compare_fractions(left.2, right.2))
            .then_with(|| left.0.count.cmp(&right.0.count))
            .then_with(|| left.0.span.cmp(&right.0.span))
    });
    tuplet_events.dedup_by(|left, right| {
        left.0 == right.0
            && compare_fractions(left.1, right.1) == std::cmp::Ordering::Equal
            && compare_fractions(left.2, right.2) == std::cmp::Ordering::Equal
    });

    let mut runs: Vec<TupletRun> = Vec::new();
    for (key, start, end, x) in tuplet_events {
        if key.count == key.span || matches!(key.count, 2 | 4) {
            continue;
        }
        if let Some(last) = runs.last_mut() {
            if last.key == key && compare_fractions(start, last.end) == std::cmp::Ordering::Equal {
                last.end = end;
                last.end_x = x;
                continue;
            }
        }
        runs.push(TupletRun {
            key,
            end,
            start_x: x,
            end_x: x,
        });
    }

    for run in &runs {
        let y = staff_top - 30.0 - (run.key.voice.saturating_sub(1) as f32 * 12.0);
        let left = run.start_x - 8.0;
        let right = run.end_x + 8.0;
        let label = run.key.count.to_string();
        let label_width = canonical_text_width(TextRole::CountLabel, &label, sink.staff_space_pt);
        let label_gap = (label_width + 8.0).max(16.0);
        let center_x = (left + right) * 0.5;
        let gap_left = center_x - label_gap * 0.5;
        let gap_right = center_x + label_gap * 0.5;
        sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "tuplet-bracket",
            x1: left,
            y1: y,
            x2: gap_left.max(left),
            y2: y,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: Some("butt"),
        });
        sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "tuplet-bracket",
            x1: gap_right.min(right),
            y1: y,
            x2: right,
            y2: y,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: Some("butt"),
        });
        sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "tuplet-hook",
            x1: left,
            y1: y,
            x2: left,
            y2: y + 5.0,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: Some("butt"),
        });
        sink.push_line_item(LineItemSpec {
            measure_id: Some(measure_id),
            role: "tuplet-hook",
            x1: right,
            y1: y,
            x2: right,
            y2: y + 5.0,
            stroke: "#333",
            stroke_width: 1.0,
            stroke_line_cap: Some("butt"),
        });

        let metric = canonical_text_metric(TextRole::CountLabel, sink.staff_space_pt);
        sink.push_text_item(TextItemSpec {
            measure_id: Some(measure_id),
            role: "tuplet-label",
            x: center_x,
            y: y + metric.ascent_pt * 0.35,
            text_role: TextRole::CountLabel,
            text: label.clone(),
            font_family: "Academico",
            font_size_pt: sink.staff_space_pt * 1.2,
            fill: "#333",
            text_anchor: Some("middle"),
            font_weight: Some("bold"),
        });
    }
}
