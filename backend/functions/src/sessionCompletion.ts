import { getFirestore } from 'firebase-admin/firestore';
import { Participant } from './types';

const DONE_STATUSES: Participant['status'][] = ['finished', 'left'];

// Flips session.status from 'active' to 'completed' once every participant
// is either 'finished' or 'left'. Participants can't be added or removed
// once the session is active (the lobby is locked by then), so this is a
// simple "did the last one just finish" check, safe to call redundantly.
export async function checkSessionCompletion(sessionId: string): Promise<void> {
  const db = getFirestore();
  const sessionRef = db.collection('sessions').doc(sessionId);

  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists || sessionSnap.data()?.status !== 'active') return;

  const participantsSnap = await sessionRef.collection('participants').get();
  if (participantsSnap.empty) return;

  const allDone = participantsSnap.docs.every((doc) =>
    DONE_STATUSES.includes((doc.data() as Participant).status)
  );
  if (!allDone) return;

  await sessionRef.update({ status: 'completed' });
}
