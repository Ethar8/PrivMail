export const SMTPResponse = {
  ready: (host: string) => `220 ${host} PrivMail SMTP Server ready\r\n`,
  ehlo: (host: string, extensions: string[]) => {
    const lines = [`250-${host} greets you`];
    for (let i = 0; i < extensions.length; i++) {
      const last = i === extensions.length - 1;
      lines.push(`250${last ? ' ' : '-'}${extensions[i]}`);
    }
    return lines.join('\r\n') + '\r\n';
  },
  ok: (msg = 'OK') => `250 ${msg}\r\n`,
  startData: () => `354 Start mail input; end with <CRLF>.<CRLF>\r\n`,
  bye: (host: string) => `221 ${host} closing connection\r\n`,
  syntaxError: (msg = 'Syntax error') => `500 ${msg}\r\n`,
  badSequence: (msg = 'Bad sequence of commands') => `503 ${msg}\r\n`,
  paramError: (msg = 'Syntax error in parameters') => `501 ${msg}\r\n`,
  notImplemented: (msg = 'Command not implemented') => `502 ${msg}\r\n`,
  readyToStartTls: () => `220 2.0.0 Ready to start TLS\r\n`,
  tlsNotAvailable: (msg = 'TLS not available') => `454 4.7.0 ${msg}\r\n`,
  mustStartTls: (msg = 'Must issue a STARTTLS command first') => `530 5.7.0 ${msg}\r\n`,
  authChallenge: (b64Prompt: string) => `334 ${b64Prompt}\r\n`,
  authSuccess: (msg = 'Authentication successful') => `235 2.7.0 ${msg}\r\n`,
  authFailed: (msg = 'Authentication credentials invalid') => `535 5.7.8 ${msg}\r\n`,
  authRequired: (msg = 'Authentication required') => `530 5.7.0 ${msg}\r\n`,
  mailboxUnavailable: (msg = 'Mailbox unavailable') => `550 ${msg}\r\n`,
  relayDenied: (msg = 'Relay access denied') => `550 ${msg}\r\n`,
  messageTooBig: (msg = 'Message size exceeds fixed maximum message size') =>
    `552 ${msg}\r\n`,
  lineTooLong: (msg = 'Line too long') => `500 ${msg}\r\n`,
  tempFailure: (msg = 'Temporary local error, please try again later') => `451 4.7.1 ${msg}\r\n`,
  virusRejected: (signature?: string) =>
    `554 5.7.1 Message rejected due to virus${signature ? `: ${signature}` : ''}\r\n`,
  transactionFailed: (msg = 'Transaction failed') => `554 ${msg}\r\n`,
};
