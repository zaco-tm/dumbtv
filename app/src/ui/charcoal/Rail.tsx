import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {dp} from '../stage';
import {Focusable, type FocusGrid} from '../useFocusGrid';
import {Icon, type IconName} from './Icon';
import {FONT_FAMILY, colors} from './theme';

/**
 * The rail: the television's list of destinations down the left.
 *
 * It is the prototype's Charcoal sidebar with the television's three differences:
 *
 *  - it is **always open**. There is no pointer on a television, and the person
 *    holding the remote needs to see where they are, so the labels are always there;
 *  - the sizes are the television's: 60px rows, 26px icons, 22px labels, a 220px rail;
 *  - the items sit at the **top**, with the gear and the children's face at the bottom,
 *    because the space between them should stay empty.
 *
 * The active item's line is in ember, with the theme's glow around it.
 */

/** The rail's width, in stage pixels. */
export const RAIL_W = 220;

/** One destination. */
export type RailItem = {
  label: string;
  /** The page the item opens. It is also what the focus model calls the item. */
  page: string;
  icon: IconName;
};

/** The five destinations, at the top. */
export const MAIN_ITEMS: RailItem[] = [
  {label: 'Home', page: 'home', icon: 'house'},
  {label: 'Live TV', page: 'live-tv', icon: 'tv'},
  {label: 'Streaming', page: 'streaming', icon: 'play'},
  {label: 'Gaming', page: 'gaming', icon: 'gamepad-2'},
  {label: 'Inputs', page: 'inputs', icon: 'cable'},
];

/** The two at the bottom. */
export const BOTTOM_ITEMS: RailItem[] = [
  {label: 'Kids', page: 'kids', icon: 'baby'},
  {label: 'Settings', page: 'settings', icon: 'settings'},
];

/** Every destination, in the rail's order. */
export const ALL_ITEMS: RailItem[] = [...MAIN_ITEMS, ...BOTTOM_ITEMS];

/** The prototype's spring: the rail's own. */
const SPRING = {stiffness: 360, damping: 34};

export type RailProps = {
  /** The grid the rail's items belong to. */
  grid: FocusGrid;
  /** The page that is open. */
  active: string;
  /** Called when a destination is chosen. */
  onSelect: (page: string) => void;
  /** Called when a destination is held down. */
  onLongPress?: (page: string) => void;
};

export function Rail({grid, active, onSelect, onLongPress}: RailProps) {
  return (
    <View style={styles.rail}>
      <View style={styles.list}>
        {MAIN_ITEMS.map((item, index) => (
          <RailRow
            key={item.page}
            grid={grid}
            item={item}
            row={index}
            active={active}
            onSelect={onSelect}
            onLongPress={onLongPress}
          />
        ))}
      </View>
      <View style={styles.bottom}>
        {BOTTOM_ITEMS.map((item, index) => (
          <RailRow
            key={item.page}
            grid={grid}
            item={item}
            row={MAIN_ITEMS.length + index}
            active={active}
            onSelect={onSelect}
            onLongPress={onLongPress}
          />
        ))}
      </View>
    </View>
  );
}

function RailRow({
  grid,
  item,
  row,
  active,
  onSelect,
  onLongPress,
}: {
  grid: FocusGrid;
  item: RailItem;
  /** The rail's own order: the items are a list of destinations, not the screen's bands. */
  row: number;
  active: string;
  onSelect: (page: string) => void;
  onLongPress?: (page: string) => void;
}) {
  const isActive = active === item.page;

  return (
    <Focusable
      grid={grid}
      target={{id: `rail:${item.page}`, row, col: 0, page: item.page}}
      radius={dp(16.8)}
      onPress={() => onSelect(item.page)}
      onLongPress={onLongPress ? () => onLongPress(item.page) : undefined}
      style={styles.item}>
      <View style={styles.iconBox}>
        <Icon
          name={item.icon}
          size={dp(26)}
          color={isActive ? colors.ember : colors.mutedForeground}
        />
      </View>
      <Text style={[styles.label, isActive ? styles.labelActive : null]}>{item.label}</Text>
      {isActive ? <ActiveLine /> : null}
    </Focusable>
  );
}

/**
 * The active item's line.
 *
 * It is in ember, with the theme's glow around it. The glow is drawn as a band of the
 * theme's own ember glow colour rather than as a shadow: Android's shadows are grey
 * below API 28, and the television's colour is the point.
 */
function ActiveLine() {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0);
  const style = useAnimatedStyle(() => ({opacity: opacity.value}));

  React.useEffect(() => {
    // With the motion reduced the line is simply there.
    opacity.value = reduce ? 1 : withSpring(1, SPRING);
  }, [opacity, reduce]);

  return (
    <Animated.View pointerEvents="none" style={[styles.glow, style]}>
      <View style={styles.line} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: dp(RAIL_W),
    flexDirection: 'column',
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  list: {
    padding: dp(8),
    gap: dp(4),
  },
  bottom: {
    marginTop: 'auto',
    padding: dp(8),
    gap: dp(4),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    height: dp(60),
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(16),
    paddingHorizontal: dp(16),
    borderRadius: dp(16.8),
  },
  iconBox: {
    width: dp(32),
    alignItems: 'center',
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    color: colors.mutedForeground,
  },
  labelActive: {
    color: colors.foreground,
    fontWeight: '500',
  },
  glow: {
    position: 'absolute',
    left: -dp(13),
    top: dp(8),
    bottom: dp(8),
    width: dp(10),
    borderRadius: dp(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.emberGlow,
  },
  line: {
    width: dp(2),
    height: '100%',
    borderRadius: dp(1),
    backgroundColor: colors.ember,
  },
});
