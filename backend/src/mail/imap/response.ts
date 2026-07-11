export const IMAPResponse = {
  greeting: () => `* OK PrivMail IMAP Server ready\r\n`,
  ok: (tag: string, msg = 'completed') => `${tag} OK ${msg}\r\n`,
  no: (tag: string, msg = 'failed') => `${tag} NO ${msg}\r\n`,
  bad: (tag: string, msg = 'bad command') => `${tag} BAD ${msg}\r\n`,
  privacyRequired: (tag: string) => `${tag} NO [PRIVACYREQUIRED] STARTTLS required\r\n`,
  bye: () => `* BYE PrivMail IMAP Server logging out\r\n`,
  untagged: (line: string) => `* ${line}\r\n`,
};
