import { CronJob } from 'cron';
import { logger } from '../logger';
import { cleanupFiles } from './cleanup-files';
import { pruneE2eeSessionKeys } from './prune-e2ee-session-keys';
import { pruneExpiredMessages } from './prune-expired';
import { pruneExpiredStatuses } from './prune-expired-statuses';
import { pruneRetention } from './prune-retention';

enum CRON_TIMES {
  EVERY_15_MINUTES = '*/15 * * * *'
}

const loadCrons = () => {
  logger.debug('Loading crons...');

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    cleanupFiles,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    pruneExpiredMessages,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    pruneRetention,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    pruneExpiredStatuses,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    pruneE2eeSessionKeys,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );
};

export { loadCrons };
