import { login, setup, getCurrentUser, logout, isAuthenticated } from '@/lib/auth';
import { authApi } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: {
      login: jest.fn(),
      setup: jest.fn(),
      me: jest.fn(),
    },
  };
});

describe('auth helpers', () => {
  const user = { id: '1', email: 'a@b.de', displayName: 'A', isAdmin: false };

  it('login returns user', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({ user });
    await expect(login('a@b.de', 'password123')).resolves.toEqual(user);
  });

  it('setup returns user', async () => {
    (authApi.setup as jest.Mock).mockResolvedValue({ user });
    await expect(setup('a@b.de', 'password123', 'A')).resolves.toEqual(user);
  });

  it('getCurrentUser returns null on error', async () => {
    (authApi.me as jest.Mock).mockRejectedValue(new Error('nope'));
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('getCurrentUser returns user', async () => {
    (authApi.me as jest.Mock).mockResolvedValue({ user });
    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it('logout and isAuthenticated are cookie-based', () => {
    logout();
    expect(isAuthenticated()).toBe(true);
  });
});
