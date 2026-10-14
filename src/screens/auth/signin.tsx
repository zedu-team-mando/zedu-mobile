import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AppText } from '@/components/ui/text';
import { AppInput } from '@/components/ui/input';
import { AppButton } from '@/components/ui/button';
import { useNavigation } from '@react-navigation/native';
import { configureGoogleSignIn, signInWithGoogle } from '@/lib/google-auth';
import { signInWithApple } from '@/lib/apple-auth';
import { PostRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import Container from '@/components/layout/container';
import { storeMultipleData } from '@/utils/helper';
import { useTheme } from '@/theme/ThemeProvider';
import { createAuthStyles } from '@/theme/createScreenStyles';

const SigninScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createAuthStyles(colors), [colors]);
  const { dispatch } = useDataContext();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const appleData = await signInWithApple();
      const token = appleData?.identityToken;

      if (token) {
        const { data, error } = await PostRequest('/auth/apple', {
          id_token: token,
        });

        if (error) {
          setAppleLoading(false);
          return;
        }
        await storeMultipleData([
          ['user', data.data.user],
          ['token', data.data.access_token],
          ['current_org', data.data.user.current_org],
          ['organisation', data.data.user.organisation],
        ]);
        dispatch({ type: ACTIONS.USER, payload: data.data.user });
        dispatch({ type: ACTIONS.TOKEN, payload: data.data.access_token });
        dispatch({ type: ACTIONS.ORG_ID, payload: data.data.user.current_org });
        dispatch({
          type: ACTIONS.ORG_DATA,
          payload: data.data.user.organisation,
        });
      }
    } catch (_e) {
      // Already logged in signInWithApple
    }
    setAppleLoading(false);
  };

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const googleData = await signInWithGoogle();
      const token = googleData?.idToken;

      if (token) {
        const { data, error } = await PostRequest('/auth/google', {
          grant_code: token,
        });

        if (error) {
          return;
        }

        await storeMultipleData([
          ['user', data.data.user],
          ['token', data.data.access_token],
          ['current_org', data.data.user.current_org],
          ['organisation', data.data.user.organisation],
        ]);

        dispatch({ type: ACTIONS.USER, payload: data.data.user });
        dispatch({ type: ACTIONS.TOKEN, payload: data.data.access_token });
        dispatch({
          type: ACTIONS.ORG_ID,
          payload: data.data.user.current_org,
        });
        dispatch({
          type: ACTIONS.ORG_DATA,
          payload: data.data.user.organisation,
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    setButtonLoading(true);

    const payload = {
      email,
      password,
    };

    const { data, error } = await PostRequest('/auth/login', payload);
    if (error) {
      dispatch({ type: ACTIONS.ERROR, payload: error });
      setButtonLoading(false);
      return;
    }

    await storeMultipleData([
      ['user', data.data.user],
      ['token', data.data.access_token],
      ['current_org', data.data.user.current_org],
      ['organisation', data.data.user.organisation],
    ]);

    dispatch({ type: ACTIONS.USER, payload: data.data.user });
    dispatch({ type: ACTIONS.TOKEN, payload: data.data.access_token });
    dispatch({ type: ACTIONS.ORG_ID, payload: data.data.user.current_org });
    dispatch({ type: ACTIONS.ORG_DATA, payload: data.data.user.organisation });

    setButtonLoading(false);
  };

  const isAnyAuthPending = buttonLoading || googleLoading || appleLoading;

  return (
    <Container>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 50 : 100}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/splash-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <AppText variant="bold" size={23} style={styles.title}>
          Login to Zedu
        </AppText>

        <TouchableOpacity
          style={styles.socialBtn}
          activeOpacity={0.8}
          onPress={handleGoogleLogin}
          disabled={isAnyAuthPending}
        >
          <Image
            source={require('@/assets/google-icon.png')}
            style={styles.socialIcon}
          />
          <AppText variant="medium" size={16}>
            Sign in with Google
          </AppText>
          {googleLoading && <ActivityIndicator />}
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.8}
            onPress={handleAppleLogin}
            disabled={isAnyAuthPending}
          >
            <Image
              source={require('@/assets/icons/apple.png')}
              style={styles.socialIcon}
            />
            <AppText variant="medium" size={16}>
              Sign in with Apple
            </AppText>
            {appleLoading && <ActivityIndicator />}
          </TouchableOpacity>
        )}

        <View style={styles.dividerContainer}>
          <View style={styles.line} />
          <AppText size={14} style={styles.orText}>
            OR
          </AppText>
          <View style={styles.line} />
        </View>

        <AppInput
          label="Email Address"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
        />

        <AppInput
          label="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.forgotPasswordContainer}
          onPress={() => navigation.navigate('ForgotPasswordEmail')}
        >
          <AppText style={styles.forgotPasswordText}>Forgot Password?</AppText>
        </TouchableOpacity>

        <AppButton
          title="Login"
          onPress={handleLogin}
          style={styles.submitBtn}
          loading={buttonLoading}
          disabled={!email || !password || isAnyAuthPending}
        />

        <View style={styles.footer}>
          <AppText style={styles.footerText}>Don't have an account? </AppText>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <AppText variant="medium" style={styles.linkText}>
              Sign Up
            </AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Container>
  );
};

export default SigninScreen;
