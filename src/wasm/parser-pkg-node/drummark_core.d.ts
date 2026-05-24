/* tslint:disable */
/* eslint-disable */

export function build_music_xml(source: string, hide_voice2_rests: boolean): any;

/**
 * Parse and normalize a DrumMark source string in one call.
 * Returns the NormalizedScore as a JS object tree.
 */
export function build_normalized_score(source: string): any;

/**
 * Parse a DrumMark source string and return the AST as a JS object.
 */
export function parse(source: string): any;
