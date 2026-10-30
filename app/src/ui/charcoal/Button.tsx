import React from 'react';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {dp} from '../stage';
import {Focusable, type FocusGrid} from '../useFocusGrid';
import type {FocusTarget} from '../focus';
import {colors, radii} from './theme';

/**
 * The theme's button.
 *
 * A television has no pointer, so the remote's focus is the pointer: the button is
 * focusable, and the ring follows the focus rather than a hover.
 *
 * The variants are the theme's own — the primary, the secondary, the outline, the
 * ghost and the ember — and the ember is the theme's own colour for the thing the
 * person is meant to press.
 */
export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'ember';

export type ButtonProps = {
  /** The grid the button belongs to. */
  grid: FocusGrid;
  /** Where the button is. */
  target: FocusTarget;
  /** What the OK button does. */
  onPress?: () => void;
  /** The variant: which of the theme's surfaces the button is drawn on. */
  variant?: ButtonVariant;
  /** The corner radius of the focus ring, in dp. */
  radius?: number;
  /** What the button looks like with the focus. */
  focusedStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  grid,
  target,
  onPress,
  variant = 'default',
  radius,
  focusedStyle,
  children,
  style,
}: ButtonProps) {
  return (
    <Focusable
      grid={grid}
      target={target}
      onPress={onPress}
      radius={radius ?? dp(9.6)}
      focusedStyle={focusedStyle}
      style={[styles.base, styles[variant], style]}>
      {children}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  default: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ember: {
    backgroundColor: colors.ember,
  },
});
