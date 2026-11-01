import { t } from '@server/utils/trpc';
import { changeLogoRoute } from './change-logo';
import { changeShareBannerRoute } from './change-share-banner';
import { onServerSettingsUpdateRoute } from './events';
import { getBankBalanceRoute } from './get-bank-balance';
import { getGameHistoryRoute } from './get-game-history';
import { getRetentionSettingsRoute } from './get-retention-settings';
import { getSettingsRoute } from './get-settings';
import { getStorageSettingsRoute } from './get-storage-settings';
import { handshakeRoute } from './handshake';
import { joinServerRoute } from './join';
import { pingRoute } from './ping';
import { updateSettingsRoute } from './update-settings';
import { useSecretTokenRoute } from './use-secret-token';

export const othersRouter = t.router({
  joinServer: joinServerRoute,
  handshake: handshakeRoute,
  ping: pingRoute,
  updateSettings: updateSettingsRoute,
  changeLogo: changeLogoRoute,
  changeShareBanner: changeShareBannerRoute,
  getSettings: getSettingsRoute,
  onServerSettingsUpdate: onServerSettingsUpdateRoute,
  useSecretToken: useSecretTokenRoute,
  getStorageSettings: getStorageSettingsRoute,
  getRetentionSettings: getRetentionSettingsRoute,
  getBankBalance: getBankBalanceRoute,
  getGameHistory: getGameHistoryRoute
});
