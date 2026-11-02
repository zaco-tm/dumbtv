import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useApps} from '../data/useTelevision';
import {AppTile} from '../ui/charcoal/AppTile';
import {Button} from '../ui/charcoal/Button';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {useGridColumns} from '../ui/grid';
import {dp} from '../ui/stage';
import {lineBox, lineBoxTight} from '../ui/typography';
import type {FocusGrid} from '../ui/useFocusGrid';

/**
 * Streaming: the television's apps that play somebody else's video or music.
 *
 * The page was called "Apps" and held everything; it is called "Streaming" now and holds
 * the streaming apps, because the games moved to their own page and a grid of Netflix,
 * Plex and Spotify should not have to say "Apps" to be honest about itself.
 *
 * The grid is six columns: the apps are band 0 and down, the columns to the right of the
 * rail. The up and down arrows walk the rows and the left arrow crosses to the rail.
 */
export function Streaming({grid}: {grid: FocusGrid}) {
  const tiles = useGridColumns(COLUMNS, dp(GRID_GAP));
  const {streaming} = useApps();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Streaming</Text>
        <Text style={styles.subtitle}>{streaming.length} apps</Text>
      </View>

      <View style={styles.grid} onLayout={tiles.onLayout}>
        {streaming.map((app, index) => (
          <Button
            key={app.package}
            grid={grid}
            target={{
              id: `streaming:${app.package}`,
              row: Math.floor(index / COLUMNS),
              col: (index % COLUMNS) + 1,
              page: 'streaming',
            }}
            variant="ghost"
            radius={dp(21.6)}
            focusedStyle={styles.focusedTile}
            style={[styles.tile, {width: tiles.columnWidth}]}>
            <AppTile label={app.label} icon={app.icon} letterSize={42} />
            <Text style={styles.tileLabel} numberOfLines={1}>
              {app.label}
            </Text>
          </Button>
        ))}
      </View>
    </View>
  );
}

/** The grid's columns, and the gap between them. */
const COLUMNS = 6;
const GRID_GAP = 20;

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
    gap: dp(64),
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
    lineHeight: lineBox(30),
    color: colors.mutedForeground,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: dp(40),
    gap: dp(GRID_GAP),
  },
  tile: {
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
    lineHeight: lineBoxTight(22),
    textAlign: 'center',
    color: colors.foreground,
  },
});
