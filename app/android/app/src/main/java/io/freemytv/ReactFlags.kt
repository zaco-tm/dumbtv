package io.freemytv

import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsDefaults

/**
 * The two React Native flags the television's focus model needs.
 *
 * The focus model lives in JavaScript — the app's grid, the app's rules — but React
 * Native keeps both halves of it switched off by default:
 *
 *  - `enableKeyEvents` is what sends the remote's key presses to JavaScript at all.
 *    Without it every arrow key does nothing.
 *  - `enableImperativeFocus` is what lets the app move the focus with the `focus`
 *    command. Without it the focus is left to Android's own spatial search, which does
 *    not know that the rail is a list of destinations rather than a column of the
 *    screen's bands — which is how "right" from Streaming landed on the seventh app
 *    instead of the first.
 *
 * They are read once and cached, so this has to run before the React runtime starts.
 */
object ReactFlags {

  fun enable() {
    ReactNativeFeatureFlags.override(
      object : ReactNativeFeatureFlagsDefaults() {
        override fun enableKeyEvents(): Boolean = true

        override fun enableImperativeFocus(): Boolean = true
      },
    )
  }
}
