import {NativeModules} from 'react-native';

/**
 * The app's way into the part of Android that JavaScript cannot reach on its own.
 *
 * One name per module, as the parity table says: parent_pin, home_mode, inputs, sleep, prefs and
 * night. The modules are the native side's stubs for now; their shape is already the final one, so
 * the ports do not have to be written again when the native side is done (task 8).
 *
 * Every method answers with a promise. The modules are looked up when they are called and not
 * when this file is read, so that a missing module is a readable error and not a crash on import.
 */

/** One HDMI input, as the native side describes it. */
export type HomeInput = {
  /** What identifies the input to the television. */
  key: string;
  /** The name on the screen. */
  label: string;
  /** Anything else worth knowing about it. */
  detail: string;
  /**
   * Whether a games console is plugged into this port.
   *
   * The television says so itself: a console that talks HDMI-CEC gets its own input, named
   * after the device ("PlayStation 5"), and the native side matches those words, the way the
   * Java app does in HomeApps.deviceSymbol.
   */
  isConsole: boolean;
};

/**
 * One app on the television, as the native side describes it.
 *
 * The category is the store's own: `CATEGORY_GAME` is a game, the media categories are
 * streaming apps. `src/data/tv.ts` is where the rule lives.
 *
 * The installer comes with it, because the category's number cannot say on its own whether an
 * app is a game or whether nobody declared one: both are zero. A store that installed the app
 * also declared the category; an app that was put on the television by hand has neither.
 */
export type TvApp = {
  /** The app's package name, which is what identifies it. */
  package: string;
  /** The name on the screen. */
  label: string;
  /** The icon, as a file in the app's cache. Empty when the app has none we can draw. */
  icon: string;
  /** The store's category: 0 is a game's number, 1 to 5 are the media ones. */
  category: number;
  /** Who installed the app. Empty when it was sideloaded and no store declared it. */
  installedBy: string;
};

/** A value a preference file can hold. */
export type PrefValue = string | number | boolean;

interface ParentPinNative {
  check(pin: string): Promise<boolean>;
  set(pin: string): Promise<void>;
}

interface HomeModeNative {
  isHome(): Promise<boolean>;
  setHome(on: boolean): Promise<void>;
  refresh(): Promise<void>;
}

interface InputsNative {
  list(): Promise<HomeInput[]>;
}

interface AppsNative {
  list(): Promise<TvApp[]>;
}

interface KidsNative {
  show(): Promise<void>;
  showNormal(): Promise<void>;
  isActive(): Promise<boolean>;
  hasPin(): Promise<boolean>;
}

interface SleepNative {
  start(minutes: number): Promise<void>;
  cancel(): Promise<void>;
  minutesLeft(): Promise<number>;
}

interface PrefsNative {
  get(file: string, key: string): Promise<PrefValue | null>;
  set(file: string, key: string, value: PrefValue): Promise<void>;
}

interface NightNative {
  isNight(): Promise<boolean>;
}

interface IptvNative {
  saveProvider(host: string, user: string, password: string): Promise<boolean>;
  savePlaylist(url: string): Promise<boolean>;
  clear(): Promise<boolean>;
  source(): Promise<TvSource | null>;
  channels(): Promise<TvChannel[]>;
  guide(): Promise<TvEvent[]>;
  watch(channelId: string, name: string): Promise<boolean>;
  openTvInstalled(): Promise<boolean>;
}

function nativeModule<T>(name: string): T {
  const found = (NativeModules as Record<string, unknown>)[name];
  if (!found) {
    throw new Error(`the native module "${name}" is not in the app`);
  }
  return found as T;
}

/** The parent PIN: a salted hash in the `parent_pin` file, never the PIN itself. */
export const parentPin = {
  check(pin: string): Promise<boolean> {
    return nativeModule<ParentPinNative>('parent_pin').check(pin);
  },
  set(pin: string): Promise<void> {
    return nativeModule<ParentPinNative>('parent_pin').set(pin);
  },
};

/** Whether this app is the television's home screen, and the switch that makes it so. */
export const homeMode = {
  isHome(): Promise<boolean> {
    return nativeModule<HomeModeNative>('home_mode').isHome();
  },
  setHome(on: boolean): Promise<void> {
    return nativeModule<HomeModeNative>('home_mode').setHome(on);
  },
  refresh(): Promise<void> {
    return nativeModule<HomeModeNative>('home_mode').refresh();
  },
};

/** The television's HDMI inputs. */
export const inputs = {
  list(): Promise<HomeInput[]> {
    return nativeModule<InputsNative>('inputs').list();
  },
};

/** The apps on the television, with the store's category for each. */
export const apps = {
  list(): Promise<TvApp[]> {
    return nativeModule<AppsNative>('apps').list();
  },
};

/**
 * The kids face.
 *
 * Getting in is free; getting out asks for the parent PIN, and the face asks for it, not this.
 */
export const kids = {
  show(): Promise<void> {
    return nativeModule<KidsNative>('kids').show();
  },
  showNormal(): Promise<void> {
    return nativeModule<KidsNative>('kids').showNormal();
  },
  isActive(): Promise<boolean> {
    return nativeModule<KidsNative>('kids').isActive();
  },
  hasPin(): Promise<boolean> {
    return nativeModule<KidsNative>('kids').hasPin();
  },
};

/** The sleep timer. */
export const sleep = {
  start(minutes: number): Promise<void> {
    return nativeModule<SleepNative>('sleep').start(minutes);
  },
  cancel(): Promise<void> {
    return nativeModule<SleepNative>('sleep').cancel();
  },
  minutesLeft(): Promise<number> {
    return nativeModule<SleepNative>('sleep').minutesLeft();
  },
};

/** The app's own preference files: `settings` and `home-ui`. */
export const prefs = {
  get(file: string, key: string): Promise<PrefValue | null> {
    return nativeModule<PrefsNative>('prefs').get(file, key);
  },
  set(file: string, key: string, value: PrefValue): Promise<void> {
    return nativeModule<PrefsNative>('prefs').set(file, key, value);
  },
};

/** Whether it is night where the television is. */
export const night = {
  isNight(): Promise<boolean> {
    return nativeModule<NightNative>('night').isNight();
  },
};

/** The preference files the app reads and writes. */
export const PREF_FILES = {
  settings: 'settings',
  homeUi: 'home-ui',
} as const;

/**
 * Live TV: the provider's channels, the guide, and the hand-off to OpenTV.
 *
 * The credentials live on the native side and are **never** sent back: `source()` says
 * what is stored and leaves the password out of it. The guide comes back as plain data.
 */
export const iptv = {
  /** Stores a provider the household signs in to. */
  saveProvider(host: string, user: string, password: string): Promise<boolean> {
    return nativeModule<IptvNative>('iptv').saveProvider(host, user, password);
  },
  /** Stores a playlist of streams. */
  savePlaylist(url: string): Promise<boolean> {
    return nativeModule<IptvNative>('iptv').savePlaylist(url);
  },
  /** Forgets the source. */
  clear(): Promise<boolean> {
    return nativeModule<IptvNative>('iptv').clear();
  },
  /** What is stored, without the secret. */
  source(): Promise<TvSource | null> {
    return nativeModule<IptvNative>('iptv').source();
  },
  /** The channels, with what is on them now. */
  channels(): Promise<TvChannel[]> {
    return nativeModule<IptvNative>('iptv').channels();
  },
  /** The evening's events. */
  guide(): Promise<TvEvent[]> {
    return nativeModule<IptvNative>('iptv').guide();
  },
  /** Opens OpenTV on a channel. */
  watch(channelId: string, name: string): Promise<boolean> {
    return nativeModule<IptvNative>('iptv').watch(channelId, name);
  },
  /** Whether OpenTV is on the television. */
  openTvInstalled(): Promise<boolean> {
    return nativeModule<IptvNative>('iptv').openTvInstalled();
  },
};

/** A programme, as the native side describes it. */
export type TvProgramme = {
  /** The title. */
  title: string;
  /** When it starts, in milliseconds since the epoch. */
  from: number;
  /** When it ends, in milliseconds since the epoch. */
  to: number;
  /** The guide's category ("News", "Sports"), when it has one. */
  category: string;
};

/** A channel on the television, with what is on it. */
export type TvChannel = {
  /** The provider's own id for the channel. */
  id: string;
  /** The name the household sees. */
  name: string;
  /** The channel number, when the provider gives one. */
  number: number;
  /** The group ("Sports", "Kids"), when the provider gives one. */
  group: string;
  /** The logo's URL, when the provider gives one. */
  logo: string;
  /** What is on now, when the guide knows. */
  now: TvProgramme | null;
  /** What is next, when the guide knows. */
  next: TvProgramme | null;
};

/** An event in the evening. */
export type TvEvent = {
  /** The title. */
  title: string;
  /** When it starts, in milliseconds since the epoch. */
  from: number;
  /** When it ends, in milliseconds since the epoch. */
  to: number;
  /** The guide's category ("News", "Sports"), when it has one. */
  category: string;
  /** The guide's id for the channel. */
  channelId: string;
  /** The name the household knows the channel by. */
  channelName: string;
};

/** What is stored, without the secret. */
export type TvSource = {
  /** Which kind of source it is. */
  kind: 'provider' | 'playlist';
  /** The provider's host, for a provider source. */
  host: string;
  /** The user the household signs in as. */
  user: string;
  /** The playlist's address, for a playlist source. */
  url: string;
  /**
   * Whether the provider is reached over an encrypted connection.
   *
   * The shipping build does not allow a plain `http://` provider, so the app says so
   * rather than letting it work in a debug build and fail in the release one.
   */
  secure: boolean;
};
