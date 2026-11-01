import {
  renderShareMeta,
  type TShareSettings
} from '@server/helpers/share-meta';
import { describe, expect, test } from 'vite-plus/test';

const HTML = `<!doctype html>
<html>
<head>
  <title>Neocordia</title>
</head>
<body></body>
</html>`;

const ORIGIN = 'https://chat.example.com';

const file = (name: string) => ({ name });

const base: TShareSettings = {
  name: 'Night Owls',
  description: 'A cozy server for people awake at 3am.',
  logo: null,
  shareBanner: null
};

const render = (
  settings: Partial<TShareSettings> = {},
  opts: { invite?: boolean } = {}
) =>
  renderShareMeta(
    HTML,
    { ...base, ...settings },
    {
      origin: ORIGIN,
      invite: opts.invite ?? false
    }
  );

const meta = (html: string, key: string) =>
  html.match(
    new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`)
  )?.[1];

describe('renderShareMeta', () => {
  test('uses the server name as page title and og:title', () => {
    const html = render();

    expect(html).toContain('<title>Night Owls</title>');
    expect(html).not.toContain('<title>Neocordia</title>');
    expect(meta(html, 'og:title')).toBe('Night Owls');
    expect(meta(html, 'twitter:title')).toBe('Night Owls');
    expect(meta(html, 'og:site_name')).toBe('Night Owls');
  });

  test('uses the server description', () => {
    const html = render();

    expect(meta(html, 'og:description')).toBe(
      'A cozy server for people awake at 3am.'
    );
    expect(meta(html, 'description')).toBe(
      'A cozy server for people awake at 3am.'
    );
    expect(meta(html, 'twitter:description')).toBe(
      'A cozy server for people awake at 3am.'
    );
  });

  test('falls back to a join line without a description', () => {
    expect(meta(render({ description: '' }), 'og:description')).toBe(
      'Join Night Owls on Neocordia.'
    );
  });

  test('invite links get invite wording', () => {
    // apostrophe HTML-escaped inside the attribute; crawlers decode it
    expect(meta(render({}, { invite: true }), 'og:description')).toBe(
      'You&#39;ve been invited to join Night Owls.'
    );
  });

  test('share banner wins and gets a large card', () => {
    const html = render({
      logo: file('logo-file.png'),
      shareBanner: file('banner-file.png')
    });

    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/public/banner-file.png`);
    expect(meta(html, 'twitter:image')).toBe(
      `${ORIGIN}/public/banner-file.png`
    );
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  test('the logo is used without a banner, still as a large card', () => {
    const html = render({ logo: file('logo-file.png') });

    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/public/logo-file.png`);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  test('the default logo gets a small card', () => {
    const html = render();

    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/logo.png`);
    expect(meta(html, 'twitter:card')).toBe('summary');
  });

  test('file names are URL-encoded', () => {
    expect(meta(render({ logo: file('my logo.png') }), 'og:image')).toBe(
      `${ORIGIN}/public/my%20logo.png`
    );
  });

  test('sets og:url, og:type and theme-color', () => {
    const html = render();

    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/`);
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'theme-color')).toBe('#171717');
  });

  test('escapes admin-entered text', () => {
    const html = render({
      name: '"><script>alert(1)</script>',
      description: `Tom & Jerry's <b>place</b>`
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain(
      '<title>&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>'
    );
    expect(meta(html, 'og:description')).toBe(
      'Tom &amp; Jerry&#39;s &lt;b&gt;place&lt;/b&gt;'
    );
  });

  test('tags land inside <head>', () => {
    const html = render();
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

    expect(head).toContain('og:title');
  });
});
