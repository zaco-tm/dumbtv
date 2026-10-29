package io.freemytv

import android.content.Context
import android.hardware.display.DisplayManager
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

/**
 * The television's HDMI inputs.
 *
 * The Java app opens an input in a window of its own, over a TvView layer, and the back stack goes
 * with it; that is task 8's work. What the stub answers is the list Android already knows: on a
 * television the displays it reports are the HDMI inputs, with the names the television gives them.
 */
class InputsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "inputs"

    /** The inputs, as `{key, label, detail}`. */
    @ReactMethod
    fun list(promise: Promise) {
        val out: WritableArray = Arguments.createArray()
        try {
            val manager = reactApplicationContext
                    .getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
            val displays: Array<Display> = manager?.displays ?: emptyArray()
            for (display in displays) {
                val name = display.name ?: ""
                if (!name.startsWith("HDMI")) continue
                val input = Arguments.createMap()
                input.putString("key", display.displayId.toString())
                input.putString("label", name)
                input.putString("detail", "display " + display.displayId + ", " +
                        display.mode.physicalWidth + "x" + display.mode.physicalHeight)
                out.pushMap(input)
            }
        } catch (e: Exception) {
            promise.reject("inputs_list_failed", e)
            return
        }
        promise.resolve(out)
    }
}
