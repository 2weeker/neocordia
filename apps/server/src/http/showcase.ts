import type http from 'http';
import { config } from '../config';
import { getShowcaseFeed } from '../db/queries/showcase';
import { createRateLimiter } from '../utils/rate-limiters/rate-limiter';
import { sendJson } from './helpers';
import { enforceHttpRateLimit } from './rate-limit';

// Pre-auth like /info: the login page's scrambled preview of showcased
// channels. Everything sensitive is stripped in db/queries/showcase.

const showcaseRateLimiter = createRateLimiter({
  maxRequests: config.rateLimiters.showcase.maxRequests,
  windowMs: config.rateLimiters.showcase.windowMs
});

const showcaseRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  if (!enforceHttpRateLimit(req, res, showcaseRateLimiter, '/showcase')) {
    return;
  }

  sendJson(res, 200, await getShowcaseFeed(), {
    'Cache-Control': 'public, max-age=60'
  });
};

export { showcaseRouteHandler };
