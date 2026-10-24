/**
 * @format
 */

import React from 'react';
import { Share } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import InvitePeopleScreen from '../invite-screen';
import { GetRequest, PostRequest } from '../../../utils/requests';
// The dotenv babel plugin inlines this at transform time (exactly as it does
// in the screen), so the expectation tracks the value the code under test got.
import { CLIENT_URL } from '@env';

jest.mock('../../../utils/requests', () => ({
  GetRequest: jest.fn(),
  PostRequest: jest.fn(),
}));

jest.mock('../../../store/useDataContext', () => ({
  useDataContext: () => ({
    state: { orgId: 'org-1', orgData: {} },
    dispatch: jest.fn(),
  }),
}));

jest.mock('../../../theme/ThemeProvider', () => {
  const actual = jest.requireActual('../../../theme/ThemeProvider');
  return {
    ...actual,
    useTheme: () => ({
      colors: {
        primary: '#000',
        iconDefault: '#000',
        textSecondary: '#000',
        textPrimary: '#000',
        border: '#000',
        background: '#fff',
        surface: '#fff',
        surfaceElevated: '#fff',
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

jest.mock('../../../components/ui/toast', () => ({
  ShowNotify: jest.fn(),
}));

const mockedGetRequest = GetRequest as jest.Mock;
const mockedPostRequest = PostRequest as jest.Mock;
// react-native's Share.share is a plain function under Jest; stub it explicitly.
const mockedShare = jest.fn();
Share.share = mockedShare;

const roles = [
  { id: 'role-user', name: 'User' },
  { id: 'role-admin', name: 'Admin' },
];

// The label text sits inside AppText > View > ... > TouchableOpacity, so the
// match's direct parent is never the touchable. Walk up to the first ancestor
// that exposes an onPress handler, or trigger role selection via the role dropdown.
const findTouchable = (
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
) => {
  const role = roles.find(r => r.name === label);
  if (role) {
    try {
      const dropdown = root.findByProps({ testID: 'role-dropdown' });
      if (dropdown) {
        return {
          props: {
            onPress: () =>
              dropdown.props.onChange({ label: role.name, value: role.id }),
          },
        } as any;
      }
    } catch {}
  }
  const nodes = root.findAllByProps({ children: label });
  let node: any = nodes[0];
  while (node && typeof node.props?.onPress !== 'function') {
    node = node.parent;
  }
  return node as ReactTestRenderer.ReactTestInstance;
};

const findShareButton = (root: ReactTestRenderer.ReactTestInstance) => {
  try {
    return root.findByProps({ testID: 'share-invite-button' });
  } catch {
    return (findTouchable(root, 'Share link via...') ||
      findTouchable(root, 'Share link (generate a link first)')) as any;
  }
};

const flushPromises = () => new Promise(setImmediate);

const renderScreen = async () => {
  mockedGetRequest.mockResolvedValue({ data: { data: roles }, error: null });
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <InvitePeopleScreen navigation={{ goBack: jest.fn() }} />,
    );
    await flushPromises();
  });
  return renderer!;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedShare.mockResolvedValue({ action: 'sharedAction' });
});

test('share is disabled before link generation', async () => {
  const renderer = await renderScreen();
  const shareButton = findShareButton(renderer.root);

  expect(shareButton.props.disabled).toBe(true);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).not.toHaveBeenCalled();
});

test('successful generation enables sharing with the complete URL', async () => {
  const renderer = await renderScreen();
  mockedPostRequest.mockResolvedValue({
    data: { data: { invitation_link: 'invite/abc123' } },
    error: null,
  });

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  await act(async () => {
    generateButton.props.onPress();
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(false);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).toHaveBeenCalledTimes(1);
  expect(mockedShare.mock.calls[0][0].message).toContain(
    `${CLIENT_URL}/invite/abc123`,
  );
});

test('failed generation leaves sharing disabled', async () => {
  const renderer = await renderScreen();
  mockedPostRequest.mockResolvedValue({ data: null, error: 'boom' });

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  await act(async () => {
    generateButton.props.onPress();
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(true);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).not.toHaveBeenCalled();
});
test('changing roles invalidates the previous link', async () => {
  const renderer = await renderScreen();
  mockedPostRequest.mockResolvedValue({
    data: { data: { invitation_link: 'invite/abc123' } },
    error: null,
  });

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  await act(async () => {
    generateButton.props.onPress();
    await flushPromises();
  });

  expect(findShareButton(renderer.root).props.disabled).toBe(false);

  const adminChip = findTouchable(renderer.root, 'Admin') as any;

  await act(async () => {
    adminChip.props.onPress();
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(true);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).not.toHaveBeenCalled();
});

test('sharing is disabled while generation is in progress', async () => {
  const renderer = await renderScreen();
  let resolveGeneration: (value: any) => void = () => undefined;
  mockedPostRequest.mockReturnValue(
    new Promise(resolve => {
      resolveGeneration = resolve;
    }),
  );

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  let generation: Promise<void> | undefined;
  await act(async () => {
    generation = generateButton.props.onPress() as Promise<void>;
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(true);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });
  expect(mockedShare).not.toHaveBeenCalled();

  await act(async () => {
    resolveGeneration({
      data: { data: { invitation_link: 'invite/abc123' } },
      error: null,
    });
    await generation;
    await flushPromises();
  });

  expect(findShareButton(renderer.root).props.disabled).toBe(false);
});

test('an outdated response cannot restore a link after role change', async () => {
  const renderer = await renderScreen();
  let firstResolve: (value: any) => void = () => undefined;
  mockedPostRequest.mockReturnValueOnce(
    new Promise(resolve => {
      firstResolve = resolve;
    }),
  );

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  let firstGeneration: Promise<void> | undefined;
  await act(async () => {
    firstGeneration = generateButton.props.onPress() as Promise<void>;
    await flushPromises();
  });

  const adminChip = findTouchable(renderer.root, 'Admin') as any;

  await act(async () => {
    adminChip.props.onPress();
    await flushPromises();
  });

  await act(async () => {
    firstResolve({
      data: { data: { invitation_link: 'invite/stale' } },
      error: null,
    });
    await firstGeneration;
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(true);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).not.toHaveBeenCalled();
  const staleNodes = renderer.root.findAll(node => {
    try {
      return (
        typeof node.props?.children === 'string' &&
        (node.props.children as string).includes('invite/stale')
      );
    } catch {
      return false;
    }
  });
  expect(staleNodes.length).toBe(0);
});

test('switching roles while generation is pending re-enables generation for the new role', async () => {
  const renderer = await renderScreen();
  let resolveFirst: (value: any) => void = () => undefined;
  mockedPostRequest.mockReturnValueOnce(
    new Promise(resolve => {
      resolveFirst = resolve;
    }),
  );

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  let firstGeneration: Promise<void> | undefined;
  await act(async () => {
    firstGeneration = generateButton.props.onPress() as Promise<void>;
    await flushPromises();
  });
  expect(mockedPostRequest).toHaveBeenCalledTimes(1);

  const adminChip = findTouchable(renderer.root, 'Admin') as any;
  await act(async () => {
    adminChip.props.onPress();
    await flushPromises();
  });

  // The Generate button must be usable immediately: no spinner is rendered
  // while the outdated request is still pending.
  const generateAgain = findTouchable(renderer.root, 'Generate') as any;

  let resolveSecond: (value: any) => void = () => undefined;
  mockedPostRequest.mockReturnValueOnce(
    new Promise(resolve => {
      resolveSecond = resolve;
    }),
  );

  let secondGeneration: Promise<void> | undefined;
  await act(async () => {
    secondGeneration = generateAgain.props.onPress() as Promise<void>;
    await flushPromises();
  });

  expect(mockedPostRequest).toHaveBeenCalledTimes(2);
  expect(mockedPostRequest.mock.calls[1][1]).toEqual({
    organisation_id: 'org-1',
    role_id: 'role-admin',
  });

  // The outdated response arrives while the new request is still pending:
  // it must not clear the current loading state or show a stale link.
  await act(async () => {
    resolveFirst({
      data: { data: { invitation_link: 'invite/stale' } },
      error: null,
    });
    await firstGeneration;
    await flushPromises();
  });

  expect(findShareButton(renderer.root).props.disabled).toBe(true);
  const staleNodes = renderer.root.findAll(node => {
    try {
      return (
        typeof node.props?.children === 'string' &&
        (node.props.children as string).includes('invite/stale')
      );
    } catch {
      return false;
    }
  });
  expect(staleNodes.length).toBe(0);

  // The latest request controls the loading state and delivers the link.
  await act(async () => {
    resolveSecond({
      data: { data: { invitation_link: 'invite/admin-link' } },
      error: null,
    });
    await secondGeneration;
    await flushPromises();
  });

  expect(findShareButton(renderer.root).props.disabled).toBe(false);
  const freshNodes = renderer.root.findAll(node => {
    try {
      return (
        typeof node.props?.children === 'string' &&
        (node.props.children as string).includes('invite/admin-link')
      );
    } catch {
      return false;
    }
  });
  expect(freshNodes.length).toBeGreaterThan(0);
});

test('an outdated response completing after the current one cannot overwrite the link', async () => {
  const renderer = await renderScreen();
  let resolveFirst: (value: any) => void = () => undefined;
  let resolveSecond: (value: any) => void = () => undefined;
  mockedPostRequest
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveFirst = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveSecond = resolve;
      }),
    );

  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  let firstGeneration: Promise<void> | undefined;
  await act(async () => {
    firstGeneration = generateButton.props.onPress() as Promise<void>;
    await flushPromises();
  });

  // Invalidate the first request by switching roles, then generate again.
  const adminChip = findTouchable(renderer.root, 'Admin') as any;
  await act(async () => {
    adminChip.props.onPress();
    await flushPromises();
  });

  const generateAgain = findTouchable(renderer.root, 'Generate') as any;
  let secondGeneration: Promise<void> | undefined;
  await act(async () => {
    secondGeneration = generateAgain.props.onPress() as Promise<void>;
    await flushPromises();
  });

  // The current request completes first and enables sharing.
  await act(async () => {
    resolveSecond({
      data: { data: { invitation_link: 'invite/current' } },
      error: null,
    });
    await secondGeneration;
    await flushPromises();
  });

  expect(findShareButton(renderer.root).props.disabled).toBe(false);

  // The outdated response arrives last and must change nothing.
  await act(async () => {
    resolveFirst({
      data: { data: { invitation_link: 'invite/stale' } },
      error: null,
    });
    await firstGeneration;
    await flushPromises();
  });

  const shareButton = findShareButton(renderer.root);
  expect(shareButton.props.disabled).toBe(false);

  await act(async () => {
    shareButton.props.onPress();
    await flushPromises();
  });

  expect(mockedShare).toHaveBeenCalledTimes(1);
  expect(mockedShare.mock.calls[0][0].message).toContain('invite/current');
  expect(mockedShare.mock.calls[0][0].message).not.toContain('invite/stale');
});

test('renders role dropdown with all offered roles and corrected copy', async () => {
  const renderer = await renderScreen();

  // Dropdown presents all available roles
  const dropdown = renderer.root.findByProps({ testID: 'role-dropdown' });
  expect(dropdown).toBeDefined();
  expect(dropdown.props.data).toEqual([
    { label: 'User', value: 'role-user' },
    { label: 'Admin', value: 'role-admin' },
  ]);

  // Corrected copy in invite link section
  const copyNodes = renderer.root.findAllByProps({
    children: 'Anyone with this link joins as the role selected above.',
  });
  expect(copyNodes.length).toBeGreaterThan(0);

  // Disabled share button text is "Share link (generate a link first)"
  const shareBtn = findShareButton(renderer.root);
  expect(shareBtn.props.disabled).toBe(true);
  const disabledLabelNodes = renderer.root.findAllByProps({
    children: 'Share link (generate a link first)',
  });
  expect(disabledLabelNodes.length).toBeGreaterThan(0);
});

test('updates share button copy when link is generated', async () => {
  mockedPostRequest.mockResolvedValue({
    data: { data: { invitation_link: 'invite/gen-link' } },
    error: null,
  });

  const renderer = await renderScreen();
  const generateButton = findTouchable(renderer.root, 'Generate') as any;

  await act(async () => {
    await generateButton.props.onPress();
    await flushPromises();
  });

  const shareBtn = findShareButton(renderer.root);
  expect(shareBtn.props.disabled).toBe(false);
  const activeLabelNodes = renderer.root.findAllByProps({
    children: 'Share link via...',
  });
  expect(activeLabelNodes.length).toBeGreaterThan(0);
});
