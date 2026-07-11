export interface SMTPCommand {
  verb: string;
  arg: string;
  raw: string;
}

export class SMTPParser {
  static parse(line: string): SMTPCommand {
    const raw = line.replace(/\r?\n$/, '');
    const trimmed = raw.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) {
      return { verb: trimmed.toUpperCase(), arg: '', raw };
    }
    const verb = trimmed.slice(0, spaceIdx).toUpperCase();
    const arg = trimmed.slice(spaceIdx + 1).trim();
    return { verb, arg, raw };
  }

  static parseAddress(arg: string): string | null {
    // MAIL FROM:<addr>  /  RCPT TO:<addr>
    const match = arg.match(/<([^>]*)>/);
    if (match) return match[1].trim();
    const colon = arg.indexOf(':');
    if (colon !== -1) return arg.slice(colon + 1).trim();
    return arg.trim() || null;
  }
}
