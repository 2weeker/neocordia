import { useNow } from '@/hooks/use-now';
import type { TShowcaseItem } from '@caesar/shared';
import { Paperclip } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { cipherAvatar, relativeTime } from './cipher';
import { CipherAvatar } from './cipher-avatar';
import { useFlicker, useShowcaseFeed } from './use-showcase';

// seconds of scroll per message: slow enough to be glanced at
const SECONDS_PER_ITEM = 4;
// fewer than this don't fill the column; a loop would scroll empty space
const MIN_ITEMS_TO_SCROLL = 6;

type TRowProps = { item: TShowcaseItem; text: string; now: number };

const Row = memo(({ item, text, now }: TRowProps) => {
    const { hue } = useMemo(() => cipherAvatar(item.authorCode), [item]);

    return (
        <li className="flex gap-3 border-b border-border/50 py-3">
            <CipherAvatar
                code={item.authorCode}
                className="mt-0.5 size-8 shrink-0 rounded-md"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                    <span
                        className="font-semibold"
                        style={{ color: `hsl(${hue} 70% 68%)` }}
                    >
                        {item.alias}
                    </span>
                    <span className="flex min-w-0 items-center gap-0.5 text-muted-foreground">
                        #
                        {/* the server sends only solid blocks; drawn as a
                            black bar the width of the redacted name */}
                        <span
                            aria-label="hidden channel"
                            className="truncate select-none rounded-[2px] bg-black text-transparent dark:ring-1 dark:ring-white/20"
                        >
                            {item.channel}
                        </span>
                    </span>
                    <span className="ml-auto shrink-0 text-muted-foreground/70">
                        {relativeTime(item.createdAt, now)}
                    </span>
                </div>
                {text && (
                    <p className="mt-1 line-clamp-4 whitespace-pre-line break-all text-sm leading-relaxed text-foreground/80">
                        {text}
                    </p>
                )}
                {item.attachments > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip size={12} />
                        {item.attachments}
                    </span>
                )}
            </div>
        </li>
    );
});

Row.displayName = 'ShowcaseRow';

// Login-page preview of showcased channels. Everything arrives scrambled
// from the server; the scroll and flicker are presentation only.
const ShowcaseFeed = memo(() => {
    const items = useShowcaseFeed();
    const [paused, setPaused] = useState(false);
    const texts = useFlicker(items, paused);
    const now = useNow(30_000);

    if (items.length === 0) return null;

    const scrolls = items.length >= MIN_ITEMS_TO_SCROLL;

    const list = (copy: number) => (
        <ul aria-hidden={copy > 0 || undefined}>
            {items.map((item) => (
                <Row
                    key={item.key}
                    item={item}
                    text={texts[item.key] ?? item.text}
                    now={now}
                />
            ))}
        </ul>
    );

    return (
        <aside
            aria-label="Scrambled preview of recent activity"
            className="hidden w-80 lg:block"
        >
            <div
                className="showcase-viewport h-[min(34rem,75vh)] overflow-hidden"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                {scrolls ? (
                    // two copies back to back: scrolling by exactly one
                    // copy loops seamlessly
                    <div
                        className="showcase-track"
                        data-paused={paused}
                        style={{
                            animationDuration: `${items.length * SECONDS_PER_ITEM}s`
                        }}
                    >
                        {list(0)}
                        {list(1)}
                    </div>
                ) : (
                    <div className="flex h-full flex-col justify-center">
                        {list(0)}
                    </div>
                )}
            </div>
        </aside>
    );
});

ShowcaseFeed.displayName = 'ShowcaseFeed';

export { ShowcaseFeed };
