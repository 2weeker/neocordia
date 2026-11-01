import type { TServerInfo, TTempFile } from '@caesar/shared';
import { initTest, loginToken, uploadFile } from '@server/__tests__/helpers';
import { testsBaseUrl } from '@server/__tests__/setup';
import { getOrphanedFileIds } from '@server/db/queries/files';
import { getSettings } from '@server/db/queries/server';
import { describe, expect, test } from 'vite-plus/test';

const uploadImage = async (name: string, type = 'image/jpeg') => {
  const token = await loginToken('testowner', 'password123');
  const res = await uploadFile(new File(['img'], name, { type }), token);

  return (await res.json()) as TTempFile;
};

const getInfo = async () =>
  (await (await fetch(`${testsBaseUrl}/info`)).json()) as TServerInfo;

const publicStatus = async (name: string) =>
  (await fetch(`${testsBaseUrl}/public/${encodeURIComponent(name)}`)).status;

describe('login background', () => {
  test('/info has no background and the default dim out of the box', async () => {
    const info = await getInfo();

    expect(info.loginBackground).toBeNull();
    expect(info.loginBackgroundDim).toBe(60);
  });

  test('admins can set a background; /info exposes only its file name', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeLoginBackground({
      fileId: (await uploadImage('beach.jpg')).id
    });

    const background = (await getSettings()).loginBackground!;
    const info = await getInfo();

    expect(background.originalName).toBe('beach.jpg');
    expect(info.loginBackground).toEqual({ name: background.name });
  });

  test('the background is public: visitors are not signed in', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeLoginBackground({
      fileId: (await uploadImage('beach.jpg')).id
    });

    expect(
      await publicStatus((await getSettings()).loginBackground!.name)
    ).toBe(200);
  });

  test('replacing or removing the background deletes the old file', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeLoginBackground({
      fileId: (await uploadImage('first.jpg')).id
    });
    const first = (await getSettings()).loginBackground!;

    await caller.others.changeLoginBackground({
      fileId: (await uploadImage('second.jpg')).id
    });

    expect((await getSettings()).loginBackground?.originalName).toBe(
      'second.jpg'
    );
    expect(await publicStatus(first.name)).toBe(404);

    await caller.others.changeLoginBackground({});

    expect((await getSettings()).loginBackground).toBeNull();
    expect((await getInfo()).loginBackground).toBeNull();
  });

  test('only images can be login backgrounds', async () => {
    const { caller } = await initTest(1);

    await expect(
      caller.others.changeLoginBackground({
        fileId: (await uploadImage('notes.txt', 'text/plain')).id
      })
    ).rejects.toThrow('Invalid file type');
  });

  test('non-admins cannot change the background or its dim', async () => {
    const { caller } = await initTest(2);

    await expect(caller.others.changeLoginBackground({})).rejects.toThrow(
      'Insufficient permissions'
    );
    await expect(
      caller.others.updateSettings({ loginBackgroundDim: 10 })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('admins can set the dim and /info reports it', async () => {
    const { caller } = await initTest(1);

    await getInfo(); // warm the settings cache
    await caller.others.updateSettings({ loginBackgroundDim: 35 });

    expect((await getInfo()).loginBackgroundDim).toBe(35);
  });

  test('dim must be a whole number from 0 to 90', async () => {
    const { caller } = await initTest(1);

    for (const value of [-1, 91, 1.5]) {
      await expect(
        caller.others.updateSettings({ loginBackgroundDim: value })
      ).rejects.toThrow();
    }

    await caller.others.updateSettings({ loginBackgroundDim: 0 });
    await caller.others.updateSettings({ loginBackgroundDim: 90 });

    expect((await getInfo()).loginBackgroundDim).toBe(90);
  });

  test('the file cleanup keeps the background', async () => {
    const { caller } = await initTest(1);

    await caller.others.changeLoginBackground({
      fileId: (await uploadImage('beach.jpg')).id
    });

    expect(await getOrphanedFileIds()).not.toContain(
      (await getSettings()).loginBackground!.id
    );
  });
});
