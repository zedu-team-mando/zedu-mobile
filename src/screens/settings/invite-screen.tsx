import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Clipboard,
  Share,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Container from '@/components/layout/container';
import { GetRequest, PostRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import { ShowNotify } from '@/components/ui/toast';
import { CLIENT_URL } from '@env';
import { useTheme } from '@/theme/ThemeProvider';
import { createInviteScreenStyles } from '@/theme/createScreenStyles';

const InvitePeopleScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createInviteScreenStyles(colors), [colors]);
  const { state, dispatch } = useDataContext();
  const { orgId, orgData: _orgData } = state;

  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleId, setRoleId] = useState<string>('');
  const [isRoleFocused, setIsRoleFocused] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const generateRequestId = useRef(0);

  useEffect(() => {
    const getRoles = async () => {
      const { data, error } = await GetRequest(`/organisations/${orgId}/roles`);
      if (!error && data?.data) {
        setRoles(data.data);
        const roleuser = data?.data?.find(
          (item: any) => item?.name === 'User' || item?.name === 'Member',
        );
        setRoleId(roleuser?.id || data.data[0]?.id);
      }
      setLoading(false);
    };
    if (orgId) getRoles();
  }, [orgId]);

  const handleAddEmail = (text: string) => {
    // Check the raw text: trimming first would drop the trailing space separator.
    if (/[,\s]$/.test(text)) {
      const email = text.replace(/[,\s]/g, '').toLowerCase();
      validateAndAdd(email);
    } else {
      setEmailInput(text);
    }
  };

  const validateAndAdd = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      if (!emails.includes(email)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEmails([...emails, email]);
        setEmailInput('');
      } else {
        setEmailInput('');
      }
    } else {
      setEmailInput(email);
    }
  };

  const removeEmail = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newEmails = [...emails];
    newEmails.splice(index, 1);
    setEmails(newEmails);
  };

  const isShareDisabled = !generatedLink || isGenerating;

  const handleSelectRole = (id: string) => {
    if (id === roleId) return;
    // Invalidate any in-flight generation so its response cannot touch
    // state, and unblock generation for the newly selected role immediately.
    generateRequestId.current += 1;
    setGeneratedLink('');
    setIsGenerating(false);
    setRoleId(id);
  };

  const handleShare = async () => {
    if (!generatedLink || isGenerating) return;
    const linkToShare = generatedLink;
    try {
      await Share.share({
        message: `Join our workspace on Zedu: ${linkToShare}`,
      });
    } catch (_error) {}
  };

  const sendInvites = async () => {
    if (emails.length === 0) return;

    setIsSending(true);
    const { error, data } = await PostRequest(`/invite`, {
      org_id: orgId,
      emails: emails,
      role_id: roleId,
    });

    if (!error) {
      ShowNotify(
        'Invites sent',
        data?.message || 'Your invites have been sent.',
      );

      // Clear the fields
      setEmails([]);
      setEmailInput('');
      // navigation.goBack();
    } else {
      dispatch({ type: ACTIONS.ERROR, payload: 'Failed to send invites' });
    }
    setIsSending(false);
  };

  const handleCopyInviteLink = async () => {
    if (!orgId || !roleId) return;

    const requestId = generateRequestId.current + 1;
    generateRequestId.current = requestId;
    setIsGenerating(true);
    const payload = {
      organisation_id: orgId,
      role_id: roleId,
    };

    const { data, error } = await PostRequest('/invite/general', payload);

    // An outdated request (the role changed or a newer request started)
    // must not touch the link, loading state, or error state; the latest
    // request owns them.
    if (requestId !== generateRequestId.current) {
      return;
    }

    if (!error && data?.data?.invitation_link) {
      const baseUrl = CLIENT_URL;
      const link = `${baseUrl}/${data.data.invitation_link}`;

      setGeneratedLink(link);
      Clipboard.setString(link);
      ShowNotify('Link copied', 'Invite link copied to clipboard.');
    } else {
      dispatch({
        type: ACTIONS.ERROR,
        payload: 'Failed to generate invite link',
      });
    }
    setIsGenerating(false);
  };

  return (
    <Container>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="close" size={26} color={colors.iconDefault} />
          <AppText variant="bold" style={styles.headerTitle}>
            Invite People
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={sendInvites}
          disabled={emails.length === 0 || isSending}
          style={[styles.sendBtn, emails.length === 0 && { opacity: 0.5 }]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <AppText variant="bold" style={styles.sendBtnText}>
              Send
            </AppText>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AppText variant="bold" style={styles.label}>
            To
          </AppText>

          <View style={styles.inputContainer}>
            <View style={styles.chipWrapper}>
              {emails.map((email, index) => (
                <View key={index} style={styles.chip}>
                  <AppText style={styles.chipText}>{email}</AppText>
                  <TouchableOpacity onPress={() => removeEmail(index)}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput
                style={styles.input}
                placeholder={emails.length === 0 ? 'name@example.com' : ''}
                placeholderTextColor={colors.textSecondary}
                value={emailInput}
                onChangeText={handleAddEmail}
                onBlur={() => emailInput && validateAndAdd(emailInput)}
                autoCapitalize="none"
                keyboardType="email-address"
                blurOnSubmit={false}
                onSubmitEditing={() => emailInput && validateAndAdd(emailInput)}
              />
            </View>
          </View>

          <AppText style={styles.hint}>
            Separate emails with a space or comma.
          </AppText>

          <View style={styles.roleSection}>
            <AppText variant="bold" style={styles.label}>
              Role
            </AppText>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Dropdown
                testID="role-dropdown"
                style={[
                  styles.roleDropdown,
                  isRoleFocused && { borderColor: colors.primary },
                ]}
                containerStyle={styles.roleDropdownMenu}
                placeholderStyle={styles.rolePlaceholder}
                selectedTextStyle={styles.roleSelectedText}
                data={roles.map(role => ({
                  label: role.name,
                  value: role.id,
                }))}
                labelField="label"
                valueField="value"
                value={roleId}
                placeholder="Select a role..."
                onFocus={() => setIsRoleFocused(true)}
                onBlur={() => setIsRoleFocused(false)}
                onChange={item => handleSelectRole(item.value)}
                renderItem={(item: any) => {
                  const isSelected = item.value === roleId;
                  return (
                    <View
                      testID={`role-option-${item.value}`}
                      style={[
                        styles.roleDropdownItem,
                        isSelected && styles.roleDropdownItemSelected,
                      ]}
                    >
                      <AppText
                        variant={isSelected ? 'bold' : 'regular'}
                        style={[
                          styles.roleDropdownItemText,
                          isSelected && styles.roleDropdownItemTextSelected,
                        ]}
                      >
                        {item.label}
                      </AppText>
                      {isSelected && (
                        <Feather
                          name="check"
                          size={18}
                          color={colors.primary}
                        />
                      )}
                    </View>
                  );
                }}
                renderRightIcon={() => (
                  <Ionicons
                    name={isRoleFocused ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.iconDefault}
                  />
                )}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.linkSection}>
            <View style={styles.linkHeader}>
              <AppText variant="bold" style={styles.sectionTitle}>
                Invite with link
              </AppText>
              <AppText style={styles.sectionSub}>
                Anyone with this link joins as the role selected above.
              </AppText>
            </View>

            <View style={styles.linkBox}>
              <View style={styles.linkContent}>
                <Feather name="link" size={18} color={colors.textSecondary} />
                <AppText numberOfLines={1} style={styles.linkText}>
                  {generatedLink || `Link appears here`}
                </AppText>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyInviteLink}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <AppText variant="bold" style={styles.copyBtnText}>
                    {generatedLink ? 'Copy' : 'Generate'}
                  </AppText>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="share-invite-button"
              style={[
                styles.shareOption,
                isShareDisabled && styles.shareOptionDisabled,
              ]}
              onPress={handleShare}
              disabled={isShareDisabled}
            >
              <Feather
                name="share-2"
                size={18}
                color={isShareDisabled ? colors.textSecondary : colors.primary}
              />
              <AppText
                variant="bold"
                style={[
                  styles.shareText,
                  isShareDisabled && styles.shareTextDisabled,
                ]}
              >
                {generatedLink
                  ? 'Share link via...'
                  : 'Share link (generate a link first)'}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
};

export default InvitePeopleScreen;
