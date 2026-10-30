import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {APP_ID} from '../config';
import {
  homeMode,
  inputs,
  night,
  parentPin,
  PREF_FILES,
  prefs,
  sleep,
} from '../native';
import {dark, light, radius} from '../ui/charcoal/tokens';
import {FONT_FAMILY} from '../ui/charcoal/theme';

/**
 * The first screen: the proof that the wiring works.
 *
 * It shows the app's own id, a row of swatches built from the generated tokens, and what each of
 * the six native modules answers. It is a shell, not the design: the design comes later, from the
 * ports (task 7), and this screen is replaced by them.
 */

type Answer = {
  label: string;
  value: string;
};

/** The colours the swatch row shows, in the order they are shown. */
const SWATCHES = [
  'background',
  'card',
  'primary',
  'ember',
  'ring',
  'muted',
  'destructive',
  'success',
] as const;

/** The radii the row shows. */
const RADII = ['sm', 'md', 'lg', 'xl'] as const;

async function ask(
  label: string,
  run: () => Promise<unknown>,
): Promise<Answer> {
  try {
    return {label, value: format(await run())};
  } catch (e) {
    return {label, value: `not answered: ${(e as Error).message}`};
  }
}

function format(value: unknown): string {
  if (value === null || value === undefined) {
    return 'nothing';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'none';
    }
    return value.map(entry => String(entry)).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function WiringScreen() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [busy, setBusy] = useState(false);

  const runChecks = useCallback(async () => {
    setBusy(true);
    setAnswers(
      await Promise.all([
        ask("parent_pin.check('0000')", () => parentPin.check('0000')),
        ask('home_mode.isHome()', () => homeMode.isHome()),
        ask('home_mode.refresh()', () => homeMode.refresh()),
        ask('inputs.list()', () => inputs.list()),
        ask(
          "prefs.get('home-ui', 'favorites')",
          () => prefs.get(PREF_FILES.homeUi, 'favorites'),
        ),
        ask('night.isNight()', () => night.isNight()),
      ]),
    );
    setBusy(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const write = useCallback(async (label: string, run: () => Promise<void>) => {
    const result = await ask(label, run);
    setAnswers(previous => [...previous, result]);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>AverageTV</Text>
        <Text style={styles.subtitle}>the wiring check</Text>
        <Text style={styles.appId}>app id: {APP_ID}</Text>

        <Text style={styles.section}>The theme, from the prototype's CSS</Text>
        {(['light', 'dark'] as const).map(look => (
          <View key={look} style={styles.swatchRow}>
            {SWATCHES.map(name => (
              <View key={name} style={styles.swatchCell}>
                <View
                  style={[
                    styles.swatch,
                    {backgroundColor: look === 'light' ? light[name] : dark[name]},
                  ]}
                />
                <Text style={styles.swatchName}>{name}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.swatchRow}>
          {RADII.map(name => (
            <View key={name} style={styles.swatchCell}>
              <View
                style={[
                  styles.radiusBox,
                  {
                    backgroundColor: dark.ember,
                    borderRadius: radius[name],
                    width: radius[name] * 4,
                    height: radius[name] * 4,
                  },
                ]}
              />
              <Text style={styles.swatchName}>
                {name} {radius[name]}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>What the native modules answer</Text>
        {answers.length === 0 ? (
          <Text style={styles.answer}>asking…</Text>
        ) : (
          answers.map(answer => (
            <View key={answer.label} style={styles.answerRow}>
              <Text style={styles.answerLabel}>{answer.label}</Text>
              <Text style={styles.answerValue}>{answer.value}</Text>
            </View>
          ))
        )}

        <Text style={styles.section}>And what they write</Text>
        <View style={styles.buttons}>
          <Button
            label="ask again"
            onPress={() => {
              runChecks();
            }}
          />
          <Button
            label="set PIN 1234"
            onPress={() => {
              write("parent_pin.set('1234')", () => parentPin.set('1234'));
            }}
          />
          <Button
            label="check PIN 1234"
            onPress={() => {
              write("parent_pin.check('1234')", async () => {
                const ok = await parentPin.check('1234');
                setAnswers(previous => [
                  ...previous,
                  {label: "parent_pin.check('1234')", value: String(ok)},
                ]);
              });
            }}
          />
          <Button
            label="set home: on"
            onPress={() => {
              write('home_mode.setHome(true)', () => homeMode.setHome(true));
            }}
          />
          <Button
            label="sleep 1 min"
            onPress={() => {
              write('sleep.start(1)', () => sleep.start(1));
            }}
          />
          <Button
            label="sleep off"
            onPress={() => {
              write('sleep.cancel()', () => sleep.cancel());
            }}
          />
          <Button
            label="save a favourite"
            onPress={() => {
              write(
                "prefs.set('home-ui', 'favorites', 'com.netflix.ninja')",
                () => prefs.set(PREF_FILES.homeUi, 'favorites', 'com.netflix.ninja'),
              );
            }}
          />
        </View>
        {busy ? <Text style={styles.answer}>working…</Text> : null}
      </ScrollView>
    </View>
  );
}

function Button({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  // A television has no pointer: the remote's focus is the pointer, so the ring follows the focus.
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessible
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.button, focused ? styles.buttonFocused : null]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dark.background,
  },
  body: {
    padding: 32,
  },
  title: {
    color: dark.foreground,
    fontFamily: FONT_FAMILY,
    fontSize: 40,
    fontWeight: '700',
  },
  subtitle: {
    color: dark.mutedForeground,
    fontFamily: FONT_FAMILY,
    fontSize: 20,
  },
  appId: {
    color: dark.ember,
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    marginTop: 8,
  },
  section: {
    color: dark.mutedForeground,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    letterSpacing: 1,
    marginTop: 32,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  swatchCell: {
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 12,
    width: 96,
  },
  swatch: {
    borderColor: dark.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 56,
    width: 56,
  },
  radiusBox: {
    opacity: 0.85,
  },
  swatchName: {
    color: dark.mutedForeground,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    marginTop: 6,
  },
  answerRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  answerLabel: {
    color: dark.mutedForeground,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    width: 380,
  },
  answerValue: {
    color: dark.foreground,
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
  },
  answer: {
    color: dark.foreground,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: dark.card,
    borderColor: dark.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 12,
    marginRight: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonFocused: {
    backgroundColor: dark.ember,
    borderColor: dark.ember,
  },
  buttonLabel: {
    color: dark.foreground,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
  },
});
