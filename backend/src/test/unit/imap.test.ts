import { IMAPParser } from '../../mail/imap/parser';
import { IMAPResponse } from '../../mail/imap/response';

describe('IMAPParser', () => {
  it('parses tag, command and args', () => {
    const cmd = IMAPParser.parse('a1 LOGIN alice@example.com secret');
    expect(cmd.tag).toBe('a1');
    expect(cmd.name).toBe('LOGIN');
    expect(cmd.args).toEqual(['alice@example.com', 'secret']);
  });

  it('handles quoted arguments', () => {
    const cmd = IMAPParser.parse('a2 SELECT "My Mailbox"');
    expect(cmd.name).toBe('SELECT');
    expect(cmd.args).toEqual(['My Mailbox']);
  });

  it('tokenizes correctly', () => {
    expect(IMAPParser.tokenize('a b "c d"')).toEqual(['a', 'b', 'c d']);
  });
});

describe('IMAPResponse', () => {
  it('formats tagged OK', () => {
    expect(IMAPResponse.ok('a1', 'done')).toBe('a1 OK done\r\n');
  });

  it('formats untagged', () => {
    expect(IMAPResponse.untagged('5 EXISTS')).toBe('* 5 EXISTS\r\n');
  });

  it('formats greeting', () => {
    expect(IMAPResponse.greeting()).toContain('* OK');
  });
});
