# Code-Complexity Audit — `VRAM-tray` (`vram-ram-status@local`)

Status: **PLAN ONLY** — no source files have been changed. This document records the
audit findings and the proposed implementation order for a future edit pass.

Baseline: `gjs -m tests/run-tests.js` → **329 passed, 0 failed** (verified before this audit).

---

## Overall assessment

The codebase is already well-layered: pure, headless-testable modules under `lib/`
(`model`, `settings`, `format`, `alerts`, `color`, `gpu/*`, `memory/ram`) with Shell-side
modules (`monitor`, `extension`, `notify`, `io`, `ui/*`) injecting their dependencies.
Complexity is generally low and localized. The findings below are **genuine
simplifications**, not line-shaving. Each is labeled by impact and whether it touches tests.

---

## A. Dead code (no production caller)

| # | Location | Finding | Tests affected |
|---|---|---|---|
| A1 | `lib/format.js:43` `defaultOptions(kind)` | Never called anywhere; also ignores its `kind` argument. Duplicates `normalizeOptions`'s fallback. | none |
| A2 | `lib/settings.js:143` `normalizeSelectedGpu` | Never called anywhere, and not even imported by `test-settings.js`. Fully dead. | none |
| A3 | `lib/format.js:114` `formatLabel` + `:100` `formatMetric` | Only referenced by each other and `test-format.js`. The live panel path uses `formatMetricParts` (per-part coloring); `extension.js`/`indicator.js` never use `formatLabel`. | test-format.js |
| A4 | `lib/model.js:120` `isUsable` | No production caller; format/menu re-implement the "usable" check inline. | test-model.js |
| A5 | `lib/alerts.js:89` `maxLevel` | No production caller; only `test-alerts.js`. | test-alerts.js |
| A6 | `lib/gpu/providers/amd.js:21` `parseVramCounters`, `:29` `readVram` | `readVram` is a thin path-builder; `parseVramCounters` is an identity wrapper over `parseByteCounters`. `amd.read()` (the real path) **does not reuse** them and re-implements the same logic. | test-amd.js |

**Recommendation:** Remove A1 and A2 outright (zero test impact). A3–A6 are
"test-only API surface" — they add a mental question ("is this load-bearing?") without
serving production. Recommend removing them *together with their now-orphaned test cases*;
the *valuable* behavior they exercise is already covered by other paths
(`formatMetricParts`, the provider `read()` tests, etc.). If you prefer to keep them as a
future-proofing contract, then at minimum wire them in (see A4 note in B7).

---

## B. Duplication that can be removed without behavior change

**B1 — `prefs.js` re-declares constants and a whole function from `lib/settings.js` (highest value).**
`prefs.js:14–59` re-declares `FORMATS`, `METRIC_ORDERS`, `UNIT_PLACEMENTS`, `COLOR_TARGETS`,
`PANEL_BOXES`, `REFRESH_INTERVALS`, and `prefs.js:294–308` re-implements
`normalizeRefreshInterval` verbatim. All already exist in `lib/settings.js` (which
`prefs.js` is allowed to import — it's pure JS). The `*_LABELS` maps are legitimately
prefs-only and stay.

→ Replace with a single import:
`import { FORMATS, METRIC_ORDERS, UNIT_PLACEMENTS, COLOR_TARGETS, PANEL_BOXES, REFRESH_INTERVALS, normalizeRefreshInterval } from './lib/settings.js';`
and delete the local copies. **No behavior change, no test change** (tests exercise
`settings.js`'s version).

**B2 — `extension.js` groups three settings-key arrays that all do the identical thing.**
`DISPLAY_KEYS` (20–30), `ALERT_KEYS` (33–45), `MENU_KEYS` (48–51) are all mapped (83–96)
to the *same* handler `() => this._monitor.refreshNow()`. The comments claim three
different behaviors ("re-render", "re-evaluate", "re-render") but the wiring is identical.
Collapse into one `REFRESH_KEYS` list (or keep at most two if you want the comments to
reflect a real future distinction). Simplifies both the arrays and the `enable()` wiring.

**B3 — `extension.js` RAM/VRAM twin blocks.**
`_logTransitions` (120–136) and `_processAlerts` (139–170) duplicate the same logic for
`ram`/`vram`. Table-drive them:

```js
for (const kind of ['ram', 'vram']) { ... }
```

with a small key map (`ram-alert-enabled`/`vram-alert-enabled`, etc.). Fewer copy-paste
twins, same behavior.

**B4 — `lib/gpu/counters.js:17` `parseByteCounters` re-implements byte validation already in `model.js`.**
`parseByteCounters` does trim → `/^\d+$/` → `Number` → `isValidByteCount` → range checks.
`model.sanitizeBytes` (77–89) already does trim → regex → `Number` → `isValidByteCount`
for a single value. Collapse to:

```js
export function parseByteCounters(usedText, totalText) {
    const used = sanitizeBytes(usedText);
    const total = sanitizeBytes(totalText);
    if (used === null || total === null || total <= 0 || used > total)
        return null;
    return { used, total };
}
```

Behavior is identical for string inputs (verified against every `test-counters.js` case).
**No test change.**

**B5 — `lib/monitor.js:262` `_collectGpus` repeats the `partial` literal 3× and field-copies into `Reading`.**
The `{usedBytes,totalBytes,memoryClass,status,errorCode}` shape is spelled out three times
(no-provider, provider-error, and each provider's return). Use the spread + two small
factories:

```js
const failed = (status, errorCode, memoryClass = MemoryClass.UNKNOWN) =>
    ({ usedBytes: null, totalBytes: null, memoryClass, status, errorCode });
// then:
new Reading({ kind: Kind.VRAM, ...partial, provider: device.vendor, deviceId: device.stableId, timestamp: now })
```

This removes the redundant explicit field-copy and centralizes the "unavailable/error"
shape. **No test change** (tests assert on the resulting `Reading`).

**B6 — provider `canHandle` triplication.**
`amd.js:13`, `intel.js:13`, `nvidia.js:12` are three identical `vendor === PROVIDER`
checks. Optional micro-DRY via a shared helper or a base `provider.js`, but this is low
value and arguably *less* readable than the current explicit per-provider form — flagging
only, not strongly recommending.

**B7 — `lib/format.js:68` uses the string literal `'ok'`.**
`reading.status !== 'ok'` should be `reading.status !== Status.OK`. `format.js` imports
`Kind` but not `Status`. Consistency + guards against enum drift. Also note this guard is
weaker than `isUsable` (doesn't reject `total === 0` / `used > total`), which is exactly
what A4's `isUsable` was for — see A4.


---

## C. Locally intricate but correct and well-tested (lower priority)

**C1 — `lib/settings.js:165` `normalizeThresholdPair`.**
The double guard (`if (w >= c)` … then a second `if (w >= c)`) is subtle. It is correct
and fully pinned by 5 test cases. Optional clarification (behavior-preserving): move the
second guard inside the first branch and drop the redundant
`Math.min(c - 1, LIMITS.percentMax - 1)` (since `c ≤ 100`, it is always just `c - 1`).
Recommend only if you want to touch it; it's not a real complexity risk.

**C2 — `ui/indicator.js` `_createMetric` / `_applyColorClasses` (170–251).**
This is the highest-complexity area of the UI layer: a `desc` record tracking six actor
fields plus double-buffered style-class bookkeeping for the (always-colored) marker vs.
the (movable) color target. This complexity is **justified** — it exists to reuse panel
actors across polls and support per-part coloring — and simplifying it would risk the
subtle rebuild-vs-in-place logic (`_layoutKey`) and the color-target move semantics.
Recommendation: **leave as-is**; the module is already decomposed into small
single-purpose methods.

---

## D. Test-side duplication (bonus, not production complexity)
`test-monitor.js`, `test-monitor-lifecycle.js`, `test-monitor-recovery.js` each re-declare
the identical `MEMINFO` string and `amdIo()` fixture (and variants). A small shared
`tests/fixtures.js` (or a `makeIo(...)` helper next to `harness.js`) would remove ~60 lines
of duplicated fixture setup without changing any assertion.

---

## Suggested implementation plan

1. **Safe, no-test changes** (do first, run suite to confirm 329 still green):
   - B1: import constants + `normalizeRefreshInterval` into `prefs.js`, delete local copies.
   - B4: rewrite `parseByteCounters` via `sanitizeBytes`.
   - B7: `format.js` use `Status.OK`.
2. **Dead code with no tests:** remove A1 (`defaultOptions`), A2 (`normalizeSelectedGpu`).
3. **extension.js cleanup:** B2 (collapse key arrays) + B3 (table-drive RAM/VRAM twins).
4. **monitor.js cleanup:** B5 (spread/factory in `_collectGpus`).
5. **Decision point:** A3–A6 test-only surface — remove with their tests, or wire in
   (e.g., make `format.js`/`menu.js` use `isUsable`). Recommended: remove for simplicity;
   this changes test files, so confirm preference first.
6. **(Optional)** test fixture consolidation (D) and C1 micro-clarification.
7. **Verify:** `gjs -m tests/run-tests.js` → expect all green (count may drop only if
   A3–A6 tests are removed), and `glib-compile-schemas --strict` + `./build.sh` still succeed.

