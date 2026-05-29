use crate::{
    notehead_glyph, rest_glyph, staff_y_for_track, EventKind, Fraction, LayoutOptions,
    NormalizedMeasure, NormalizedScore, STAFF_HEIGHT_SS,
};

/// Converts a uniform slot grid position to a horizontal X coordinate (in px).
pub struct SlotMapper {
    pub px_per_quarter: f32,
}

impl SlotMapper {
    pub fn new(px_per_quarter: f32) -> Self {
        Self { px_per_quarter }
    }

    pub fn slot_x_within_beat(&self, slot: u32, slots_per_beat: u32, beat_width: f32) -> f32 {
        let frac = slot as f32 / slots_per_beat as f32;
        frac * beat_width
    }

    pub fn measure_width(&self, total_slots: u32, slots_per_quarter: u32, is_compact: bool) -> f32 {
        if is_compact {
            return 40.0;
        }
        let quarters = total_slots as f32 / slots_per_quarter as f32;
        quarters * self.px_per_quarter
    }

    pub fn beat_width(&self, beat_slots: u32, slots_per_quarter: u32) -> f32 {
        let quarters = beat_slots as f32 / slots_per_quarter as f32;
        let density_bonus = if beat_slots > 1 { 1.15 } else { 1.0 };
        quarters * self.px_per_quarter * density_bonus
    }
}

/// A single element on the layout plan.
#[derive(Debug, Clone)]
pub struct LayoutElement {
    pub kind: ElementKind,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub smufl_codepoint: Option<u32>,
    pub voice: Option<u8>,
    pub stem_up: Option<bool>,
    pub barline_type: Option<String>,
    pub text: Option<String>,
    pub from_x: Option<f32>,
    pub to_x: Option<f32>,
    pub priority: u8,
    pub can_shift_y: bool,
    pub can_shift_x: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ElementKind {
    Note,
    Rest,
    Barline,
    Sticking,
    Modifier,
    GraceNote,
    Beam,
    Stem,
    Hairpin,
    Volta,
    NavMarker,
    Text,
    Clef,
    TimeSignature,
}

/// Place notes and rests from a single measure's events.
pub fn place_notes(
    measure: &NormalizedMeasure,
    mapper: &SlotMapper,
    opts: &LayoutOptions,
) -> Vec<LayoutElement> {
    let mut elements = Vec::new();
    for ev in &measure.events {
        let x = mapper.slot_x_within_beat(
            to_slots(&ev.start, measure.note_value),
            slots_per_beat(measure),
            beat_width_for(measure, &ev.start),
        );
        let y = staff_y_for_track(&ev.track);
        let metrics = if ev.kind == EventKind::Rest {
            rest_glyph(ev.duration.denominator)
        } else {
            notehead_glyph(&ev.track, &ev.modifiers, &ev.glyph)
        };

        elements.push(LayoutElement {
            kind: if ev.kind == EventKind::Rest {
                ElementKind::Rest
            } else {
                ElementKind::Note
            },
            x,
            y,
            width: metrics.width_ss() * opts.staff_space_pt,
            height: metrics.bbox_height_ss() * opts.staff_space_pt,
            smufl_codepoint: Some(metrics.smufl_codepoint),
            voice: Some(ev.voice),
            stem_up: Some(ev.voice == 1),
            barline_type: None,
            text: None,
            from_x: None,
            to_x: None,
            priority: 0,
            can_shift_y: false,
            can_shift_x: false,
        });
    }
    elements
}

pub fn place_barlines(measure: &NormalizedMeasure, measure_x: f32, opts: &LayoutOptions) -> Vec<LayoutElement> {
    let mut elements = Vec::new();
    let bar_type = measure.barline.as_deref().unwrap_or("regular");
    elements.push(LayoutElement {
        kind: ElementKind::Barline,
        x: measure_x,
        y: 0.0,
        width: 2.0,
        height: STAFF_HEIGHT_SS * opts.staff_space_pt,
        smufl_codepoint: None,
        voice: None,
        stem_up: None,
        barline_type: Some(bar_type.to_string()),
        text: None,
        from_x: None,
        to_x: None,
        priority: 0,
        can_shift_y: false,
        can_shift_x: false,
    });
    elements
}

/// Push lower-priority edge elements outward when they overlap.
/// Returns the resolved elements with Y positions adjusted.
pub fn stack_edge_elements(elements: &mut [LayoutElement], edge_padding: f32) -> Vec<String> {
    let mut warnings = Vec::new();
    let max_iters = 5;

    for _iter in 0..max_iters {
        let mut any_overlap = false;

        for i in 0..elements.len() {
            for j in (i + 1)..elements.len() {
                let (a, b) = if elements[i].priority < elements[j].priority {
                    (&elements[i].clone(), &elements[j].clone())
                } else {
                    (&elements[j].clone(), &elements[i].clone())
                };

                let a_right = a.x + a.width;
                let b_right = b.x + b.width;
                let x_overlap = a.x < b_right && a_right > b.x;
                if !x_overlap {
                    continue;
                }

                let a_bottom = a.y + a.height;
                let b_bottom = b.y + b.height;
                let y_overlap = a.y < b_bottom && a_bottom > b.y;
                if !y_overlap {
                    continue;
                }

                any_overlap = true;
                let overlap = a_bottom.min(b_bottom) - a.y.max(b.y);
                let push = overlap + edge_padding;

                if elements[j].can_shift_y {
                    elements[j].y += push;
                } else if elements[i].can_shift_y {
                    elements[i].y -= push;
                } else {
                    warnings.push(format!("unresolved overlap at x={:.1}", a.x));
                }
            }
        }

        if !any_overlap {
            break;
        }
    }

    warnings
}

/// A single system (one line of music) containing measures.
#[derive(Debug, Clone)]
pub struct System {
    pub y: f32,
    pub height: f32,
    pub measures: Vec<MeasureLayout>,
}

#[derive(Debug, Clone)]
pub struct MeasureLayout {
    pub x: f32,
    pub width: f32,
    pub elements: Vec<LayoutElement>,
}

/// Build systems from a NormalizedScore.
pub fn build_systems(score: &NormalizedScore, opts: &LayoutOptions) -> Vec<System> {
    let mapper = SlotMapper::new(opts.px_per_quarter);
    let mut systems = Vec::new();
    let mut current_system = System {
        y: opts.top_margin_pt,
        height: STAFF_HEIGHT_SS * opts.staff_space_pt,
        measures: Vec::new(),
    };
    let mut cursor_x = opts.left_margin_pt + 30.0 + 40.0;
    let usable_width =
        opts.page_width_pt - opts.left_margin_pt - opts.right_margin_pt - 30.0 - 40.0;

    for measure in &score.measures {
        let is_compact =
            measure.multi_rest_count.is_some() || measure.measure_repeat_slashes.is_some();
        let total_slots = measure.events.len() as u32;
        let width = mapper.measure_width(total_slots.max(1), 4, is_compact);

        if cursor_x + width > opts.left_margin_pt + usable_width
            && !current_system.measures.is_empty()
        {
            systems.push(current_system);
            current_system = System {
                y: opts.top_margin_pt + (systems.len() as f32 + 1.0) * (opts.staff_space_pt * 8.0),
                height: STAFF_HEIGHT_SS * opts.staff_space_pt,
                measures: Vec::new(),
            };
            cursor_x = opts.left_margin_pt + 30.0 + 40.0;
        }

        let mut elements = Vec::new();
        elements.extend(place_notes(measure, &mapper, opts));
        elements.extend(place_barlines(measure, cursor_x, opts));

        current_system.measures.push(MeasureLayout {
            x: cursor_x,
            width,
            elements,
        });
        cursor_x += width;
    }

    if !current_system.measures.is_empty() {
        systems.push(current_system);
    }
    systems
}

fn to_slots(f: &Fraction, note_value: u32) -> u32 {
    (f.numerator * note_value) / f.denominator.max(1)
}

fn slots_per_beat(_measure: &NormalizedMeasure) -> u32 {
    4
}

fn beat_width_for(_measure: &NormalizedMeasure, _start: &Fraction) -> f32 {
    80.0
}
