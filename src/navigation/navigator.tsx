import WorkspaceDrawer from '@/components/layout/workspace-drawer';
import { useTheme } from '@/theme/ThemeProvider';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return <WorkspaceDrawer {...props} />;
}

// Drawer wraps the TabNavigator, but only enables drawer on Chats
const MainDrawerNavigator = () => {
  const [isChatsFocused, setIsChatsFocused] = React.useState(true);
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.4)',
        drawerStyle: { width: '85%', backgroundColor: colors.surface },
        swipeEnabled: isChatsFocused,
        // gestureEnabled: isChatsFocused,
      }}
    >
      <Drawer.Screen name="Tabs">
        {_props => <TabNavigator onChatsFocus={setIsChatsFocused} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};
import React, { useEffect, useRef, useState } from 'react';
import {
  createStackNavigator,
  TransitionPresets,
} from '@react-navigation/stack';
import WelcomeScreen from '@/screens/welcomescreen';
import SignupScreen from '@/screens/auth/signup';
import SigninScreen from '@/screens/auth/signin';
// import MainDrawerNavigator from './drawer-navigator';
import { ChatStack, ChatStackParamList } from './stacks/chats';
import { ChannelStack, ChannelStackParamList } from './stacks/channels';
import { AgentStackParamList } from './stacks/agents';
import { SettingStack, SettingStackParamList } from './stacks/settings';
import { NavigatorScreenParams } from '@react-navigation/native';
import { retrieveMultipleData } from '@/utils/helper';
import { onSessionExpired } from '@/utils/session-expiry';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from '@env';
import { ShowNotify } from '@/components/ui/toast';
import { BuzzStack, BuzzStackParamList } from './stacks/buzz';
import { MentionStack, MentionStackParamList } from './stacks/mentions';
import TabNavigator from './tab-navigator';
import {
  DirectCallStack,
  DirectCallStackParamList,
} from './stacks/direct-calls';
import { FileStack, FileStackParamList } from './stacks/files';
import {
  clearAndroidLaunchIncomingCall,
  getAndroidLaunchIncomingCall,
  subscribeToAndroidIncomingCalls,
  subscribeToAndroidIncomingCallCancelled,
} from '@/services/android-incoming-call.service';
import {
  clearIosLaunchIncomingCall,
  getIosLaunchIncomingCall,
  subscribeToIosIncomingCalls,
  subscribeToIosIncomingCallCancelled,
} from '@/services/ios-incoming-call.service';
import {
  startIosVoipPushCancelHandling,
  startIosVoipPushLogging,
  startIosVoipPushTokenSync,
} from '@/services/ios-voip-push.service';
import {
  ensureOngoingDirectCallScreen,
  handleNativeIncomingCallAction,
  isActiveBuzzCallRoute,
  NativeIncomingCallEvent,
  navigateToIncomingDirectCall,
  parseInviteFromNotification,
  shouldProcessIncomingCallInvite,
} from '@/services/incoming-direct-call.handler';
import {
  consumePendingMessageNotification,
  handleMessageNotificationClick,
} from '@/services/notification-navigation.service';
import {
  extractDirectCallCancelDetails,
  extractDirectCallAnsweredElsewhereDetails,
  handleIncomingDirectCallCancelled,
  handleIncomingDirectCallAnsweredElsewhere,
} from '@/services/incoming-direct-call-cancel.service';
import { getActiveRouteName, navigate } from './root-navigation';
import { MinimizedCallWidget } from '@/components/buzz/MinimizedCallWidget';
import { VoiceNotePlaybackHost } from '@/components/layout/chat/voice-note-playback-host';
import { useAndroidCallOverlay } from '@/hooks/useAndroidCallOverlay';
import { useActiveCallActions } from '@/hooks/useActiveCallActions';
import GeneralNotificationConnection from '@/centrifugoo/general-notification-connection';
import AgoraConnection from '@/centrifugoo/agora-connection';
import ChannelConnection from '@/centrifugoo/channel-connection';
import DMConnection from '@/centrifugoo/dm-connection';

export type RootStackParamList = {
  Welcome: undefined;
  Signup: undefined;
  Signin: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordCode: undefined;
  ForgotPasswordReset: undefined;
  MainTabs: undefined;
  MainDrawer: undefined;
  ChatStack: NavigatorScreenParams<ChatStackParamList>;
  BuzzStack: NavigatorScreenParams<BuzzStackParamList>;
  ChannelStack: NavigatorScreenParams<ChannelStackParamList>;
  AgentStack: NavigatorScreenParams<AgentStackParamList>;
  SettingStack: NavigatorScreenParams<SettingStackParamList>;
  MentionStack: NavigatorScreenParams<MentionStackParamList>;
  DirectCallStack: NavigatorScreenParams<DirectCallStackParamList>;
  FileStack: NavigatorScreenParams<FileStackParamList>;
};

const Stack = createStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  currentRoute?: string;
}

export const AppNavigator = ({ currentRoute }: AppNavigatorProps) => {
  const { colors } = useTheme();
  const { state, dispatch } = useDataContext();
  const { isMuted, toggleMic, sendQuickEmoji, endCall } =
    useActiveCallActions();
  useAndroidCallOverlay({ currentRoute });
  const [initializing, setInitializing] = useState(true);
  const isInitializedRef = useRef(false);
  const hasTokenRef = useRef(false);
  const userRef = useRef(state?.user);
  const buzzDataRef = useRef(state?.buzzData);
  const dmsRef = useRef(state?.dms);
  const userChannelsRef = useRef(state?.userChannels);
  const callbackRef = useRef(state?.callback);
  const channelCallbackRef = useRef(state?.channelCallback);
  const dispatchRef = useRef(dispatch);
  const buzzIsMutedRef = useRef(state?.buzzIsMuted);
  const buzzShowVideoRef = useRef(state?.buzzShowVideo);
  const hasJoinedRef = useRef(state?.hasJoined);
  const sessionExpiryHandledRef = useRef(false);

  useEffect(() => {
    if (state?.token) {
      sessionExpiryHandledRef.current = false;
    }
  }, [state?.token]);

  useEffect(() => {
    return onSessionExpired(() => {
      if (sessionExpiryHandledRef.current) return;
      sessionExpiryHandledRef.current = true;

      dispatch({ type: ACTIONS.TOKEN, payload: null });
      dispatch({ type: ACTIONS.USER, payload: null });
      dispatch({ type: ACTIONS.ORG_ID, payload: null });
      dispatch({ type: ACTIONS.ORG_DATA, payload: null });
      dispatch({ type: ACTIONS.USER_CHANNELS, payload: [] });
      dispatch({ type: ACTIONS.DMS, payload: [] });
      dispatch({ type: ACTIONS.DMS_CHAT, payload: { data: [], page: 1 } });
      ShowNotify('Session expired', 'Please sign in again.');
    });
  }, [dispatch]);

  useEffect(() => {
    isInitializedRef.current = !initializing;
    hasTokenRef.current = Boolean(state?.token);
  }, [initializing, state?.token]);

  useEffect(() => {
    userRef.current = state?.user;
  }, [state?.user]);

  useEffect(() => {
    buzzDataRef.current = state?.buzzData;
  }, [state?.buzzData]);

  useEffect(() => {
    dmsRef.current = state?.dms;
  }, [state?.dms]);

  useEffect(() => {
    userChannelsRef.current = state?.userChannels;
  }, [state?.userChannels]);

  useEffect(() => {
    callbackRef.current = state?.callback;
  }, [state?.callback]);

  useEffect(() => {
    channelCallbackRef.current = state?.channelCallback;
  }, [state?.channelCallback]);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    buzzIsMutedRef.current = state?.buzzIsMuted;
  }, [state?.buzzIsMuted]);

  useEffect(() => {
    buzzShowVideoRef.current = state?.buzzShowVideo;
  }, [state?.buzzShowVideo]);

  useEffect(() => {
    hasJoinedRef.current = state?.hasJoined;
  }, [state?.hasJoined]);

  const getAndroidAcceptContext = () => ({
    dispatch: dispatchRef.current,
    user: userRef.current,
    buzzIsMuted: buzzIsMutedRef.current,
    buzzShowVideo: buzzShowVideoRef.current,
  });

  const getMessageNotificationDeps = () => ({
    dispatch: dispatchRef.current,
    dms: dmsRef.current,
    userChannels: userChannelsRef.current,
    callback: callbackRef.current,
    channelCallback: channelCallbackRef.current,
  });

  const isMessageNotificationReady = () =>
    isInitializedRef.current && hasTokenRef.current;

  useEffect(() => {
    OneSignal.initialize(ONESIGNAL_APP_ID);
    OneSignal.Notifications.requestPermission(true);

    const isDirectCallNotification = (notification: any) => {
      const payload =
        notification?.additionalData ||
        notification?.rawPayload?.custom?.a ||
        {};

      const bodyPayload =
        typeof notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      return (
        payload?.event === 'direct_call_initiated' ||
        bodyPayload?.event === 'direct_call_initiated'
      );
    };

    const isDirectCallCancelledNotification = (notification: any) => {
      const payload =
        notification?.additionalData ||
        notification?.rawPayload?.custom?.a ||
        {};

      const bodyPayload =
        typeof notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      return Boolean(
        extractDirectCallCancelDetails({
          ...payload,
          ...(bodyPayload && typeof bodyPayload === 'object'
            ? bodyPayload
            : {}),
        }),
      );
    };

    const processIncomingCallCancelled = async (notification: any) => {
      const payload =
        notification?.additionalData ||
        notification?.rawPayload?.custom?.a ||
        {};
      const bodyPayload =
        typeof notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      const cancelDetails = extractDirectCallCancelDetails({
        ...payload,
        ...(bodyPayload && typeof bodyPayload === 'object' ? bodyPayload : {}),
      });

      if (!cancelDetails) return;

      await handleIncomingDirectCallCancelled(cancelDetails.buzzId, {
        notify: true,
        callerName: cancelDetails.callerName,
        dispatch: dispatchRef.current,
      });
    };

    const processIncomingCallAnsweredElsewhere = async (notification: any) => {
      const payload =
        notification?.additionalData ||
        notification?.rawPayload?.custom?.a ||
        {};
      const bodyPayload =
        typeof notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      const answeredDetails = extractDirectCallAnsweredElsewhereDetails(
        {
          ...payload,
          ...(bodyPayload && typeof bodyPayload === 'object'
            ? bodyPayload
            : {}),
        },
        userRef.current?.user_id || userRef.current?.id,
      );

      if (!answeredDetails) return;

      const activeBuzzId = String(buzzDataRef.current?.buzz_id || '');
      const isAlreadyInThisCall =
        activeBuzzId === answeredDetails.buzzId &&
        Boolean(hasJoinedRef.current);

      if (isAlreadyInThisCall) {
        return;
      }

      await handleIncomingDirectCallAnsweredElsewhere(answeredDetails.buzzId, {
        dispatch: dispatchRef.current,
      });
    };

    const processIncomingCallInvite = async (notification: any) => {
      if (Platform.OS === 'ios') {
        return;
      }

      const parsed = parseInviteFromNotification(notification);
      if (!parsed) return;

      if (
        !shouldProcessIncomingCallInvite(parsed, {
          currentUserId: userRef.current?.user_id || userRef.current?.id,
          activeBuzz: buzzDataRef.current,
        })
      ) {
        return;
      }

      if (!isInitializedRef.current || !hasTokenRef.current) {
        return;
      }

      navigateToIncomingDirectCall(parsed);
    };

    const processNativeIncomingCallEvent: (
      event: NativeIncomingCallEvent,
      clearLaunch: () => Promise<void>,
    ) => Promise<void> = async (event, clearLaunch) => {
      if (!event) return;

      if (Platform.OS === 'ios' && event.action === 'open') {
        await clearLaunch();
        return;
      }

      const isTerminalIncomingAction =
        event.action === 'decline' || event.action === 'timeout';

      if (
        !isTerminalIncomingAction &&
        !shouldProcessIncomingCallInvite(event.invite, {
          currentUserId: userRef.current?.user_id || userRef.current?.id,
          activeBuzz: buzzDataRef.current,
        })
      ) {
        await clearLaunch();
        return;
      }

      if (!isInitializedRef.current || !hasTokenRef.current) {
        return;
      }

      if (
        isTerminalIncomingAction &&
        !shouldProcessIncomingCallInvite(event.invite, {
          currentUserId: userRef.current?.user_id || userRef.current?.id,
          activeBuzz: buzzDataRef.current,
        })
      ) {
        await clearLaunch();
        return;
      }

      await handleNativeIncomingCallAction(
        event.action,
        event.invite,
        getAndroidAcceptContext(),
      );
      await clearLaunch();
    };

    const onClickListener = async (event: any) => {
      if (isDirectCallCancelledNotification(event?.notification)) {
        await processIncomingCallCancelled(event?.notification);
        return;
      }

      const answeredNotificationPayload =
        event?.notification?.additionalData ||
        event?.notification?.rawPayload?.custom?.a ||
        {};
      const answeredBodyPayload =
        typeof event?.notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(event.notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      if (
        extractDirectCallAnsweredElsewhereDetails(
          {
            ...answeredNotificationPayload,
            ...(answeredBodyPayload && typeof answeredBodyPayload === 'object'
              ? answeredBodyPayload
              : {}),
          },
          userRef.current?.user_id || userRef.current?.id,
        )
      ) {
        await processIncomingCallAnsweredElsewhere(event?.notification);
        return;
      }

      if (isDirectCallNotification(event?.notification)) {
        if (Platform.OS === 'android') {
          await processIncomingCallInvite(event?.notification);
        }
        return;
      }

      await handleMessageNotificationClick(
        event?.notification,
        getMessageNotificationDeps(),
        {
          isReady: isMessageNotificationReady(),
        },
      );
    };

    const onForegroundDisplayListener = async (event: any) => {
      if (isDirectCallCancelledNotification(event?.notification)) {
        event.preventDefault();
        await processIncomingCallCancelled(event?.notification);
        return;
      }

      const answeredNotificationPayload =
        event?.notification?.additionalData ||
        event?.notification?.rawPayload?.custom?.a ||
        {};
      const answeredBodyPayload =
        typeof event?.notification?.body === 'string'
          ? (() => {
              try {
                return JSON.parse(event.notification.body);
              } catch {
                return null;
              }
            })()
          : null;

      if (
        extractDirectCallAnsweredElsewhereDetails(
          {
            ...answeredNotificationPayload,
            ...(answeredBodyPayload && typeof answeredBodyPayload === 'object'
              ? answeredBodyPayload
              : {}),
          },
          userRef.current?.user_id || userRef.current?.id,
        )
      ) {
        event.preventDefault();
        await processIncomingCallAnsweredElsewhere(event?.notification);
        return;
      }

      if (isDirectCallNotification(event?.notification)) {
        event.preventDefault();
        if (Platform.OS === 'ios') {
          console.warn(
            '[OneSignal] direct call notification received on iOS — check VoIP Push logs separately',
          );
        } else {
          await processIncomingCallInvite(event?.notification);
        }
        return;
      }

      if (Platform.OS === 'android') {
        const body = event?.notification?.body;
        const bodyText =
          typeof body === 'string'
            ? body.replace(/<[^>]*>?/gm, '')
            : body != null
            ? String(body)
            : '';
        ShowNotify(event?.notification?.title as string, bodyText);
      }

      event.getNotification().display();
    };

    OneSignal.Notifications.addEventListener('click', onClickListener);
    OneSignal.Notifications.addEventListener(
      'foregroundWillDisplay',
      onForegroundDisplayListener,
    );

    let unsubscribeNativeIncomingCall: () => void = () => {};
    let unsubscribeNativeIncomingCallCancelled: () => void = () => {};

    if (Platform.OS === 'android') {
      unsubscribeNativeIncomingCall = subscribeToAndroidIncomingCalls(event => {
        processNativeIncomingCallEvent(event, clearAndroidLaunchIncomingCall);
      });

      unsubscribeNativeIncomingCallCancelled =
        subscribeToAndroidIncomingCallCancelled(buzzId => {
          handleIncomingDirectCallCancelled(buzzId, {
            notify: true,
            dispatch: dispatchRef.current,
          }).catch(() => {});
        });
    }

    if (Platform.OS === 'ios') {
      unsubscribeNativeIncomingCall = subscribeToIosIncomingCalls(event => {
        processNativeIncomingCallEvent(event, clearIosLaunchIncomingCall);
      });

      unsubscribeNativeIncomingCallCancelled =
        subscribeToIosIncomingCallCancelled(buzzId => {
          handleIncomingDirectCallCancelled(buzzId, {
            notify: true,
            dispatch: dispatchRef.current,
          }).catch(() => {});
        });
    }

    return () => {
      OneSignal.Notifications.removeEventListener('click', onClickListener);
      OneSignal.Notifications.removeEventListener(
        'foregroundWillDisplay',
        onForegroundDisplayListener,
      );
      unsubscribeNativeIncomingCall();
      unsubscribeNativeIncomingCallCancelled();
    };
  }, []);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const keys = ['token', 'organisation', 'current_org', 'user'];
        const [token, organisation, current_org, user] =
          (await retrieveMultipleData(keys)) || [];

        if (token) {
          dispatch({ type: ACTIONS.TOKEN, payload: token });
          dispatch({ type: ACTIONS.ORG_ID, payload: current_org });
          dispatch({ type: ACTIONS.ORG_DATA, payload: organisation });
          dispatch({ type: ACTIONS.USER, payload: user });
        }
      } finally {
        setInitializing(false);
      }
    };

    bootstrapAsync();
  }, [dispatch]);

  useEffect(() => {
    if (initializing || !state?.token) {
      return;
    }

    consumePendingMessageNotification(getMessageNotificationDeps(), {
      isReady: true,
    }).catch(() => {});
  }, [initializing, state?.token, state?.dms, state?.userChannels]);

  useEffect(() => {
    if (initializing || !state?.token) {
      return;
    }

    const consumeNativeLaunchCall = async () => {
      const launchEvent =
        Platform.OS === 'ios'
          ? await getIosLaunchIncomingCall()
          : Platform.OS === 'android'
          ? await getAndroidLaunchIncomingCall()
          : null;

      if (!launchEvent) return;

      if (Platform.OS === 'ios' && launchEvent.action === 'open') {
        await clearIosLaunchIncomingCall();
        return;
      }

      const clearLaunch =
        Platform.OS === 'ios'
          ? clearIosLaunchIncomingCall
          : clearAndroidLaunchIncomingCall;

      const isTerminalLaunchAction =
        launchEvent.action === 'decline' || launchEvent.action === 'timeout';

      const shouldProcessInvite = shouldProcessIncomingCallInvite(
        launchEvent.invite,
        {
          currentUserId: state?.user?.user_id || state?.user?.id,
          activeBuzz: state?.buzzData,
        },
      );

      if (!isTerminalLaunchAction && !shouldProcessInvite) {
        await clearLaunch();
        return;
      }

      if (isTerminalLaunchAction && !shouldProcessInvite) {
        await clearLaunch();
        return;
      }

      await handleNativeIncomingCallAction(
        launchEvent.action,
        launchEvent.invite,
        {
          dispatch,
          user: state?.user,
          buzzIsMuted: state?.buzzIsMuted,
          buzzShowVideo: state?.buzzShowVideo,
        },
      );
      await clearLaunch();
    };

    const runConsumeNativeLaunchCall = () => {
      consumeNativeLaunchCall().catch(() => {});
    };

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      runConsumeNativeLaunchCall();
    }

    if (Platform.OS !== 'ios') {
      return;
    }

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && nextState !== 'inactive') {
        return;
      }

      if (
        nextState === 'active' &&
        hasJoinedRef.current &&
        buzzDataRef.current
      ) {
        const activeRoute = getActiveRouteName();
        if (!isActiveBuzzCallRoute(activeRoute)) {
          ensureOngoingDirectCallScreen(buzzDataRef.current);
        }
      }

      getIosLaunchIncomingCall()
        .then(launchEvent => {
          if (!launchEvent) return;

          const inviteBuzzId = String(launchEvent.invite?.buzz_id || '');
          const activeBuzzId = String(buzzDataRef.current?.buzz_id || '');
          if (
            hasJoinedRef.current &&
            inviteBuzzId &&
            activeBuzzId &&
            inviteBuzzId === activeBuzzId
          ) {
            clearIosLaunchIncomingCall().catch(() => {});
            return;
          }

          if (
            launchEvent?.action === 'accept' ||
            launchEvent?.action === 'decline' ||
            launchEvent?.action === 'timeout'
          ) {
            runConsumeNativeLaunchCall();
          }
        })
        .catch(() => {});
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [
    initializing,
    state?.token,
    state?.user,
    state?.buzzData,
    state?.buzzIsMuted,
    state?.buzzShowVideo,
    dispatch,
  ]);

  useEffect(() => {
    if (initializing || !state?.token || Platform.OS !== 'ios') {
      return;
    }

    const stopVoipPushLogging = startIosVoipPushLogging();
    const stopVoipTokenSync = startIosVoipPushTokenSync();
    const stopVoipPushCancelHandling = startIosVoipPushCancelHandling(
      dispatch,
      () => userRef.current?.user_id || userRef.current?.id,
    );

    return () => {
      stopVoipPushLogging();
      stopVoipTokenSync();
      stopVoipPushCancelHandling();
    };
  }, [initializing, state?.token, dispatch]);

  if (initializing) return null;

  const minimizedBuzzCode = state?.buzzData?.buzz_code;
  const minimizedChannelId = String(state?.buzzData?.channel_id || '');
  const isCallRoute =
    currentRoute === 'OngoingDirectCall' ||
    currentRoute === 'CallScreen' ||
    currentRoute === 'ChannelCall';

  return (
    <>
      <Stack.Navigator
        key={state?.token ? 'MainTabs' : 'Signin'}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
          ...(Platform.OS === 'ios'
            ? TransitionPresets.SlideFromRightIOS
            : {
                animationEnabled: true,
                cardStyleInterpolator: ({ current, next, layouts }) => {
                  return {
                    cardStyle: {
                      transform: [
                        {
                          // Incoming screen slides in from right
                          translateX: current.progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [layouts.screen.width, 0],
                            extrapolate: 'clamp',
                          }),
                        },
                        {
                          // Outgoing screen pushes out slightly to the left
                          translateX: next
                            ? next.progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -layouts.screen.width * 0.3],
                                extrapolate: 'clamp',
                              })
                            : 0,
                        },
                      ],
                    },
                  };
                },
              }),
        }}
      >
        {!state?.token ? (
          // Auth Screens
          <Stack.Group>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Signin" component={SigninScreen} />
            <Stack.Screen
              name="ForgotPasswordEmail"
              component={
                require('@/screens/auth/forgot/ForgotPasswordEmailScreen')
                  .default
              }
            />
            <Stack.Screen
              name="ForgotPasswordCode"
              component={
                require('@/screens/auth/forgot/ForgotPasswordCodeScreen')
                  .default
              }
            />
            <Stack.Screen
              name="ForgotPasswordReset"
              component={
                require('@/screens/auth/forgot/ForgotPasswordResetScreen')
                  .default
              }
            />
          </Stack.Group>
        ) : (
          // Authenticated Screens
          <Stack.Group>
            {/* Drawer overlays the tabs, only enabled on Chats */}
            <Stack.Screen name="MainTabs" component={MainDrawerNavigator} />
            <Stack.Screen name="ChatStack" component={ChatStack} />
            <Stack.Screen name="ChannelStack" component={ChannelStack} />
            <Stack.Screen name="BuzzStack" component={BuzzStack} />
            <Stack.Screen name="DirectCallStack" component={DirectCallStack} />
            <Stack.Screen name="SettingStack" component={SettingStack} />
            <Stack.Screen name="MentionStack" component={MentionStack} />
            <Stack.Screen name="FileStack" component={FileStack} />
          </Stack.Group>
        )}
      </Stack.Navigator>

      {state?.isCallMinimized &&
      state?.minimizedFrom === 'CallScreen' &&
      minimizedBuzzCode ? (
        <AgoraConnection id={minimizedBuzzCode} />
      ) : null}

      {state?.isCallMinimized &&
      state?.minimizedFrom === 'ChannelCall' &&
      minimizedChannelId ? (
        <ChannelConnection id={minimizedChannelId} />
      ) : null}

      {state?.isCallMinimized &&
      state?.minimizedFrom === 'OngoingDirectCall' &&
      minimizedChannelId ? (
        <DMConnection id={minimizedChannelId} />
      ) : null}

      {!isCallRoute && (
        <MinimizedCallWidget
          visible={state?.isCallMinimized ?? false}
          isMuted={isMuted}
          onExpand={() => {
            const buzzCode = minimizedBuzzCode;
            const buzzData = state?.buzzData;
            if (!buzzCode || !buzzData) return;
            dispatch({ type: ACTIONS.CALL_MINIMIZED, payload: false });
            if (state?.minimizedFrom === 'CallScreen') {
              navigate('BuzzStack', {
                screen: 'CallScreen',
                params: { buzzCode, buzzData },
              } as any);
            } else if (state?.minimizedFrom === 'ChannelCall') {
              navigate('BuzzStack', {
                screen: 'ChannelCall',
                params: { buzzCode, buzzData },
              } as any);
            } else {
              navigate('DirectCallStack', {
                screen: 'OngoingDirectCall',
                params: { buzzCode, buzzData },
              } as any);
            }
          }}
          onEndCall={endCall}
          onToggleMic={toggleMic}
          onToggleEmoji={sendQuickEmoji}
          buzzCode={state?.buzzData?.buzz_code}
        />
      )}

      <VoiceNotePlaybackHost />

      <GeneralNotificationConnection />
    </>
  );
};
