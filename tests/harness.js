// tests/harness.js — minimal assertion helpers for headless GJS tests.
//
// Kept free of Shell/GTK/Adwaita imports. Run the whole suite with:
//   gjs -m tests/run-tests.js

export function runSuite(name, fn) {
    let passed = 0;
    let failed = 0;

    const ok = (cond, msg) => {
        if (cond) {
            passed++;
            console.log(`ok - ${msg}`);
        } else {
            failed++;
            console.error(`FAIL - ${msg}`);
        }
    };

    const eq = (actual, expected, msg) => {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        ok(a === e, `${msg} (got ${a}, want ${e})`);
    };

    console.log(`# ${name}`);
    fn({ ok, eq });
    return { passed, failed };
}
