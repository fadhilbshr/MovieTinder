import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Participant } from './types';
import { checkSessionCompletion } from './sessionCompletion';

// Fires on the active -> finished transition (a participant reaches the end
// of their deck). No swipe data changes here, unlike leaving — this just
// checks whether the whole session is now done.
export const onParticipantFinish = onDocumentUpdated(
  'sessions/{sessionId}/participants/{participantId}',
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as Participant;
    const after = change.after.data() as Participant;
    if (before.status === 'finished' || after.status !== 'finished') return;

    const { sessionId } = event.params;
    await checkSessionCompletion(sessionId);
  }
);
