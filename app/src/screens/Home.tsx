import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {
  TRENDING,
  WEATHER,
  type Trend,
  type Weather,
} from '../data/mock';
import {loadFavorites, type FavoriteEntry} from '../data/tv';
import {Button} from '../ui/charcoal/Button';
import {Card} from '../ui/charcoal/Card';
import {Icon} from '../ui/charcoal/Icon';
import {Rating} from '../ui/charcoal/Rating';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {dp} from '../ui/stage';
import {useFocused, type FocusGrid} from '../ui/useFocusGrid';

/**
 * The home screen: the greeting, the weather, Favorites, and Trending.
 *
 * The prototype's three sections, with the prototype's numbers: the sizes are the
 * television's, because a television is read from across a room.
 *
 * The bands of the screen are the focus grid's rows: Favorites is band 0, the Trending
 * feature is band 1 in column 1, and the ranked list runs down bands 2 and up in
 * column 2. The rail is column 0.
 *
 * Favorites is the television's own: the apps and the inputs the house pinned, read from the
 * native side. The greeting's weather and the Trending picks are still the prototype's; they
 * come off the network, and that is task 10's work.
 */
export function Home({grid}: {grid: FocusGrid}) {
  const favorites = useFavorites();
  return (
    <View style={styles.screen}>
      <Greeting />
      <Favorites grid={grid} items={favorites} />
      <Trending grid={grid} />
    </View>
  );
}

/**
 * The house's favourites, read from the native side.
 *
 * The list is empty until the native side answers: a row of tiles that are not there yet would
 * be a row of lies, and the section goes away rather than showing an empty strip.
 */
function useFavorites(): FavoriteEntry[] {
  const [items, setItems] = useState<FavoriteEntry[]>([]);
  useEffect(() => {
    let alive = true;
    loadFavorites()
      .then(found => {
        if (alive) {
          setItems(found);
        }
      })
      .catch((e: unknown) => {
        // The native side is not there (or the file is not readable): the row goes away, and
        // the reason is in the log rather than on the television's screen.
        console.warn('the favourites could not be read:', e);
      });
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

/** The greeting follows the clock. There is no name: the screen belongs to the house. */
export function greetingFor(hour: number): string {
  if (hour < 5) {
    return 'Good night';
  }
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function Greeting({
  hour = new Date().getHours(),
  weather = WEATHER,
}: {
  hour?: number;
  weather?: Weather;
}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>{greetingFor(hour)}</Text>
        <Text style={styles.weather}>
          {weather.temperature}° · {weather.summary} · {weather.place}
        </Text>
      </View>
      <View style={styles.dayNumbers}>
        <DayNumber label="High" value={`${weather.high}°`} />
        <DayNumber label="Low" value={`${weather.low}°`} />
        <DayNumber label="Sunset" value={weather.sunset} />
      </View>
    </View>
  );
}

function DayNumber({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.dayNumber}>
      <Text style={styles.dayLabel}>{label}</Text>
      <Text style={styles.dayValue}>{value}</Text>
    </View>
  );
}

/**
 * Favorites: the apps and the inputs the household pinned, in the order they put them.
 *
 * The two kinds have to look different at a glance — an app is a picture, an input is a
 * socket — but they sit in one row.
 *
 * The row is band 0 of the screen's focus grid: the tiles are columns 1 and up, so the
 * left arrow from the first tile crosses to the rail.
 */
function Favorites({grid, items}: {grid: FocusGrid; items: FavoriteEntry[]}) {
  // An empty row is not a row: the section goes away rather than showing an empty strip.
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.favorites}>
      <Text style={styles.sectionTitle}>Favorites</Text>
      <View style={styles.favoriteRow}>
        {items.map((item, index) => (
          <Button
            key={`${item.kind}-${item.key}`}
            grid={grid}
            target={{id: `favourite:${item.key}`, row: 0, col: index + 1, page: 'home'}}
            variant="ghost"
            radius={dp(21.6)}
            focusedStyle={styles.focusedTile}
            style={styles.favoriteTile}>
            {item.kind === 'app' ? (
              <AppBox label={item.label.charAt(0)} icon={item.icon} />
            ) : (
              <InputBox />
            )}
            <Text style={styles.favoriteLabel} numberOfLines={1}>
              {item.label}
            </Text>
            {item.kind === 'input' ? (
              <Text style={styles.favoriteDetail} numberOfLines={1}>
                {item.detail}
              </Text>
            ) : null}
          </Button>
        ))}
      </View>
    </View>
  );
}

/**
 * The app's tile: the app's own icon, or a picture with the app's first letter on it.
 *
 * With the focus, the box goes from the card's colour to the muted one and the letter
 * comes forward, the way the prototype's tile does.
 */
function AppBox({label, icon}: {label: string; icon?: string}) {
  const focused = useFocused();
  return (
    <Card
      radius={dp(26)}
      padding={0}
      style={[styles.appBox, focused ? styles.appBoxFocused : null]}>
      {icon ? (
        // The icon is a file in the app's cache: the native side writes it there and hands
        // over the path, because a drawable cannot cross the bridge.
        <Image source={{uri: `file://${icon}`}} style={styles.appIcon} resizeMode="contain" />
      ) : (
        <Text style={[styles.appInitial, focused ? styles.appInitialFocused : null]}>
          {label}
        </Text>
      )}
    </Card>
  );
}

/** The input's tile: a socket, not a picture. */
function InputBox() {
  const focused = useFocused();
  return (
    <View style={[styles.inputBox, focused ? styles.inputBoxFocused : null]}>
      <Icon
        name="plug"
        size={dp(44)}
        color={focused ? colors.foreground : colors.mutedForeground}
      />
    </View>
  );
}

/**
 * Trending: one big feature on the left, and the ranked list beside it.
 *
 * The feature is band 1, column 1. The list runs down bands 2 and up in column 2, so
 * the up and down arrows walk the list and the left arrow crosses to the feature.
 */
function Trending({grid, items = TRENDING}: {grid: FocusGrid; items?: Trend[]}) {
  if (items.length === 0) {
    return null;
  }
  const feature = items.find(item => item.feature) ?? items[0];
  const rest = items.filter(item => item !== feature);

  return (
    <View style={styles.trending}>
      <Button
        grid={grid}
        target={{id: 'trending:feature', row: 1, col: 1, page: 'home'}}
        variant="ghost"
        radius={dp(26.4)}
        focusedStyle={styles.focusedFeature}
        style={styles.feature}>
        <Gradient
          style={styles.posterLarge}
          stops={[
            {offset: '0', color: colors.muted},
            {offset: '1', color: colors.card},
          ]}
        />
        {/* The name is on the poster, over a scrim: a poster card with its title under
            it takes more height than the stage has to give. */}
        <View style={styles.featureScrim}>
          <Gradient
            style={StyleSheet.absoluteFill}
            fromTop={false}
            stops={[
              {offset: '0', color: colors.background, opacity: 1},
              {offset: '0.5', color: colors.background, opacity: 0.85},
              {offset: '1', color: colors.background, opacity: 0},
            ]}
          />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureMeta}>{feature.meta}</Text>
            <View style={styles.ratingRow}>
              <Rating value={Math.round(feature.rating / 2)} size={dp(20)} />
              <Text style={styles.ratingValue}>{feature.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </Button>

      <View style={styles.trendList}>
        {rest.map((item, index) => (
          <Button
            key={item.title}
            grid={grid}
            target={{id: `trending:${item.title}`, row: index + 2, col: 2, page: 'home'}}
            variant="ghost"
            radius={dp(21.6)}
            focusedStyle={styles.focusedRow}
            style={styles.trendRow}>
            <Text style={styles.rank}>{item.rank}</Text>
            <Gradient
              style={styles.poster}
              stops={[
                {offset: '0', color: colors.muted},
                {offset: '1', color: colors.card},
              ]}
            />
            <View style={styles.trendText}>
              <Text style={styles.trendTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.trendMeta} numberOfLines={1}>
                {item.year} · {item.meta}
              </Text>
            </View>
            <View style={styles.trendRating}>
              <Rating value={Math.round(item.rating / 2)} size={dp(18)} />
              <Text style={styles.ratingValue}>{item.rating.toFixed(1)}</Text>
            </View>
          </Button>
        ))}
      </View>
    </View>
  );
}

/** One stop of a gradient. */
type GradientStop = {
  /** Where the stop is, from 0 to 1. */
  offset: string;
  color: string;
  opacity?: number;
};

/**
 * A gradient, drawn with SVG.
 *
 * React Native has no gradient of its own, and the prototype's poster boxes are
 * gradients from the theme's own colours.
 */
function Gradient({
  stops,
  style,
  fromTop = true,
}: {
  stops: GradientStop[];
  style?: StyleProp<ViewStyle>;
  fromTop?: boolean;
}) {
  // Every gradient needs its own name: two gradients with one name would share a
  // colour, and the poster boxes are not all the same.
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <View style={style}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1={fromTop ? '0' : '1'} x2="0" y2={fromTop ? '1' : '0'}>
            {stops.map(stop => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: dp(64),
    paddingHorizontal: dp(64),
    paddingTop: dp(32),
  },
  greeting: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(72),
    lineHeight: dp(72),
    fontWeight: '600',
    letterSpacing: dp(-1.8),
    color: colors.foreground,
  },
  weather: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(30),
    lineHeight: dp(30),
    marginTop: dp(16),
    color: colors.mutedForeground,
  },
  dayNumbers: {
    flexDirection: 'row',
    gap: dp(48),
  },
  dayNumber: {
    alignItems: 'flex-end',
  },
  dayLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(19),
    lineHeight: dp(24),
    letterSpacing: dp(0.95),
    textTransform: 'uppercase',
    opacity: 0.7,
    color: colors.mutedForeground,
  },
  dayValue: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(26),
    lineHeight: dp(30),
    color: colors.foreground,
  },
  favorites: {
    marginTop: dp(32),
    paddingHorizontal: dp(64),
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(32),
    lineHeight: dp(38),
    fontWeight: '500',
    letterSpacing: dp(-0.8),
    color: colors.foreground,
  },
  favoriteRow: {
    flexDirection: 'row',
    gap: dp(24),
    marginTop: dp(16),
  },
  favoriteTile: {
    width: dp(176),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: dp(12),
    padding: dp(12),
    borderRadius: dp(21.6),
  },
  focusedTile: {
    backgroundColor: colors.accent,
    transform: [{scale: 1.05}],
  },
  appBox: {
    width: dp(104),
    height: dp(104),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBoxFocused: {
    backgroundColor: colors.muted,
  },
  appIcon: {
    width: dp(72),
    height: dp(72),
  },
  appInitial: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(46),
    lineHeight: dp(52),
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  appInitialFocused: {
    color: colors.foreground,
  },
  inputBox: {
    width: dp(104),
    height: dp(104),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: dp(26),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  inputBoxFocused: {
    borderColor: colors.ring,
  },
  favoriteLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(26),
    textAlign: 'center',
    color: colors.foreground,
  },
  favoriteDetail: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(18),
    lineHeight: dp(22),
    marginTop: dp(-8),
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  trending: {
    flexDirection: 'row',
    gap: dp(48),
    marginTop: dp(32),
    paddingHorizontal: dp(64),
  },
  feature: {
    width: dp(340),
    aspectRatio: 2 / 3,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderRadius: dp(26.4),
    overflow: 'hidden',
  },
  focusedFeature: {
    transform: [{scale: 1.02}],
  },
  posterLarge: {
    ...StyleSheet.absoluteFill,
    borderRadius: dp(26.4),
  },
  featureScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  featureText: {
    paddingHorizontal: dp(28),
    paddingBottom: dp(24),
    paddingTop: dp(96),
    gap: dp(8),
  },
  featureTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(44),
    lineHeight: dp(48),
    fontWeight: '600',
    letterSpacing: dp(-1.1),
    color: colors.foreground,
  },
  featureMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(28),
    color: colors.mutedForeground,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(12),
    marginTop: dp(4),
  },
  ratingValue: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(24),
    lineHeight: dp(28),
    fontVariant: ['tabular-nums'],
    color: colors.foreground,
  },
  trendList: {
    flex: 1,
    justifyContent: 'center',
    gap: dp(8),
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(24),
    paddingHorizontal: dp(16),
    paddingVertical: dp(8),
    borderRadius: dp(21.6),
  },
  focusedRow: {
    backgroundColor: colors.accent,
  },
  rank: {
    width: dp(44),
    textAlign: 'right',
    fontFamily: FONT_FAMILY,
    fontSize: dp(30),
    lineHeight: dp(36),
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: colors.mutedForeground,
  },
  poster: {
    width: dp(92),
    height: dp(92),
    borderRadius: dp(16.8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  trendText: {
    flex: 1,
  },
  trendTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(32),
    lineHeight: dp(38),
    fontWeight: '500',
    letterSpacing: dp(-0.8),
    color: colors.foreground,
  },
  trendMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(28),
    marginTop: dp(4),
    color: colors.mutedForeground,
  },
  trendRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(12),
  },
});
