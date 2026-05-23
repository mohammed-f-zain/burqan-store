# Rep app — Android APK

## Install on your phone (latest preview build)

1. Open on the phone (Chrome):  
   https://expo.dev/accounts/saeedfwaz/projects/mobile/builds/d5db3454-3337-45ae-a5c5-6d5771036c00  
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
