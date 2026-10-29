/**
 * The app's own constants.
 *
 * APP_ID is the preview id, not the shipping one. The household's home screen is the Java app
 * (tv.dumbtv.variant) until the swap, and it has to keep working while this tree is built. The
 * test in __tests__/appId.test.ts checks that this and the Gradle file still say the same thing.
 */
export const APP_ID = 'tv.dumbtv.preview';

/** The Java package the native code lives in. */
export const JAVA_PACKAGE = 'io.freemytv';
