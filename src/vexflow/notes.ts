import type { Fraction, NormalizedEvent, TrackName } from "../dsl/types";
import { simplify, type InstrumentSpec } from "../dsl/logic";

// Duration code mapping from Fraction to VexFlow duration string
export function durationCode(duration: Fraction): string {
  const normalized = simplify(duration);
  const base: Record<number, string> = {
    1: "w", 2: "h", 4: "q", 8: "8", 16: "16", 32: "32", 64: "64",
  };
  let code = base[normalized.denominator] ?? "q";
  if (normalized.numerator === 3) {
    const baseDenom = normalized.denominator / 2;
    if (base[baseDenom]) code = base[baseDenom] + "d";
  }
  return code;
}

export function instrumentForTrack(track: TrackName, glyph?: string): InstrumentSpec {
  if (track === "HH" && (glyph === "c" || glyph === "C")) {
    return { displayStep: "A", displayOctave: 5, notehead: "x" };
  }
  switch (track) {
    case "HH": return { displayStep: "G", displayOctave: 5, notehead: "x" };
    case "HF": return { displayStep: "D", displayOctave: 4, notehead: "x" };
    case "SD": return { displayStep: "C", displayOctave: 5 };
    case "BD": return { displayStep: "F", displayOctave: 4 };
    case "T1": return { displayStep: "E", displayOctave: 5 };
    case "T2": return { displayStep: "D", displayOctave: 5 };
    case "T3": return { displayStep: "A", displayOctave: 4 };
    case "RC": return { displayStep: "F", displayOctave: 5, notehead: "x" };
    case "C":  return { displayStep: "A", displayOctave: 5, notehead: "x" };
    case "ST": return { displayStep: "B", displayOctave: 5 };
    default:   return { displayStep: "B", displayOctave: 5 };
  }
}

/**
 * Returns either a VexFlow notehead type code (like 'X', 'CX') 
 * or a raw SMuFL glyph ID if no code exists.
 */
export function getVexNotehead(event: NormalizedEvent, _instrument: InstrumentSpec): string | undefined {
  if (event.track === "SD") {
    if (event.modifier === "cross") return "X"; // noteheadXBlack
    if (event.modifier === "rim") return "SF";  // noteheadSlashedBlack1
  }

  if (event.track === "HH" || event.track === "C" || event.track === "RC") {
    if (event.modifier === "open") return "CX"; // noteheadCircleX
    if (event.track === "RC" && event.modifier === "bell") return "D2"; // noteheadDiamondBlack
    return "X"; // noteheadXBlack
  }

  // Ghost notes will use standard round noteheads but will be parenthesized by the renderer
  return undefined;
}

/**
 * Check if the returned string from getVexNotehead is a VexFlow shorthand code
 * or a raw SMuFL ID.
 */
export function isVexCode(head: string): boolean {
  const codes = ["D0", "D1", "D2", "D3", "T0", "T1", "T2", "T3", "X0", "X1", "X2", "X3", "S1", "S2", "R1", "R2", "X", "CX", "CI", "H", "SQ", "TU", "TD", "SF", "SB"];
  return codes.includes(head.toUpperCase());
}

export function makeNoteKey(event: NormalizedEvent, instrument: InstrumentSpec): string {
  const head = getVexNotehead(event, instrument);
  const base = `${instrument.displayStep}/${instrument.displayOctave}`;
  
  if (head && isVexCode(head)) {
    return `${base}/${head}`;
  }
  
  // If it's a raw SMuFL ID, we can't put it in the key string reliably in VF5
  // We should just return the base and let the renderer use setGlyph
  return base;
}
