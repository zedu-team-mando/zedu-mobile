import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppInput } from './input';

jest.mock('./text', () => ({ AppText: 'AppText' }));
jest.mock('../../utils/normalize', () => ({
  normalize: (value: number) => value,
}));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

describe('AppInput password visibility accessibility', () => {
  let tree: Renderer.ReactTestRenderer | undefined;
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previousActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;

  beforeAll(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  const renderInput = async (
    props: { disabled?: boolean; secureTextEntry?: boolean } = {},
  ) => {
    await act(async () => {
      tree = Renderer.create(
        <AppInput
          placeholder="Password"
          value="DemoPassword123!"
          onChangeText={jest.fn()}
          secureTextEntry
          {...props}
        />,
      );
    });
  };

  afterEach(async () => {
    if (tree) {
      await act(async () => tree?.unmount());
      tree = undefined;
    }
  });

  it('labels the hidden-password action and hides its decorative icon', async () => {
    await renderInput();
    const toggle = tree!.root.findByType(TouchableOpacity);
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityLabel).toBe('Show password');
    expect(tree!.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    expect(tree!.root.findByType(Icon).props.accessible).toBe(false);
  });

  it('updates the label and secure state as visibility changes', async () => {
    await renderInput();
    const toggle = () => tree!.root.findByType(TouchableOpacity);
    const input = () => tree!.root.findByType(TextInput);

    await act(async () => toggle().props.onPress());
    expect(toggle().props.accessibilityLabel).toBe('Hide password');
    expect(input().props.secureTextEntry).toBe(false);
    expect(input().props.value).toBe('DemoPassword123!');

    await act(async () => toggle().props.onPress());
    expect(toggle().props.accessibilityLabel).toBe('Show password');
    expect(input().props.secureTextEntry).toBe(true);
    expect(input().props.value).toBe('DemoPassword123!');
  });

  it('exposes a disabled state when the input is disabled', async () => {
    await renderInput({ disabled: true });
    const toggle = tree!.root.findByType(TouchableOpacity);
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.accessibilityState).toEqual({ disabled: true });
    expect(tree!.root.findByType(TextInput).props.editable).toBe(false);
  });

  it('does not render the toggle for ordinary inputs', async () => {
    await renderInput({ secureTextEntry: false });
    expect(tree!.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });
});
