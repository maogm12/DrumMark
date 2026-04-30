import type { Fraction, NormalizedEvent, TrackName } from "../dsl/types";
import { simplify, type InstrumentSpec } from "../dsl/logic";

// Duration information including VexFlow duration string and dot count
export type DurationInfo = {
  code: string;
  dots: number;
};

// Duration code mapping from Fraction to VexFlow duration string and dots
export function durationCode(duration: Fraction): DurationInfo {
  const normalized = simplify(duration);
  const base: Record<number, string> = {
    1: "w", 2: "h", 4: "q", 8: "8", 16: "16", 32: "32", 64: "64",
  };
  
  let code = base[normalized.denominator];
  let dots = 0;

  if (!code) {
    // For denominators not directly representable (e.g., 24 = 1/24 triplet),
    // find the next shorter duration that is beamable (denominator >= 8).
    // e.g., 1/24 -> "16" (16th note), 1/12 -> "8" (eighth note)
    for (const d of [64, 32, 16, 8]) {
      if (normalized.denominator >= d) {
        code = base[d];
        break;
      }
    }
    code = code ?? "q";
  }

  if (normalized.numerator === 3) {
    const baseDenom = normalized.denominator / 2;
    if (base[baseDenom]) {
      code = base[baseDenom];
      dots = 1;
    }
  } else if (normalized.numerator === 7) {
    const baseDenom = normalized.denominator / 4;
    if (base[baseDenom]) {
      code = base[baseDenom];
      dots = 2;
    }
  }
  
  return { code, dots };
}

export function instrumentForTrack(track: TrackName, _glyph?: string): InstrumentSpec {
  switch (track) {
    case "HH": return { displayStep: "G", displayOctave: 5, notehead: "x" };
    case "HF": return { displayStep: "D", displayOctave: 4, notehead: "x" };
    case "SD": return { displayStep: "C", displayOctave: 5 };
    case "BD": return { displayStep: "F", displayOctave: 4 };
    case "BD2": return { displayStep: "E", displayOctave: 4 };
    case "T1": return { displayStep: "E", displayOctave: 5 };
    case "T2": return { displayStep: "D", displayOctave: 5 };
    case "T3": return { displayStep: "A", displayOctave: 4 };
    case "T4": return { displayStep: "G", displayOctave: 4 };
    case "RC": return { displayStep: "F", displayOctave: 5, notehead: "x" };
    case "RC2": return { displayStep: "E", displayOctave: 5, notehead: "x" };
    case "C":  return { displayStep: "A", displayOctave: 5, notehead: "x" };
    case "C2": return { displayStep: "B", displayOctave: 5, notehead: "x" };
    case "SPL": return { displayStep: "D", displayOctave: 6, notehead: "x" };
    case "CHN": return { displayStep: "C", displayOctave: 6, notehead: "x" };
    case "CB": return { displayStep: "B", displayOctave: 4 };
    case "WB": return { displayStep: "A", displayOctave: 3 };
    case "CL": return { displayStep: "G", displayOctave: 4 };
    case "ST": return { displayStep: "B", displayOctave: 5 };
    default:   return { displayStep: "B", displayOctave: 5 };
  }
}

/**
 * Returns either a VexFlow notehead type code (like 'X', 'CX') 
 * or a raw SMuFL glyph ID if no code exists.
 */
export function getVexNotehead(event: NormalizedEvent, _instrument: InstrumentSpec): string | undefined {
  if (event.modifiers.includes("dead")) {
    return "X";
  }

  if (event.track === "SD") {
    if (event.modifiers.includes("cross")) return "X"; // noteheadXBlack
    if (event.modifiers.includes("rim")) return "SF";  // noteheadSlashedBlack1
  }

  if (
    event.track === "HH" ||
    event.track === "HF" ||
    event.track === "RC" ||
    event.track === "RC2" ||
    event.track === "C" ||
    event.track === "C2" ||
    event.track === "SPL" ||
    event.track === "CHN"
  ) {
    if (event.modifiers.includes("open")) return "CX"; // noteheadCircleX
    if ((event.track === "RC" || event.track === "RC2") && event.modifiers.includes("bell")) return "D2"; // noteheadDiamondBlack
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
