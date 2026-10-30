package io.freemytv

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

/**
 * The television's HDMI inputs.
 *
 * The list is the Java app's own: `HomeApps.allInputs` walks the TV's input manager, gives each
 * port the number the television gives it, and takes the name from the device that talks HDMI-CEC
 * ("PlayStation 5"), so the tile is named after the console and not after the port.
 *
 * `isConsole` is that name read the way the Java app reads it: `HomeApps.deviceSymbol` picks an
 * icon from the words in the name, and the game console's icon is "gamepad". The words are the
 * table in `HomeApps`: a gamepad, a playstation, a ps5, a ps4, a ps3, an xbox, a nintendo, a
 * switch, a steam deck, a console, a game.
 */
class InputsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "inputs"

    /** The inputs, as `{key, label, detail, isConsole}`. */
    @ReactMethod
    fun list(promise: Promise) {
        val out: WritableArray = Arguments.createArray()
        try {
            val context: Context = reactApplicationContext.applicationContext
            for (item in HomeApps.allInputs(context)) {
                // The live TV entry is in the same list: it is not an input.
                if (item.kind != HomeApps.INPUT) continue
                val input = Arguments.createMap()
                input.putString("key", item.key)
                input.putString("label", item.label)
                input.putString("detail", if (item.connected) "connected" else "no signal")
                input.putBoolean("isConsole", SYMBOL_CONSOLE == item.symbol)
                out.pushMap(input)
            }
        } catch (e: Exception) {
            promise.reject("inputs_list_failed", e)
            return
        }
        promise.resolve(out)
    }

    private companion object {
        /** The icon `HomeApps.deviceSymbol` gives a game console. */
        const val SYMBOL_CONSOLE = "gamepad"
    }
}
