package io.freemytv

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // The app's own native modules. They are not autolinked: they live in this app's own
          // source tree, not in a package.
          add(AverageTVPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The Java app's Application did this, and every process needs it: the preference files and
    // the place (the city and its coordinates) are read from the context, and the home screen, the
    // screensaver and the photo import all run in processes of their own.
    Prefs.init(this)
    Place.init(this)
    // React Native first: its loader initialises SoLoader, loads the native libraries,
    // and sets its own feature flags on the way.
    loadReactNative(this)
    // Our flags come *after* React Native's, because the last override is the one that
    // counts — React Native's own loader overrides the flags with its stable set, so it
    // has to be our turn after it.
    //
    // It also cannot come before: the flags reach React Native's C++ side, and that
    // loads a native library through SoLoader, which is not initialised until React
    // Native is loaded. Doing it earlier crashed the app on every start.
    ReactFlags.enable()
  }
}
