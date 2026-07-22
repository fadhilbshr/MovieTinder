# MovieSwipe — Project Instructions for Claude Code

You are building an Android app for groups to agree on what movie to watch,
using a Tinder-style swipe interface. This file is your persistent context —
read it fully before starting work, and follow the decisions below exactly;
they were already debated and resolved, so don't re-litigate them.

Full product/technical spec: `docs/spec.md`. Read that too before writing code.

## One-line pitch

A host sets filters, the app generates a ~50-movie deck from TMDb, and
produces a shareable link. Everyone who opens the link joins the same session
and swipes right/left through the identical deck. Once done, everyone sees a
ranked results list — full matches (everyone said yes) at the top, then every
other movie sorted by how many people liked it.

## Tech stack (decided — do not substitute alternatives without asking)

- **Android:** Kotlin, Jetpack Compose, Hilt (DI), Room (local movie cache),
  Coil (image loading), WorkManager (offline swipe queueing)
- **Backend:** Firebase — Firestore, Anonymous Authentication, Cloud Functions
  (TypeScript)
- **Movie data:** TMDb API — `/discover/movie`, `/movie/{id}`,
  `/movie/{id}/credits`, `/movie/{id}/watch/providers`
- **Sharing:** Android App Links (not Firebase Dynamic Links — deprecated).
  Needs a real domain or Firebase Hosting subdomain serving
  `assetlinks.json`.

## Product decisions already made (final — build to these)

1. **Joining is lobby-style and locks before swiping starts.** Everyone who
   opens the link joins a waiting lobby and marks themselves ready. Once
   every participant in the lobby is ready (minimum 2, per #7), the host
   taps "Start Swiping," which locks the lobby — no one can join after that
   point. Deck order is identical for every participant since the deck and
   the participant list are both frozen before card 1 is shown to anyone.
2. **Match threshold is unanimous.** A movie is a full match only once every
   participant who ever joined the session has a "yes" recorded for it.
3. **Leaving is explicit**, never inferred from the app closing or
   backgrounding, and behaves differently before vs. after swiping starts:
   - **Leaving the lobby** (before the host starts swiping) just removes
     the participant outright — no deck position was ever assigned, so
     there's nothing to auto-swipe, and it stops them from blocking the
     "everyone ready" check.
   - **Leaving mid-swipe** requires a "Leave Session" action with a
     confirmation dialog that tells the person what happens next. On
     confirmed leave: every card from their current deck position to the
     end is auto-recorded as a right swipe tagged `source: "auto_left"` —
     distinct from a genuine `source: "swipe"`.
4. **Rejoining after leaving is locked.** If someone left and reopens the
   join link, they land on the live results screen only — they can't swipe
   again.
5. **The Matches screen is a single ranked list, not a binary match/no-match
   view:**
   - Section 1: full unanimous matches, highlighted.
   - Below that: every other movie in the deck, sorted **descending by
     yesCount** (e.g. with 10 participants: all 10/10s, then all 9/10s, then
     8/10s, and so on).
   - Every yes-vote's avatar/indicator must visually distinguish a genuine
     swipe from an `auto_left` yes, so the group can tell a real match from
     one that only happened because someone dropped out.
   - Live "It's a Match!" toast the instant a movie hits unanimous yes.
6. Session auto-expires after 7 days of inactivity.
7. Minimum 2 participants to start swiping.
8. If the final ranked list has no full matches, the host can re-filter
   (loosen criteria) and re-deal a new round in the same session, without
   re-sharing the link.

## Data model & security rules — already written, use these as-is

- `backend/firestore.rules` — canonical security rules. Key invariant: a
  client can **only** ever write a swipe with `source: "swipe"`. Writing
  `source: "auto_left"`, session metadata, or `movieStats` is only ever done
  server-side via the Admin SDK — enforce this, don't loosen it.
- `backend/functions/src/types.ts` — canonical TypeScript types for
  `Session`, `Participant`, `Swipe`, `MovieStats`, etc. Use these types
  throughout the Cloud Functions codebase; don't redefine the shape ad hoc.

Collections (see types.ts for full field detail):
```
sessions/{sessionId}
sessions/{sessionId}/participants/{participantId}
sessions/{sessionId}/swipes/{participantId}_{movieId}
sessions/{sessionId}/movieStats/{movieId}
```

## Build roadmap — work through these phases in order

**Phase 0 — Setup**
- Firebase project: enable Firestore, Anonymous Auth, Cloud Functions
- TMDb API key (server-side only, never shipped in the Android app)
- Domain/Firebase Hosting subdomain for the App Link + `assetlinks.json`

**Phase 1 — Backend skeleton (start here)**
- `generateSessionList(filters)` — callable Cloud Function. Queries TMDb
  `/discover/movie` with the given filters, dedupes, trims to `listSize`,
  writes the ordered `movieIds` array onto the new `sessions/{sessionId}` doc
  with `status: "lobby"`.
- `startSwiping(sessionId)` — host-only callable Cloud Function. Requires
  every participant currently in the lobby to be `"ready"` and at least 2 of
  them present, then transactionally flips `session.status` to `"active"`
  and every participant's `status` from `"ready"` to `"active"`. This is the
  only path from lobby to swiping — `firestore.rules` blocks participant
  creation once `session.status` is no longer `"lobby"`, which is what
  locks the lobby.
- `onSwipeWrite` — Firestore trigger on `sessions/{sessionId}/swipes/{swipeId}`
  create. Recomputes the corresponding `movieStats/{movieId}` doc (yesCount,
  realYesCount, autoLeftYesCount, noCount, likedBy, isFullMatch).
- `onParticipantLeave` — Firestore trigger on `participants/{participantId}`
  update, firing when `status` transitions to `"left"` (mid-swipe leave
  only — leaving the lobby deletes the doc instead and doesn't go through
  this trigger). Batch-writes `auto_left` right-swipes for every remaining
  card in that participant's deck (from `deckPosition + 1` to the end of
  `movieIds`), then recomputes `movieStats` for each affected movie. Also
  checks whether every participant is now `"finished"` or `"left"`, and if
  so flips `session.status` to `"completed"`.
- `onParticipantFinish` — Firestore trigger on `participants/{participantId}`
  update, firing when `status` transitions to `"finished"`. Runs the same
  "is everyone done" completion check as `onParticipantLeave` — needed
  because a session can also complete via its last participant finishing
  their deck rather than leaving.
- Deploy `firestore.rules` as part of this phase.

**Phase 2 — Android scaffold**
- New Compose project, Hilt, Firebase SDK, Coil, Room wired up
- Anonymous auth on launch
- Navigation graph: Create → Filters → Share → Join → Lobby → Swipe → Matches → Results

**Phase 3 — Core screens**
- Filter picker → calls `generateSessionList`
- Share screen: App Link + QR code
- Join flow: deep link handling, display name entry
- Lobby screen: shows who's joined, a "Ready" toggle per participant, and
  (host only) a "Start Swiping" button — disabled until everyone's ready
  and the 2-participant minimum is met, calls `startSwiping`
- Swipe deck: gesture-based cards, writes `source: "swipe"` swipes to
  Firestore, works offline (queue via WorkManager, flush on reconnect)

**Phase 4 — Matches screen**
- Live listener on `movieStats`, rendered as the ranked list described above
- Visual distinction for `auto_left` votes
- "It's a Match!" toast on `isFullMatch` transitioning to true

**Phase 5 — Leave flow & edge cases**
- "Leave Session" button + confirmation dialog explaining the consequence
- Re-filter / re-deal loop when results are thin
- Session expiry handling

**Phase 6 — Polish**
- Offline swipe queueing edge cases
- Empty/error states
- Real-group test run

## Your first task

Start Phase 1. Set up the Cloud Functions project (TypeScript, Firebase
Functions SDK) inside `backend/functions/`, using the types already defined
in `backend/functions/src/types.ts`, and implement `generateSessionList`
first — it's the simplest of the three and unblocks testing the other two.
Ask before introducing any dependency or architectural choice not already
specified above.
