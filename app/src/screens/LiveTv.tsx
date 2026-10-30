import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  badgeFor,
  byNow,
  formatTime,
  loadLiveTv,
  progressFor,
  tonight,
  type Badge,
  type LiveTv as LiveTvData,
} from '../data/livetv';
import {iptv, type TvChannel, type TvEvent} from '../native';
import {Button} from '../ui/charcoal/Button';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {dp} from '../ui/stage';
import {useFocused, type FocusGrid} from '../ui/useFocusGrid';

/**
 * Live TV: what is on now, and what is coming tonight.
 *
 * The prototype's page, in the app's focus model: the "on now" tiles are band 0 and the
 * events run down the bands under it, so the up and down arrows walk the events and the
 * left and right arrows walk the channels.
 *
 * Pressing a channel or an event hands off to OpenTV, which does the playing: the guide
 * is here, the player is there.
 */
export function LiveTv({grid}: {grid: FocusGrid}) {
  const [data, setData] = useState<LiveTvData | null>(null);

  useEffect(() => {
    let alive = true;
    loadLiveTv()
      .then(found => {
        if (alive) {
          setData(found);
        }
      })
      .catch((e: unknown) => {
        // The native side is not there, or the provider is down. The screen says what it
        // can rather than showing an error the household would have to read across a room.
        console.warn('the guide could not be read:', e);
        if (alive) {
          setData({channels: [], events: [], configured: false, secure: true});
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return <View style={styles.screen} />;
  }

  if (!data.configured) {
    return <NotSetUp />;
  }

  const now = Date.now();
  const channels = byNow(data.channels, now);
  const events = tonight(data.events, now);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Live TV</Text>
        <Text style={styles.subtitle}>
          {channels.length} channels · {events.length} events tonight
        </Text>
      </View>

      <Text style={styles.sectionTitle}>On now</Text>
      <View style={styles.channelRow}>
        {channels.map((channel, index) => (
          <ChannelTile
            key={channel.id}
            grid={grid}
            channel={channel}
            column={index + 1}
            now={now}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Tonight</Text>
      <View style={styles.eventList}>
        {events.map((event, index) => (
          <EventRow key={`${event.from}-${event.title}-${event.channelId}`} grid={grid} event={event} row={index + 2} now={now} />
        ))}
      </View>
    </View>
  );
}

/**
 * A channel's tile: its number, its name, and what is on it.
 *
 * A channel the guide does not have still has a tile — it is a channel, and it is on the
 * television — but it has no programme to say, and it does not pretend to.
 */
function ChannelTile({
  grid,
  channel,
  column,
  now,
}: {
  grid: FocusGrid;
  channel: TvChannel;
  column: number;
  now: number;
}) {
  const focused = useFocused();
  const progress = progressFor(channel.now, now);

  return (
    <Button
      grid={grid}
      target={{id: `livetv:channel:${channel.id}`, row: 0, col: column, page: 'live-tv'}}
      onPress={() => {
        iptv.watch(channel.id, channel.name).catch(() => {
          // OpenTV is not on the television. Nothing to hand off to.
        });
      }}
      variant="ghost"
      radius={dp(21.6)}
      focusedStyle={styles.focusedTile}
      style={styles.channelTile}>
      <View style={[styles.channelBox, focused ? styles.channelBoxFocused : null]}>
        <Text style={[styles.channelNumber, focused ? styles.channelNumberFocused : null]}>
          {channel.number || '—'}
        </Text>
      </View>
      <Text style={styles.channelName} numberOfLines={1}>
        {channel.name}
      </Text>
      {channel.now ? (
        <Text style={styles.channelNow} numberOfLines={1}>
          {channel.now.title}
        </Text>
      ) : null}
      {/* How far through the programme we are. */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${Math.round(progress * 100)}%`}]} />
      </View>
    </Button>
  );
}

/** One event: when it is, what it is, and where it is. */
function EventRow({
  grid,
  event,
  row,
  now,
}: {
  grid: FocusGrid;
  event: TvEvent;
  row: number;
  now: number;
}) {
  const badge = badgeFor(event, now);

  return (
    <Button
      grid={grid}
      target={{id: `livetv:event:${event.from}-${event.title}`, row, col: 1, page: 'live-tv'}}
      onPress={() => {
        iptv.watch(event.channelId, event.channelName).catch(() => {
          // OpenTV is not on the television. Nothing to hand off to.
        });
      }}
      variant="ghost"
      radius={dp(21.6)}
      focusedStyle={styles.focusedRow}
      style={styles.eventRow}>
      <Text style={styles.eventTime}>{formatTime(event.from)}</Text>
      <Text style={styles.eventTitle} numberOfLines={1}>
        {event.title}
      </Text>
      <Text style={styles.eventChannel} numberOfLines={1}>
        {event.channelName}
      </Text>
      {badge ? <BadgeLabel badge={badge} /> : null}
    </Button>
  );
}

/** A label on the event: Live, Sports, New. It says what the event is. */
function BadgeLabel({badge}: {badge: Badge}) {
  const live = badge === 'Live';
  return (
    <View style={[styles.badge, live ? styles.badgeLive : styles.badgeOutline]}>
      <Text style={[styles.badgeText, live ? styles.badgeTextLive : styles.badgeTextOutline]}>
        {badge}
      </Text>
    </View>
  );
}

/** No source is stored yet. */
function NotSetUp() {
  return (
    <View style={styles.notSetUp}>
      <Text style={styles.notSetUpTitle}>Live TV</Text>
      <Text style={styles.notSetUpBody}>
        No provider yet. Open Settings to add one.
      </Text>
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
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(32),
    lineHeight: dp(38),
    fontWeight: '500',
    letterSpacing: dp(-0.8),
    marginTop: dp(32),
    color: colors.foreground,
  },
  channelRow: {
    flexDirection: 'row',
    gap: dp(24),
    marginTop: dp(16),
  },
  channelTile: {
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
  channelBox: {
    width: dp(104),
    height: dp(104),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: dp(26),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  channelBoxFocused: {
    backgroundColor: colors.muted,
  },
  channelNumber: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(34),
    lineHeight: dp(40),
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  channelNumberFocused: {
    color: colors.foreground,
  },
  channelName: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(26),
    textAlign: 'center',
    color: colors.foreground,
  },
  channelNow: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(18),
    lineHeight: dp(22),
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  progressTrack: {
    height: dp(4),
    width: '100%',
    borderRadius: dp(2),
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  progressFill: {
    height: '100%',
    borderRadius: dp(2),
    backgroundColor: colors.ember,
  },
  eventList: {
    marginTop: dp(16),
    gap: dp(8),
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dp(24),
    paddingHorizontal: dp(16),
    paddingVertical: dp(8),
  },
  focusedRow: {
    backgroundColor: colors.accent,
  },
  eventTime: {
    width: dp(72),
    fontFamily: FONT_FAMILY,
    fontSize: dp(26),
    lineHeight: dp(32),
    fontVariant: ['tabular-nums'],
    color: colors.mutedForeground,
  },
  eventTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: dp(30),
    lineHeight: dp(36),
    color: colors.foreground,
  },
  eventChannel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(22),
    lineHeight: dp(28),
    color: colors.mutedForeground,
  },
  badge: {
    borderRadius: dp(8),
    paddingHorizontal: dp(12),
    paddingVertical: dp(4),
  },
  badgeLive: {
    backgroundColor: colors.ember,
  },
  badgeOutline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(18),
    lineHeight: dp(24),
    fontWeight: '500',
    letterSpacing: dp(0.9),
    textTransform: 'uppercase',
  },
  badgeTextLive: {
    color: colors.emberForeground,
  },
  badgeTextOutline: {
    color: colors.mutedForeground,
  },
  notSetUp: {
    flex: 1,
    justifyContent: 'center',
  },
  notSetUpTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(72),
    lineHeight: dp(72),
    fontWeight: '600',
    color: colors.foreground,
  },
  notSetUpBody: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(30),
    lineHeight: dp(30),
    marginTop: dp(16),
    color: colors.mutedForeground,
  },
});
