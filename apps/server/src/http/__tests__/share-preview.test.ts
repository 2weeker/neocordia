import type { TTempFile } from '@caesar/shared';
import { initTest, loginToken, uploadFile } from '@server/__tests__/helpers';
import { testsBaseUrl } from '@server/__tests__/setup';
import { updateSettings } from '@server/db/mutations/server';
import { getOrphanedFileIds } from '@server/db/queries/files';
import { getSettings } from '@server/db/queries/server';
import { INTERFACE_PATH } from '@server/helpers/paths';
import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, test } from 'vite-plus/test';

// same fixture as interface.test.ts: whichever file runs first writes it
const ensureIndexHtml = () => {
  const indexPath = path.join(INTERFACE_PATH, 'index.html');

  if (fs.existsSync(indexPath)) return;

  fs.mkdirSync(INTERFACE_PATH, { recursive: true });
  fs.writeFileSync(
    indexPath,
    `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
  <link rel="stylesheet" href="/assets/test.css">
</head>
<body>
  <h1>Test Interface</h1>
  <script type="module" src="/assets/test.js"></script>
</body>
</html>`
  );
};

const meta = (html: string, key: string) =>
  html.match(
    new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`)
  )?.[1];

const getPage = async (query = '') =>
  (await fetch(`${testsBaseUrl}/${query}`)).text();

const uploadImage = async (name: string, type = 'image/png') => {
  const token = await loginToken('testowner', 'password123');
  const res = await uploadFile(new File(['img'], name, { type }), token);

  return (await res.json()) as TTempFile;
};

describe('link previews', () => {
  beforeAll(ensureIndexHtml);

  test('index.html carries the server name and description', async () => {
    const html = await getPage();

    expect(html).toContain('<title>Test Server</title>');
    expect(meta(html, 'og:title')).toBe('Test Server');
    expect(meta(html, 'og:description')).toBe('Test server description');
    expect(meta(html, 'twitter:card')).toBe('summary');
    // page still works: the script got its CSP nonce
    expect(html).toMatch(/<script nonce="[^"]+" type="module"/);
  });

  test('invite links get invite wording and never echo the code', async () => {
    const html = await getPage('?invite=SECRETCODE123');

    expect(meta(html, 'og:description')).toBe(
      'You&#39;ve been invited to join Test Server.'
    );
    expect(html).not.toContain('SECRETCODE123');
  });

  test('a new server name shows up on the next request', async () => {
    await getPage();
    await updateSettings({ name: 'Renamed Server' });

    expect(meta(await getPage(), 'og:title')).toBe('Renamed Server');
  });

  test('admins can set a share banner and it becomes the large image', async () => {
    const { caller } = await initTest(1);
    const tempFile = await uploadImage('banner.png');

    await caller.others.changeShareBanner({ fileId: tempFile.id });

    const banner = (await getSettings()).shareBanner;

    expect(banner?.originalName).toBe('banner.png');

    const html = await getPage();

    expect(meta(html, 'og:image')).toMatch(
      new RegExp(`/public/${banner!.name}$`)
    );
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  test('the share banner is public: crawlers cannot sign in', async () => {
    const { caller } = await initTest(1);
    const tempFile = await uploadImage('banner.png');

    await caller.others.changeShareBanner({ fileId: tempFile.id });

    const banner = (await getSettings()).shareBanner!;
    const res = await fetch(
      `${testsBaseUrl}/public/${encodeURIComponent(banner.name)}`
    );

    expect(res.status).toBe(200);
  });

  test('replacing or removing the banner deletes the old file', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeShareBanner({
      fileId: (await uploadImage('first.png')).id
    });
    const first = (await getSettings()).shareBanner!;

    await caller.others.changeShareBanner({
      fileId: (await uploadImage('second.png')).id
    });

    expect((await getSettings()).shareBanner?.originalName).toBe('second.png');
    expect(
      (await fetch(`${testsBaseUrl}/public/${encodeURIComponent(first.name)}`))
        .status
    ).toBe(404);

    await caller.others.changeShareBanner({});

    expect((await getSettings()).shareBanner).toBeNull();
  });

  test('only images can be share banners', async () => {
    const { caller } = await initTest(1);
    const tempFile = await uploadImage('notes.txt', 'text/plain');

    await expect(
      caller.others.changeShareBanner({ fileId: tempFile.id })
    ).rejects.toThrow('Invalid file type');
  });

  test('non-admins cannot change the share banner', async () => {
    const { caller } = await initTest(2);

    await expect(caller.others.changeShareBanner({})).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('the file cleanup keeps the share banner', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeShareBanner({
      fileId: (await uploadImage('banner.png')).id
    });

    const banner = (await getSettings()).shareBanner!;

    expect(await getOrphanedFileIds()).not.toContain(banner.id);
  });
});
