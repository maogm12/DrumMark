# Drum Notation App Tasks

## Phase 0: Project Setup

- [x] Write DSL design document
- [ ] Initialize git repository
- [ ] Add initial project scaffold
- [ ] Choose frontend stack and package manager

## Phase 1: DSL Core

- [ ] Define tokenizer output types
- [ ] Implement line preprocessing
- [ ] Implement comment stripping
- [ ] Implement header parsing (`tempo`, `time`, `divisions`)
- [ ] Implement paragraph splitting by blank lines
- [ ] Implement track line parsing
- [ ] Implement base token parsing
- [ ] Implement modifier parsing
- [ ] Implement `o` sugar for `HH`
- [ ] Implement group parsing (`[n/m: ...]`)
- [ ] Implement repeat parsing (`|:`, `:|`, `:|xN`)
- [ ] Build AST types
- [ ] Build normalized event model

## Phase 2: Validation

- [ ] Validate known headers
- [ ] Validate known track names
- [ ] Validate per-track token legality
- [ ] Validate modifier legality
- [ ] Validate group arity
- [ ] Validate measure slot totals against `divisions`
- [ ] Validate paragraph measure-count consistency
- [ ] Validate repeat boundary consistency across tracks
- [ ] Collect structured errors and warnings with line/column info

## Phase 3: Grid Preview

- [ ] Render paragraphs as preview rows
- [ ] Render measures with clear boundaries
- [ ] Render groups spanning multiple slots
- [ ] Render modifiers visually
- [ ] Render repeat boundaries
- [ ] Render `ST` sticking row
- [ ] Highlight parse errors in preview

## Phase 4: MusicXML Export

- [ ] Map tracks to percussion instruments
- [ ] Convert normalized events into MusicXML measures
- [ ] Export tuplets from group syntax
- [ ] Export repeats where possible
- [ ] Degrade `:|xN` for `N > 2` by expansion if needed
- [ ] Export a single percussion part
- [ ] Verify import in MuseScore

## Phase 5: App UI

- [ ] Set up editor pane
- [ ] Set up preview pane
- [ ] Add error panel
- [ ] Add `Export MusicXML`
- [ ] Add `Export PDF`

## Immediate Next Tasks

1. Initialize git repository
2. Scaffold project structure
3. Implement parser types and preprocessing
