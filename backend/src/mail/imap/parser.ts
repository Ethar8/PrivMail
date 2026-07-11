export interface IMAPCommand {
  tag: string;
  name: string;
  args: string[];
  raw: string;
}

export class IMAPParser {
  static parse(line: string): IMAPCommand {
    const raw = line.replace(/\r?\n$/, '');
    const parts = IMAPParser.tokenize(raw);
    const tag = parts.shift() ?? '*';
    const name = (parts.shift() ?? '').toUpperCase();
    return { tag, name, args: parts, raw };
  }

  static tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ' ' && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += c;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }
}
