import './admin';

export { generateSessionList } from './generateSessionList';

// Phase 1, still to do:
// - onSwipeWrite: Firestore trigger on sessions/{sessionId}/swipes/{swipeId}
//   create. Recomputes movieStats/{movieId} (yesCount, realYesCount,
//   autoLeftYesCount, noCount, likedBy, isFullMatch).
// - onParticipantLeave: Firestore trigger on
//   sessions/{sessionId}/participants/{participantId} update, firing when
//   status transitions to 'left'. Batch-writes auto_left right-swipes for
//   the rest of that participant's deck, then recomputes movieStats.
