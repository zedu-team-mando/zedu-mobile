import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MediaPreviewModal from '@/components/media/MediaPreviewModal';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createChatMediaStyles } from '@/theme/createChatOverlayStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Container from '@/components/layout/container';
import {
  useChannelFiles,
  ChannelFileMediaItem,
} from '@/services/channels/channel-files';

type PreviewMediaItem = ChannelFileMediaItem;

type MediaGalleryScreenRouteProp = RouteProp<
  {
    MediaGalleryScreen: {
      preview_media?: PreviewMediaItem[];
      channel_id?: string;
    };
  },
  'MediaGalleryScreen'
>;

type MediaGalleryScreenNavigationProp = StackNavigationProp<any>;

type MediaGalleryScreenProps = {
  route: MediaGalleryScreenRouteProp;
  navigation: MediaGalleryScreenNavigationProp;
};

type EmptyStateContent = {
  icon: string;
  title: string;
  description: string;
};

type MediaTabProps = {
  media: PreviewMediaItem[];
  onImagePress: (img: PreviewMediaItem) => void;
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyState: EmptyStateContent;
  styles: ReturnType<typeof createChatMediaStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
};

const EmptyState: React.FC<{
  content: EmptyStateContent;
  styles: ReturnType<typeof createChatMediaStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ content, styles, colors }) => (
  <View style={styles.emptyState}>
    <Ionicons name={content.icon} size={48} color={colors.iconMuted} />
    <AppText variant="bold" size={16} style={styles.emptyTitle}>
      {content.title}
    </AppText>
    <AppText size={13} style={styles.emptyDescription}>
      {content.description}
    </AppText>
  </View>
);

const AUDIO_EXTENSIONS = ['wav', 'm4a', 'mp3', 'ogg', 'aac', 'flac'];

const getFileExtension = (fileName: string): string => {
  if (!fileName) return '';
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ext;
};

const decodeFileName = (fileName: string): string => {
  try {
    return decodeURIComponent(fileName || '');
  } catch {
    return fileName || '';
  }
};

const extensionFromFileLink = (fileLink: string): string => {
  if (!fileLink) return '';
  const path = fileLink.split('?')[0];
  const segment = path.split('/').pop() || '';
  return getFileExtension(decodeFileName(segment));
};

/** Audio is determined by extension / file_type / link — not misleading video MIME (e.g. m4a as video/mp4). */
const isAudioItem = (item: PreviewMediaItem): boolean => {
  const fileName = decodeFileName(item.file_name);
  const nameExt = getFileExtension(fileName);
  const fileType = (item.file_type || '').toLowerCase().trim();
  const linkExt = extensionFromFileLink(item.file_link);

  if (AUDIO_EXTENSIONS.includes(nameExt)) return true;
  if (AUDIO_EXTENSIONS.includes(fileType)) return true;
  if (AUDIO_EXTENSIONS.includes(linkExt)) return true;

  const mimeType = (item.mime_type || '').toLowerCase();
  return mimeType.startsWith('audio/');
};

const isVideoItem = (item: PreviewMediaItem): boolean => {
  if (isAudioItem(item)) return false;

  const fileName = decodeFileName(item.file_name);
  const nameExt = getFileExtension(fileName);
  const fileType = (item.file_type || '').toLowerCase().trim();
  const linkExt = extensionFromFileLink(item.file_link);
  const mimeType = (item.mime_type || '').toLowerCase();
  const videoExtensions = ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'];

  if (videoExtensions.includes(nameExt)) return true;
  if (videoExtensions.includes(fileType)) return true;
  if (videoExtensions.includes(linkExt)) return true;
  if (mimeType.startsWith('video/')) return true;
  return false;
};

const isDocumentItem = (item: PreviewMediaItem): boolean => {
  if (isAudioItem(item) || isVideoItem(item)) return false;

  const fileName = decodeFileName(item.file_name);
  const nameExt = getFileExtension(fileName);
  const fileType = (item.file_type || '').toLowerCase().trim();
  const linkExt = extensionFromFileLink(item.file_link);
  const mimeType = (item.mime_type || '').toLowerCase();
  const docExtensions = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'csv',
  ];

  if (
    mimeType.includes('pdf') ||
    nameExt === 'pdf' ||
    fileType === 'pdf' ||
    linkExt === 'pdf'
  )
    return true;
  if (
    docExtensions.includes(nameExt) ||
    docExtensions.includes(fileType) ||
    docExtensions.includes(linkExt)
  )
    return true;
  if (
    mimeType.startsWith('application') &&
    !mimeType.startsWith('application/octet-stream')
  ) {
    return true;
  }
  return false;
};

const getDocumentVisual = (
  fileName: string,
  mime: string,
  fallbackColor: string,
) => {
  const ext = getFileExtension(fileName);
  const mimeType = (mime || '').toLowerCase();

  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return { icon: 'document-text-outline', color: '#DC2626' };
  }

  if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) {
    return { icon: 'document-outline', color: '#2563EB' };
  }

  if (
    ['xls', 'xlsx', 'csv'].includes(ext) ||
    mimeType.includes('sheet') ||
    mimeType.includes('excel')
  ) {
    return { icon: 'grid-outline', color: '#16A34A' };
  }

  if (
    ['ppt', 'pptx'].includes(ext) ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation')
  ) {
    return { icon: 'easel-outline', color: '#EA580C' };
  }

  if (ext === 'txt') {
    return { icon: 'reader-outline', color: '#4B5563' };
  }

  return { icon: 'document-attach-outline', color: fallbackColor };
};

const MediaTab: React.FC<MediaTabProps> = ({
  media,
  onImagePress,
  loading,
  loadingMore,
  onLoadMore,
  emptyState,
  styles,
  colors,
}) => {
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onLoadMore) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 120) {
      onLoadMore();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (media.length === 0) {
    return <EmptyState content={emptyState} styles={styles} colors={colors} />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.mediaGrid}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {media.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.mediaItem}
            onPress={() => onImagePress(item)}
            activeOpacity={0.8}
          >
            {isAudioItem(item) ? (
              <View style={styles.audioPlaceholder}>
                <Ionicons
                  name="musical-notes"
                  size={44}
                  color={colors.primary}
                />
              </View>
            ) : isDocumentItem(item) ? (
              <View style={styles.docGridPlaceholder}>
                <Ionicons
                  name={
                    getDocumentVisual(
                      item.file_name,
                      item.mime_type,
                      colors.primary,
                    ).icon
                  }
                  size={36}
                  color={
                    getDocumentVisual(
                      item.file_name,
                      item.mime_type,
                      colors.primary,
                    ).color
                  }
                />
              </View>
            ) : isVideoItem(item) ? (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="play" size={32} color={colors.white} />
              </View>
            ) : (
              <FastImage
                source={{ uri: item.file_link }}
                style={styles.mediaImage}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
          </TouchableOpacity>
        ))}

        {loadingMore && (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>
    </>
  );
};

type ListTabProps = {
  items: PreviewMediaItem[];
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyState: EmptyStateContent;
  renderRow: (item: PreviewMediaItem) => React.ReactNode;
  styles: ReturnType<typeof createChatMediaStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
};

const ListTab: React.FC<ListTabProps> = ({
  items,
  loading,
  loadingMore,
  onLoadMore,
  emptyState,
  renderRow,
  styles,
  colors,
}) => {
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onLoadMore) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 120) {
      onLoadMore();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return <EmptyState content={emptyState} styles={styles} colors={colors} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.linksList}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {items.map(item => renderRow(item))}
      {loadingMore && (
        <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
      )}
    </ScrollView>
  );
};

const TAB_LIST = [
  { key: 'all', label: 'All' },
  { key: 'images', label: 'Images' },
  { key: 'videos', label: 'Videos' },
  { key: 'audio', label: 'Audio' },
  { key: 'documents', label: 'Documents' },
] as const;

const FILE_CATEGORY_PARAM: Record<
  (typeof TAB_LIST)[number]['key'],
  string | undefined
> = {
  all: undefined,
  images: 'images',
  videos: 'videos',
  audio: 'audio',
  documents: 'documents',
};

const EMPTY_STATES: Record<
  (typeof TAB_LIST)[number]['key'],
  EmptyStateContent
> = {
  all: {
    icon: 'folder-open-outline',
    title: 'Nothing shared yet',
    description:
      'Photos, videos, audio and documents shared in this conversation will show up here.',
  },
  images: {
    icon: 'images-outline',
    title: 'No images yet',
    description: 'Images shared in this conversation will show up here.',
  },
  videos: {
    icon: 'videocam-outline',
    title: 'No videos yet',
    description: 'Videos shared in this conversation will show up here.',
  },
  audio: {
    icon: 'musical-notes-outline',
    title: 'No audio yet',
    description: 'Audio files shared in this conversation will show up here.',
  },
  documents: {
    icon: 'document-text-outline',
    title: 'No documents yet',
    description: 'Documents shared in this conversation will show up here.',
  },
};

const MediaGalleryScreen: React.FC<MediaGalleryScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createChatMediaStyles(colors), [colors]);
  const { channel_id } = route.params || {};
  const usesChannelApi = Boolean(channel_id);

  const [activeTab, setActiveTab] =
    React.useState<(typeof TAB_LIST)[number]['key']>('all');
  const fileCategory = FILE_CATEGORY_PARAM[activeTab];

  const {
    files: channelFiles,
    loading: channelLoading,
    setLoading: setChannelLoading,
    loadingMore: channelLoadingMore,
    loadMore: channelLoadMore,
    error: channelError,
  } = useChannelFiles(channel_id, fileCategory);

  type TabKey = (typeof TAB_LIST)[number]['key'];
  const tabScrollRef = useRef<ScrollView>(null);
  const tabLayoutsRef = useRef<Record<TabKey, { x: number; width: number }>>(
    {} as Record<TabKey, { x: number; width: number }>,
  );
  const underlineLeft = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [previewItem, setPreviewItem] = React.useState<PreviewMediaItem | null>(
    null,
  );

  const animateUnderlineToTab = (tabKey: TabKey) => {
    const layout = tabLayoutsRef.current[tabKey];
    if (!layout) {
      return;
    }

    Animated.parallel([
      Animated.spring(underlineLeft, {
        toValue: layout.x,
        useNativeDriver: false,
        speed: 20,
        bounciness: 8,
      }),
      Animated.spring(underlineWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        speed: 20,
        bounciness: 8,
      }),
    ]).start();

    tabScrollRef.current?.scrollTo({
      x: Math.max(0, layout.x - 24),
      animated: true,
    });
  };

  const handleTabLayout = (tabKey: TabKey, event: LayoutChangeEvent) => {
    const { x, width: tabWidth } = event.nativeEvent.layout;
    tabLayoutsRef.current[tabKey] = { x, width: tabWidth };
    if (tabKey === activeTab) {
      underlineLeft.setValue(x);
      underlineWidth.setValue(tabWidth);
    }
  };

  useEffect(() => {
    animateUnderlineToTab(activeTab);
  }, [activeTab]);

  const handleTabPress = (tabKey: TabKey) => {
    if (tabKey === activeTab) {
      return;
    }
    setChannelLoading(true);
    setActiveTab(tabKey);
  };

  const handleMediaPress = (item: PreviewMediaItem) => {
    setPreviewItem(item);
  };

  const tabLoadingMore = channelLoadingMore;
  const tabLoadMore = channelLoadMore;

  return (
    <Container>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="bold" style={styles.headerTitle}>
          Media, Links & Docs
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      {usesChannelApi && channelError ? (
        <View style={styles.loadingWrap}>
          <AppText size={13} style={styles.emptyText}>
            {channelError}
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.customTabBarContainer}>
            <View style={styles.customTabBar}>
              <ScrollView
                ref={tabScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.customTabScrollContent}
              >
                {TAB_LIST.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={styles.customTabBtn}
                    activeOpacity={0.7}
                    onPress={() => handleTabPress(tab.key)}
                    onLayout={event => handleTabLayout(tab.key, event)}
                  >
                    <AppText
                      style={[
                        styles.customTabLabel,
                        activeTab === tab.key && styles.customTabLabelActive,
                      ]}
                    >
                      {tab.label}
                    </AppText>
                  </TouchableOpacity>
                ))}
                <Animated.View
                  style={[
                    styles.customTabUnderline,
                    {
                      left: underlineLeft,
                      width: underlineWidth,
                    },
                  ]}
                />
              </ScrollView>
            </View>
          </View>
          <View style={styles.tabContentContainer}>
            {activeTab !== 'documents' && (
              <MediaTab
                media={channelFiles}
                onImagePress={handleMediaPress}
                loading={channelLoading}
                loadingMore={tabLoadingMore}
                onLoadMore={tabLoadMore}
                emptyState={EMPTY_STATES[activeTab]}
                styles={styles}
                colors={colors}
              />
            )}
            {activeTab === 'documents' && (
              <ListTab
                items={channelFiles}
                loading={channelLoading}
                loadingMore={tabLoadingMore}
                onLoadMore={tabLoadMore}
                emptyState={EMPTY_STATES.documents}
                styles={styles}
                colors={colors}
                renderRow={item => (
                  <TouchableOpacity key={item.id} style={styles.docItem}>
                    <Ionicons
                      name={
                        getDocumentVisual(
                          item.file_name,
                          item.mime_type,
                          colors.primary,
                        ).icon
                      }
                      size={22}
                      color={
                        getDocumentVisual(
                          item.file_name,
                          item.mime_type,
                          colors.primary,
                        ).color
                      }
                      style={{ marginRight: 10 }}
                    />
                    <AppText style={styles.docText} numberOfLines={1}>
                      {item.file_name || item.file_link}
                    </AppText>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </>
      )}

      <MediaPreviewModal
        visible={!!previewItem}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </Container>
  );
};

export default MediaGalleryScreen;
