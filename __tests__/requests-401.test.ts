jest.mock('axios', () => {
  const client: any = jest.fn();
  client.interceptors = {
    request: { use: jest.fn() },
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => client),
      __client: client,
    },
    __client: client,
  };
});

jest.mock('@/utils/helper', () => ({
  clearAllData: jest.fn().mockResolvedValue(undefined),
  retrieveToken: jest.fn().mockResolvedValue('stored-token'),
}));

import axios from 'axios';
import { request } from '@/utils/requests';
import { onSessionExpired } from '@/utils/session-expiry';
import { clearAllData } from '@/utils/helper';

const mockClient = (axios as any).__client;

describe('request 401 handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears storage and signals expiry for an authenticated request', async () => {
    const onExpired = jest.fn();
    const unsubscribe = onSessionExpired(onExpired);

    mockClient.mockRejectedValueOnce({
      message: 'Unauthorized',
      config: { headers: { Authorization: 'Bearer stored-token' } },
      response: { status: 401, data: { status_code: 401 } },
    });

    const result = await request({ method: 'GET', url: '/profile' });

    expect(result).toEqual({ data: null, error: 'Unauthorized' });
    expect(clearAllData).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not signal expiry when an unauthenticated request returns 401', async () => {
    const onExpired = jest.fn();
    const unsubscribe = onSessionExpired(onExpired);

    mockClient.mockRejectedValueOnce({
      message: 'Invalid credentials',
      config: { headers: {} },
      response: { status: 401, data: { status_code: 401 } },
    });

    await request({ method: 'POST', url: '/auth/login' });

    expect(clearAllData).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();

    unsubscribe();
  });
});
