import { config, validateProductionSecrets } from './config/config';
import { logger } from './utils/logger';
import { createApp } from './app';
import { runMigrations } from './database/migrate';
import { SMTPServer } from './mail/smtp/server';
import { IMAPServer } from './mail/imap/server';
import { ingestMessage } from './mail/ingest';
import { outboundQueue } from './mail/queue';

async function main(): Promise<void> {
  logger.info(`Starting PrivMail backend (env=${config.env})`);

  // Regel 2 – Fail-Fast: kein Produktivstart mit schwachen/Default-Secrets.
  const secretProblems = validateProductionSecrets();
  if (secretProblems.length > 0) {
    for (const p of secretProblems) logger.error(`FATAL: ${p}`);
    logger.error('Abbruch: Unsichere Konfiguration im Produktivbetrieb. Bitte Secrets setzen.');
    process.exit(1);
  }

  try {
    await runMigrations();
  } catch (err) {
    logger.error('Database migration failed', (err as Error).message);
    logger.warn('Continuing without migrations; database-backed features may fail.');
  }

  const app = createApp();
  app.listen(config.apiPort, () => {
    logger.info(`🌐 API-Server läuft auf Port ${config.apiPort}`);
  });

  const smtp = new SMTPServer(ingestMessage);
  smtp.start();

  const imap = new IMAPServer();
  imap.start();

  outboundQueue.start();

  const shutdown = () => {
    logger.info('Shutting down PrivMail backend...');
    smtp.stop();
    imap.stop();
    outboundQueue.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
