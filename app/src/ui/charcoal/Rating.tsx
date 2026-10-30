import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {dp} from '../stage';
import {colors} from './theme';

/**
 * The rating: five stars, the filled ones in ember, the empty one outlined and muted.
 *
 * It is always read-only here. A television does not let you rate a film, so the rating
 * is data: it never takes the focus and it never answers the remote.
 */

/** The star the prototype draws. Its own path — the rating's is not lucide's. */
const STAR =
  'M12 2.8l2.75 5.84 6.35.78-4.7 4.38 1.23 6.3L12 17.03 6.37 20.1l1.23-6.3-4.7-4.38 6.35-.78L12 2.8z';

export type RatingProps = {
  /** How many of the stars are filled. */
  value: number;
  /** How many stars there are. */
  max?: number;
  /** The star's size, in dp. */
  size?: number;
};

export function Rating({value, max = 5, size = dp(28)}: RatingProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${value} out of ${max}`}
      style={styles.row}>
      {Array.from({length: max}, (_, index) => (
        <Star key={index} filled={index + 1 <= value} size={size} />
      ))}
    </View>
  );
}

function Star({filled, size}: {filled: boolean; size: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill={filled ? colors.ember : 'transparent'}
        stroke={filled ? colors.ember : colors.mutedForeground}
        strokeOpacity={filled ? 1 : 0.5}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(4),
  },
});
