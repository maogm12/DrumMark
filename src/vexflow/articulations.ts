import type { NormalizedEvent } from "../dsl/types";

export function articulationForEvent(event: NormalizedEvent): unknown {
  // Accent for X/D/P glyphs
  if (event.kind === "accent") {
    return { type: "accent", modifier: "a>" };
  }

  if (event.modifier === "close") {
    return { type: "articulation", modifier: "a-" };
  }

  if (event.modifier === "choke") {
    return { type: "articulation", modifier: "a." };
  }

  return null;
}

export function modifierIsGrace(event: NormalizedEvent): boolean {
  return event.modifier === "flam" || event.modifier === "drag";
}

export function graceNoteSlash(event: NormalizedEvent): boolean {
  return event.modifier === "flam";
}
