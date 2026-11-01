import {
    serverSliceActions,
    serverSliceReducer,
    type IServerState
} from '@/features/server/slice';
import type { IRootState } from '@/features/store';
import type { TJoinedMessage } from '@caesar/shared';
import { describe, expect, test } from 'vite-plus/test';
import {
    messagesByChannelIdSelector,
    visibleMessagesSelector
} from '../selectors';

const CHANNEL_ID = 1;
const OTHER_CHANNEL_ID = 2;

// ids double as time: message n was sent at n seconds
const msg = (id: number, extra: Partial<TJoinedMessage> = {}) =>
    ({
        id,
        channelId: CHANNEL_ID,
        userId: 1,
        content: `m${id}`,
        createdAt: id * 1000,
        pinned: false,
        files: [],
        reactions: [],
        scVotes: [],
        ...extra
    }) as unknown as TJoinedMessage;

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => msg(from + i));

type TAction = Parameters<typeof serverSliceReducer>[1];

const run = (...actions: TAction[]) =>
    actions.reduce<IServerState>(
        (state, action) => serverSliceReducer(state, action),
        serverSliceReducer(undefined, { type: 'init' })
    );

const ids = (messages: TJoinedMessage[]) => messages.map((m) => m.id);

const view = (state: IServerState, channelId = CHANNEL_ID) => {
    const root = { server: state } as IRootState;

    return {
        visible: ids(visibleMessagesSelector(root, channelId)),
        all: ids(messagesByChannelIdSelector(root, channelId)),
        newerCursor: state.newerCursorMap[channelId]
    };
};

const add = (messages: TJoinedMessage[], channelId = CHANNEL_ID) =>
    serverSliceActions.addMessages({ channelId, messages });

const prune = (beforeId: number, channelId = CHANNEL_ID) =>
    serverSliceActions.pruneChannelMessages({ channelId, beforeId });

describe('pruneChannelMessages', () => {
    test('drops unpinned messages up to beforeId and keeps newer ones', () => {
        const state = run(add(range(1, 10)), prune(6));

        expect(view(state).all).toEqual([7, 8, 9, 10]);
    });

    test('keeps pinned messages at or below beforeId', () => {
        const state = run(
            add([msg(1), msg(2, { pinned: true }), msg(3), msg(4)]),
            prune(3)
        );

        expect(view(state).all).toEqual([2, 4]);
    });

    test('leaves other channels alone', () => {
        const other = range(1, 3).map((m) => ({
            ...m,
            channelId: OTHER_CHANNEL_ID
        }));
        const state = run(
            add(range(1, 3)),
            add(other, OTHER_CHANNEL_ID),
            prune(3)
        );

        expect(view(state, OTHER_CHANNEL_ID).all).toEqual([1, 2, 3]);
    });

    test('pruning a whole jump window returns to the tail', () => {
        const state = run(
            add(range(100, 110)),
            serverSliceActions.setJumpWindow({
                channelId: CHANNEL_ID,
                messages: range(10, 20),
                newerCursor: 20_000
            }),
            prune(50)
        );

        expect(view(state).newerCursor).toBeUndefined();
        expect(view(state).visible).toEqual(ids(range(100, 110)));
    });

    test('a jump window that survives the prune stays open', () => {
        const state = run(
            add(range(100, 110)),
            serverSliceActions.setJumpWindow({
                channelId: CHANNEL_ID,
                messages: range(10, 20),
                newerCursor: 20_000
            }),
            prune(15)
        );

        expect(view(state).newerCursor).toBe(20_000);
        expect(view(state).visible).toEqual(ids(range(16, 20)));
    });

    test('is a no-op for a channel with nothing loaded', () => {
        const state = run(prune(10));

        expect(view(state).all).toEqual([]);
    });
});
