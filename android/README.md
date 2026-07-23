# MovieSwipe — Android app

Phase 2 scaffold: Compose, Hilt, Room, Coil, and the Firebase SDK wired up,
anonymous auth on launch, and a navigation graph with placeholder screens for
every step in the flow (Create → Filters → Share → Join → Lobby → Swipe →
Matches → Results). Screens are stubs; real UI lands in Phase 3+.

## One-time setup

1. **Generate the Gradle wrapper.** This project was scaffolded in a sandbox
   that can't reach Gradle's or Google's servers, so `gradlew`/`gradlew.bat`
   aren't committed. From this directory, with normal internet access:
   ```
   gradle wrapper --gradle-version 8.14.3
   ```
   Or just open the project in Android Studio — it'll offer to generate the
   wrapper for you on first import.

2. **Replace `app/google-services.json`.** The committed one is a placeholder
   with fake IDs (same pattern as `backend/.firebaserc`) so Gradle sync
   doesn't hard-fail on a missing file. Once you've created the Firebase
   project (Phase 0) and registered an Android app with package name
   `com.movieswipe.app`, download the real `google-services.json` from the
   Firebase console and drop it in over the placeholder.

3. **Open in Android Studio** (this repo has no Android SDK available in the
   sandbox this was built in, so it hasn't been Gradle-synced or built —
   verify it compiles there before trusting it further).

## Notes

- `AppDatabase` (Room) has an empty `entities` list for now — the movie cache
  schema lands in Phase 3 once the TMDb movie detail shape driving the swipe
  deck is settled.
- The App Link intent-filter for join links isn't wired up yet — needs
  Phase 0's domain/Firebase Hosting + `assetlinks.json` first, then lands
  alongside the rest of the Phase 3 join flow.
- Dependency versions in `gradle/libs.versions.toml` were picked from
  training knowledge, not verified against Maven — this sandbox can't reach
  `dl.google.com` to check current stable numbers. Bump anything Android
  Studio flags as outdated on first sync.
