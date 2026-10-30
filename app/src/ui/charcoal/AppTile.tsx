import React from 'react';
import {Image, StyleSheet, Text, type StyleProp, type ViewStyle} from 'react-native';
import {dp} from '../stage';
import {useFocused} from '../useFocusGrid';
import {Card} from './Card';
import {FONT_FAMILY, colors} from './theme';

/**
 * An app's picture: the app's own icon, or a letter on a card.
 *
 * The icon is a file in the app's cache — the native side writes it there and hands over
 * the path, because a drawable cannot cross the bridge. An app with no icon we can draw
 * gets the first letter of its name, which is what a television launcher has always
 * done.
 *
 * With the focus, the box goes from the card's colour to the muted one and the letter
 * comes forward.
 */
export function AppTile({
  label,
  icon,
  size = dp(104),
  style,
}: {
  /** The app's name. Its first letter stands in when there is no icon. */
  label: string;
  /** The icon's path, when the native side has one. */
  icon?: string;
  /** The box's size. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const focused = useFocused();
  return (
    <Card
      radius={dp(26)}
      padding={0}
      style={[styles.box, {width: size, height: size}, focused ? styles.boxFocused : null, style]}>
      {icon ? (
        <Image source={{uri: `file://${icon}`}} style={styles.icon} resizeMode="contain" />
      ) : (
        <Text style={[styles.initial, focused ? styles.initialFocused : null]}>
          {label.charAt(0).toUpperCase()}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    backgroundColor: colors.muted,
  },
  icon: {
    width: dp(72),
    height: dp(72),
  },
  initial: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(46),
    lineHeight: dp(52),
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  initialFocused: {
    color: colors.foreground,
  },
});
