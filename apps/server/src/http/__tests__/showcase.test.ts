import type { TShowcaseFeed } from '@caesar/shared';
import {
  channels,
  files,
  messageFiles,
  messages
} from '@caesar/shared/db/schema';
import { initTest } from '@server/__tests__/helpers';
import { tdb, testsBaseUrl } from '@server/__tests__/setup';
import { clearShowcaseCache } from '@server/db/queries/showcase';
import { SHOWCASE_GLYPHS } from '@server/helpers/showcase-cipher';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, test } from 'vite-plus/test';

// seed: channel 1 = General (text), users 1 "Test Owner", 2 "Test User"
const GENERAL_CHANNEL_ID = 1;

const glyphs = new Set(Array.from(SHOWCASE_GLYPHS));

const fetchRaw = () => fetch(`${testsBaseUrl}/showcase`);

const fetchFeed = async () => {
  const res = await fetchRaw();

  expect(res.status).toBe(200);

  return (await res.json()) as TShowcaseFeed;
};

const insertMessage = async (
  content: string,
  opts: { userId?: number; channelId?: number; createdAt?: number } = {}
) =>
  (
    await tdb
      .insert(messages)
      .values({
        channelId: opts.channelId ?? GENERAL_CHANNEL_ID,
        userId: opts.userId ?? 1,
        content,
        createdAt: opts.createdAt ?? Date.now()
      })
      .returning({ id: messages.id })
      .get()
  ).id;

const showcaseGeneral = async () => {
  const { caller } = await initTest(1);

  await caller.channels.update({
    channelId: GENERAL_CHANNEL_ID,
    showcase: true
  });

  return caller;
};

describe('/showcase', () => {
  beforeEach(async () => {
    clearShowcaseCache();
    await tdb
      .delete(messages)
      .where(eq(messages.channelId, GENERAL_CHANNEL_ID));
  });

  test('is empty when no channel is showcased', async () => {
    await insertMessage('<p>hello</p>');

    expect((await fetchFeed()).items).toEqual([]);
  });

  test('lists messages of showcased channels with the channel name blacked out', async () => {
    await showcaseGeneral();
    await insertMessage('<p>hello there</p>');

    const body = await (await fetchRaw()).text();
    const { items } = JSON.parse(body) as TShowcaseFeed;

    expect(items).toHaveLength(1);
    // one block per character of "General"
    expect(items[0]!.channel).toBe('█'.repeat('General'.length));
    expect(body).not.toContain('General');
  });

  test('never sends real text, names or ids', async () => {
    await showcaseGeneral();
    await insertMessage(
      '<p>supersecretphrase <span data-type="mention" data-user-id="2">@Test User</span></p>'
    );

    const body = await (await fetchRaw()).text();

    expect(body).not.toMatch(/supersecret|phrase/i);
    expect(body).not.toMatch(/Test Owner|testowner|Test User|testuser/i);
    expect(body).not.toContain('data-user-id');

    const { items } = JSON.parse(body) as TShowcaseFeed;
    const [item] = items;

    expect(Object.keys(item!).sort()).toEqual([
      'alias',
      'attachments',
      'authorCode',
      'channel',
      'createdAt',
      'key',
      'text'
    ]);
    expect(
      Array.from(item!.text).every((c) => glyphs.has(c) || ' @'.includes(c))
    ).toBe(true);
    expect(Array.from(item!.alias).every((c) => glyphs.has(c))).toBe(true);
  });

  test('the same author keeps one alias and code; authors differ', async () => {
    await showcaseGeneral();
    await insertMessage('<p>one</p>', { userId: 1 });
    await insertMessage('<p>two</p>', { userId: 1 });
    await insertMessage('<p>three</p>', { userId: 2 });

    const [a, b, c] = (await fetchFeed()).items;

    expect(a!.authorCode).toBe(b!.authorCode);
    expect(a!.alias).toBe(b!.alias);
    expect(c!.authorCode).not.toBe(a!.authorCode);
  });

  test('returns the newest 40 messages, oldest first', async () => {
    await showcaseGeneral();

    const start = Date.now() - 60 * 60_000;

    for (let i = 0; i < 45; i++) {
      await insertMessage(`<p>message ${i}</p>`, {
        createdAt: start + i * 60_000
      });
    }

    const { items } = await fetchFeed();

    expect(items).toHaveLength(40);

    const times = items.map((item) => item.createdAt);

    expect(times).toEqual([...times].sort((x, y) => x - y));
    expect(times[0]).toBeGreaterThanOrEqual(start + 5 * 60_000 - 60_000);
  });

  test('skips messages with no text and no attachments', async () => {
    await showcaseGeneral();
    await insertMessage('<p></p>');
    await insertMessage('<p>visible</p>');

    expect((await fetchFeed()).items).toHaveLength(1);
  });

  test('ignores a private channel even if its showcase flag is set', async () => {
    await insertMessage('<p>hidden</p>');
    // the API refuses this combination; the feed must not rely on that
    await tdb
      .update(channels)
      .set({ private: true, showcase: true })
      .where(eq(channels.id, GENERAL_CHANNEL_ID));

    expect((await fetchFeed()).items).toEqual([]);
  });

  test('counts attachments instead of exposing them', async () => {
    await showcaseGeneral();

    const messageId = await insertMessage('<p>look</p>');
    const file = await tdb
      .insert(files)
      .values({
        name: 'secret-file-name.png',
        originalName: 'holiday.png',
        md5: 'x',
        userId: 1,
        size: 1,
        mimeType: 'image/png',
        extension: '.png',
        createdAt: Date.now()
      })
      .returning()
      .get();

    await tdb
      .insert(messageFiles)
      .values({ messageId, fileId: file.id, createdAt: Date.now() });

    const body = await (await fetchRaw()).text();

    expect(body).not.toMatch(/secret-file-name|holiday/);
    expect((JSON.parse(body) as TShowcaseFeed).items[0]!.attachments).toBe(1);
  });

  test('caches the feed between requests', async () => {
    await showcaseGeneral();
    await insertMessage('<p>first</p>');

    expect((await fetchFeed()).items).toHaveLength(1);

    await insertMessage('<p>second</p>');

    expect((await fetchFeed()).items).toHaveLength(1);

    clearShowcaseCache();

    expect((await fetchFeed()).items).toHaveLength(2);
  });

  test('turning the showcase off takes effect immediately', async () => {
    const caller = await showcaseGeneral();
    await insertMessage('<p>hello</p>');

    expect((await fetchFeed()).items).toHaveLength(1);

    await caller.channels.update({
      channelId: GENERAL_CHANNEL_ID,
      showcase: false
    });

    expect((await fetchFeed()).items).toEqual([]);
  });

  test('is rate limited per IP', async () => {
    let last = 200;

    for (let i = 0; i < 31; i++) {
      last = (await fetchRaw()).status;
    }

    expect(last).toBe(429);
  });
});
