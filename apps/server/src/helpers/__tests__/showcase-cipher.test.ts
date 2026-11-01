import {
  aliasFromCode,
  authorCode,
  htmlToPlainText,
  redactName,
  SHOWCASE_GLYPHS,
  SHOWCASE_TEXT_MAX,
  scrambleText
} from '@server/helpers/showcase-cipher';
import { describe, expect, test } from 'vite-plus/test';

const glyphSet = new Set(Array.from(SHOWCASE_GLYPHS));

const onlyGlyphsAnd = (text: string, allowed: string) =>
  Array.from(text).every((c) => glyphSet.has(c) || allowed.includes(c));

describe('htmlToPlainText', () => {
  test('strips tags and keeps paragraph and line breaks', () => {
    expect(
      htmlToPlainText('<p>hello <strong>there</strong></p><p>a<br>b</p>')
    ).toBe('hello there\na\nb');
  });

  test('keeps mention text and decodes entities', () => {
    expect(
      htmlToPlainText(
        '<p><span data-type="mention" data-user-id="2">@Test User</span> &amp; &lt;3</p>'
      )
    ).toBe('@Test User & <3');
  });

  test('collapses runs of blank lines and trims', () => {
    expect(
      htmlToPlainText('<p></p><p></p><p>x</p><p></p><p></p><p>y</p>')
    ).toBe('x\n\ny');
  });
});

describe('scrambleText', () => {
  test('replaces every letter, digit and emoji with a glyph', () => {
    const out = scrambleText('hey 42 🎉', 'seed');

    expect(onlyGlyphsAnd(out, ' ')).toBe(true);
    expect(out).not.toMatch(/[a-z0-9]/i);
    expect(out).not.toContain('🎉');
  });

  test('keeps whitespace, punctuation and line breaks in place', () => {
    const out = scrambleText('hey, you?\nok!', 'seed');

    expect(out[3]).toBe(',');
    expect(out[4]).toBe(' ');
    expect(out[8]).toBe('?');
    expect(out[9]).toBe('\n');
    expect(out.at(-1)).toBe('!');
    expect(Array.from(out)).toHaveLength(Array.from('hey, you?\nok!').length);
  });

  test('output depends only on the shape, never on the letters', () => {
    expect(scrambleText('hello world', 'seed')).toBe(
      scrambleText('xqzzv abcde', 'seed')
    );
  });

  test('is stable for a seed and varies across seeds', () => {
    expect(scrambleText('same text here', 'a')).toBe(
      scrambleText('same text here', 'a')
    );
    expect(scrambleText('same text here', 'a')).not.toBe(
      scrambleText('same text here', 'b')
    );
  });

  test('a multi-codepoint emoji becomes one glyph', () => {
    expect(Array.from(scrambleText('👨‍👩‍👧', 'seed'))).toHaveLength(1);
  });

  test('caps long text and marks the cut', () => {
    const out = scrambleText('a'.repeat(SHOWCASE_TEXT_MAX + 50), 'seed');

    expect(Array.from(out)).toHaveLength(SHOWCASE_TEXT_MAX + 1);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('authorCode', () => {
  test('is stable per user and differs between users', () => {
    expect(authorCode(1)).toBe(authorCode(1));
    expect(authorCode(1)).not.toBe(authorCode(2));
  });

  test('does not contain the user id in the clear', () => {
    expect(authorCode(12345)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('aliasFromCode', () => {
  test('is 3 to 6 glyphs, stable per code', () => {
    for (const userId of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const code = authorCode(userId);
      const alias = aliasFromCode(code);

      expect(alias).toBe(aliasFromCode(code));
      expect(onlyGlyphsAnd(alias, '')).toBe(true);
      expect(Array.from(alias).length).toBeGreaterThanOrEqual(3);
      expect(Array.from(alias).length).toBeLessThanOrEqual(6);
    }
  });
});

describe('redactName', () => {
  test('one block per character', () => {
    expect(redactName('general')).toBe('███████');
  });

  test('counts an emoji as one character', () => {
    expect(redactName('memes 🐸')).toBe('████████'.slice(0, 7));
  });

  test('caps very long names', () => {
    expect(redactName('x'.repeat(100))).toBe('█'.repeat(16));
  });
});
