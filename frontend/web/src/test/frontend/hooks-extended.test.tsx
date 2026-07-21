/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useEmail } from '@/hooks/useEmail';
import { useAI } from '@/hooks/useAI';
import { mailApi } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    mailApi: {
      list: jest.fn(),
      get: jest.fn(),
      markRead: jest.fn(),
      remove: jest.fn(),
      send: jest.fn(),
    },
  };
});

jest.mock('@/lib/db', () => ({
  saveEmailLocally: jest.fn(async () => undefined),
  updateEmailBodyLocally: jest.fn(async () => undefined),
}));

describe('useEmail', () => {
  it('loads mailbox list via refresh', async () => {
    (mailApi.list as jest.Mock).mockResolvedValue({
      emails: [
        {
          id: '1',
          subject: 'Hi',
          from: 'a',
          to: 'b',
          receivedAt: new Date().toISOString(),
          isRead: false,
          isEncrypted: false,
          spamScore: 0,
          mailbox: 'INBOX',
        },
      ],
    });
    const { result } = renderHook(() => useEmail('INBOX'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emails.length).toBe(1);
  });
});

describe('useAI', () => {
  it('exposes summarize helpers', async () => {
    const { result } = renderHook(() => useAI());
    expect(typeof result.current.summarize).toBe('function');
    expect(typeof result.current.toneCheck).toBe('function');
  });
});
