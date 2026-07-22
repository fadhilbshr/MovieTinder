import './admin';

export { generateSessionList } from './generateSessionList';
export { startSwiping } from './startSwiping';
export { onSwipeWrite } from './onSwipeWrite';

// Phase 1, still to do:
// - onParticipantLeave: Firestore trigger on
//   sessions/{sessionId}/participants/{participantId} update, firing when
//   status transitions to 'left'. Batch-writes auto_left right-swipes for
//   the rest of that participant's deck, then recomputes movieStats.
