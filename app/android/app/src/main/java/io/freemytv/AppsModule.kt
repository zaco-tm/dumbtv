package io.freemytv

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.File

/**
 * The apps on the television, with the store's category for each.
 *
 * The list is the Java app's own (`HomeApps.launchable`): the television's own apps first, then
 * the phone apps that are not part of the system. The two things that list does not carry are
 * added here: the category the store put in the app's own manifest, and the icon.
 *
 * The category is `ApplicationInfo.category`. It is what tells a game from a streaming app:
 * `CATEGORY_GAME` is a game, the media categories (`CATEGORY_VIDEO`, `CATEGORY_AUDIO`,
 * `CATEGORY_SOCIAL`, `CATEGORY_IMAGE`, `CATEGORY_NEWS`) are streaming apps. The JavaScript
 * decides, not this module: the rule is in app/src/data/tv.ts, where it can be read and tested.
 *
 * One number has to travel with it. `CATEGORY_GAME` is zero, and an app that declares no
 * category at all is also zero — the field is a plain int with no "unset" of its own, and
 * `ActivityInfo` does not carry the category either. So the category alone cannot say whether
 * an app is a game or whether nobody ever said. The installer can: a store writes the category
 * into the app it installs, and an app that was sideloaded has neither a store nor a category.
 * So `installedBy` goes over the bridge as well, and the rule uses the two together.
 *
 * The icon is written to a file in the app's cache and the path is what goes over the bridge.
 * A drawable cannot cross the bridge, and a base64 icon for every app on the television would be
 * megabytes of string for a screen that shows a handful of them.
 */
class AppsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "apps"

    /** The apps, as `{package, label, icon, category, installedBy}`. */
    @ReactMethod
    fun list(promise: Promise) {
        val out: WritableArray = Arguments.createArray()
        try {
            val context: Context = reactApplicationContext.applicationContext
            val pm = context.packageManager
            for (entry in HomeApps.launchable(context)) {
                val pkg = entry[0]
                if (pkg == context.packageName) continue   // this app is not one of the television's apps
                val app = Arguments.createMap()
                app.putString("package", pkg)
                app.putString("label", entry[1])
                app.putString("icon", iconPath(context, pm, pkg))
                app.putInt("category", category(pm, pkg))
                app.putString("installedBy", installedBy(pm, pkg))
                out.pushMap(app)
            }
        } catch (e: Exception) {
            promise.reject("apps_list_failed", e)
            return
        }
        promise.resolve(out)
    }

    /** The store's category for the app. Zero (a game's number) when the app does not say. */
    private fun category(pm: PackageManager, pkg: String): Int = try {
        pm.getApplicationInfo(pkg, 0).category
    } catch (e: PackageManager.NameNotFoundException) {
        ApplicationInfo.CATEGORY_GAME
    }

    /**
     * Who installed the app, or an empty string when nobody did.
     *
     * This is what makes the category mean something: a store that installs an app also tells
     * the system what kind of app it is, and an app that was put on the television by hand has
     * no category at all — which is the same number as a game.
     */
    private fun installedBy(pm: PackageManager, pkg: String): String = try {
        pm.getInstallSourceInfo(pkg).installingPackageName ?: ""
    } catch (e: PackageManager.NameNotFoundException) {
        ""
    }

    /**
     * The icon, as a file in the cache, or an empty string when the app has none we can draw.
     *
     * The file is written once per app and per version of it: an app that is updated brings a new
     * icon, and the old file would be shown until the cache is cleared.
     */
    private fun iconPath(context: Context, pm: PackageManager, pkg: String): String {
        val drawable: Drawable = try {
            pm.getApplicationIcon(pkg)
        } catch (e: PackageManager.NameNotFoundException) {
            return ""
        } catch (e: Exception) {
            return ""
        }
        val stamp = try {
            pm.getPackageInfo(pkg, 0).lastUpdateTime
        } catch (e: PackageManager.NameNotFoundException) {
            0L
        }
        val dir = File(context.cacheDir, "icons")
        if (!dir.exists() && !dir.mkdirs()) return ""
        val file = File(dir, pkg.replace(File.separatorChar, '_') + ".png")
        if (file.exists() && file.lastModified() >= stamp) return file.absolutePath
        val bitmap = draw(drawable) ?: return ""
        try {
            file.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
        } catch (e: Exception) {
            return ""
        } finally {
            bitmap.recycle()
        }
        return file.absolutePath
    }

    /** The drawable as a square bitmap of the size the screens show it at. */
    private fun draw(drawable: Drawable): Bitmap? = try {
        val bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, ICON_PX, ICON_PX)
        drawable.draw(canvas)
        bitmap
    } catch (e: Exception) {
        null
    }

    private companion object {
        /** The side of the icon, in pixels: big enough for a 4K screen's row of apps. */
        const val ICON_PX = 192
    }
}
