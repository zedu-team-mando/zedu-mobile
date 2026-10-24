import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ThemedRefreshControl } from '@/components/ui/themed-refresh-control';
import { AppText } from '@/components/ui/text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Container from '@/components/layout/container';
import { GetRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { useTheme } from '@/theme/ThemeProvider';
import { createSecurityScreenStyles } from '@/theme/createScreenStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Session {
  id: string;
  user_id: string;
  access_token_id: string;
  login_at: string;
  ip_address: string;
  location: string;
  device: string;
  created_at: string;
  is_live: boolean;
}

const SkeletonBox = ({
  width,
  height,
  style,
  skeletonStyle,
}: {
  width: number | string;
  height: number;
  style?: object;
  skeletonStyle: object;
}) => <View style={[{ width, height }, skeletonStyle, style]} />;

const SecuritySkeleton = ({
  styles,
}: {
  styles: ReturnType<typeof createSecurityScreenStyles>;
}) => (
  <View style={styles.scrollContent}>
    <SkeletonBox
      width="40%"
      height={22}
      skeletonStyle={styles.skeleton}
      style={{ marginVertical: 20 }}
    />
    {[1, 2, 3, 4].map(i => (
      <View key={i} style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <SkeletonBox
            width={40}
            height={40}
            skeletonStyle={styles.skeleton}
            style={{ borderRadius: 20 }}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBox
              width="40%"
              height={16}
              skeletonStyle={styles.skeleton}
              style={{ marginBottom: 6 }}
            />
            <SkeletonBox
              width="60%"
              height={12}
              skeletonStyle={styles.skeleton}
            />
          </View>
        </View>
      </View>
    ))}
  </View>
);

const SecurityScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createSecurityScreenStyles(colors), [colors]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { state } = useDataContext();
  const { user } = state;

  const fetchSessions = async (pageNum: number, isRefresh: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);

    const limit = 10;
    const { data, error } = await GetRequest(
      `/users/${user?.user_id}/login-audit?page=${pageNum}&limit=${limit}`,
    );

    if (!error && data?.data) {
      if (isRefresh) {
        setSessions(data.data);
      } else {
        setSessions(prev => [...prev, ...data.data]);
      }

      // Check if there are more pages
      const pagination = data.pagination;
      setHasMore(pagination.current_page < pagination.total_pages_count);
    }

    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchSessions(1);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchSessions(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSessions(nextPage);
    }
  };

  const getDeviceIcon = (device: string) => {
    const d = device.toLowerCase();
    if (
      d.includes('chrome') ||
      d.includes('safari') ||
      d.includes('browser') ||
      d.includes('unknown')
    )
      return 'laptop';
    if (d.includes('iphone') || d.includes('android')) return 'cellphone';
    return 'help-circle-outline';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDeviceLabel = (device?: string) => {
    if (
      !device ||
      device.trim() === '' ||
      device.trim().toLowerCase() === 'unknown'
    ) {
      return 'Unknown device';
    }
    return device;
  };

  return (
    <Container>
      <View style={styles.header}>
        <TouchableOpacity
          testID="security-back-button"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.iconDefault} />
        </TouchableOpacity>
        <AppText variant="bold" style={styles.headerTitle}>
          Account Security
        </AppText>
      </View>

      {loading ? (
        <SecuritySkeleton styles={styles} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
          refreshControl={
            <ThemedRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <View style={styles.introContainer}>
            <AppText variant="bold" style={styles.introTitle}>
              Where you are logged in
            </AppText>
            <AppText style={styles.introSubtitle}>
              Review the devices and browsers that have logged in to your
              account. If you do not recognize one, end that session and change
              your password.
            </AppText>
          </View>

          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={48}
                color={colors.iconMuted}
              />
              <AppText style={styles.emptyText}>
                No active sessions found.
              </AppText>
            </View>
          ) : (
            <>
              {sessions.map(session => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons
                        name={getDeviceIcon(session.device) as any}
                        size={22}
                        color={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.sessionMeta}>
                      <AppText variant="bold" style={styles.deviceName}>
                        {getDeviceLabel(session.device)}
                      </AppText>
                      <AppText style={styles.locationText}>
                        {`${session.location || 'Unknown location'} · ${
                          session.ip_address || 'Unknown IP'
                        }`}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.sessionDetails}>
                    <View style={styles.detailItem}>
                      <AppText style={styles.detailLabel}>LOGGED IN</AppText>
                      <AppText style={styles.detailValue}>
                        {formatDate(session.login_at)}
                      </AppText>
                    </View>
                    <View
                      testID={`status-pill-${session.id}`}
                      style={[
                        styles.statusPill,
                        session.is_live
                          ? styles.activeStatusPill
                          : styles.inactiveStatusPill,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          session.is_live
                            ? styles.activeStatusDot
                            : styles.inactiveStatusDot,
                        ]}
                      />
                      <AppText
                        style={[
                          styles.statusPillText,
                          session.is_live
                            ? styles.activeStatusText
                            : styles.inactiveStatusText,
                        ]}
                      >
                        {session.is_live ? 'Active' : 'Inactive'}
                      </AppText>
                    </View>
                  </View>
                </View>
              ))}

              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <AppText style={styles.loadMoreText}>
                      Load More Sessions
                    </AppText>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* <AppButton
                        title="Sign Out of All Devices"
                        variant="secondary"
                        onPress={() => { }}
                        style={styles.signOutAll}
                    /> */}
        </ScrollView>
      )}
    </Container>
  );
};

export default SecurityScreen;
