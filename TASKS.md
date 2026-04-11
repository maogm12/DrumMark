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
- [x] Implement paragraph splitting by blank lines
- [x] Implement track line parsing
- [x] Implement base token parsing
- [x] Implement modifier parsing
- [x] Implement `o` sugar for `HH`
- [x] Implement group parsing (`[n/m: ...]`)
- [x] Implement repeat parsing (`|:`, `:|`, `:|xN`)
- [x] Build AST types
- [x] Build normalized event model

## Phase 2: Validation

- [ ] Validate known headers
- [ ] Validate known track names
- [x] Validate per-track token legality
- [x] Validate modifier legality
- [x] Validate group arity
- [x] Validate measure slot totals against `divisions`
- [x] Validate paragraph measure-count consistency
- [x] Validate repeat boundary consistency across tracks
- [ ] Collect structured errors and warnings with line/column info

## Phase 3: Grid Preview

- [x] Render paragraphs as preview rows
- [x] Render measures with clear boundaries
- [x] Render groups spanning multiple slots
- [ ] Render modifiers visually
- [ ] Render repeat boundaries
- [x] Render `ST` sticking row
- [x] Highlight parse errors in preview

## Phase 4: MusicXML Export

- [ ] Map tracks to percussion instruments
- [ ] Convert normalized events into MusicXML measures
- [ ] Export tuplets from group syntax
- [ ] Export repeats where possible
- [ ] Degrade `:|xN` for `N > 2` by expansion if needed
- [ ] Export a single percussion part
- [ ] Verify import in MuseScore

## Phase 5: App UI

- [x] Set up editor pane
- [x] Set up preview pane
- [x] Add error panel
- [ ] Add `Export MusicXML`
- [ ] Add `Export PDF`
- [x] Add staff-style preview tab

## Immediate Next Tasks

1. Add `Export MusicXML`
2. Improve staff repeat/modifier rendering fidelity
3. Add `Export PDF`
