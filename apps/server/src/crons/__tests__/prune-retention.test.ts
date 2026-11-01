import { ActivityLogType, ServerEvents } from '@caesar/shared';
import {
  activityLog,
  files,
  logins,
  messageFiles,
  messages
} from '@caesar/shared/db/schema';
import { tdb } from '@server/__tests__/setup';
import { pruneRetention } from '@server/crons/prune-retention';
import { updateSettings } from '@server/db/mutations/server';
import { getOrphanedFileIds } from '@server/db/queries/files';
import { pubsub } from '@server/utils/pubsub';
import { asc, eq } from 'drizzle-orm';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

// seed: channel 1 = General (text), channel 3 = DM between users 3 and 4
const GENERAL_CHANNEL_ID = 1;
const DM_CHANNEL_ID = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const clearChannel = (channelId: number) =>
  tdb.delete(messages).where(eq(messages.channelId, channelId));

// inserts `count` messages oldest first, `createdAt` spaced one minute
// apart ending at `endAt`; returns their ids in insertion order
const insertMessages = async (
  channelId: number,
  count: number,
  opts: { endAt?: number; userId?: number; pinned?: boolean } = {}
) => {
  const endAt = opts.endAt ?? Date.now();
  const rows = Array.from({ length: count }, (_, i) => ({
    channelId,
    userId: opts.userId ?? 1,
    content: `message ${i}`,
    pinned: opts.pinned ?? false,
    createdAt: endAt - (count - 1 - i) * 60_000
  }));

  const inserted = await tdb
    .insert(messages)
    .values(rows)
    .returning({ id: messages.id });

  return inserted.map((r) => r.id);
};

const channelMessageIds = async (channelId: number) =>
  (
    await tdb
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(asc(messages.id))
  ).map((r) => r.id);

describe('pruneRetention', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('keeps everything when every retention setting is 0', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const ids = await insertMessages(GENERAL_CHANNEL_ID, 20, {
      endAt: Date.now() - 400 * DAY_MS
    });

    await pruneRetention();

    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual(ids);
  });

  test('count cap keeps only the newest N messages of a text channel', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const ids = await insertMessages(GENERAL_CHANNEL_ID, 10);

    await updateSettings({ messageRetentionMaxCount: 3 });
    await pruneRetention();

    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual(ids.slice(-3));
  });

  test('count cap deletes more rows than one batch', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const ids = await insertMessages(GENERAL_CHANNEL_ID, 1205);

    await updateSettings({ messageRetentionMaxCount: 5 });
    await pruneRetention();

    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual(ids.slice(-5));
  });

  test('pinned messages are never pruned and do not count toward the cap', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const [oldPinned] = await insertMessages(GENERAL_CHANNEL_ID, 1, {
      pinned: true,
      endAt: Date.now() - 100 * DAY_MS
    });
    const ids = await insertMessages(GENERAL_CHANNEL_ID, 5);

    await updateSettings({
      messageRetentionMaxCount: 2,
      messageRetentionMaxAgeDays: 30
    });
    await pruneRetention();

    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual([
      oldPinned!,
      ...ids.slice(-2)
    ]);
  });

  test('age cap deletes messages older than N days', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const old = await insertMessages(GENERAL_CHANNEL_ID, 3, {
      endAt: Date.now() - 10 * DAY_MS
    });
    const recent = await insertMessages(GENERAL_CHANNEL_ID, 2, {
      endAt: Date.now() - 2 * DAY_MS
    });

    await updateSettings({ messageRetentionMaxAgeDays: 7 });
    await pruneRetention();

    const remaining = await channelMessageIds(GENERAL_CHANNEL_ID);

    expect(remaining).toEqual(recent);
    expect(remaining).not.toContain(old[0]);
  });

  test('when both caps are set, whichever removes more wins', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    await insertMessages(GENERAL_CHANNEL_ID, 4, {
      endAt: Date.now() - 10 * DAY_MS
    });
    const recent = await insertMessages(GENERAL_CHANNEL_ID, 6);

    // age alone keeps 6, count alone keeps 3: the stricter result stands
    await updateSettings({
      messageRetentionMaxCount: 3,
      messageRetentionMaxAgeDays: 7
    });
    await pruneRetention();

    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual(
      recent.slice(-3)
    );
  });

  test('channel settings leave DMs alone', async () => {
    await clearChannel(DM_CHANNEL_ID);
    const dmIds = await insertMessages(DM_CHANNEL_ID, 5, { userId: 3 });

    await updateSettings({
      messageRetentionMaxCount: 1,
      messageRetentionMaxAgeDays: 1
    });
    await pruneRetention();

    expect(await channelMessageIds(DM_CHANNEL_ID)).toEqual(dmIds);
  });

  test('DM settings prune DMs and leave channels alone', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    await clearChannel(DM_CHANNEL_ID);
    const channelIds = await insertMessages(GENERAL_CHANNEL_ID, 5);
    const dmIds = await insertMessages(DM_CHANNEL_ID, 5, { userId: 3 });

    await updateSettings({ dmRetentionMaxCount: 2 });
    await pruneRetention();

    expect(await channelMessageIds(DM_CHANNEL_ID)).toEqual(dmIds.slice(-2));
    expect(await channelMessageIds(GENERAL_CHANNEL_ID)).toEqual(channelIds);
  });

  test('DM age cap deletes DM messages older than N days', async () => {
    await clearChannel(DM_CHANNEL_ID);
    await insertMessages(DM_CHANNEL_ID, 3, {
      userId: 3,
      endAt: Date.now() - 5 * DAY_MS
    });
    const recent = await insertMessages(DM_CHANNEL_ID, 1, { userId: 3 });

    await updateSettings({ dmRetentionMaxAgeDays: 3 });
    await pruneRetention();

    expect(await channelMessageIds(DM_CHANNEL_ID)).toEqual(recent);
  });

  test('broadcasts one prune event per channel with the newest pruned id', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const ids = await insertMessages(GENERAL_CHANNEL_ID, 6);
    const publishFor = vi.spyOn(pubsub, 'publishFor');

    await updateSettings({ messageRetentionMaxCount: 2 });
    await pruneRetention();

    const pruneEvents = publishFor.mock.calls.filter(
      ([, topic]) => topic === ServerEvents.MESSAGES_PRUNED
    );

    expect(pruneEvents).toHaveLength(1);
    expect(pruneEvents[0]![2]).toEqual({
      channelId: GENERAL_CHANNEL_ID,
      beforeId: ids[3]
    });
  });

  test('no prune event when nothing was pruned', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    await insertMessages(GENERAL_CHANNEL_ID, 2);
    const publishFor = vi.spyOn(pubsub, 'publishFor');

    await updateSettings({ messageRetentionMaxCount: 5 });
    await pruneRetention();

    expect(
      publishFor.mock.calls.filter(
        ([, topic]) => topic === ServerEvents.MESSAGES_PRUNED
      )
    ).toHaveLength(0);
  });

  test('attachments of pruned messages become orphans for the file sweep', async () => {
    await clearChannel(GENERAL_CHANNEL_ID);
    const [oldId] = await insertMessages(GENERAL_CHANNEL_ID, 1, {
      endAt: Date.now() - 10 * DAY_MS
    });
    await insertMessages(GENERAL_CHANNEL_ID, 1);

    const file = await tdb
      .insert(files)
      .values({
        name: 'pruned-attachment.txt',
        originalName: 'pruned-attachment.txt',
        md5: 'x',
        userId: 1,
        size: 1,
        mimeType: 'text/plain',
        extension: '.txt',
        createdAt: Date.now() - 10 * DAY_MS
      })
      .returning()
      .get();

    await tdb.insert(messageFiles).values({
      messageId: oldId!,
      fileId: file.id,
      createdAt: Date.now() - 10 * DAY_MS
    });

    expect(await getOrphanedFileIds({ minAgeMs: 0 })).not.toContain(file.id);

    await updateSettings({ messageRetentionMaxCount: 1 });
    await pruneRetention();

    expect(await getOrphanedFileIds({ minAgeMs: 0 })).toContain(file.id);
  });

  test('log retention deletes logins and activity older than N days', async () => {
    const old = Date.now() - 40 * DAY_MS;
    const recent = Date.now() - 5 * DAY_MS;

    await tdb.delete(logins);
    await tdb.delete(activityLog);

    await tdb.insert(logins).values([
      { userId: 1, ip: 'old', createdAt: old },
      { userId: 1, ip: 'recent', createdAt: recent }
    ]);
    await tdb.insert(activityLog).values([
      { userId: 1, type: ActivityLogType.USER_JOINED, createdAt: old },
      { userId: 1, type: ActivityLogType.USER_JOINED, createdAt: recent }
    ]);

    await updateSettings({ logRetentionDays: 30 });
    await pruneRetention();

    const loginRows = await tdb.select().from(logins).all();
    const activityRows = await tdb.select().from(activityLog).all();

    expect(loginRows.map((r) => r.ip)).toEqual(['recent']);
    expect(activityRows.map((r) => r.createdAt)).toEqual([recent]);
  });

  test('log retention 0 keeps old logs', async () => {
    await tdb.delete(logins);
    await tdb.insert(logins).values({
      userId: 1,
      ip: 'ancient',
      createdAt: Date.now() - 900 * DAY_MS
    });

    await pruneRetention();

    expect(await tdb.select().from(logins).all()).toHaveLength(1);
  });
});
