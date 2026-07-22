import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Swipe } from './types';
import { recomputeMovieStats } from './movieStats';

export const onSwipeWrite = onDocumentCreated(
  'sessions/{sessionId}/swipes/{swipeId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const swipe = snapshot.data() as Swipe;
    const { sessionId } = event.params;

    await recomputeMovieStats(sessionId, swipe.movieId);
  }
);
