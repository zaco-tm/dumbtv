import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {dp} from '../stage';
import {colors, radii} from './theme';

/**
 * The theme's card: a surface, a border and a corner.
 *
 * The prototype's card is the theme's own — the surface colour, the border and the
 * radius — and nothing else. The poster boxes and the app tiles on the home screen are
 * cards of this kind, with their own corners.
 */
export type CardProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** The card's corner radius, in dp. */
  radius?: number;
  /** The card's padding, in dp. */
  padding?: number;
};

export function Card({children, style, radius = radii.xl, padding = dp(24)}: CardProps) {
  return (
    <View style={[styles.card, {borderRadius: radius, padding}, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
