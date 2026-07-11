import * as net from 'net';

export interface SMTPSession {
  socket: net.Socket;
  remoteAddress: string;
  clientHostname: string | null;
  mailFrom: string | null;
  rcptTo: string[];
  data: string;
  dataBytes: number;
  dataExceeded: boolean;
  inData: boolean;
  authenticated: boolean;
  user: string | null;
  tlsActive: boolean;
  /** Multi-step AUTH state: null = not in AUTH, otherwise the current step. */
  authState: null | { mechanism: 'LOGIN' | 'PLAIN'; stage: 'username' | 'password'; username?: string };
}

export function createSMTPSession(socket: net.Socket): SMTPSession {
  return {
    socket,
    remoteAddress: socket.remoteAddress ?? 'unknown',
    clientHostname: null,
    mailFrom: null,
    rcptTo: [],
    data: '',
    dataBytes: 0,
    dataExceeded: false,
    inData: false,
    authenticated: false,
    user: null,
    tlsActive: false,
    authState: null,
  };
}

export function resetTransaction(session: SMTPSession): void {
  session.mailFrom = null;
  session.rcptTo = [];
  session.data = '';
  session.dataBytes = 0;
  session.dataExceeded = false;
  session.inData = false;
}
