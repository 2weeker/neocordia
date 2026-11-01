import type { TServerInfo } from '@caesar/shared';
import type http from 'http';
import { getSettings } from '../db/queries/server';
import { sendJson } from './helpers';

const infoRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const settings = await getSettings();

  const info: TServerInfo = {
    name: settings.name,
    description: settings.description,
    logo: settings.logo ? { name: settings.logo.name } : null,
    loginBackground: settings.loginBackground
      ? { name: settings.loginBackground.name }
      : null,
    loginBackgroundDim: settings.loginBackgroundDim
  };

  sendJson(res, 200, info);
};

export { infoRouteHandler };
