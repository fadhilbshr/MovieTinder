import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { Session } from './types';

const MIN_PARTICIPANTS = 2;

// Host-only callable: locks the lobby and moves everyone into the swipe
// phase. Requires every participant currently in the lobby to be 'ready'
// and at least MIN_PARTICIPANTS of them. No new participants can join after
// this succeeds — firestore.rules blocks participant creation once
// session.status is no longer 'lobby'.
export const startSwiping = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before starting a session.');
  }

  const sessionId = request.data?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new HttpsError('invalid-argument', 'sessionId is required.');
  }

  const db = getFirestore();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const participantsRef = sessionRef.collection('participants');

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError('not-found', 'Session not found.');
    }

    const session = sessionSnap.data() as Session;
    if (session.hostId !== request.auth!.uid) {
      throw new HttpsError('permission-denied', 'Only the host can start swiping.');
    }
    if (session.status !== 'lobby') {
      throw new HttpsError('failed-precondition', 'This session has already started.');
    }

    const participantsSnap = await tx.get(participantsRef);
    if (participantsSnap.size < MIN_PARTICIPANTS) {
      throw new HttpsError(
        'failed-precondition',
        `At least ${MIN_PARTICIPANTS} participants are required to start.`
      );
    }

    const notReady = participantsSnap.docs.some((doc) => doc.data().status !== 'ready');
    if (notReady) {
      throw new HttpsError('failed-precondition', 'Every participant must be ready before starting.');
    }

    tx.update(sessionRef, { status: 'active' });
    for (const doc of participantsSnap.docs) {
      tx.update(doc.ref, { status: 'active' });
    }
  });

  return { started: true };
});
