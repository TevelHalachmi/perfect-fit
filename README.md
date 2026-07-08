# Perfect Fit 🎯

A lovely little rage game about precision.

**Hold** the screen — your shape grows, wobbles, and shakes.
**Release** when it matches the outline. Simple. Infuriating. Adorable.

## ▶️ Play now

**https://tevelhalachmi.github.io/perfect-fit/**

Works in any browser — phone or desktop (hold `Space` on desktop). Send the
link to anyone.

## 📱 Install it like an app

- **iPhone / iPad** — open the link in Safari → tap **Share** → **Add to
  Home Screen**. Fullscreen, offline, app icon and all.
- **Android** — open the link in Chrome → tap the **⋮ menu** → **Add to Home
  screen / Install app**. Or grab the native APK from
  [**Releases**](../../releases) — download `PerfectFit.apk` on your phone,
  open it, and allow the install.

## 🎮 What's inside

- 12 unlockable kawaii shapes with reactive faces
- A shop: 8 skins and 5 permanent upgrades, funded by coins you earn playing
- An endless difficulty ramp with escalating twists — spinning, breathing,
  wandering, ghosting targets. Level 1 is a lullaby; level 20 is a duel.
- 100% procedurally synthesized sound (Web Audio) — nothing to download
- Offline PWA + Capacitor config for native Android/iOS builds

## 🔧 Build the native apps yourself

```bash
npm install
npx cap add android && npx cap sync    # Android Studio project
npx cap add ios && npx cap sync        # Xcode project (needs macOS)
```

The Android APK in Releases is rebuilt automatically by GitHub Actions on
every push to `main`.
