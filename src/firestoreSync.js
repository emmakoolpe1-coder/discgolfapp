/**
 * Firestore sync helpers. Only imports from firebase.js and firebase/firestore.
 * Do NOT import from App.jsx or any component file.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

export function emailToUserId(email) {
  if (!email || typeof email !== 'string') return '';
  return email.replace(/\./g, '_').replace(/@/g, '_');
}

export async function syncToFirestore(userId, discs, bags, aces) {
  if (!userId || !db) return;
  try {
    const ref = doc(db, 'users', userId);
    // Strip large base64 photos to stay under Firestore 1MB doc limit
    const cleanDiscs = (discs ?? []).map(d => {
      if (d.photo && d.photo.length > 5000) {
        const { photo, ...rest } = d;
        return rest;
      }
      return d;
    });
    await setDoc(ref, { discs: cleanDiscs, bags: bags ?? [], aceHistory: aces ?? [], updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) { console.warn('Firestore sync failed', e); throw e; }
}

export async function loadFromFirestore(userId) {
  if (!userId || !db) return null;
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return { discs: d.discs ?? [], bags: d.bags ?? [], aceHistory: d.aceHistory ?? [] };
  } catch (e) { console.warn('Firestore load failed', e); return null; }
}

export async function deleteUserDataFromFirestore(userId) {
  if (!userId || !db) return;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const ref = doc(db, 'users', userId);
    await deleteDoc(ref);
  } catch (e) {
    console.warn('Firestore delete failed', e);
    throw e;
  }
}
