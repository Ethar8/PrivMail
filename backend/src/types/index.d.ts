import 'express-session';

declare module 'express-session' {
  interface SessionData {
    challenge?: string;
    webauthnUserId?: string;
  }
}

export {};
