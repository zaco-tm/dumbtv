# AverageTV — the React Native app

The home screen the television runs, in React Native. The design lives in `../prototype/` (Vite +
React + Tailwind + the Charcoal UI Pro theme); this tree is the product: the same components,
ported to `View`/`Text`/`Pressable`, with the same tokens.

What is where:

| Where | What |
|---|---|
| `android/` | The Android app. The host activity is `io.freemytv.HomeActivity`; the native modules are in `android/app/src/main/java/io/freemytv/`. |
| `src/native/` | The JavaScript's way into Android: one wrapper per native module. |
| `src/screens/` | The screens. `WiringScreen.tsx` is the first one: it proves the wiring. |
| `src/ui/charcoal/` | The ports of the prototype's components, and `tokens.ts` (generated). |
| `tools/gen-tokens.mjs` | Writes `src/ui/charcoal/tokens.ts` from `../prototype/src/index.css`. |

## The app id

This tree builds under **`tv.dumbtv.preview`**, not the shipping `tv.dumbtv.variant`. The
household's home screen is the Java app until the swap, and it has to keep working while this tree
is built. The Java package stays `io.freemytv`, because the Guard (an accessibility service)
compares the focused window's simple class name with the literal `HomeActivity`.

## Building

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. The SDK needs
`platforms;android-37.0` and `build-tools;37.0.0`, which the React Native 0.88 template asks for.

## The tokens

The theme's colours and radii are generated from the prototype's CSS, never copied:

```sh
npm run tokens      # node tools/gen-tokens.mjs
```

Running it twice writes the same file. Change a colour in `../prototype/src/index.css` and the app
has it.

## Checking the tree

```sh
npm run typecheck   # tsc --noEmit
npm test            # jest
```
