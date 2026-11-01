import { ChannelPermission, ServerEvents } from '@caesar/shared';
import {
  activityLog,
  channels,
  logins,
  messages
} from '@caesar/shared/db/schema';
import { and, asc, desc, eq, inArray, lt, lte, max, sql } from 'drizzle-orm';
import { db } from '../db';
import { getAffectedOnlineUserIdsForChannel } from '../db/queries/channels';
import { getSettings } from '../db/queries/server';
import { logger } from '../logger';
import { pubsub } from '../utils/pubsub';

// Admin-set retention (server settings, 0 = keep forever):
// - channels and DMs each have a per-channel message cap and a max age
// - pinned messages are exempt and don't count toward the cap
// - logins and activity_log have a max age
//
// Message ids follow creation order, so each channel's policy collapses to
// one cutoff id: every unpinned message at or below it goes. Clients get
// that same id (MESSAGES_PRUNED) and drop the same set locally.
//
// Deletes run in small batches with no wrapping transaction, so the write
// lock is released between them and live traffic interleaves (see
// db/connection.ts). Attachments are not touched here: their message_files
// rows cascade away and the orphan sweep (cleanup-files) reclaims the disk.

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

type TPolicy = { maxCount: number; maxAgeDays: number };

const isUnpinned = sql`coalesce(${messages.pinned}, 0) = 0`;

const getCutoffId = async (
  channelId: number,
  policy: TPolicy,
  now: number
): Promise<number> => {
  let cutoffId = 0;

  if (policy.maxCount > 0) {
    // the newest message beyond the cap; everything older goes with it
    const row = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.channelId, channelId), isUnpinned))
      .orderBy(desc(messages.id))
      .limit(1)
      .offset(policy.maxCount)
      .get();

    if (row) cutoffId = row.id;
  }

  if (policy.maxAgeDays > 0) {
    const row = await db
      .select({ id: max(messages.id) })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, channelId),
          isUnpinned,
          lt(messages.createdAt, now - policy.maxAgeDays * DAY_MS)
        )
      )
      .get();

    if (row?.id && row.id > cutoffId) cutoffId = row.id;
  }

  return cutoffId;
};

const deleteMessagesThrough = async (channelId: number, cutoffId: number) => {
  let deleted = 0;

  for (;;) {
    const batch = await db
      .delete(messages)
      .where(
        inArray(
          messages.id,
          db
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.channelId, channelId),
                isUnpinned,
                lte(messages.id, cutoffId)
              )
            )
            .orderBy(asc(messages.id))
            .limit(BATCH_SIZE)
        )
      )
      .returning({ id: messages.id });

    deleted += batch.length;

    if (batch.length < BATCH_SIZE) return deleted;
  }
};

const pruneChannels = async (isDm: boolean, policy: TPolicy, now: number) => {
  if (policy.maxCount <= 0 && policy.maxAgeDays <= 0) return 0;

  const targets = await db
    .select({ id: channels.id, private: channels.private })
    .from(channels)
    .where(eq(channels.isDm, isDm));

  let total = 0;

  for (const channel of targets) {
    const cutoffId = await getCutoffId(channel.id, policy, now);

    if (cutoffId === 0) continue;

    const deleted = await deleteMessagesThrough(channel.id, cutoffId);

    if (deleted === 0) continue;

    total += deleted;

    const audience = await getAffectedOnlineUserIdsForChannel(channel.id, {
      permission: ChannelPermission.VIEW_CHANNEL,
      channel: { isDm, private: channel.private }
    });

    pubsub.publishFor(audience, ServerEvents.MESSAGES_PRUNED, {
      channelId: channel.id,
      beforeId: cutoffId
    });
  }

  return total;
};

const deleteOlderThan = async (
  table: typeof logins | typeof activityLog,
  cutoff: number
) => {
  let deleted = 0;

  for (;;) {
    const batch = await db
      .delete(table)
      .where(
        inArray(
          table.id,
          db
            .select({ id: table.id })
            .from(table)
            .where(lt(table.createdAt, cutoff))
            .limit(BATCH_SIZE)
        )
      )
      .returning({ id: table.id });

    deleted += batch.length;

    if (batch.length < BATCH_SIZE) return deleted;
  }
};

const pruneLogs = async (retentionDays: number, now: number) => {
  if (retentionDays <= 0) return 0;

  const cutoff = now - retentionDays * DAY_MS;

  return (
    (await deleteOlderThan(logins, cutoff)) +
    (await deleteOlderThan(activityLog, cutoff))
  );
};

// a first run against years of history can outlast the 15 min interval
let running = false;

const pruneRetention = async () => {
  if (running) return;

  running = true;

  try {
    const settings = await getSettings();
    const now = Date.now();

    const channelMessages = await pruneChannels(
      false,
      {
        maxCount: settings.messageRetentionMaxCount,
        maxAgeDays: settings.messageRetentionMaxAgeDays
      },
      now
    );
    const dmMessages = await pruneChannels(
      true,
      {
        maxCount: settings.dmRetentionMaxCount,
        maxAgeDays: settings.dmRetentionMaxAgeDays
      },
      now
    );
    const logRows = await pruneLogs(settings.logRetentionDays, now);

    if (channelMessages + dmMessages + logRows > 0) {
      logger.info(
        `[Cron] Retention pruned ${channelMessages} channel messages, ${dmMessages} DM messages, ${logRows} log rows.`
      );
    }
  } catch (error) {
    logger.error('[Cron] Retention prune failed:', error);
  } finally {
    running = false;
  }
};

export { pruneRetention };
