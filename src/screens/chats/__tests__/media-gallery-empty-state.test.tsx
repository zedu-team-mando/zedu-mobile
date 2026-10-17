/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MediaGalleryScreen from '@/screens/chats/media-gallery';

const mockFiles: { current: any } = { current: {} };

jest.mock('@/services/channels/channel-files', () => ({
  useChannelFiles: () => mockFiles.current,
}));

jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: {}, dispatch: jest.fn() }),
}));

// The preview modal plays media natively and isn't under test.
jest.mock('@/components/media/MediaPreviewModal', () => () => null);

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: require('@/theme/palettes').lightColors,
    isDark: false,
  }),
}));

type Renderer = ReactTestRenderer.ReactTestRenderer;

const filesState = (overrides: Record<string, unknown> = {}) => ({
  files: [],
  loading: false,
  setLoading: jest.fn(),
  loadingMore: false,
  loadMore: jest.fn(),
  error: null,
  ...overrides,
});

const renderScreen = async () => {
  let renderer: Renderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <MediaGalleryScreen
        navigation={{ goBack: jest.fn() } as any}
        route={{ params: { channel_id: 'channel-1' } } as any}
      />,
    );
  });
  return renderer!;
};

const texts = (renderer: Renderer) =>
  renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));

const iconNames = (renderer: Renderer) =>
  renderer.root.findAllByType(Ionicons).map(node => node.props.name);

const openTab = async (renderer: Renderer, label: string) => {
  const tab = renderer.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(t => t.props.children === label),
    )!;
  await ReactTestRenderer.act(() => {
    tab.props.onPress();
  });
};

const EMPTY_STATES = [
  {
    tab: 'All',
    icon: 'folder-open-outline',
    title: 'Nothing shared yet',
    description:
      'Photos, videos, audio and documents shared in this conversation will show up here.',
  },
  {
    tab: 'Images',
    icon: 'images-outline',
    title: 'No images yet',
    description: 'Images shared in this conversation will show up here.',
  },
  {
    tab: 'Videos',
    icon: 'videocam-outline',
    title: 'No videos yet',
    description: 'Videos shared in this conversation will show up here.',
  },
  {
    tab: 'Audio',
    icon: 'musical-notes-outline',
    title: 'No audio yet',
    description: 'Audio files shared in this conversation will show up here.',
  },
  {
    tab: 'Documents',
    icon: 'document-text-outline',
    title: 'No documents yet',
    description: 'Documents shared in this conversation will show up here.',
  },
];

describe('MediaGalleryScreen empty state', () => {
  let current: Renderer | undefined;

  beforeEach(() => {
    mockFiles.current = filesState();
  });

  afterEach(async () => {
    await ReactTestRenderer.act(() => {
      current?.unmount();
    });
    current = undefined;
  });

  it.each(EMPTY_STATES)(
    'shows the icon, title and explanation on the $tab tab',
    async ({ tab, icon, title, description }) => {
      current = await renderScreen();
      if (tab !== 'All') {
        await openTab(current, tab);
      }

      expect(texts(current)).toEqual(
        expect.arrayContaining([title, description]),
      );
      expect(iconNames(current)).toContain(icon);
    },
  );

  it('no longer shows the generated "No <tab> files found" phrases', async () => {
    current = await renderScreen();
    const seen: string[] = [...texts(current)];
    for (const { tab } of EMPTY_STATES.slice(1)) {
      await openTab(current, tab);
      seen.push(...texts(current));
    }

    expect(seen.filter(text => / files found$/.test(text))).toEqual([]);
    expect(seen).not.toContain('No documents found');
  });

  it('shows the files instead of the empty state when the tab has files', async () => {
    mockFiles.current = filesState({
      files: [
        {
          id: 'file-1',
          file_name: 'notes.pdf',
          file_link: 'https://zedu.chat/files/notes.pdf',
          file_type: 'pdf',
          mime_type: 'application/pdf',
        },
      ],
    });
    current = await renderScreen();
    await openTab(current, 'Documents');

    expect(texts(current)).toContain('notes.pdf');
    expect(texts(current)).not.toContain('No documents yet');
  });

  it('keeps showing the loader, not the empty state, while loading', async () => {
    mockFiles.current = filesState({ loading: true });
    current = await renderScreen();

    expect(current.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(texts(current)).not.toContain('Nothing shared yet');
  });

  it('keeps showing the error message when files fail to load', async () => {
    mockFiles.current = filesState({ error: 'Failed to fetch files' });
    current = await renderScreen();

    expect(texts(current)).toContain('Failed to fetch files');
    expect(texts(current)).not.toContain('Nothing shared yet');
  });
});
