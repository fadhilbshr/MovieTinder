import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Participant, Session, Swipe } from './types';
import { recomputeMovieStats } from './movieStats';

// Fires only on the mid-swipe leave path (active -> left). Leaving during
// the lobby deletes the participant doc instead of updating it, so it never
// reaches this trigger — there's no deck position to auto-swipe for yet.
export const onParticipantLeave = onDocumentUpdated(
  'sessions/{sessionId}/participants/{participantId}',
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as Participant;
    const after = change.after.data() as Participant;
    if (before.status === 'left' || after.status !== 'left') return;

    const { sessionId, participantId } = event.params;
    const db = getFirestore();
    const sessionRef = db.collection('sessions').doc(sessionId);

    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return;

    const session = sessionSnap.data() as Session;
    const remainingMovieIds = session.movieIds.slice(after.deckPosition + 1);
    if (remainingMovieIds.length === 0) return;

    const timestamp = Timestamp.now();
    const batch = db.batch();
    for (const movieId of remainingMovieIds) {
      const swipe: Swipe = {
        participantId,
        movieId,
        direction: 'right',
        source: 'auto_left',
        timestamp,
      };
      batch.set(sessionRef.collection('swipes').doc(`${participantId}_${movieId}`), swipe);
    }
    await batch.commit();

    await Promise.all(remainingMovieIds.map((movieId) => recomputeMovieStats(sessionId, movieId)));
  }
);
