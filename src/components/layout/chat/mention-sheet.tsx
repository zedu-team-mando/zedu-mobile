import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Image, FlatList } from 'react-native';
import type { ListRenderItem } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createMentionSheetStyles } from '@/theme/createChatOverlayStyles';
import { searchMentionParticipants } from './mention-search';

interface MentionParticipant {
  user_id: string | number;
  username?: string | null;
  avatar_url?: string | null;
  online?: boolean;
  default_avatar_url?: string | null;
}

interface ChannelMention {
  user_id: 'channel';
  username: 'channel';
  type: 'channel';
}

interface MentionSheetProps {
  query: string;
  showChannelMention?: boolean;
  participants: MentionParticipant[];
  onSelect: (user: MentionParticipant | ChannelMention) => void;
}

const FALLBACK_AVATAR = require('@/assets/images/user.png');
const INITIAL_RENDER_COUNT = 5;

export const MentionSheet = ({
  query,
  showChannelMention = false,
  participants,
  onSelect,
}: MentionSheetProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createMentionSheetStyles(colors), [colors]);

  const safeParticipants = useMemo(
    () => (Array.isArray(participants) ? participants : []),
    [participants],
  );

  const showChannelOption = useMemo(() => {
    if (!showChannelMention) {
      return false;
    }

    const normalizedQuery = query.trim().toLowerCase();
    return (
      normalizedQuery.length === 0 || 'channel'.startsWith(normalizedQuery)
    );
  }, [query, showChannelMention]);

  const filteredParticipants = useMemo(
    () => searchMentionParticipants(safeParticipants, query),
    [query, safeParticipants],
  );

  const renderChannelOption = useCallback(() => {
    if (!showChannelOption) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() =>
          onSelect({
            user_id: 'channel',
            username: 'channel',
            type: 'channel',
          })
        }
      >
        <View style={styles.channelMentionBadge}>
          <AppText
            variant="bold"
            size={13}
            style={styles.channelMentionBadgeText}
          >
            @
          </AppText>
        </View>
        <View style={styles.memberInfo}>
          <AppText
            variant="medium"
            size={14}
            style={styles.channelMentionLabel}
          >
            channel
          </AppText>
          <AppText size={12} style={styles.statusText}>
            Notify everyone in this channel
          </AppText>
        </View>
      </TouchableOpacity>
    );
  }, [onSelect, showChannelOption, styles]);

  const renderParticipant = useCallback<ListRenderItem<MentionParticipant>>(
    ({ item }) => {
      const avatarUri = item.avatar_url || item.default_avatar_url;

      return (
        <TouchableOpacity
          style={styles.memberRow}
          onPress={() => onSelect(item)}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={avatarUri ? { uri: avatarUri } : FALLBACK_AVATAR}
              style={styles.avatar}
            />
            <View
              style={item.online ? styles.onlineBadge : styles.offlineBadge}
            />
          </View>

          <View style={styles.memberInfo}>
            <AppText variant="medium" size={14}>
              {item.username || 'Unknown'}
            </AppText>
            <AppText size={12} style={styles.statusText}>
              {item.online ? 'Active' : 'Away'}
            </AppText>
          </View>
        </TouchableOpacity>
      );
    },
    [onSelect, styles],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <AppText style={styles.emptyText}>
          {safeParticipants.length === 0
            ? 'No members available'
            : 'No matches found'}
        </AppText>
      </View>
    ),
    [safeParticipants.length, styles],
  );

  const keyExtractor = useCallback(
    (item: MentionParticipant, index: number) =>
      String(item.user_id ?? item.username ?? index),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="bold" size={14}>
          Mention someone
        </AppText>
        <AppText size={12} style={styles.headerHint}>
          {query ? `Results for "@${query}"` : 'Members in this chat'}
        </AppText>
      </View>

      <FlatList
        data={filteredParticipants}
        renderItem={renderParticipant}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderChannelOption}
        ListEmptyComponent={renderEmptyState}
        bounces={false}
        style={styles.list}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        removeClippedSubviews
        initialNumToRender={INITIAL_RENDER_COUNT}
        maxToRenderPerBatch={INITIAL_RENDER_COUNT}
        windowSize={5}
      />
    </View>
  );
};
