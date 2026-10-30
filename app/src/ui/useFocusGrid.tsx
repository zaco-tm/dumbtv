import React from 'react';
import {
  StyleSheet,
  UIManager,
  View,
  findNodeHandle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {colors} from './charcoal/theme';
import {moveFocus, type Direction, type FocusTarget} from './focus';

/**
 * The television's focus, in React Native.
 *
 * There is no DOM here, so the prototype's `el.focus()` and `data-*` attributes do not
 * exist. What does:
 *
 *  - every focusable is a `View` with `focusable`, and it says where it is;
 *  - the arrow keys are handled here, on the stage, and the movement is decided by the
 *    model in `focus.ts` — not by Android's own spatial search, which does not know
 *    that the rail is a list of destinations;
 *  - the focus is moved with the `focus` command, which asks the view to take it.
 *
 * The model is pure and is proved by jest; this file is only the plumbing around it.
 */

/** The keys the remote's arrow pad sends, and the direction each one is. */
const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
};

/** What a focusable's ref holds: the native view React Native made for it. */
type ViewRef = React.ComponentRef<typeof View>;

/** The grid: the targets on the screen, and where the focus is. */
export type FocusGrid = {
  /** Says a focusable is there. */
  register(target: FocusTarget, ref: React.RefObject<ViewRef | null>): void;
  /** Says a focusable is gone. */
  unregister(id: string): void;
  /** Says which target has the focus. */
  setCurrent(id: string): void;
  /** Asks a target to take the focus. */
  focus(id: string): boolean;
  /** Moves the focus in a direction, if the model says where. */
  move(dir: Direction): boolean;
  /** The stage's key handler. */
  onKeyDown(event: {
    nativeEvent?: {key?: string; code?: string};
    preventDefault?: () => void;
    stopPropagation?: () => void;
  }): void;
};

/**
 * The grid for the page on the screen.
 *
 * The page matters because "left" goes back to the rail item of the page you are on:
 * the rail's items carry the page they open, and the grid carries the page that is
 * open now.
 */
export function useFocusGrid(page: string): FocusGrid {
  const targets = React.useRef(new Map<string, FocusTarget>()).current;
  const refs = React.useRef(new Map<string, React.RefObject<ViewRef | null>>()).current;
  const current = React.useRef<string | null>(null);
  const open = React.useRef(page);
  open.current = page;

  const register = React.useCallback(
    (target: FocusTarget, ref: React.RefObject<ViewRef | null>) => {
      targets.set(target.id, target);
      refs.set(target.id, ref);
    },
    [targets, refs],
  );

  const unregister = React.useCallback(
    (id: string) => {
      targets.delete(id);
      refs.delete(id);
      if (current.current === id) {
        current.current = null;
      }
    },
    [targets, refs],
  );

  const setCurrent = React.useCallback((id: string) => {
    current.current = id;
  }, []);

  const focus = React.useCallback(
    (id: string) => {
      const ref = refs.get(id);
      const handle = ref?.current ? findNodeHandle(ref.current) : null;
      if (handle == null) {
        return false;
      }
      // The command is named, not numbered: with the new architecture the name is
      // what the native side dispatches on, and the type still says number.
      UIManager.dispatchViewManagerCommand(handle, 'focus' as unknown as number, []);
      // The focus is ours now, whether or not the native view has said so yet: the
      // model has to know where it is before the next arrow key arrives.
      current.current = id;
      return true;
    },
    [refs],
  );

  const move = React.useCallback(
    (dir: Direction) => {
      const from = current.current;
      if (!from) {
        return false;
      }
      const next = moveFocus([...targets.values()], from, dir, open.current);
      if (!next) {
        return false;
      }
      return focus(next);
    },
    [targets, focus],
  );

  const onKeyDown = React.useCallback(
    (event: {
      nativeEvent?: {key?: string; code?: string};
      preventDefault?: () => void;
      stopPropagation?: () => void;
    }) => {
      const native = event.nativeEvent ?? {};
      const dir = DIRECTIONS[native.key ?? ''] ?? DIRECTIONS[native.code ?? ''];
      if (!dir) {
        return;
      }
      if (move(dir)) {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
    },
    [move],
  );

  // One object for the life of the screen: a caller that puts the grid in a dependency
  // list must not be woken by every render of the page.
  return React.useMemo(
    () => ({register, unregister, setCurrent, focus, move, onKeyDown}),
    [register, unregister, setCurrent, focus, move, onKeyDown],
  );
}

export type FocusableProps = {
  /** The grid this item belongs to. */
  grid: FocusGrid;
  /** Where the item is. */
  target: FocusTarget;
  /** The corner radius of the focus ring, in dp. */
  radius?: number;
  /** What the item looks like with the focus. */
  focusedStyle?: StyleProp<ViewStyle>;
  /** What the OK button does. */
  onPress?: () => void;
  /**
   * What a long press does.
   *
   * A television has no pointer, so this is for a mouse on an emulator: it is how the
   * development entries are reached.
   */
  onLongPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** How long a press has to last to be a long one. */
const LONG_PRESS_MS = 700;

/**
 * A thing the remote can put the focus on.
 *
 * The ring is drawn inside the item's own bounds: React Native has no box shadow that
 * grows outwards, and the tiles have enough padding that the ring lands on the padding
 * rather than on the picture.
 */
export function Focusable({
  grid,
  target,
  radius = 0,
  focusedStyle,
  onPress,
  onLongPress,
  children,
  style,
}: FocusableProps) {
  const ref = React.useRef<ViewRef>(null);
  const [focused, setFocused] = React.useState(false);
  const longPress = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // The target is made afresh on every render by the caller; the grid only needs its
  // fields, so they are taken out once and the object is kept still.
  const {id, row, col, page} = target;
  const here = React.useMemo(
    () => (page === undefined ? {id, row, col} : {id, row, col, page}),
    [id, row, col, page],
  );

  React.useEffect(() => {
    return () => {
      if (longPress.current) {
        clearTimeout(longPress.current);
      }
    };
  }, []);

  const startLongPress = React.useCallback(() => {
    if (!onLongPress) {
      return;
    }
    longPress.current = setTimeout(onLongPress, LONG_PRESS_MS);
  }, [onLongPress]);

  const endLongPress = React.useCallback(() => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  }, []);

  React.useEffect(() => {
    grid.register(here, ref);
    return () => {
      grid.unregister(here.id);
    };
  }, [grid, here]);

  return (
    <View
      ref={ref}
      focusable
      // `focusable` is what makes the view clickable on Android, so this is the OK
      // button: the remote's centre key arrives as a click on the focused view.
      onClick={onPress ? () => onPress() : undefined}
      onTouchStart={startLongPress}
      onTouchEnd={endLongPress}
      onTouchCancel={endLongPress}
      onFocus={() => {
        setFocused(true);
        grid.setCurrent(target.id);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      style={[style, focused ? focusedStyle : null]}>
      <FocusedContext.Provider value={focused}>{children}</FocusedContext.Provider>
      {focused ? (
        <View pointerEvents="none" style={[styles.ring, {borderRadius: radius}]} />
      ) : null}
    </View>
  );
}

/**
 * Whether the thing being drawn has the focus.
 *
 * The prototype's tiles change what is inside them when they are focused — the app box
 * goes from the card's colour to the muted one — and that is the inside knowing about
 * the outside.
 */
const FocusedContext = React.createContext(false);

/** Whether the thing being drawn has the focus. */
export function useFocused(): boolean {
  return React.useContext(FocusedContext);
}

const styles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: 4,
    borderColor: colors.ring,
  },
});
