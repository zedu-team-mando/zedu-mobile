/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import SecurityScreen from '../security-screen';
import { GetRequest } from '../../../utils/requests';

jest.mock('../../../utils/requests', () => ({
  GetRequest: jest.fn(),
}));

jest.mock('../../../store/useDataContext', () => ({
  useDataContext: () => ({
    state: {
      user: { user_id: 'test-user-123' },
    },
    dispatch: jest.fn(),
  }),
}));

jest.mock('../../../theme/ThemeProvider', () => {
  const actual = jest.requireActual('../../../theme/ThemeProvider');
  return {
    ...actual,
    useTheme: () => ({
      colors: {
        primary: '#5B44E8',
        iconDefault: '#1F2937',
        iconMuted: '#9CA3AF',
        textSecondary: '#6B7280',
        textPrimary: '#111827',
        border: '#E5E7EB',
        background: '#FFFFFF',
        surface: '#FFFFFF',
        surfaceElevated: '#F9FAFB',
        black: '#000000',
        online: '#10B981',
        categoryChip: '#F3F4F6',
      },
    }),
  };
});

jest.mock('../../../components/layout/container', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockedGetRequest = GetRequest as jest.Mock;
const flushPromises = () => new Promise(setImmediate);

const mockSessions = [
  {
    id: 'session-1',
    user_id: 'test-user-123',
    access_token_id: 'token-1',
    login_at: '2026-10-09T10:29:00Z',
    ip_address: '162.159.113.82',
    location: 'Amsterdam',
    device: 'Unknown',
    created_at: '2026-10-09T10:29:00Z',
    is_live: true,
  },
  {
    id: 'session-2',
    user_id: 'test-user-123',
    access_token_id: 'token-2',
    login_at: '2026-10-07T20:11:00Z',
    ip_address: '172.70.47.186',
    location: 'Amsterdam',
    device: 'Chrome',
    created_at: '2026-10-07T20:11:00Z',
    is_live: true,
  },
  {
    id: 'session-3',
    user_id: 'test-user-123',
    access_token_id: 'token-3',
    login_at: '2026-09-30T19:49:00Z',
    ip_address: '104.23.166.121',
    location: 'Amsterdam',
    device: 'Firefox on macOS',
    created_at: '2026-09-30T19:49:00Z',
    is_live: false,
  },
];

describe('SecurityScreen session list redesign (#68)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSecurityScreen = async (sessions = mockSessions) => {
    mockedGetRequest.mockResolvedValue({
      data: {
        data: sessions,
        pagination: { current_page: 1, total_pages_count: 1 },
      },
      error: null,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SecurityScreen navigation={{ goBack: jest.fn() }} />,
      );
      await flushPromises();
    });
    return renderer!;
  };

  test('displays intro heading and description', async () => {
    const renderer = await renderSecurityScreen();

    const titleNodes = renderer.root.findAllByProps({
      children: 'Where you are logged in',
    });
    expect(titleNodes.length).toBeGreaterThan(0);

    const descNodes = renderer.root.findAllByProps({
      children:
        'Review the devices and browsers that have logged in to your account. If you do not recognize one, end that session and change your password.',
    });
    expect(descNodes.length).toBeGreaterThan(0);
  });

  test('renders "Unknown device" when device name is unknown or missing', async () => {
    const renderer = await renderSecurityScreen();

    // Session 1 has device: 'Unknown', should render 'Unknown device'
    const unknownDeviceNodes = renderer.root.findAllByProps({
      children: 'Unknown device',
    });
    expect(unknownDeviceNodes.length).toBeGreaterThan(0);

    // Session 2 has device: 'Chrome'
    const chromeDeviceNodes = renderer.root.findAllByProps({
      children: 'Chrome',
    });
    expect(chromeDeviceNodes.length).toBeGreaterThan(0);
  });

  test('each card displays location, IP, and LOGGED IN label', async () => {
    const renderer = await renderSecurityScreen();

    const loggedInLabelNodes = renderer.root.findAllByProps({
      children: 'LOGGED IN',
    });
    expect(loggedInLabelNodes.length).toBeGreaterThanOrEqual(
      mockSessions.length,
    );

    const locationTextNodes = renderer.root.findAllByProps({
      children: 'Amsterdam · 162.159.113.82',
    });
    expect(locationTextNodes.length).toBeGreaterThan(0);
  });

  test('renders status as a pill with a dot and text label', async () => {
    const renderer = await renderSecurityScreen();

    const pill1 = renderer.root.findByProps({
      testID: 'status-pill-session-1',
    });
    expect(pill1).toBeDefined();

    const activeNodes = pill1.findAllByProps({ children: 'Active' });
    expect(activeNodes.length).toBeGreaterThan(0);

    const pill3 = renderer.root.findByProps({
      testID: 'status-pill-session-3',
    });
    expect(pill3).toBeDefined();

    const inactiveNodes = pill3.findAllByProps({ children: 'Inactive' });
    expect(inactiveNodes.length).toBeGreaterThan(0);
  });

  test('hides "This session" badge and "End session" button until backend support exists', async () => {
    const renderer = await renderSecurityScreen();

    const thisSessionNodes = renderer.root.findAllByProps({
      children: 'This session',
    });
    expect(thisSessionNodes.length).toBe(0);

    const endSessionNodes = renderer.root.findAllByProps({
      children: 'End session',
    });
    expect(endSessionNodes.length).toBe(0);
  });

  test('shows empty state when no sessions exist', async () => {
    const renderer = await renderSecurityScreen([]);

    const emptyTextNodes = renderer.root.findAllByProps({
      children: 'No active sessions found.',
    });
    expect(emptyTextNodes.length).toBeGreaterThan(0);
  });
});
