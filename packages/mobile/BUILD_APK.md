# Rep app — Android APK

## Expo Go — nothing loads / blank screen

1. **Phone and Mac on the same Wi‑Fi** (not guest network).
2. Start Metro from `packages/mobile`:
   ```bash
   cd packages/mobile && npx expo start -c
   ```
3. **Scan the QR code in the terminal** (IP changes when you change networks — old QR codes stop working).
4. If it spins forever: try tunnel mode:
   ```bash
   npx expo start --tunnel
   ```
   Then in `packages/mobile/.env` set:
   ```
   EXPO_PUBLIC_API_FORCE_ENV=1
   EXPO_PUBLIC_API_URL=https://api.burqan.store
   ```
5. Start the API locally for login during dev:
   ```bash
   npm run api:dev
   ```
   (from repo root — port **4000**)
6. Allow **Node** through macOS Firewall if the phone cannot connect.
7. **Maps** in store registration may be blank in Expo Go — use the **APK** or a dev build for full maps; the rest of the app should still work.

---

## Install on your phone (latest preview build)

1. Open on the phone (Chrome):  
   https://expo.dev/accounts/saeedfwaz/projects/mobile/builds/01045792-addf-4992-9d53-11afbb4fd5b1  
   (Fixes Android crash on launch — do not use older builds.)  
2. Tap **Install** / download the APK, then allow “Install unknown apps” if Android asks.
3. The app talks to **https://api.burqan.store** (configured in `eas.json` → `preview` profile).

## Build a new APK later

From `packages/mobile` (Expo account must be logged in: `npx eas-cli login`):

```bash
npm run build:apk
```

Or:

```bash
npx eas-cli build --platform android --profile preview
```

When the build finishes, Expo prints a link and QR code. Download the `.apk` from that page.

## Local APK path (after download)

If you ran `eas build:download` on this machine:

`packages/mobile/dist/burqan-rep-preview.apk`

AirDrop, WhatsApp, or USB-copy that file to the phone and open it to install.

## See crash logs (Android)

Release APKs do not show errors on screen. Use **logcat** with the phone connected by USB.

### 1. On the phone

1. **Settings → About phone** → tap **Build number** 7 times (Developer mode).
2. **Settings → Developer options** → enable **USB debugging**.
3. Connect the phone to the Mac with a USB cable → allow **USB debugging** on the phone.

### 2. On the Mac — install `adb` (once)

```bash
brew install android-platform-tools
```

(Or install [Android Studio](https://developer.android.com/studio) and use its SDK Platform-Tools.)

Check the device:

```bash
adb devices
```

You should see your phone listed as `device`.

### 3. Capture the crash

Clear old logs, open the app on the phone so it crashes, then run:

```bash
adb logcat -c
adb logcat *:E AndroidRuntime:E ReactNativeJS:E | tee ~/Desktop/burqan-crash.log
```

Reproduce the crash (open **برقان**), wait 5 seconds, press **Ctrl+C**.

Search the file for the error:

```bash
grep -i -E "FATAL|Exception|Error|burqan|com.burqan" ~/Desktop/burqan-crash.log | tail -80
```

Send that output when asking for help.

### Narrow filter (less noise)

```bash
adb logcat | grep -i -E "AndroidRuntime|ReactNative|burqan|hermes|FATAL"
```

### While developing (live JS errors)

With Expo on the same Wi‑Fi (not the store APK):

```bash
cd packages/mobile
npx expo start
```

Open the app in **Expo Go** or a dev build — red error screens and Metro terminal show JavaScript errors.
