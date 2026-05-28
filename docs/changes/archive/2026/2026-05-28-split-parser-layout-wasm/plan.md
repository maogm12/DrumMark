# Split Parser and Layout WASM

## Status

completed

## Problem

A single WASM bundle and shared wrapper obscured parser vs layout boundaries, inflated browser load, and made CLI/browser initialization paths harder to reason about.

## Goal

Separate parser and layout WASM packages with enforced import boundaries, explicit source revision through render, layout engine as default, and remaining parity/audit tasks completed.

## Non-goals

- Re-opening completed system-box pagination work (archived under `RENDER_LAYOUT_CONTRACT_*`).

## Current Plan

Implementation completed on branch `proposal/split-parser-layout-wasm` and merged to main. All 12 tasks (Revised Tasks v2 + v3 delta) are Done. Verification passed via `npm run verify:split-wasm` on 2026-05-18.

## Spec Delta

N/A

## Affected Specs / Contracts

- N/A (no public behavior changes to specs or contracts)

## Tasks

### Task 0: Consolidate Approved Proposal After Human Stamp

Status: Done

### Task 1: Define Split WASM Build Topology

Status: Done

### Task 2: Add Explicit Browser and Node WASM Wrappers

Status: Done

### Task 3: Build Static Import Scanner Harness

Status: Done

### Task 4: Carry Source Revision Through Parsed Score State

Status: Done

### Task 5: Make Layout Engine the Default with Settings Migration

Status: Done

### Task 6: Move Shared Render Options Out of VexFlow Modules

Status: Done

### Task 7: Convert Layout SVG Rendering to Explicit Source Input

Status: Done

### Task 8: Enforce Production Import Boundaries

Status: Done

### Task 9: Add Parser/Layout Semantic Parity Corpus

Status: Done

### Task 10: Add Browser Network and Transfer Audit

Status: Done

### Task 11: Consolidate Verification and Build Gates

Status: Done

### Task 12: Archive Proposal Artifacts After Merge

Status: Done

## Test Plan

- `npm run verify:split-wasm` — full verification gate (build, import boundaries, wrappers, settings migration, source revision, SVG adapter, parity, CLI, network audit)
- `npm run drummark -- <fixture> --format svg`
- `npm run wasm:build`

## Risks / Notes

- Do not regress split packages: `parser-pkg-*`, `layout-pkg-*`, `parser_wasm_*`, `layout_wasm_*`.
- VexFlow comparison tasks in archived proposal are superseded by remove-vexflow work.

## Linked Items

- Legacy proposal: `docs/archived/ARCHITECTURE_proposal_split_parser_layout_wasm.md`
- Legacy tasks: `docs/archived/ARCHITECTURE_tasks_split_parser_layout_wasm.md`

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-05-28 | Migrated from `docs/proposals/`; status `implementing` reflects partial completion |
| 2 | 2026-05-28 | Synced task statuses from archived tasks ledger; all 12 tasks Done; status → `completed` |
