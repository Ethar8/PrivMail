import * as net from 'net';

export type IMAPState = 'not-authenticated' | 'authenticated' | 'selected' | 'logout';

export interface IMAPSession {
  socket: net.Socket;
  remoteAddress: string;
  state: IMAPState;
  user: string | null;
  userId: string | null;
  selectedMailbox: string | null;
  idling: boolean;
  idleTag: string | null;
  idleTimeout: NodeJS.Timeout | null;
  tlsActive: boolean;
  pendingAppend: { command: import('./parser').IMAPCommand; remaining: number; buffer: string } | null;
}

export function createIMAPSession(socket: net.Socket): IMAPSession {
  return {
    socket,
    remoteAddress: socket.remoteAddress ?? 'unknown',
    state: 'not-authenticated',
    user: null,
    userId: null,
    selectedMailbox: null,
    idling: false,
    idleTag: null,
    idleTimeout: null,
    tlsActive: false,
    pendingAppend: null,
  };
}
