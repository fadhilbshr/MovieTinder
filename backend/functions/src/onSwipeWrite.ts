import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { LikedByEntry, MovieStats, Swipe } from './types';

export const onSwipeWrite = onDocumentCreated(
  'sessions/{sessionId}/swipes/{swipeId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const swipe = snapshot.data() as Swipe;
    const { sessionId } = event.params;
    const { movieId } = swipe;

    const db = getFirestore();
    const sessionRef = db.collection('sessions').doc(sessionId);

    const [swipesSnap, participantsCountSnap] = await Promise.all([
      sessionRef.collection('swipes').where('movieId', '==', movieId).get(),
      sessionRef.collection('participants').count().get(),
    ]);

    let realYesCount = 0;
    let autoLeftYesCount = 0;
    let noCount = 0;
    const likedBy: LikedByEntry[] = [];

    for (const doc of swipesSnap.docs) {
      const s = doc.data() as Swipe;
      if (s.direction !== 'right') {
        noCount += 1;
        continue;
      }

      likedBy.push({ participantId: s.participantId, source: s.source });
      if (s.source === 'auto_left') {
        autoLeftYesCount += 1;
      } else {
        realYesCount += 1;
      }
    }

    const yesCount = realYesCount + autoLeftYesCount;
    const totalParticipants = participantsCountSnap.data().count;

    const stats: MovieStats = {
      yesCount,
      realYesCount,
      autoLeftYesCount,
      noCount,
      likedBy,
      isFullMatch: totalParticipants > 0 && yesCount === totalParticipants,
    };

    await sessionRef.collection('movieStats').doc(String(movieId)).set(stats);
  }
);
