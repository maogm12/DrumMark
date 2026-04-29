import type { NormalizedEvent } from "../dsl/types";

export function articulationForEvent(event: NormalizedEvent): unknown {
  // Accent for X/D/P glyphs
  if (event.modifiers.includes("accent")) {
    return { type: "accent", modifier: "a>" };
  }

  if (event.modifiers.includes("close")) {
    return { type: "articulation", modifier: "a-" };
  }

  if (event.modifiers.includes("choke")) {
    return { type: "articulation", modifier: "a." };
  }

  return null;
}

export function modifierIsGrace(event: NormalizedEvent): boolean {
  return event.modifiers.includes("flam") || event.modifiers.includes("drag");
}

export function graceNoteSlash(event: NormalizedEvent): boolean {
  return event.modifiers.includes("flam");
}

export function annotationTextForEvent(event: NormalizedEvent): string | null {
  if (event.modifiers.includes("half-open")) {
    return "half-open";
  }

  return null;
}

export function tremoloMarksForEvent(event: NormalizedEvent): number | null {
  if (event.modifiers.includes("roll")) {
    return 3;
  }

  return null;
}
