declare module 'oidc-provider' {
  import type { IncomingMessage, ServerResponse } from 'http';
  import type { RequestHandler } from 'express';

  export interface AccountClaims {
    sub: string;
    [key: string]: unknown;
  }

  export interface Account {
    accountId: string;
    claims: (use: string, scope: string, claims: unknown, rejected: string[]) => Promise<AccountClaims> | AccountClaims;
  }

  export interface ClientMetadata {
    client_id: string;
    client_secret?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    post_logout_redirect_uris?: string[];
    scope?: string;
  }

  export interface Configuration {
    clients?: ClientMetadata[];
    findAccount?: (ctx: unknown, id: string, token?: unknown) => Promise<Account | undefined>;
    adapter?: new (name: string) => Adapter;
    cookies?: { keys?: string[]; long?: Record<string, unknown>; short?: Record<string, unknown> };
    features?: Record<string, { enabled?: boolean; [k: string]: unknown }>;
    pkce?: { required?: (ctx: unknown, client: unknown) => boolean; methods?: string[] };
    interactions?: { url?: (ctx: unknown, interaction: Interaction) => string };
    claims?: Record<string, string[] | null>;
    scopes?: string[];
    jwks?: { keys: Record<string, unknown>[] };
    ttl?: Record<string, number>;
    routes?: Record<string, string>;
    clientBasedCORS?: (ctx: unknown, origin: string, client: unknown) => boolean;
    issueRefreshToken?: boolean | ((ctx: unknown, client: unknown, code: unknown) => boolean | Promise<boolean>);
    renderError?: (ctx: unknown, out: unknown, error: Error) => Promise<void>;
    [key: string]: unknown;
  }

  export interface Interaction {
    uid: string;
    prompt: { name: string; reasons: string[]; details: Record<string, unknown> };
    params: Record<string, unknown>;
    session?: { accountId?: string };
    lastSubmission?: Record<string, unknown>;
    grantId?: string;
  }

  export interface AdapterPayload {
    [key: string]: unknown;
  }

  export interface Adapter {
    upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void>;
    find(id: string): Promise<AdapterPayload | undefined>;
    findByUserCode?(userCode: string): Promise<AdapterPayload | undefined>;
    findByUid?(uid: string): Promise<AdapterPayload | undefined>;
    destroy(id: string): Promise<void>;
    revokeByGrantId?(grantId: string): Promise<void>;
    consume?(id: string): Promise<void>;
  }

  export default class Provider {
    constructor(issuer: string, configuration?: Configuration);
    callback(): RequestHandler;
    interactionDetails(req: IncomingMessage, res: ServerResponse): Promise<Interaction>;
    interactionFinished(
      req: IncomingMessage,
      res: ServerResponse,
      result: Record<string, unknown>,
      options?: { mergeWithLastSubmission?: boolean },
    ): Promise<void>;
    interactionResult(
      req: IncomingMessage,
      res: ServerResponse,
      result: Record<string, unknown>,
      options?: { mergeWithLastSubmission?: boolean },
    ): Promise<string>;
    Client: { find(id: string): Promise<ClientMetadata | undefined>; adapter: Adapter };
    issuer: string;
    proxy: boolean;
  }
}
