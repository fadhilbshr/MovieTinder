import { Timestamp } from 'firebase-admin/firestore';

export type ParticipantStatus = 'active' | 'finished' | 'left';
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
                          // order shown to every participant, including
                          // late joiners
  status: 'active' | 'completed';
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
