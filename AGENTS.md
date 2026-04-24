# AGENTS.md

## Rendering Rules

- All score rendering must be done by OSMD.
- Do not add custom HTML/CSS rendering that simulates score headers, titles, staves, or notation when OSMD cannot render a document.
- If OSMD cannot render a given input, fall back only to blank pages or empty preview states instead of custom score-like markup.
