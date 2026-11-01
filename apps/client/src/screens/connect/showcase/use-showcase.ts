import { getUrlFromServer } from '@/helpers/get-file-url';
import type { TShowcaseItem } from '@caesar/shared';
import { useEffect, useState } from 'react';
import { flicker } from './cipher';

const REFRESH_MS = 2 * 60_000;
const FLICKER_MS = 140;

// Plain fetch on purpose: the login page ships without tRPC. A failed
// fetch just leaves the feed empty, which hides it.
export const useShowcaseFeed = () => {
    const [items, setItems] = useState<TShowcaseItem[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            try {
                const res = await fetch(`${getUrlFromServer()}/showcase`, {
                    signal: controller.signal
                });

                if (!res.ok) return;

                const { items } = (await res.json()) as {
                    items: TShowcaseItem[];
                };

                setItems(items);
            } catch {
                // offline, aborted or rate limited: keep what we have
            }
        };

        void load();

        const timer = setInterval(load, REFRESH_MS);

        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, []);

    return items;
};

const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Re-rolls a couple of glyphs in one random message every tick. The text
// is already ciphertext from the server; this is decoration only. Returns
// overrides keyed by message: a key's server text never changes, so a
// refresh needs no reset and missing keys fall back to the server text.
export const useFlicker = (items: TShowcaseItem[], paused: boolean) => {
    const [overrides, setOverrides] = useState<Record<string, string>>({});

    useEffect(() => {
        if (paused || items.length === 0 || prefersReducedMotion()) return;

        const timer = setInterval(() => {
            if (document.hidden) return;

            const item = items[Math.floor(Math.random() * items.length)];

            setOverrides((prev) => ({
                ...prev,
                [item.key]: flicker(prev[item.key] ?? item.text, 2, Math.random)
            }));
        }, FLICKER_MS);

        return () => clearInterval(timer);
    }, [items, paused]);

    return overrides;
};
