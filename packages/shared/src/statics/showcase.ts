// Login-page showcase glyphs: half-width katakana ｦ + ｱ..ﾝ. The server
// scrambles messages into these; the client's flicker re-rolls them.
export const SHOWCASE_GLYPHS = String.fromCharCode(
  0xff66,
  ...Array.from({ length: 0xff9d - 0xff71 + 1 }, (_, i) => 0xff71 + i)
);

export const SHOWCASE_TEXT_MAX = 280;
