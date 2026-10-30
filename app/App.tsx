/**
 * The app's root.
 *
 * @format
 */

import React from 'react';
import {StatusBar, StyleSheet, Text, View, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Home} from './src/screens/Home';
import {Gaming} from './src/screens/Gaming';
import {Inputs} from './src/screens/Inputs';
import {LiveTv} from './src/screens/LiveTv';
import {Settings} from './src/screens/Settings';
import {Streaming} from './src/screens/Streaming';
import {WiringScreen} from './src/screens/WiringScreen';
import {ALL_ITEMS, Rail} from './src/ui/charcoal/Rail';
import {FONT_FAMILY, colors} from './src/ui/charcoal/theme';
import {useFocusGrid} from './src/ui/useFocusGrid';

/**
 * The shell: the rail down the left, and the page beside it.
 *
 * The stage is the television's own screen, so there is no scaling here: the rail is
 * 220 stage pixels wide and the page fills the rest.
 */
function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [destination, setDestination] = React.useState('home');
  const [wiring, setWiring] = React.useState(false);
  const grid = useFocusGrid(destination);

  // The remote's focus has to start somewhere, or the arrow keys do nothing.
  React.useEffect(() => {
    grid.focus('rail:home');
  }, [grid]);

  if (wiring) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.container}>
          <WiringScreen />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.stage} onKeyDown={grid.onKeyDown}>
        <Rail
          grid={grid}
          active={destination}
          onSelect={setDestination}
          onLongPress={page => {
            // The wiring screen is the proof that the native modules answer. It is a
            // development entry, so it is a long press on the one destination that has
            // no page of its own yet.
            if (page === 'settings') {
              setWiring(true);
            }
          }}
        />
        <View style={styles.content}>
          {destination === 'home' ? (
            <Home grid={grid} />
          ) : destination === 'live-tv' ? (
            <LiveTv grid={grid} />
          ) : destination === 'streaming' ? (
            <Streaming grid={grid} />
          ) : destination === 'gaming' ? (
            <Gaming grid={grid} />
          ) : destination === 'inputs' ? (
            <Inputs grid={grid} />
          ) : destination === 'settings' ? (
            <Settings grid={grid} />
          ) : (
            <Coming page={destination} />
          )}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

/** The pages that come with the native side and the guide are not here yet. */
function Coming({page}: {page: string}) {
  const label = ALL_ITEMS.find(item => item.page === page)?.label ?? page;
  return (
    <View style={styles.coming}>
      <Text style={styles.comingTitle}>{label}</Text>
      <Text style={styles.comingBody}>This page is not here yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stage: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  coming: {
    flex: 1,
    paddingHorizontal: 64,
    paddingTop: 32,
  },
  comingTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 72,
    lineHeight: 72,
    fontWeight: '600',
    color: colors.foreground,
  },
  comingBody: {
    fontFamily: FONT_FAMILY,
    fontSize: 30,
    lineHeight: 30,
    marginTop: 16,
    color: colors.mutedForeground,
  },
});

export default App;
