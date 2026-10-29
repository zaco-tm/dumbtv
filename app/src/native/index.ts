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

interface SleepNative {
  start(minutes: number): Promise<void>;
  cancel(): Promise<void>;
}

interface PrefsNative {
  get(file: string, key: string): Promise<PrefValue | null>;
  set(file: string, key: string, value: PrefValue): Promise<void>;
}

interface NightNative {
  isNight(): Promise<boolean>;
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

/** The sleep timer. */
export const sleep = {
  start(minutes: number): Promise<void> {
    return nativeModule<SleepNative>('sleep').start(minutes);
  },
  cancel(): Promise<void> {
    return nativeModule<SleepNative>('sleep').cancel();
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
