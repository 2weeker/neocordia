import { Permission } from '@caesar/shared';
import { removeFile } from '@server/db/mutations/files';
import { updateSettings } from '@server/db/mutations/server';
import { getSettings } from '@server/db/queries/server';
import { fileManager } from '@server/utils/file-manager';
import { protectedProcedure } from '@server/utils/trpc';
import z from 'zod';

// Link-preview image (helpers/share-meta). Mirrors changeLogo: replacing
// or clearing it deletes the previous file.
const changeShareBannerRoute = protectedProcedure
  .input(
    z.object({
      fileId: z.string().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SETTINGS);

    if (
      input.fileId &&
      !fileManager.temporaryFileHasMimeType(input.fileId, 'image/')
    ) {
      throw new Error('Invalid file type. Please try again.');
    }

    const settings = await getSettings();

    if (settings.shareBannerId) {
      await removeFile(settings.shareBannerId);
      await updateSettings({ shareBannerId: null });
    }

    if (input.fileId) {
      const newFile = await fileManager.saveFile(input.fileId, ctx.userId);

      await updateSettings({ shareBannerId: newFile.id });
    }
  });

export { changeShareBannerRoute };
