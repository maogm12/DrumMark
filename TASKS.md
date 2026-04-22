# Drum Notation App Tasks

## Phase 0: Project Setup

- [x] Write DSL design document
- [x] Initialize git repository
- [x] Add initial project scaffold
- [x] Choose frontend stack and package manager

## Phase 1: DSL Core

- [x] Define tokenizer output types
- [x] Implement line preprocessing
- [x] Implement comment stripping
- [x] Implement header parsing (`tempo`, `time`, `divisions`)
- [x] Implement `grouping` header parsing and validation
- [x] Implement paragraph splitting by blank lines
- [x] Implement track line parsing
- [x] Implement empty-measure rest shorthand (`| |`)
- [x] Implement base token parsing
- [x] Implement modifier parsing
- [x] Implement `o` sugar for `HH`
- [x] Implement `c` crash sugar for `HH`
- [x] Implement `DR` input sugar
- [x] Implement group parsing (`[n/m: ...]`)
- [x] Implement repeat parsing (`|:`, `:|`, `:|xN`)
- [x] Build AST types
- [x] Build normalized event model
- [ ] Align normalized event model documentation with v0 implementation

## Phase 2: Validation

- [x] Validate known headers
- [ ] Validate supported `time` beat units
- [x] Validate known track names
- [x] Validate per-track token legality
- [x] Validate modifier legality
- [ ] Validate `DR` rejects modifiers
- [x] Validate group arity
- [ ] Validate supported group ratios and stretched durations
- [ ] Reject groups requiring automatic tie splitting
- [ ] Reject group durations below 64th note
- [x] Validate measure slot totals against `divisions`
- [x] Validate `grouping` compatibility against `time` and `divisions`
- [x] Validate `DR` paragraph exclusivity with explicit drum tracks
- [x] Validate paragraph measure-count consistency
- [ ] Validate repeat counts are at least 2
- [x] Validate repeat boundary consistency across tracks
- [ ] Validate whitespace-equivalent measure syntax
- [x] Collect structured errors with line/column info

## Phase 3: Grid Preview

- [x] Render paragraphs as preview rows
- [x] Render measures with clear boundaries
- [x] Render groups spanning multiple slots
- [x] Render modifiers visually
- [x] Render repeat boundaries
- [x] Render `ST` sticking row
- [x] Highlight parse errors in preview

## Phase 4: MusicXML Export

- [x] Map tracks to percussion instruments
- [x] Convert normalized events into MusicXML measures
- [x] Export tuplets from group syntax
- [x] Export repeats where possible
- [x] Degrade `:|xN` for `N > 2` by expansion if needed
- [x] Export a single percussion part
- [x] Keep default beaming within `grouping` boundaries
- [ ] Exclude `ST` sticking from MusicXML export
- [ ] Export supported modifiers with stable MusicXML semantics
- [ ] Verify import in MuseScore

## Phase 5: App UI

- [x] Set up editor pane
- [x] Set up preview pane
- [x] Add error panel
- [x] Add `Export MusicXML`
- [x] Add `Export PDF`
- [x] Add staff-style preview tab

## Immediate Next Tasks

1. Validate supported `time` beat units
2. Validate repeat counts are at least 2
3. Validate supported group ratios and stretched durations
4. Reject groups requiring automatic tie splitting
5. Reject group durations below 64th note
6. Export supported modifiers with stable MusicXML semantics
7. Exclude `ST` sticking from MusicXML export
8. Validate `DR` rejects modifiers
9. Validate whitespace-equivalent measure syntax
10. Align normalized event model documentation with v0 implementation
11. Verify import in MuseScore
