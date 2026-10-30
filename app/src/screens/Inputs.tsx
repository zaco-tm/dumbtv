import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useInputs} from '../data/useTelevision';
import {Button} from '../ui/charcoal/Button';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {dp} from '../ui/stage';
import type {FocusGrid} from '../ui/useFocusGrid';

/**
 * Inputs: the television's own inputs. The ones with nothing plugged in are dimmed, the
 * way they are on the television's own screen.
 *
 * The consoles are not here: they are on the Gaming page, because a console is something
 * you play on. What is left here is everything else — the tuner, and the ports with
 * something that is not a console on the other end.
 */
export function Inputs({grid}: {grid: FocusGrid}) {
  const all = useInputs();
  const inputs = all.filter(input => !input.isConsole);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Inputs</Text>
        <Text style={styles.subtitle}>{inputs.length} sources</Text>
      </View>

      <View style={styles.list}>
        {inputs.map((input, index) => (
          <Button
            key={input.key}
            grid={grid}
            target={{id: `inputs:${input.key}`, row: index + 2, col: 1, page: 'inputs'}}
            variant="ghost"
            radius={dp(21.6)}
            focusedStyle={styles.focusedRow}
            style={styles.row}>
            <Text style={[styles.label, input.connected ? null : styles.labelDimmed]}>
              {input.label}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {input.detail}
            </Text>
          </Button>
        ))}
      </View>
    </View>
  );
}

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
  list: {
    marginTop: dp(40),
    gap: dp(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(24),
    paddingHorizontal: dp(20),
    paddingVertical: dp(16),
  },
  focusedRow: {
    backgroundColor: colors.accent,
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(34),
    lineHeight: dp(40),
    fontWeight: '500',
    color: colors.foreground,
  },
  labelDimmed: {
    color: colors.mutedForeground,
    opacity: 0.6,
  },
  detail: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: dp(24),
    lineHeight: dp(30),
    color: colors.mutedForeground,
  },
});
