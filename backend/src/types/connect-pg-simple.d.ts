declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  import { Pool } from 'pg';

  interface PgStoreOptions {
    pool?: Pool;
    conString?: string;
    tableName?: string;
    schemaName?: string;
    createTableIfMissing?: boolean;
    ttl?: number;
    pruneSessionInterval?: number | false;
  }

  interface PgStoreClass {
    new (options?: PgStoreOptions): Store;
  }

  function connectPgSimple(session: unknown): PgStoreClass;
  export = connectPgSimple;
}
