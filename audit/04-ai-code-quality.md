# Phase 4 — AI-Generated Code Quality Review

Every JS module was inspected (not just the entry point). The codebase is
already the product of a prior "complexity audit + simplification pass"
(see commit history `bd9e974`/`0397e66` and the handover document), so it is in
good shape. This review focuses on what remains.

## Overall assessment

| Quality signal | Result |
| --- | --- |
| Modularization | Good — 20 JS files; largest is `lib/monitor.js` (320 lines) |
| Entry-point size | Good — `extension.js` is 199 lines; enable/disable adjacent |
| Timeout removal next to creation | Good — `Monitor._schedule()` calls `_clearTimeout()` immediately before re-arming |
| Schema-id discipline | Good — `settings-schema` in metadata; `this.getSettings()` used with no args |
| Unused imports | None found in production modules |
| Obfuscation / minification | None (ego-lint `quality/code-provenance: provenance-score=3`) |

## Findings

### Q1 — Dead code: unused exports in `lib/settings.js` (NOT kept-by-request)

- **File/function:** `normalizeMetricOrder`, `normalizeCooldown`,
  `normalizeHysteresis`, and the `GPU_SELECTIONS` constant.
- **Why unnecessary:** none is referenced by production code (verified by
  search — only `lib/settings.js` and `tests/test-settings.js` reference them).
  `metric-order` is compared inline (`=== 'ram-first'`); `alert-cooldown` and
  `alert-hysteresis` are read directly via `get_int()` and already bounded by
  the schema (`0..86400`, `0..50`); the GPU choices `['auto','all']` are
  re-listed inline in `prefs.js` instead of importing `GPU_SELECTIONS`.
- **Behavioral equivalence:** removing them (and their test cases) changes no
  runtime behavior — they are never called.
- **Regression risk:** none functionally; the corresponding `test-settings.js`
  cases become dead and should be removed too.
- **Tests needed:** run `gjs -m tests/run-tests.js` after removal to confirm
  the suite still passes.

### Q2 — Unused `kind` parameter in `lib/format.js` `normalizeOptions(kind, options)`

- **File/function:** `lib/format.js:34` `normalizeOptions(kind, options = {})`.
- **Why unnecessary:** `kind` is accepted but never used. The format default
  always falls back to `DEFAULTS.ramFormat`, which is also misleading for VRAM
  (though in practice every caller passes an explicit `format`).
- **Behavioral equivalence:** drop the parameter (or use `kind` to select the
  correct default); callers already pass an explicit `format`.
- **Regression risk:** none if the parameter is simply dropped (callers pass
  explicit options); low if defaults are made kind-aware.
- **Tests needed:** existing `test-format.js`; add a case if defaults become
  kind-aware.

### Q3 — `lib/gpu/selection.js` returns `mode`/`fallback` fields consumed only by tests

- **File/function:** `resolveSelection()` returns `{ mode, primary, devices,
  fallback }`; production (`monitor.js`) consumes only `primary` (and stores
  the whole object). `mode` and `fallback` are read only by tests.
- **Why unnecessary:** `mode`/`fallback` are observability-only. Keeping them
  is harmless and cheap (they document intent and support tests).
- **Recommendation:** leave as-is (they are part of the tested contract), or
  drop `mode`/`fallback` if minimalism is preferred.
- **Regression risk:** none if left; low if removed (must update
  `test-selection.js`).

### Q4 — Test-only helpers **kept by author request** (do NOT remove)

- **Files/functions:** `formatLabel` + `formatMetric` (`lib/format.js`),
  `isUsable` (`lib/model.js`), `maxLevel` (`lib/alerts.js`),
  `parseVramCounters` + `readVram` (`lib/gpu/providers/amd.js`).
- **Finding:** these are exported and unit-tested but not called by production
  code (`formatMetricParts` is the production formatter; `formatLabel`/
  `formatMetric` are its string-rendering convenience layer).
- **Disposition:** the handover document records that these were **kept with
  their tests by explicit request**. They are documented, tested, and harmless;
  the author should be aware they are test/documentation surface, not runtime
  surface. No action recommended.

**Note for maintainer:** keeping them is fine, but they should not be mistaken
for "the formatting API". The canonical runtime entry is `formatMetricParts()`.
This is documentation-level clarity only.

### Q5 — Leftover LLM-instruction placeholder comments

- **File/line:** `extension.js:122` `// ALERTS_INSERT`,
  `lib/monitor.js:241` `// REST_INSERT`, `prefs.js:173` `// PAGES_INSERT`.
- **Why unnecessary:** generation-scaffolding markers ("insert code here") that
  no longer correspond to any insertion task and can mislead a future reader.
- **Behavioral equivalence:** pure comments; removal changes nothing.
- **Regression risk:** none.
- **Tests needed:** none.

### Q6 — Duplicated version literal

- **File/line:** `prefs.js:21` `const VERSION = '2.0.0';` duplicates
  `metadata.json` `version-name` and `CHANGELOG.md`.
- **Why it matters:** a release bump now requires editing three places. Minor
  maintainability smell, common in small extensions; not a defect.
- **Recommendation (optional):** read the version from metadata at prefs build
  time (e.g. `this.metadata['version-name']`) or accept the duplication.
- **Regression risk:** none.

### Q7 — `parseVramCounters` trivial wrapper (context)

- **File/function:** `lib/gpu/providers/amd.js:21` `parseVramCounters()` is a
  one-line passthrough to `parseByteCounters()`.
- **Why it exists:** gives AMD tests a stable, vendor-scoped entry point; on the
  **kept-by-request** list. Redundant but harmless.
- **Disposition:** keep (requested); note that `read()` itself calls
  `parseByteCounters` directly, so `parseVramCounters`/`readVram` are test
  surface only.

### Q8 — `lib/color.js` `resolveColorClass` vs `resolveBarFill` duplication

- **File/function:** two functions re-encode the same "colors enabled + normal
  state" gating, returning a CSS class string vs an RGBA array respectively.
- **Assessment:** **not a defect** — the two return types serve different
  consumers (panel style class vs Cairo fill). Keeping them separate improves
  clarity; do not merge.
- **Regression risk:** N/A (no change recommended).

## Items deliberately NOT flagged (legitimate error handling)

The following defensive constructs are **retained** per the audit instruction
"do not remove legitimate error handling required for unreliable hardware
interfaces":

- `lib/io.js` `readText`/`listDir` returning `null`/`[]` on any error.
- `lib/model.js` `sanitizeBytes`/`percentUsed`/`isValidByteCount` strict
  validation (rejects negative, fractional, hex, out-of-range, `used > total`).
- `lib/monitor.js` per-stage `try/catch` in `_collectRam`, `_collectGpus`,
  `_revalidateDiscovery`, and `_collect` (degraded snapshot + transition-only
  logging).
- `lib/notify.js` swallowed D-Bus delivery errors (notification failure must
  never crash the Shell).
- `Monitor._inFlight` re-entrancy guard (defensible against re-entrant
  `refreshNow()` from within `onSnapshot`).

## Post-remediation

The following were applied and validated (`324 passed, 0 failed`; ego-lint
exit 0):

- Q1 — removed dead exports `normalizeMetricOrder`, `normalizeCooldown`,
  `normalizeHysteresis`, `GPU_SELECTIONS` (+ 4 now-unused `LIMITS` entries) and
  their test cases.
- Q2 — dropped the unused `kind` parameter from `normalizeOptions`.
- Q5 — removed the three `// *_INSERT` scaffold comments.
- Q6 — replaced the duplicated `VERSION` literal with
  `this.metadata['version-name']`.

Q7/Q4 (test-only helpers) and Q8 (color helpers) were left as-is, per the
"kept-by-request" note and the clarity rationale.

**Correction to Q7-adjacent finding F4:** the `Adw.ComboRow.selected` →
`selected-item` migration was not performed because `selected-item` is read-only
and `selected` is still the correct writable API (verified against libadwaita
1.9.4).

