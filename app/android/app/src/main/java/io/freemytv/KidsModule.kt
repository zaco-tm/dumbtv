package io.freemytv

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The kids face: the Java app's, unchanged.
 *
 * Getting in is free: the face is a mode of the home screen, not a separate app. Getting out asks
 * for the parent PIN, and the Home button asks for it too, so a child cannot leave it.
 *
 * The face itself is the Java app's `KidsView`, drawn by the native side. This module is only the
 * way in and out of it.
 */
class KidsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "kids"

    /** The kids face comes up. */
    @ReactMethod
    fun show(promise: Promise) {
        val activity = activity()
        if (activity == null) {
            promise.reject("kids_no_activity", "there is no home screen to show the kids face on")
            return
        }
        try {
            activity.showKids()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("kids_show_failed", e)
        }
    }

    /** The kids face goes away. The parent PIN is asked for by the face itself, not here. */
    @ReactMethod
    fun showNormal(promise: Promise) {
        val activity = activity()
        if (activity == null) {
            promise.reject("kids_no_activity", "there is no home screen to leave the kids face on")
            return
        }
        try {
            activity.showNormal()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("kids_show_normal_failed", e)
        }
    }

    /** Whether the kids face is the one on screen. */
    @ReactMethod
    fun isActive(promise: Promise) {
        try {
            promise.resolve(activity()?.inKidsMode() ?: false)
        } catch (e: Exception) {
            promise.reject("kids_is_active_failed", e)
        }
    }

    /** Whether a parent PIN is set. Without one, the kids face is not locked. */
    @ReactMethod
    fun hasPin(promise: Promise) {
        try {
            promise.resolve(Prefs.hasPin())
        } catch (e: Exception) {
            promise.reject("kids_has_pin_failed", e)
        }
    }

    private fun activity(): HomeActivity? =
            reactApplicationContext.currentActivity as? HomeActivity
}
