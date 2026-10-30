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
    // Before the runtime starts: the flags it reads are cached, and the focus model
    // needs the remote's keys and the imperative focus command.
    ReactFlags.enable()
    loadReactNative(this)
  }
}
