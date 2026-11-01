import { SHOWCASE_GLYPHS } from '@caesar/shared';
import { describe, expect, test } from 'vite-plus/test';
import { cipherAvatar, flicker, relativeTime } from '../cipher';

const glyphs = new Set(Array.from(SHOWCASE_GLYPHS));

// deterministic stand-in for Math.random
const sequence = (...values: number[]) => {
    let i = 0;

    return () => values[i++ % values.length];
};

describe('cipherAvatar', () => {
    test('is the same for the same code', () => {
        expect(cipherAvatar('0123456789abcdef')).toEqual(
            cipherAvatar('0123456789abcdef')
        );
    });

    test('differs between codes', () => {
        expect(cipherAvatar('0123456789abcdef')).not.toEqual(
            cipherAvatar('fedcba9876543210')
        );
    });

    test('is a 5x5 grid mirrored left to right', () => {
        const { cells } = cipherAvatar('a1b2c3d4e5f60718');

        expect(cells).toHaveLength(5);

        for (const row of cells) {
            expect(row).toHaveLength(5);
            expect(row[0]).toBe(row[4]);
            expect(row[1]).toBe(row[3]);
        }
    });

    test('hue is a valid degree value', () => {
        const { hue } = cipherAvatar('ffffffffffffffff');

        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
    });
});

describe('flicker', () => {
    const text = 'ｱｲｳ, ｴｵ?\nｶｷ';

    test('keeps length, whitespace and punctuation', () => {
        const out = flicker(text, 5, Math.random);
        const before = Array.from(text);
        const after = Array.from(out);

        expect(after).toHaveLength(before.length);

        before.forEach((c, i) => {
            if (!glyphs.has(c)) expect(after[i]).toBe(c);
        });
    });

    test('changes at most `count` glyphs, only into glyphs', () => {
        const out = Array.from(flicker(text, 2, Math.random));
        const before = Array.from(text);
        const changed = out.filter((c, i) => c !== before[i]);

        expect(changed.length).toBeLessThanOrEqual(2);
        expect(changed.every((c) => glyphs.has(c))).toBe(true);
    });

    test('re-rolls the picked positions', () => {
        // pick position 0, then the last glyph of the set
        expect(Array.from(flicker('ｱｲｳ', 1, sequence(0, 0.999)))[0]).toBe(
            Array.from(SHOWCASE_GLYPHS).at(-1)
        );
    });

    test('leaves text without glyphs untouched', () => {
        expect(flicker('?! ...', 3, Math.random)).toBe('?! ...');
    });
});

describe('relativeTime', () => {
    const now = 10 * 24 * 60 * 60_000;

    test.each([
        [now - 30_000, 'now'],
        [now - 3 * 60_000, '3m'],
        [now - 2 * 60 * 60_000, '2h'],
        [now - 5 * 24 * 60 * 60_000, '5d']
    ])('%i -> %s', (createdAt, expected) => {
        expect(relativeTime(createdAt, now)).toBe(expected);
    });
});
