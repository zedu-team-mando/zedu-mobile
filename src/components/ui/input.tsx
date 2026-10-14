import React, { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { AppText } from './text';
import { normalize } from '@/utils/normalize';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/theme/ThemeProvider';

interface AppInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  disabled?: boolean;
  multiline?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  onFocus?: () => void;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
  disabled = false,
  multiline,
  style,
  inputStyle,
  onFocus,
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginBottom: normalize(20), width: '100%' },
        label: { marginBottom: normalize(8), color: colors.textMuted },
        inputWrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          height: normalize(52),
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: normalize(8),
          paddingHorizontal: normalize(15),
          backgroundColor: colors.surface,
        },
        inputWrapperFocused: {
          borderColor: colors.primary,
        },
        inputWrapperError: {
          borderColor: colors.error,
        },
        inputWrapperDisabled: {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
        errorText: {
          color: colors.error,
          marginTop: normalize(4),
          fontSize: normalize(12),
        },
        input: {
          flex: 1,
          fontSize: normalize(16),
          color: colors.textPrimary,
          height: '100%',
        },
      }),
    [colors],
  );

  return (
    <View style={[styles.container, style]}>
      {label && (
        <AppText variant="medium" size={14} style={styles.label}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
          disabled && styles.inputWrapperDisabled,
          multiline && {
            height: 'auto',
            minHeight: normalize(100),
            alignItems: 'flex-start',
            paddingTop: normalize(10),
          },
        ]}
      >
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              isPasswordVisible ? 'Hide password' : 'Show password'
            }
            accessibilityState={{ disabled }}
          >
            <Icon
              accessible={false}
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <AppText size={12} style={styles.errorText}>
          {error}
        </AppText>
      )}
    </View>
  );
};
