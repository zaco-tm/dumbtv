package io.freemytv

import android.util.Log
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider

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
 * They are read once and cached, so this has to run before anything reads them — and
 * after React Native's own loader, which overrides the flags with its stable set when
 * it loads. That puts it between the two: React Native is loaded, the flags are ours,
 * and the React instance has not been created yet. See MainApplication.
 *
 * **The override is forced, and that is deliberate.** React Native's own loader has
 * already overridden the flags by then, and `override` refuses a second time ("Feature
 * flags cannot be overridden more than once"), which crashed the app on every start.
 * `dangerouslyForceOverride` is the API for exactly this case: it puts our provider on
 * a fresh accessor — so nothing that was read earlier is remembered — and hands back the
 * flags that had already been read, which is worth knowing about and is logged.
 */
object ReactFlags {

  fun enable() {
    val read = ReactNativeFeatureFlags.dangerouslyForceOverride(
      AverageTvFlags(ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android()),
    )
    if (!read.isNullOrEmpty()) {
      Log.w(TAG, "these feature flags had already been read: $read")
    }
  }

  /**
   * React Native's stable flags, with the two this app needs turned on.
   *
   * **React Native's own stable set is the base, not the plain defaults**, and the
   * difference is not academic: the defaults have `useTurboModuleInterop` off, and that
   * flag is what lets a plain Java or Kotlin module — every module this app has — be
   * found from JavaScript at all. Overriding the defaults instead of the stable set
   * turned the interop off, and every native module vanished from the bridge ("the
   * native module 'iptv' is not in the app").
   *
   * The stable class is final, so this delegates to it rather than extending it: every
   * flag React Native's stable set has is answered by that set, and only the two the
   * focus model needs are answered here.
   */
  private class AverageTvFlags(
    stable: ReactNativeFeatureFlagsProvider,
  ) : ReactNativeFeatureFlagsProvider by stable {

    override fun enableKeyEvents(): Boolean = true

    override fun enableImperativeFocus(): Boolean = true
  }

  private const val TAG = "AverageTV"
}
