import type { TShowcaseFeed, TShowcaseItem } from '@caesar/shared';
import { channels, messageFiles, messages } from '@caesar/shared/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '..';
import {
  aliasFromCode,
  authorCode,
  htmlToPlainText,
  messageCode,
  redactName,
  scrambleText
} from '../../helpers/showcase-cipher';

// Login-page showcase: the newest messages of admin-approved channels,
// reduced to their scrambled shape (helpers/showcase-cipher). Public and
// unauthenticated, so it is cached: one query per minute however many
// visitors load the login page.

const FEED_SIZE = 40;
// empty messages are skipped after the query, so read a little extra
const QUERY_LIMIT = FEED_SIZE * 2;
const CACHE_TTL_MS = 60_000;
const MINUTE_MS = 60_000;

let cache: { feed: TShowcaseFeed; expiresAt: number } | undefined;

const buildShowcaseFeed = async (): Promise<TShowcaseFeed> => {
  const rows = await db
    .select({
      id: messages.id,
      content: messages.content,
      userId: messages.userId,
      createdAt: messages.createdAt,
      channel: channels.name,
      attachments: sql<number>`(
        SELECT COUNT(*) FROM ${messageFiles}
        WHERE ${messageFiles.messageId} = ${messages.id}
      )`
    })
    .from(messages)
    .innerJoin(channels, eq(channels.id, messages.channelId))
    .where(
      and(
        eq(channels.showcase, true),
        // belt and braces: update-channel never lets these combine
        eq(channels.private, false),
        eq(channels.isDm, false),
        isNull(messages.expiresAt)
      )
    )
    .orderBy(desc(messages.id))
    .limit(QUERY_LIMIT);

  const items: TShowcaseItem[] = [];

  for (const row of rows) {
    if (items.length === FEED_SIZE) break;

    const plain = htmlToPlainText(row.content ?? '');

    if (!plain && row.attachments === 0) continue;

    const key = messageCode(row.id);
    const code = authorCode(row.userId);

    items.push({
      key,
      channel: redactName(row.channel),
      authorCode: code,
      alias: aliasFromCode(code),
      text: scrambleText(plain, key),
      attachments: row.attachments,
      // minute precision is all "3m ago" needs
      createdAt: Math.floor(row.createdAt / MINUTE_MS) * MINUTE_MS
    });
  }

  // oldest first, like a chat log
  return { items: items.reverse() };
};

const getShowcaseFeed = async (): Promise<TShowcaseFeed> => {
  const now = Date.now();

  if (cache && cache.expiresAt > now) return cache.feed;

  const feed = await buildShowcaseFeed();

  cache = { feed, expiresAt: now + CACHE_TTL_MS };

  return feed;
};

// a channel joining or leaving the showcase must show up at once
const clearShowcaseCache = () => {
  cache = undefined;
};

export { clearShowcaseCache, getShowcaseFeed };
