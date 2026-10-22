# Phase 6 — Performance Review

## Sampling frequency

- Default refresh interval: **10 s** (schema `refresh-interval`, default 10).
- Supported intervals: 1/2/5/10/15/30/60 s.
- At audit time the live session was set to **60 s** (user-modified), so the
  default 10 s was not the running baseline.

## Measurements (real, this host)

| Measurement | Value | Method |
| --- | --- | --- |
| Per-file read cost (`/proc` + `/sys`) | **~19 µs/file** | `gjs` micro-benchmark, 2000 iterations of `GLib.file_get_contents` |
| Typical per-poll read set | 2–4 files | `/proc/meminfo` + 1–2 VRAM counters (AMD); +`vendor`/`uevent` only on 30 s discovery revalidation |
| Estimated per-poll CPU | ~40–80 µs | derived from the above |
| CPU at 10 s interval | < 0.001% of one core | 80 µs / 10 s |
| CPU at 1 s interval (worst case) | < 0.01% of one core | 80 µs / 1 s |
| gnome-shell process RSS | ~395 MB | whole Shell (not attributable to this extension) |

## Static observations (distinguished from measurements)

- **No per-poll UI reconstruction:** the panel updates actors in place and only
  rebuilds when the layout key changes (`Indicator._layoutKey`); the dropdown is
  rebuilt lazily only while open (`Menu.update`/`_render`). No actor churn per
  poll.
- **No unnecessary GPU rediscovery:** discovery is cached and revalidated at
  most every 30 s (`DISCOVERY_REVALIDATE_MS`), or immediately only when the
  selected device is missing from the cache.
- **No unnecessary filesystem scans:** discovery lists `/sys/class/drm` once per
  revalidation (≤ every 30 s), not per poll; card-node filtering is cheap.
- **No logging spam:** failures/recoveries are logged once per transition
  (`_logFailure`/`_logRecovery`, `_logTransitions`); no per-poll logging.
- **No excessive allocations:** format strings and `Reading` objects are small
  and per-poll; the 30 s discovery objects are bounded by the number of GPUs.
- **Synchronous blocking:** reads are synchronous but of tiny, always-local
  pseudo-files (measured ~19 µs each). This is not a practical blocker at the
  supported intervals.

## Conclusion

Performance is a non-issue at the default 10 s interval. No additional
complexity (e.g. async I/O) is warranted — it would add lifecycle/coordination
code without a demonstrated benefit given the measured read cost.
