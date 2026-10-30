import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {iptv, type TvSource} from '../native';
import {Button} from '../ui/charcoal/Button';
import {FONT_FAMILY, colors} from '../ui/charcoal/theme';
import {dp} from '../ui/stage';
import {Focusable, type FocusGrid} from '../ui/useFocusGrid';

/**
 * Settings: the things the household sets once.
 *
 * At the moment that is one thing: where Live TV gets its channels from. The provider's
 * host, user and password, or a playlist's address.
 *
 * The password is handed to the native side and forgotten here: it is sealed with the
 * television's own key and never comes back. Nothing on this screen ever holds it after
 * it is saved.
 *
 * **The field and the remote.** A television has no pointer, so the row is the thing the
 * remote's focus lands on, and the OK button puts the caret in the field — which brings
 * up the television's own on-screen keyboard. That keyboard's behaviour with the remote
 * is the one part of this screen that has never been tried on a television, and it is the
 * first thing to check when the preview app is on the Ember 55.
 */
export function Settings({grid}: {grid: FocusGrid}) {
  const [source, setSource] = useState<TvSource | null>(null);
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [playlist, setPlaylist] = useState('');
  const [said, setSaid] = useState('');

  useEffect(() => {
    let alive = true;
    iptv
      .source()
      .then(found => {
        if (!alive) {
          return;
        }
        setSource(found);
        if (found) {
          setHost(found.host);
          setUser(found.user);
          setPlaylist(found.url);
        }
      })
      .catch((e: unknown) => {
        console.warn('the source could not be read:', e);
      });
    return () => {
      alive = false;
    };
  }, []);

  const insecure = source !== null && !source.secure;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Live TV</Text>
      <Text style={styles.sectionNote}>
        Where the channels come from. Either a provider account, or a playlist.
      </Text>

      <Field
        grid={grid}
        target={{id: 'settings:host', row: 1, col: 1, page: 'settings'}}
        label="Provider host"
        value={host}
        onChange={setHost}
        placeholder="provider.example.com"
      />
      <Field
        grid={grid}
        target={{id: 'settings:user', row: 2, col: 1, page: 'settings'}}
        label="User"
        value={user}
        onChange={setUser}
        placeholder="the account name"
      />
      <Field
        grid={grid}
        target={{id: 'settings:password', row: 3, col: 1, page: 'settings'}}
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="the account password"
        secure
      />
      <Button
        grid={grid}
        target={{id: 'settings:save-provider', row: 4, col: 1, page: 'settings'}}
        variant="ember"
        radius={dp(12)}
        style={styles.button}
        onPress={() => {
          iptv
            .saveProvider(host, user, password)
            .then(() => {
              setSaid('Provider saved.');
              setPassword('');
              return iptv.source();
            })
            .then(found => setSource(found))
            .catch(() => setSaid('The provider could not be saved.'));
        }}>
        <Text style={styles.buttonText}>Save the provider</Text>
      </Button>

      {insecure ? (
        <Text style={styles.warning}>
          This provider is not on an encrypted connection. It works in a development build,
          and the shipping build will not reach it.
        </Text>
      ) : null}

      <Field
        grid={grid}
        target={{id: 'settings:playlist', row: 5, col: 1, page: 'settings'}}
        label="Playlist address"
        value={playlist}
        onChange={setPlaylist}
        placeholder="https://…/playlist.m3u"
      />
      <Button
        grid={grid}
        target={{id: 'settings:save-playlist', row: 6, col: 1, page: 'settings'}}
        variant="outline"
        radius={dp(12)}
        style={styles.button}
        onPress={() => {
          iptv
            .savePlaylist(playlist)
            .then(() => {
              setSaid('Playlist saved.');
              return iptv.source();
            })
            .then(found => setSource(found))
            .catch(() => setSaid('The playlist could not be saved.'));
        }}>
        <Text style={styles.buttonText}>Save the playlist</Text>
      </Button>

      {said ? <Text style={styles.said}>{said}</Text> : null}
    </View>
  );
}

/**
 * One field.
 *
 * The row is the focusable thing: the remote lands on the row, and the OK button puts
 * the caret in the text. The text itself is not focusable, so the remote's arrows cannot
 * wander into it and leave the grid's model out of step with what is on the screen.
 */
function Field({
  grid,
  target,
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  grid: FocusGrid;
  target: {id: string; row: number; col: number; page: string};
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  secure?: boolean;
}) {
  const input = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Focusable
        grid={grid}
        target={target}
        radius={dp(12)}
        focusedStyle={styles.focusedField}
        onPress={() => {
          input.current?.focus();
        }}
        style={styles.fieldBox}>
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure}
          focusable={false}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={styles.fieldInput}
        />
      </Focusable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: dp(64),
    paddingTop: dp(32),
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(72),
    lineHeight: dp(72),
    fontWeight: '600',
    letterSpacing: dp(-1.8),
    color: colors.foreground,
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
  sectionNote: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(24),
    lineHeight: dp(30),
    marginTop: dp(8),
    color: colors.mutedForeground,
  },
  field: {
    marginTop: dp(20),
    maxWidth: dp(720),
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(19),
    lineHeight: dp(24),
    letterSpacing: dp(0.95),
    textTransform: 'uppercase',
    opacity: 0.7,
    color: colors.mutedForeground,
  },
  fieldBox: {
    marginTop: dp(8),
    borderRadius: dp(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: dp(16),
    paddingVertical: dp(12),
  },
  focusedField: {
    borderColor: colors.ring,
    backgroundColor: colors.muted,
  },
  fieldInput: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(28),
    lineHeight: dp(36),
    color: colors.foreground,
    padding: 0,
  },
  button: {
    marginTop: dp(24),
    paddingHorizontal: dp(28),
    paddingVertical: dp(14),
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(26),
    lineHeight: dp(32),
    fontWeight: '500',
    color: colors.foreground,
  },
  warning: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(24),
    lineHeight: dp(30),
    marginTop: dp(16),
    maxWidth: dp(900),
    color: colors.ember,
  },
  said: {
    fontFamily: FONT_FAMILY,
    fontSize: dp(24),
    lineHeight: dp(30),
    marginTop: dp(24),
    color: colors.mutedForeground,
  },
});
