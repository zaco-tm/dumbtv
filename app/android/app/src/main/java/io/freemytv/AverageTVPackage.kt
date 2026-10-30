package io.freemytv

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * The app's own native modules.
 *
 * They are not autolinked: they live in this app's own source tree, not in a package. Each one is
 * the JavaScript's way into the part of Android that JavaScript cannot reach on its own.
 */
class AverageTVPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
            listOf(
                    ParentPinModule(reactContext),
                    HomeModeModule(reactContext),
                    InputsModule(reactContext),
                    AppsModule(reactContext),
                    SleepModule(reactContext),
                    PrefsModule(reactContext),
                    NightModule(reactContext),
                    KidsModule(reactContext),
            )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
            emptyList()
}
