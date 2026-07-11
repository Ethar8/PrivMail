export interface SMTPSessionShape {
  mailFrom: string | null;
  rcptTo: string[];
  data: string;
  authenticated: boolean;
  user: string | null;
  clientHostname: string | null;
  remoteAddress: string;
}

export type SMTPVerb =
  | 'EHLO'
  | 'HELO'
  | 'MAIL'
  | 'RCPT'
  | 'DATA'
  | 'RSET'
  | 'NOOP'
  | 'VRFY'
  | 'EXPN'
  | 'QUIT'
  | 'HELP';
