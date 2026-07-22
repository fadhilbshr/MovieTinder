# MovieSwipe — Product & Technical Spec (v1)

## 1. Overview

A "Tinder for movies" Android app for groups. One person (the **host**) sets filter
criteria and generates a list of ~50 movies. The app produces a shareable link;
everyone who opens it joins the same session and swipes right (want to watch) or
left (pass) through the same list, with a poster, synopsis, cast, and rating on
each card. Once swiping is done, the app surfaces every movie that **everyone**
swiped right on. If there are no matches, the group can loosen the filters and
run another round, or negotiate manually from the near-matches.

**Recommended data sources:** [TMDb](https://www.themoviedb.org/documentation/api)
for posters, synopses, cast, ratings, genres, and runtime (free, generous limits,
excellent catalog). For "where can I actually watch this," TMDb also exposes a
`watch/providers` endpoint (backed by JustWatch data) — no separate paid API
needed for v1. This is worth including even in the MVP since "what's actually
streamable" is often the real deciding factor for a group.

**Recommended scope for this spec:** MVP first — session creation, filtering,
sharing, swiping, and matching. Everything past that (accounts, watch history,
in-app chat, etc.) is listed in §9 as Phase 2 so the first build stays lean.

---

## 2. Core User Flow

1. **Host opens app → "New Session."**
2. Host sets filters (genres, year range, min rating, runtime, list size,
   streaming services) and taps **Generate List**.
3. App queries TMDb, builds an ordered list of movies, creates a session record,
   and produces a shareable link (`moviesw.app/join/AB3F9K`).
4. Host shares the link (standard Android share sheet — text, WhatsApp, etc.).
5. Each recipient taps the link → app opens (or Play Store install → resumes
   into the session) → enters a display name → joins the **lobby**.
6. Everyone in the lobby marks themselves **ready**. Once every participant
   is ready (minimum 2), the host taps **Start Swiping**, which locks the
   lobby — no one can join after this point.
7. Everyone swipes through the same deck independently, at their own pace.
8. As swipes come in, the app computes matches in real time.
9. Once someone finishes their deck, they can view a live **Matches** screen.
10. When everyone's done: final match list is shown. If empty, the host can
   **re-filter and re-deal** a new round within the same group, or the group
   can eyeball the "close calls" (movies most people liked) and decide manually.

---

## 3. Feature Breakdown (MVP)

### 3.1 Session creation & filters
- Genres (multi-select)
- Release year range (slider)
- Minimum rating (TMDb score)
- Runtime range
- Streaming services the group has access to (multi-select — Netflix, Prime
  Video, Disney+, Max, Hulu, Apple TV+, etc.) — filters to movies available on
  at least one selected service in the user's region
- List size (default 50, adjustable 10–100)
- Region (for streaming availability — default to device locale)

### 3.2 Sharing
- Generates a Firebase Dynamic Link / Android App Link tied to the session ID.
- Link opens the app directly to the "join session" screen if installed, or
  Play Store → app → session if not (standard deferred deep link pattern).
- No account needed to join — anonymous participation, just a display name.
- Joining lands in the **lobby**, not directly in the deck — see §3.3.

### 3.3 Lobby — RESOLVED
- After joining, a participant sees who else has joined and a **Ready**
  toggle for themselves (can be flipped back and forth before the host
  starts).
- The host sees a **Start Swiping** button, enabled only once every
  participant in the lobby is ready and there are at least 2 of them.
- Starting locks the lobby: no one can join after this point, and the deck
  (already generated at session-creation time) and the participant list are
  both frozen. This is what guarantees every participant sees the identical
  deck from card 1 — there's no late-joiner case to handle.
- Leaving the lobby (before the host starts) removes the participant
  outright — no deck position was ever assigned to them, so there's nothing
  to auto-swipe on their behalf. This is different from leaving mid-swipe
  (§3.5).

### 3.4 Swipe interface
- Full-bleed poster, title, year, TMDb rating, genre chips, runtime, 2–3 line
  synopsis, top 4 cast names, and streaming service logos (if available).
- Swipe right = like, swipe left = pass. Tap card = expand full details.
- Progress indicator ("14 / 50").
- Swipes sync to the backend as they happen (no "submit" step).
- Works offline mid-deck; queues and syncs swipes when connectivity returns.

### 3.5 Matching — RESOLVED
- **Threshold: unanimous.** A movie is a full **match** once every participant
  who ever joined the session has a "yes" recorded for it (see leaving rule
  below — a yes can be a real swipe or an automatic one). Since the lobby
  locks before swiping starts (§3.3), "everyone who ever joined" is a fixed
  set for the whole session — no one can join mid-swipe and change the
  denominator.
- **Deck order is identical for every participant** — everyone swipes the
  exact same ordered list, since both the deck and the participant list are
  frozen when the host starts swiping.
- **Leaving mid-swipe:** leaving is an explicit action ("Leave Session," with
  a confirmation dialog explaining the consequence) — not inferred from the app
  being closed or backgrounded. On confirmed leave, every card from the
  participant's current position to the end of the deck is auto-recorded as a
  **right swipe tagged `auto_left`**, distinct from a genuine `swipe` right.
  (Leaving the lobby, before swiping starts, is a separate, simpler path —
  see §3.3.)
- **Live "It's a Match!" toast/animation** the moment a movie hits unanimous
  yes, visible to whoever is active in the app at that moment.
- **Matches screen is a single ranked list, not just a binary match/no-match
  view:**
  - Top section: full unanimous matches (yesCount == total participants),
    highlighted.
  - Below that, every other movie in the deck, sorted **descending by
    yesCount** — e.g. with 10 participants: 10/10 first, then all 9/10s,
    then all 8/10s, and so on. This lets the group see the closest near-misses
    even with zero full matches.
  - Each movie's yes-avatars visually distinguish a genuine swipe from an
    `auto_left` yes (e.g., a small "left early" tag/greyed avatar), so the
    group can tell a real match from one that only "matched" because someone
    dropped out.
- Once all participants are `finished` or `left`, session status flips to
  `completed` and this ranked list becomes the final result.

### 3.6 No-match handling
- If the final match list is empty (or too small), the host gets two options:
  - **Re-filter**: adjust criteria (e.g., lower min rating, allow more genres)
    and generate a fresh list within the same session/group — no need to
    re-share the link, everyone gets prompted to swipe the new round.
  - **Show near-matches**: movies liked by the most participants (e.g., liked
    by all but one), to negotiate manually.

---

## 4. Data Model (Firebase Firestore)

```
sessions/{sessionId}
  hostId: string
  filters: { genres[], yearMin, yearMax, minRating, runtimeMin, runtimeMax,
             streamingServices[], region, listSize }
  movieIds: [tmdbId, tmdbId, ...]      // ordered deck, snapshot at generation time
  status: "lobby" | "active" | "completed"   // "lobby" until the host calls
                                              // startSwiping, which locks joining
  createdAt: timestamp

sessions/{sessionId}/participants/{participantId}
  displayName: string
  joinedAt: timestamp
  deckPosition: number       // index of last card swiped
  status: "joined" | "ready" | "active" | "finished" | "left"
                              // joined/ready = lobby, not yet swiping
                              // active = swiping (set only by startSwiping,
                              //   never written by a client)
                              // finished/left = done, mid-swipe only —
                              //   leaving the lobby deletes the doc instead
  leftAt: timestamp | null

sessions/{sessionId}/swipes/{participantId_movieId}
  participantId: string
  movieId: number
  direction: "right" | "left"
  source: "swipe" | "auto_left"   // auto_left = they left before reaching this card
  timestamp: timestamp

sessions/{sessionId}/movieStats/{movieId}   // maintained by a Cloud Function, drives the ranked Matches screen
  yesCount: number            // real + auto_left, right swipes
  realYesCount: number
  autoLeftYesCount: number
  noCount: number
  likedBy: [ { participantId, source } ]
  isFullMatch: boolean        // yesCount == total participants who ever joined
```

Movie metadata itself (poster URL, synopsis, cast, rating) is **not** duplicated
into Firestore — it's fetched from TMDb once per session and cached locally on
device (Room DB) so re-opening the app doesn't re-hit the API for every card.

**Why Cloud Functions for match computation:** if every client computes matches
independently from raw swipe data, clock drift and partial reads can cause the
match toast to fire inconsistently. Five functions do the real work:
- `startSwiping`: host-only callable. Requires every lobby participant to be
  `ready` and at least 2 of them present, then transactionally flips
  `session.status` to `active` and every participant's `status` to `active`.
  This is also what locks the lobby — `firestore.rules` only allows a new
  participant doc to be created while `session.status == "lobby"`.
- `onSwipeWrite`: recalculates `movieStats/{movieId}` whenever a swipe is written.
- `onParticipantLeave`: when a participant's status flips to `left` (mid-swipe
  only), this function batch-writes `auto_left` right-swipes for every
  remaining card in their deck, then recalculates `movieStats` for each of
  those movies. Doing this server-side avoids a client having to stay online
  to "finish" writing on someone else's behalf.
- `onParticipantLeave` and `onParticipantFinish` both also check whether
  every participant is now `finished` or `left` and, if so, flip
  `session.status` to `completed` — a session can complete either by its
  last participant leaving or by finishing their deck.

---

## 5. Architecture

**Android app**
- Kotlin, Jetpack Compose for UI
- Custom swipeable-card component (Compose `pointerInput` + `draggable`, or a
  lightweight library like `compose-swipeable-cards` if it fits your needs)
- Coil for poster image loading/caching
- Room for local movie metadata cache (offline swiping support)
- Hilt for DI, ViewModel + StateFlow for state
- WorkManager to flush queued offline swipes on reconnect

**Backend**
- Firebase Firestore — real-time swipe sync, matches, session state
- Firebase Authentication (Anonymous) — one anonymous identity per device per
  session, no signup friction
- Firebase Cloud Functions — match computation, list generation (calls TMDb
  server-side so the API key never ships in the app)
- Firebase Dynamic Links (or plain Android App Links, since Dynamic Links is
  being deprecated by Google — **use App Links** for a new project) for the
  shareable join URL

**External API**
- TMDb `/discover/movie` for filtered list generation
- TMDb `/movie/{id}` + `/movie/{id}/credits` for details/cast
- TMDb `/movie/{id}/watch/providers` for streaming availability

---

## 6. Screens (MVP)

1. Landing / Create Session
2. Filter picker
3. "List ready — share this link" screen (with QR code + share sheet)
4. Join Session (name entry)
5. Lobby — shows who's joined, a Ready toggle per participant, and (host
   only) a Start Swiping button, enabled once everyone's ready and the
   2-participant minimum is met
6. Swipe deck
7. Movie detail (expanded card)
8. Live Matches tab
9. Final Results / Re-filter screen

---

## 7. Edge Cases & Open Decisions

**Resolved:**
- **Lobby locks before swiping:** everyone joins a lobby and marks ready; the
  host starts swiping only once everyone's ready and the 2-participant
  minimum is met. No one can join after that (§3.3), which is what
  guarantees deck order is identical for every participant — there's no
  late-joiner case to handle.
- **Match threshold:** unanimous — every participant who was in the lobby
  when swiping started needs a yes (real or `auto_left`). Since joining locks
  before swiping, this denominator can't change mid-session.
- **Leaving the lobby:** removes the participant's doc outright — no deck
  position was ever assigned, so there's nothing to auto-swipe.
- **Participant leaves mid-swipe:** all of their un-reached cards are
  auto-recorded as right swipes, tagged `auto_left` so the Matches screen can
  visually distinguish them from genuine yeses (see §3.5).
- **Minimum group size:** 2 participants minimum, enforced by `startSwiping`
  before it'll lock the lobby.
- **Rejoining after leaving:** if someone left mid-swipe, then reopens the
  link, they stay locked as `left` — reopening the link just shows them the
  live results, keeps the auto-yes logic unambiguous.

**Still open:**
- **Session expiry:** recommend auto-expiring sessions after 7 days of inactivity.

---

## 8. Non-Functional Requirements

- Should feel smooth on low/mid-range Android devices — compress poster images,
  cache aggressively.
- Support up to ~10 concurrent participants per session without lag on the
  live Matches screen.
- No personal data collected beyond a self-chosen display name (anonymous auth).
- Should work reasonably offline mid-swipe (queue + sync).

---

## 9. Phase 2 Ideas (explicitly out of scope for v1)

- Optional real accounts + cross-session swipe history
- "Already seen" exclusion list (possibly via Trakt integration)
- In-app group chat / emoji reactions on matches
- Deep link straight into the streaming app for the matched movie
- TV show support, not just movies
- Configurable match threshold (majority vs. unanimous)
- iOS version

---

## 10. Suggested Build Order

1. Firebase project + anonymous auth + Firestore schema
2. TMDb integration (Cloud Function: filters → movie ID list)
3. Session creation + share link (App Links)
4. Join flow + Lobby (ready toggle, host Start Swiping → `startSwiping`)
5. Swipe deck UI + swipe-write-to-Firestore
6. Match computation (Cloud Function) + live Matches screen
7. Final results + re-filter loop
8. Offline queueing polish
