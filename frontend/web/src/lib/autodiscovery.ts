/**
 * RFC 6186 / autodiscovery payload for automatic mobile mail setup.
 *
 * Encodes the standardized service data (SMTP submission, IMAP, and the
 * JMAP/WebDAV autodiscovery endpoints) into a compact text payload that a
 * mobile device can scan to configure an account without manual port entry.
 *
 * The format is a plain "key=value" block (one per line) plus the RFC 6186
 * SRV-style hints, which is what PrivMail's companion mobile config expects.
 */
export interface AutodiscoveryParams {
  email: string;
  domain: string; // mail domain, e.g. mail.example.com
  displayName?: string;
  smtpPort?: number; // submission
  imapPort?: number;
  jmapUrl?: string;
  carddavUrl?: string;
  caldavUrl?: string;
}

export function buildAutodiscoveryPayload(p: AutodiscoveryParams): string {
  const smtp = p.smtpPort ?? 587;
  const imap = p.imapPort ?? 993;
  const jmap = p.jmapUrl ?? `https://${p.domain}/.well-known/jmap`;
  const carddav = p.carddavUrl ?? `https://${p.domain}/.well-known/carddav`;
  const caldav = p.caldavUrl ?? `https://${p.domain}/.well-known/caldav`;

  // RFC 6186 SRV records that a client resolver would look up, provided as hints.
  const lines = [
    'PRIVMAIL-AUTOCONFIG/1',
    `email=${p.email}`,
    p.displayName ? `name=${p.displayName}` : '',
    // Submission (SMTP) — RFC 6186 _submission._tcp
    `smtp=${p.domain}:${smtp};starttls`,
    `srv:_submission._tcp.${p.domain}=0 1 ${smtp} ${p.domain}`,
    // IMAP — RFC 6186 _imaps._tcp
    `imap=${p.domain}:${imap};tls`,
    `srv:_imaps._tcp.${p.domain}=0 1 ${imap} ${p.domain}`,
    // JMAP + WebDAV autodiscovery
    `jmap=${jmap}`,
    `carddav=${carddav}`,
    `caldav=${caldav}`,
  ].filter(Boolean);

  return lines.join('\n');
}
