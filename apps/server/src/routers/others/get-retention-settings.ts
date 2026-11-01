import { Permission, type TRetentionSettings } from '@caesar/shared';
import { getSettings } from '@server/db/queries/server';
import { protectedProcedure } from '@server/utils/trpc';

const getRetentionSettingsRoute = protectedProcedure.query(
  async ({ ctx }): Promise<TRetentionSettings> => {
    await ctx.needsPermission(Permission.MANAGE_SETTINGS);

    const settings = await getSettings();

    return {
      messageRetentionMaxCount: settings.messageRetentionMaxCount,
      messageRetentionMaxAgeDays: settings.messageRetentionMaxAgeDays,
      dmRetentionMaxCount: settings.dmRetentionMaxCount,
      dmRetentionMaxAgeDays: settings.dmRetentionMaxAgeDays,
      logRetentionDays: settings.logRetentionDays
    };
  }
);

export { getRetentionSettingsRoute };
