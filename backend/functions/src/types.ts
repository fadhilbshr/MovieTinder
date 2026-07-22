import { Timestamp } from 'firebase-admin/firestore';

// 'joined'   -> in the lobby, not yet ready
// 'ready'    -> in the lobby, marked ready; waiting on the host to start
// 'active'   -> swiping; only reachable via the host-triggered startSwiping
//               function, never written directly by a client
// 'finished' -> reached the end of the deck
// 'left'     -> explicit Leave Session during the swipe phase (see
//               onParticipantLeave). Leaving during the lobby instead
//               deletes the participant doc outright — 'left' is never used
//               pre-start.
export type ParticipantStatus = 'joined' | 'ready' | 'active' | 'finished' | 'left';
export type SessionStatus = 'lobby' | 'active' | 'completed';
export type SwipeDirection = 'left' | 'right';
export type SwipeSource = 'swipe' | 'auto_left';

export interface SessionFilters {
  genres: number[];             // TMDb genre IDs
  yearMin: number;
  yearMax: number;
  minRating: number;            // TMDb vote_average, 0-10
  runtimeMin: number;           // minutes
  runtimeMax: number;
  streamingServices: number[];  // TMDb watch-provider IDs
  region: string;                // ISO 3166-1, e.g. "US"
  listSize: number;              // 10-100
}

// sessions/{sessionId}
export interface Session {
  hostId: string;
  filters: SessionFilters;
  movieIds: number[];    // ordered deck snapshot, TMDb movie IDs — same
                          // order shown to every participant
  status: SessionStatus; // 'lobby' until the host calls startSwiping, then
                          // 'active', then 'completed' once everyone is
                          // finished or left
  createdAt: Timestamp;
}

// sessions/{sessionId}/participants/{participantId}
export interface Participant {
  displayName: string;
  joinedAt: Timestamp;
  deckPosition: number;      // index of the last card this participant swiped
  status: ParticipantStatus;
  leftAt: Timestamp | null;
}

// sessions/{sessionId}/swipes/{participantId}_{movieId}
export interface Swipe {
  participantId: string;
  movieId: number;
  direction: SwipeDirection;
  source: SwipeSource;       // 'auto_left' only ever written by
                              // onParticipantLeave, never by a client
  timestamp: Timestamp;
}

export interface LikedByEntry {
  participantId: string;
  source: SwipeSource;
}

// sessions/{sessionId}/movieStats/{movieId}
// Drives the ranked Matches screen: full matches first (isFullMatch),
// then everything else sorted by yesCount descending.
export interface MovieStats {
  yesCount: number;          // realYesCount + autoLeftYesCount
  realYesCount: number;
  autoLeftYesCount: number;
  noCount: number;
  likedBy: LikedByEntry[];
  isFullMatch: boolean;      // yesCount === total participants who ever joined
}
