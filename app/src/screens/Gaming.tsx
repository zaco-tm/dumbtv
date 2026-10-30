import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useApps, useInputs} from '../data/useTelevision';
import {AppTile} from '../ui/charcoal/AppTile';
import {Button} from '../ui/charcoal/Button';
import {Icon} from '../ui/charcoal/Icon';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {dp} from '../ui/stage';
import {useFocused, type FocusGrid} from '../ui/useFocusGrid';

/**
 * Gaming: the consoles plugged into the television, and the games installed on it.
 *
 * The two kinds of thing are told apart the way the television itself tells them apart:
 *
 *  - a **console** is an input. It is a device on the other end of a cable, and the
 *    television names it — a console that talks HDMI-CEC gets its own input, named after
 *    the device ("PlayStation 5"). The app matches those words, the way the Java app does
 *    in `HomeApps.deviceSymbol`.
 *  - a **game** is an app. Its store category says it is a game, and that is the whole
 *    test.
 *
 * The consoles are a row of tiles at the top (band 0, the columns to the right of the
 * rail); the games are a grid below them (bands 2 and down). So the up and down arrows
 * walk the games and the left and right arrows walk the consoles, and the rail is on the
 * left of both.
 */
export function Gaming({grid}: {grid: FocusGrid}) {
  const {games} = useApps();
  const inputs = useInputs();
  const consoles = inputs.filter(input => input.isConsole);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Gaming</Text>
        <Text style={styles.subtitle}>
          {consoles.length} consoles · {games.length} games
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Consoles</Text>
      <View style={styles.consoleRow}>
        {consoles.map((input, index) => (
          <ConsoleTile
            key={input.key}
            grid={grid}
            label={input.label}
            detail={input.detail}
            column={index + 1}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Games</Text>
      <View style={styles.grid}>
        {games.map((game, index) => (
          <Button
            key={game.package}
            grid={grid}
            target={{
              id: `gaming:${game.package}`,
              row: Math.floor(index / COLUMNS) + 2,
              col: (index % COLUMNS) + 1,
              page: 'gaming',
            }}
            variant="ghost"
            radius={dp(21.6)}
            focusedStyle={styles.focusedTile}
            style={styles.tile}>
            <AppTile label={game.label} icon={game.icon} />
            <Text style={styles.tileLabel} numberOfLines={1}>
              {game.label}
            </Text>
          </Button>
        ))}
      </View>
    </View>
  );
}

/**
 * A console's tile: a socket, not a picture.
 *
 * A console is an input, so it is drawn the way an input is drawn — a dashed box — and
 * it is named after the device on the other end of the cable.
 */
function ConsoleTile({
  grid,
  label,
  detail,
  column,
}: {
  grid: FocusGrid;
  label: string;
  detail: string;
  column: number;
}) {
  const focused = useFocused();
  return (
    <Button
      grid={grid}
      target={{id: `gaming:console:${label}`, row: 0, col: column, page: 'gaming'}}
      variant="ghost"
      radius={dp(21.6)}
      focusedStyle={styles.focusedTile}
      style={styles.consoleTile}>
      <View style={[styles.consoleBox, focused ? styles.consoleBoxFocused : null]}>
        <Icon
          name="gamepad-2"
          size={dp(48)}
          color={focused ? colors.foreground : colors.mutedForeground}
        />
      </View>
      <Text style={styles.consoleDetail} numberOfLines={1}>
        {detail}
      </Text>
      <Text style={styles.consoleLabel} numberOfLines={1}>
        {label}
      </Text>
    </Button>
  );
}

/** The games grid's columns. */
const COLUMNS = 6;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: dp(64),
    paddingTop: dp(32),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(72),
    lineHeight: dp(72),
    fontWeight: '600',
    letterSpacing: dp(-1.8),
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(30),
    lineHeight: dp(30),
    marginBottom: dp(6),
    color: colors.mutedForeground,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(32),
    lineHeight: dp(38),
    fontWeight: '500',
    letterSpacing: dp(-0.8),
    marginTop: dp(32),
    color: colors.foreground,
  },
  consoleRow: {
    flexDirection: 'row',
    gap: dp(20),
    marginTop: dp(16),
  },
  consoleTile: {
    width: dp(220),
    flexDirection: 'column',
    alignItems: 'center',
    gap: dp(12),
    padding: dp(12),
  },
  consoleBox: {
    width: dp(104),
    height: dp(104),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: dp(26),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  consoleBoxFocused: {
    borderColor: colors.ring,
  },
  consoleDetail: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(26),
    textAlign: 'center',
    color: colors.foreground,
  },
  consoleLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(18),
    lineHeight: dp(22),
    marginTop: dp(-8),
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: dp(16),
    gap: dp(20),
  },
  tile: {
    width: dp(176),
    flexDirection: 'column',
    alignItems: 'center',
    gap: dp(12),
    padding: dp(12),
  },
  focusedTile: {
    backgroundColor: colors.accent,
    transform: [{scale: 1.05}],
  },
  tileLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(26),
    textAlign: 'center',
    color: colors.foreground,
  },
});
