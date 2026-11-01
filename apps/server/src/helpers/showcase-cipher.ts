import { SHOWCASE_GLYPHS, SHOWCASE_TEXT_MAX } from '@caesar/shared';
import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { getServerTokenSync } from '../db/queries/server';

// The login-page showcase (http/showcase.ts) shows what a server's chatter
// looks like without revealing any of it. Only the *shape* leaves the
// server: whitespace, punctuation and line breaks stay, every other
// grapheme (letters, digits, emoji) becomes a random half-width katakana.
// Glyphs are drawn from a stream seeded per message, independent of the
// character they replace, so the output carries no letter information
// (no substitution to frequency-analyse) and is stable across refreshes.

const GLYPHS = Array.from(SHOWCASE_GLYPHS);

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

// deterministic byte stream: sha256(seed:block) chained per 32 bytes
const createGlyphStream = (seed: string) => {
  let block = 0;
  let bytes = Buffer.alloc(0);
  let offset = 0;

  return () => {
    if (offset >= bytes.length) {
      bytes = crypto.createHash('sha256').update(`${seed}:${block++}`).digest();
      offset = 0;
    }

    return GLYPHS[bytes[offset++]! % GLYPHS.length]!;
  };
};

const BLOCK_END = /<\/(p|div|li|h[1-6]|blockquote|pre)>/gi;

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');

const htmlToPlainText = (html: string) =>
  decodeEntities(
    sanitizeHtml(html.replace(/<br\s*\/?>/gi, '\n').replace(BLOCK_END, '\n'), {
      allowedTags: [],
      allowedAttributes: {}
    })
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const KEEP = /^(\s+|\p{P})$/u;

const scrambleText = (plain: string, seed: string) => {
  const next = createGlyphStream(seed);
  const graphemes = Array.from(segmenter.segment(plain), (s) => s.segment);
  const cut = graphemes.length > SHOWCASE_TEXT_MAX;

  const out = graphemes
    .slice(0, SHOWCASE_TEXT_MAX)
    .map((g) => (KEEP.test(g) ? g : next()))
    .join('');

  return cut ? `${out}…` : out;
};

const REDACTED_MAX = 16;

// channel names: one solid block per grapheme (capped), drawn as a black
// bar on the login page; only a rough length leaves the server
const redactName = (name: string) =>
  '█'.repeat(
    Math.min(Array.from(segmenter.segment(name)).length, REDACTED_MAX)
  );

const hmac = (input: string) =>
  crypto
    .createHmac('sha256', getServerTokenSync())
    .update(input)
    .digest('hex')
    .slice(0, 16);

// opaque per-author id: stable on this server, not linkable to the account
const authorCode = (userId: number) => hmac(`showcase-author:${userId}`);

// opaque per-message id (React keys, per-message glyph seed)
const messageCode = (messageId: number) =>
  hmac(`showcase-message:${messageId}`);

// 3-6 glyphs from the code alone, so the real name's length doesn't leak
const aliasFromCode = (code: string) => {
  const next = createGlyphStream(`alias:${code}`);
  const length = 3 + (parseInt(code[0] ?? '0', 16) % 4);

  return Array.from({ length }, next).join('');
};

export {
  aliasFromCode,
  authorCode,
  htmlToPlainText,
  messageCode,
  redactName,
  SHOWCASE_GLYPHS,
  SHOWCASE_TEXT_MAX,
  scrambleText
};
