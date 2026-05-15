# CSS Cleanup Analysis

Analysis-only pass over `src/styles/*.css` (19 files, ~7,500 lines). No edits made.

Findings grouped by category. Each item is a concrete, reviewable change you can accept or reject independently — start with the categories you trust most.

**Categories**

1. [Dead selectors](#1-dead-selectors) — safest, most mechanical
2. [Token mismatches & magic numbers](#2-token-mismatches--magic-numbers) — bug-class issues + drift
3. [Duplication / shared patterns](#3-duplication--shared-patterns) — promote to `tokens.css`
4. [Reorganization within files](#4-reorganization-within-files) — readability only
5. [Suggested order of operations](#5-suggested-order-of-operations)

---

## 1. Dead selectors

CSS classes defined but **not referenced in any `.jsx` / `.js` source**. Verified by:
- Extracting every `.classname` selector from `src/styles/*.css`
- Cross-checking against every `className=` / template-literal / `clsx(...)` token in `src/**/*.jsx`
- Filtering known false positives: Bootstrap classes applied by React-Bootstrap (`btn-primary`, `modal-content`, etc.), reactflow library classes (`react-flow__*`), and dynamically composed names (e.g. `ide-tab-decoration-${kind}` covers `ide-tab-decoration-bids` … `-yml`; `sc-card-${type}` covers `sc-card-added/modified/removed`).

After filtering, **18 confirmed-dead selectors** remain, clustered into 4 vestigial features:

### 1a. Removed CWL fullscreen / split-pane UI — `cwlPreviewPanel.css`

| Selector | Line |
|---|---|
| `.cwl-code-fullscreen` | 123, 244, 253 |
| `.cwl-fullscreen-modal` (+ descendants) | 176, 180, 189, … |
| `.cwl-split-container` | 211 |
| `.cwl-split-pane` | 217 |
| `.cwl-split-pane-header` | 225 |
| `.cwl-split-pane-label` | 236 |

All references live in `cwlPreviewPanel.css` only — the JSX no longer renders a fullscreen modal or split view. Likely a casualty of the redesign's "CWL preview as IDE aux tab" model.

### 1b. Removed scatter toggle UI — `workflowItem.css`

| Selector | Line |
|---|---|
| `.scatter-switch` (+ descendants) | 126, 141, 147 |
| `.scatter-toggle-group` | 478 |
| `.scatter-toggle-row` | 484, 649 |
| `.scatter-help-text` | 492, 653 |

`grep` finds zero JSX references. The new param panel must handle scatter differently (probably as an inline param control rather than a toggle row).

### 1c. Pre-redesign layout shell — `background.css` + `ideLayout.css`

| Selector | File:Line | Notes |
|---|---|---|
| `.app-layout` | `background.css:33` | Replaced by `.ide-layout` |
| `.workflow-content` | `background.css:41` | Replaced by IDE center column |
| `.workflow-content-main` | `background.css:49` | Same |
| `.toolbar-row` | `background.css:82, 92` | Replaced by `.ide-utility-bar` / `TopBar` |
| `.ide-placeholder-label` | `ideLayout.css:826` | Verify — search returns 0 hits |
| `.menu-collapse-btn` | only in a comment at `ideLayout.css:133`; the rule itself is gone | Comment can be dropped |

### 1d. Stragglers

| Selector | Line | Notes |
|---|---|---|
| `.info-icon` | `edgeMappingModal.css:363` (compound `.io-item .info-icon`) | The `.io-item` exists, but `.info-icon` is never applied in JSX. Spot-check the React Icon library — may be using a different class name (e.g. lucide / react-icons usually render `<svg>` without that class). |
| `.node-notes-textarea` | `workflowItem.css:1270, 1281` | Notes feature may have moved to a Bootstrap `Form.Control` without this class |

**Suggested action:** Delete the 1a + 1b clusters with confidence. For 1c, the `background.css` entries are clearly vestigial — delete. For 1d, eyeball the React component once before deleting to make sure I'm not missing a dynamic className.

---

## 2. Token mismatches & magic numbers

### 2a. `var(--token, fallback)` fallbacks that don't match the token — **bug-class**

`tokens.css` defines the canonical color, but several `var(--…, #hex)` fallbacks in `ideLayout.css` and `workflowManagerPage.css` specify a **different** hex. If the token is ever unset (FOUC, custom-property failure, debugging override), the fallback would render a visually-different color than the design intends.

| Location | Token | Fallback | Actual token value |
|---|---|---|---|
| `ideLayout.css:327, 331, 338, 614, 655` | `--color-warning` | `#e2b340` | `#ffc107` |
| `ideLayout.css:610, 651` | `--color-danger` | `#dc3545` | `#e74c3c` |
| `ideLayout.css:659` | `--color-success` | `#28a745` | `#4caf50` |
| `workflowManagerPage.css:394` | `--bg-elevated` | `#252526` | `#181818` |
| `workflowManagerPage.css:331` | `--bg-input` | `#313131` | `#313131` ✓ (only correct one) |

**Recommended:** Drop the fallbacks entirely (`var(--color-warning)` instead of `var(--color-warning, #e2b340)`). The token is always defined at `:root` in `tokens.css`, so the fallback is dead code that's also misleading.

### 2b. Hardcoded hex colors that should reference tokens

| File:Line | Value | Suggested replacement |
|---|---|---|
| `toolParamPanel.css:598` | `color: #fff` | `var(--text-on-accent)` (`#ffffff`) |
| `workflowManagerPage.css:331,394` | bare hex in `var(--token, …)` fallback | drop fallback per 2a |

### 2c. Hardcoded hex colors with no existing token — promote to tokens?

| File:Line | Value | Purpose | Suggestion |
|---|---|---|---|
| `cwlPreviewPanel.css:139` | `#e0a050` | Accent for `.cwl-comment` (YAML syntax color) | One-off — fine as-is, or add `--syntax-comment` |
| `sidebarStagedChanges.css:142` | `#ffdc50` | Stage indicator gold | Add `--color-change-indicator`? |
| `sidebarStagedChanges.css:368, 418` | `#ef9a9a` | Soft danger (removed-line text) | Add `--color-danger-soft` |
| `sidebarStagedChanges.css:373, 423` | `#a5d6a7` | Soft success (added-line text) | Add `--color-success-soft` |
| `tagDropdown.css:133` | `#1a3a5c` | Selected dark blue | Add `--bg-selected-dark`? Or use `--bg-selected` (`#264f78`) |
| `tagDropdown.css:138` | `#1e4570` | Hover variant of above | Pair with above |

The diff-indicator (`#ef9a9a` / `#a5d6a7`) and syntax (`#e0a050`) colors are intentional one-offs — promote only the ones that recur (the diff pair appears 4× combined; worth a token).

### 2d. Token-family colors used with custom alphas

Several places use the literal RGB of a token (e.g. `rgba(168, 85, 247, …)` is `--color-purple`) with an alpha that doesn't match any existing `*-muted` / `*-border` variant:

| Color (raw) | Token family | Custom alphas seen | Notes |
|---|---|---|---|
| `rgba(168, 85, 247, …)` | `--color-purple` | `.08`, `.25`, `.6`, `.85` | tokens.css has muted `.15`, border `.4`, hover `1` |
| `rgba(255, 157, 86, …)` | `--color-custom` | `.6` | matched in topBar + sidebarStagedChanges |
| `rgba(255, 193, 7, …)` | `--color-warning` | `.04`, `.06`, `.6` | tokens.css has muted `.12`, border `.4` |
| `rgba(0, 120, 212, …)` | `--color-accent` | `.04`, `.5` | tokens.css has muted `.15`, border `.4` |
| `rgba(231, 76, 60, …)` | `--color-danger` | `.25`, `.5` | tokens.css has muted `.12`, border `.4` |

CSS doesn't yet let you alpha-blend a hex token without `color-mix()`. Two options:
- **Add explicit alpha variants** to tokens.css (e.g. `--color-purple-soft: rgba(168, 85, 247, 0.08)`) for the recurring ones.
- **Adopt `color-mix(in srgb, var(--color-purple) 8%, transparent)`** — modern, but requires baseline-browser check.

### 2e. Font-size drift — significant

`tokens.css` defines 8 sizes:
`--size-2xs/xs/sm/base/md/lg/xl/2xl` = `0.6875 / 0.75 / 0.8125 / 0.8125 / 0.875 / 1 / 1.125 / 1.5 rem`.

CSS files actually use **21+ distinct rem values**, most off-token:

| Value | Usage count | Closest token |
|---|---|---|
| `0.85rem` | 26 | `--size-sm` 0.8125 / `--size-md` 0.875 |
| `0.7rem` | 26 | `--size-2xs` 0.6875 |
| `0.8rem` | 21 | `--size-sm` 0.8125 |
| `0.75rem` | 21 | `--size-xs` ✓ |
| `0.72rem` | 21 | `--size-2xs` 0.6875 |
| `0.9rem` | 17 | `--size-md` 0.875 |
| `0.6rem`, `0.65rem` | 16, 16 | (below smallest token) |
| `0.78rem`, `0.95rem`, `0.68rem`, … | <15 each | various |

Only `0.75rem` and `1rem` regularly match tokens. The other values are tiny visual nudges (0.85 vs 0.875 is 13.6 vs 14px — sub-pixel at typical zoom). Pick one:
- **Snap to tokens** — replace every off-token rem with the nearest `--size-*`. Mechanical, slight visual drift (sub-px to 1px).
- **Expand the scale** — add tokens for the most-used off-token values (`--size-xs-tight: 0.7rem`, `--size-sm-loose: 0.85rem`).
- **Leave as-is** — accept that font-sizing is contextual and not worth tokenizing.

Snapping is the cleanest long-term, but worth checking 2-3 spot-cases visually first.

### 2f. Inconsistent media-query breakpoints

```
@media (max-width: 480px)
@media (max-width: 576px)   ← Bootstrap sm
@media (max-width: 600px)
@media (max-width: 700px)
@media (max-width: 768px)   ← Bootstrap md
@media (max-width: 900px)
```

Six different breakpoints across files. Pick 2-3 and stick to them, or add `--bp-*` custom properties / SCSS variables. Bootstrap's `576px` and `768px` cover most of this.

### 2g. Inset shadow not using `--shadow-inset-sm`

`workflowItem.css:560, 580` uses `inset 0 1px 2px rgba(0, 0, 0, 0.25)` instead of the `--shadow-inset-sm` token (which is `inset 0 1px 3px rgba(0, 0, 0, 0.25)` — only the blur radius differs, 2 vs 3px). Decide if these should match, then either replace with the token or document the intentional difference in a comment.

---

## 3. Duplication / shared patterns

Patterns repeated across files that could be promoted to `tokens.css` (or a new `utilities.css`). Sorted by impact.

### 3a. Button hover reset — 8 files, ~24 occurrences (HIGH)

`background.css:71-75` defines a global `button:hover { transform: scale(1.02); box-shadow: ... }`. Most icon buttons / tab close buttons / utility buttons explicitly opt out with:

```css
.some-btn:hover {
    transform: none;
    box-shadow: none;
}
```

Appears in: `ideLayout.css` (6×), `toolParamPanel.css` (3×), `bidsDataModal.css` (3×), `workflowMenu.css` (4×), `tagDropdown.css` (2×), `commandPalette.css` (1×), `workflowItem.css` (3×), `workflowMenuItem.css` (1×).

**Suggestion:** Add a `.btn-no-scale` utility OR — better — invert the global rule. Change `button:hover` to apply only to a `.btn-affordance` class, so the default is "no scale" and you opt **in** to the scale effect (matches actual usage frequency).

### 3b. Section header — uppercase mono small caps — 8 files (HIGH)

```css
font-family: var(--font-mono);
font-weight: 500/600;
font-size: 0.7-0.8rem;
text-transform: uppercase;
letter-spacing: 0.5px;
color: var(--text-muted);
```

Appears as: `.param-section-header`, `.tool-param-panel-toc-subheader`, `.output-config-group-header`, `.io-modal-label`, `.column-header`, `.sc-section-header`, and several more.

**Suggestion:** Add a `.section-header` class in `tokens.css`; each file overrides only its specific size and spacing.

### 3c. Form input "inset well" — 4 files (HIGH)

```css
background-color: var(--bg-inset);
border: 1px solid var(--border-subtle);
border-radius: var(--radius-md);
box-shadow: var(--shadow-inset-sm);
padding: 5-6px 10px;
```

`workflowItem.css` (`.param-text/-number/-select`, `.when-param-select`), `ioNodeModal.css` (`.io-modal-input/-textarea`), `bidsDataModal.css` (`.bids-search-input`, `.bids-output-label-input`, `.bids-filter-select`).

**Suggestion:** Promote to a `.input-well` base class. Each file keeps only font and width overrides.

### 3d. "Expand to tab" button — duplicated 2× identically (MEDIUM)

`.tool-param-panel-expand-btn` (`toolParamPanel.css:63-88`) and `.bids-data-panel-expand-btn` (`bidsDataModal.css:89-114`) are byte-for-byte identical aside from class name. Both render the same "↗ open in tab" affordance.

**Suggestion:** Single `.panel-expand-btn` class in `tokens.css`, applied in both JSX components.

### 3e. Empty state container — 5 files (MEDIUM)

`.command-palette-empty`, `.bids-empty-state`, `.wm-empty`, `.cwl-empty-message`, `.output-config-empty` — all share: centered text, italic, muted color, padding 20-60px.

**Suggestion:** `.empty-state` utility.

### 3f. Inline chip/badge — 4 files with drift (MEDIUM)

`.output-config-custom-badge`, `.tag-badge`, `.bids-datatype-chip`, `.sc-badge` — all small inline-flex with padding 1-3px × 6-8px, radius 3-8px. Mostly the same shape, varying paddings.

**Suggestion:** `.badge-inline` base with conservative defaults; per-file overrides for spacing.

### 3g. Scrollbar variants — 5 files (LOW-MEDIUM)

`background.css` defines globals (10px wide). `tagDropdown.css`, `sidebarStagedChanges.css` use thinner scrollbars (4-6px). `cwlPreviewPanel.css` hides horizontal scrollbar. Multiple inline `::-webkit-scrollbar*` re-definitions.

**Suggestion:** Keep the global from `background.css`, add `.scrollbar-thin` and `.scrollbar-hidden` modifiers in `tokens.css` (4px and hidden, respectively).

### 3h. Modal action button pair — 4 modal files (LOW-MEDIUM)

`.modal-footer` with `.btn-primary` + `.btn-secondary` and `gap: 8-10px` defined separately in `outputConfigModal.css`, `ioNodeModal.css`, `edgeMappingModal.css`, `bidsDataModal.css`. The shared modal chrome in `tokens.css:263-265` already handles gap for `.edge-mapping-modal, .custom-modal`; consider extending the `:is(...)` list, or adding a `.modal-action-row` utility.

---

## 4. Reorganization within files

Per-file structural review. Smaller files (<300 lines) are mostly fine; the recommendations focus on the 5 largest.

### Priority targets (largest first)

#### `workflowItem.css` — 1571 lines (CRITICAL)

Already has top-level `/* ===== SECTION ===== */` headers, but the "UNIFIED PARAMETER PANE" section (~lines 1-722) mixes:
- Param card chrome (54-68)
- Form control styling (124-280)
- Input states (219-232)
- Docker-specific rules (281-298)
- Then jumps abruptly to "SCATTER TOGGLE" at line 300

Suggestions:
- Add **sub-section headers** inside the parameter pane: "card chrome", "form controls", "states", "Docker", etc.
- Consider splitting the file into 3-4 sibling files (each imported by the same JSX entry):
  - `workflowItem.params.css` — `.param-*` core
  - `workflowItem.nodeVisuals.css` — node-specific badges, columns
  - `workflowItem.expressions.css` — expression / when / scatter (note: scatter rules are partly dead, see §1b)
- Media queries (lines ~596-718) are correctly grouped at the end — keep that pattern after the split.

#### `ideLayout.css` — 929 lines (HIGH)

Has section headers, but they're under-specific. The 70-line sidebar section (40-111) has **three** consecutive sub-headers all comment-tagged as "Sidebar". Resize handle rules are split into three non-contiguous chunks (lines 777-789, 831-855, 857-862).

Suggestions:
- Renumber sub-headers (e.g. `/* === Sidebar: container === */`, `/* === Sidebar: tabs === */`, `/* === Sidebar: collapse button === */`).
- Pull all `.ide-resize-handle*` rules to a single contiguous block.
- Group utility-bar internals (badges, problem list, I/O panel, log panel) under one parent header with explicit sub-heads.

#### `toolParamPanel.css` — 621 lines (HIGH)

Has a 23-line header comment that's useful for context, but the rest of the file has only **2 top-level section headers** for 600 lines of rules. The body section interleaves TOC rules with main-pane rules.

Suggestions:
- Add sub-sections: "TOC", "Main scroll", "Settings rows", "Row layout", "Sub-rows", "Footer".

#### `bidsDataModal.css` — 576 lines (MEDIUM-HIGH)

Has a 2-panel grid header at line 138, but the subject panel (146-250) and right panel (252-336+) lack internal sub-headers despite each containing 5+ logical sub-regions.

Suggestions:
- Sub-sections: "Subject panel: header", "Subject panel: search", "Subject panel: list", "Right panel: data type chips", "Right panel: output groups", "Right panel: path preview".

#### `workflowMenu.css` — 443 lines (MEDIUM)

Top-level section headers are good, but the "Section headers & hierarchy" block (17-183) covers 4 distinct concerns (top-level, nested, indentation, chevrons) under one umbrella comment.

Suggestions:
- Split the umbrella into 4 sub-headers.
- Group the per-kind accent rules (I/O green, Workflows purple, Custom Nodes tangerine) under one explicit "Section accents by kind" header.

### Files that are already well-organized

`tokens.css`, `tagDropdown.css`, `commandPalette.css`, `background.css`, `workflowCanvas.css`, `ioNodeModal.css`, `workflowMenuItem.css`, `statusBar.css`. No structural changes needed.

### Files with minor issues (low priority)

- `topBar.css` — search bar section could use sub-heads
- `workflowManagerPage.css` — table section is big enough to deserve "thead", "row", "cells" sub-heads
- `sidebarStagedChanges.css` — card/property sections could use clearer separation
- `outputConfigModal.css` — toolbar/badge/state rules could be sub-headed
- `edgeMappingModal.css` — SVG connection-line rules deserve their own sub-section header
- `cwlPreviewPanel.css` — after deleting the dead split-pane / fullscreen rules (§1a), the remaining file will be much smaller and clearer

---

## 5. Suggested order of operations

Roughly safest → most-judgment-required:

1. **Delete confirmed dead selectors (§1).** Mechanical, low risk. Removes ~120-150 lines. Spot-check `info-icon` and `node-notes-textarea` in JSX first.
2. **Fix wrong fallback hexes (§2a).** Drop the fallbacks entirely — they're misleading dead weight.
3. **Replace `#fff` with `var(--text-on-accent)` (§2b).** Trivial.
4. **Promote duplication patterns to tokens.css (§3a–3d).** Highest impact: `.btn-no-scale` (or inverting the global), `.section-header`, `.input-well`, `.panel-expand-btn`. Each is a discrete PR.
5. **Add reorg sub-section headers to the 5 large files (§4).** Comment-only diffs — purely additive readability.
6. **Decide on font-size strategy (§2e).** Pick one of snap-to-tokens / expand-scale / leave-alone, then act.
7. **Decide on alpha-color strategy (§2d).** Either add `*-soft` variants for the recurring ones, or migrate to `color-mix()`.
8. **(Optional, biggest change)** Split `workflowItem.css` into 3-4 component-scoped files.

Total estimated reduction if all 1-4 are applied: ~250-400 lines, plus a meaningful reduction in cross-file drift.

---

*Generated 2026-05-14 from analysis of `redesign` branch (HEAD: `ce9151e`).*
