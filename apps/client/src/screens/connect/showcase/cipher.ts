import { SHOWCASE_GLYPHS } from '@caesar/shared';

// Presentation helpers for the login-page showcase. The server already
// scrambled everything; these only decorate what arrived.

const GLYPHS = Array.from(SHOWCASE_GLYPHS);
const GLYPH_SET = new Set(GLYPHS);

type TCipherAvatar = { hue: number; cells: boolean[][] };

// 5x5 mirrored pattern + hue from the opaque 16-hex author code: the same
// author always looks the same, and the code itself is all it encodes.
export const cipherAvatar = (code: string): TCipherAvatar => {
    const hue = parseInt(code.slice(0, 3), 16) % 360;
    const bits = BigInt(`0x${code.slice(3) || '0'}`);

    const cells = Array.from({ length: 5 }, (_, row) => {
        const half = Array.from(
            { length: 3 },
            (_, col) => ((bits >> BigInt(row * 3 + col)) & 1n) === 1n
        );

        return [half[0], half[1], half[2], half[1], half[0]];
    });

    return { hue, cells };
};

// re-roll up to `count` glyph positions; whitespace/punctuation stay put
export const flicker = (
    text: string,
    count: number,
    random: () => number
): string => {
    const chars = Array.from(text);
    const positions = chars.flatMap((c, i) => (GLYPH_SET.has(c) ? [i] : []));

    if (positions.length === 0) return text;

    for (let k = 0; k < count; k++) {
        const pos = positions[Math.floor(random() * positions.length)];

        chars[pos] = GLYPHS[Math.floor(random() * GLYPHS.length)]!;
    }

    return chars.join('');
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const relativeTime = (createdAt: number, now: number): string => {
    const diff = Math.max(0, now - createdAt);

    if (diff < MINUTE) return 'now';
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;

    return `${Math.floor(diff / DAY)}d`;
};
