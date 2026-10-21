// tests/test-model.js — normalized Reading contract and byte validation.

import {
    isValidByteCount,
    sanitizeBytes,
    percentUsed,
    isUsable,
    Reading,
    Status,
    Kind,
} from '../vram-ram-status@local/lib/model.js';

export function run(t) {
    const { eq } = t;

    // isValidByteCount
    eq(isValidByteCount(0), true, 'zero is a valid byte count');
    eq(isValidByteCount(1024), true, 'positive integer is valid');
    eq(isValidByteCount(-1), false, 'negative is invalid');
    eq(isValidByteCount(1.5), false, 'fraction is invalid');
    eq(isValidByteCount(NaN), false, 'NaN is invalid');
    eq(isValidByteCount(Infinity), false, 'Infinity is invalid');
    eq(isValidByteCount(Number.MAX_SAFE_INTEGER + 1), false, 'beyond safe integer is invalid');

    // sanitizeBytes
    eq(sanitizeBytes('1024'), 1024, 'coerces an integer string');
    eq(sanitizeBytes('12.5'), null, 'rejects a fractional string');
    eq(sanitizeBytes(null), null, 'null stays null');
    eq(sanitizeBytes(undefined), null, 'undefined stays null');

    // percentUsed
    eq(percentUsed(50, 100), 50, 'half is 50%');
    eq(percentUsed(0, 100), 0, 'zero used is 0%');
    eq(percentUsed(101, 100), null, 'used > total is rejected');
    eq(percentUsed(50, 0), null, 'zero total is rejected');
    eq(percentUsed(null, 100), null, 'missing used is rejected');

    // isUsable
    eq(isUsable(new Reading({ kind: Kind.RAM, usedBytes: 50, totalBytes: 100, status: Status.OK })), true, 'usable reading');
    eq(isUsable(new Reading({ kind: Kind.RAM, usedBytes: null, totalBytes: 100, status: Status.OK })), false, 'missing used is not usable');
    eq(isUsable(new Reading({ kind: Kind.RAM, usedBytes: 50, totalBytes: 100, status: Status.ERROR })), false, 'error status is not usable');
    eq(isUsable(null), false, 'null is not usable');
}
