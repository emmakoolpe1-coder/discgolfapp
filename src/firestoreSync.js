/**
 * Firestore sync helpers. Only imports from firebase.js and firebase/firestore.
 * Do NOT import from App.jsx or any component file.
 *
 * All Firestore WRITES go through firestoreService — never import setDoc,
 * updateDoc, addDoc, or deleteDoc from firebase/firestore.
 */
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase.js';
import {
  createBatch,
  safeBatchSet,
  safeBatchDelete,
  safeBatchCommit,
  safeDeleteDoc,
  backupUserData,
} from './services/firestoreService.js';

function removeUndefined(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/** Parse a flight number from Firestore (number or numeric string); preserve 0; never use || so "0" is not replaced. */
function normalizeFlightField(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v != null && v !== '') {
    const n = parseFloat(String(v).replace(/,/g, '.'));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Normalize disc from Firestore with fallback defaults to prevent crashes on missing fields. */
function normalizeDisc(data, docId) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    id: d.id ?? docId ?? '',
    manufacturer: d.manufacturer ?? '',
    mold: d.mold ?? '',
    plastic_type: d.plastic_type ?? '',
    custom_name: d.custom_name ?? '',
    speed: normalizeFlightField(d.speed, 7),
    glide: normalizeFlightField(d.glide, 5),
    turn: normalizeFlightField(d.turn, -1),
    fade: normalizeFlightField(d.fade, 1),
    weight_grams: typeof d.weight_grams === 'number' ? d.weight_grams : (d.weight_grams != null ? parseInt(d.weight_grams, 10) : 175) ?? 175,
    disc_type: d.disc_type ?? 'midrange',
    wear_level: typeof d.wear_level === 'number' ? d.wear_level : (d.wear_level != null ? parseInt(d.wear_level, 10) : 10) ?? 10,
    status: d.status ?? 'backup',
    flight_preference: d.flight_preference ?? 'both',
    color: d.color ?? '#22c55e',
    photo: d.photo ?? null,
    date_acquired: d.date_acquired ?? '',
    story: d.story ?? '',
    estimated_value: typeof d.estimated_value === 'number' ? d.estimated_value : (d.estimated_value != null ? parseFloat(d.estimated_value) : 18) ?? 18,
    hasAce: !!d.hasAce,
    aceDate: d.aceDate ?? '',
    aceLocation: d.aceLocation ?? '',
    aceHole: d.aceHole ?? '',
    lostNote: typeof d.lostNote === 'string' ? d.lostNote : '',
    gaveAwayNote: typeof d.gaveAwayNote === 'string' ? d.gaveAwayNote : '',
    bagIds: (() => {
      if (Array.isArray(d.bagIds) && d.bagIds.length) {
        return d.bagIds.filter((x) => typeof x === 'string' && x);
      }
      if (typeof d.bagId === 'string' && d.bagId) return [d.bagId];
      return [];
    })(),
    bagId: null,
  };
}

/** Normalize ace from Firestore with fallback defaults to prevent crashes on missing fields. */
function normalizeAce(data, docId) {
  const a = data && typeof data === 'object' ? data : {};
  return {
    id: a.id ?? docId ?? '',
    discId: a.discId ?? '',
    date: a.date ?? '',
    course: a.course ?? '',
    hole: typeof a.hole === 'number' ? a.hole : (a.hole != null ? parseInt(a.hole, 10) : 0) ?? 0,
    distance: typeof a.distance === 'number' ? a.distance : (a.distance != null ? parseInt(a.distance, 10) : 0) ?? 0,
    witnessed: !!a.witnessed,
    notes: a.notes ?? '',
    photo: a.photo ?? null,
  };
}

/** Normalize bag with fallback defaults. */
function normalizeBag(b) {
  const bag = b && typeof b === 'object' ? b : {};
  return {
    id: bag.id ?? '',
    name: bag.name ?? '',
    bagColor: bag.bagColor ?? '#6b7280',
    disc_ids: Array.isArray(bag.disc_ids) ? bag.disc_ids : [],
  };
}

export function emailToUserId(email) {
  if (!email || typeof email !== 'string') return '';
  return email.replace(/\./g, '_').replace(/@/g, '_');
}

export async function syncToFirestore(userId, discs, bags, aces, tournaments, longestThrows, personalBests, dataLoaded = false) {
  if (!userId || !db) return;
  const firebaseUser = getAuth().currentUser;
  // This app uses custom email auth + Google Identity Services; Firebase Auth currentUser
  // is only set for Google users who've signed in via Firebase. For email users it's always null.
  // We trust the caller: sync is only invoked when userAuth exists (App guards with userAuth?.email).
  const isAuthenticated = !!firebaseUser || !!userId;
  console.log('[sync] Auth state:', { firebaseUser: firebaseUser?.email ?? null, userId, isAuthenticated });
  if (!isAuthenticated) {
    console.warn('[sync] Skipping sync — no authenticated user (signed out)');
    return;
  }
  try {
    console.log('[sync] userId used for write:', userId);
    const userRef = doc(db, 'users', userId);
    const discsCol = collection(userRef, 'discs');
    const acesCol = collection(userRef, 'aces');

    const discsList = discs ?? [];
    const currentDiscSnap = await getDocs(discsCol);
    const remoteDiscCount = currentDiscSnap.size;

    // CRITICAL: Never sync empty local state when Firestore has discs (data loss protection)
    if (discsList.length === 0 && remoteDiscCount > 0) {
      console.warn('[sync] ⚠️ BLOCKED: Refusing to write 0 discs when Firestore has', remoteDiscCount, 'discs. Possible data loss prevented.');
      return;
    }
    // CRITICAL: Never allow a sync that would reduce total disc count (data loss protection)
    if (discsList.length < remoteDiscCount) {
      console.warn('[sync] ⚠️ BLOCKED: Refusing to write', discsList.length, 'discs when Firestore has', remoteDiscCount, '. Would reduce count. Possible data loss prevented.');
      return;
    }

    const batch = createBatch();

    // Sync discs subcollection
    {
      console.log('[sync] Writing discs to Firestore for user:', userId, 'count:', discsList.length);
      const incomingDiscIds = new Set(discsList.map(d => d.id).filter(Boolean));
      currentDiscSnap.forEach(s => {
        if (!incomingDiscIds.has(s.id)) safeBatchDelete(batch, s.ref);
      });
      discsList.forEach(d => {
        if (!d || !d.id) return;
        const safe = { ...d };
        if (safe.photo && typeof safe.photo === 'string' && safe.photo.length > 900000) {
          console.error('Photo too large for Firestore:', safe.photo.length, 'bytes for disc', safe.id);
          safe.photo = undefined;
        }
        const ref = doc(discsCol, String(safe.id));
        // merge: true — safe for updates; full object written so merge prevents partial-write data loss
        safeBatchSet(batch, ref, removeUndefined(safe), { merge: true });
      });
      console.log('[sync] ✅ Discs write enqueued');
    }

    // Sync aces subcollection
    // GUARD: Only block empty overwrite when dataLoaded is false (startup state before load).
    // When dataLoaded is true, empty arrays are intentional user deletions — allow them.
    const acesList = aces ?? [];
    const currentAceSnap = await getDocs(acesCol);
    if (!dataLoaded && acesList.length === 0 && currentAceSnap.size > 0) {
      console.warn('[sync] ⚠️ Skipping aces write: data not loaded yet, incoming empty but Firestore has', currentAceSnap.size, 'aces — possible data loss prevented');
    } else {
      console.log('[sync] Writing aces to Firestore for user:', userId, 'count:', acesList.length, 'path:', `users/${userId}/aces`);
      const incomingAceIds = new Set(acesList.map(a => a.id).filter(Boolean));
      currentAceSnap.forEach(s => {
        if (!incomingAceIds.has(s.id)) safeBatchDelete(batch, s.ref);
      });
      acesList.forEach(a => {
        if (!a || !a.id) return;
        const safe = { ...a };
        if (safe.photo && typeof safe.photo === 'string' && safe.photo.length > 900000) {
          console.error('Ace photo too large for Firestore:', safe.photo.length, 'bytes for ace', safe.id);
          safe.photo = undefined;
        }
        const ref = doc(acesCol, String(safe.id));
        // merge: true — safe for updates; full object written so merge prevents partial-write data loss
        safeBatchSet(batch, ref, removeUndefined(safe), { merge: true });
      });
      console.log('[sync] ✅ Aces write enqueued');
    }

    // Root user document for bags / tournaments / longestThrows / personalBests
    // GUARD: Only block empty overwrite when dataLoaded is false. When dataLoaded is true, allow all writes (including intentional deletions).
    const userSnap = await getDoc(userRef);
    const existing = userSnap.exists() ? userSnap.data() : {};
    const payload = removeUndefined({
      updatedAt: new Date().toISOString(),
    });
    const existingBags = existing.bags;
    const existingTournaments = existing.tournaments;
    const existingLongestThrows = existing.longestThrows;
    const existingPersonalBests = existing.personalBests;
    if (bags != null) {
      if (dataLoaded || bags.length > 0 || !Array.isArray(existingBags) || existingBags.length === 0) payload.bags = bags;
    }
    if (tournaments != null) {
      if (dataLoaded || tournaments.length > 0 || !Array.isArray(existingTournaments) || existingTournaments.length === 0) payload.tournaments = tournaments;
    }
    if (longestThrows != null) {
      if (dataLoaded || longestThrows.length > 0 || !Array.isArray(existingLongestThrows) || existingLongestThrows.length === 0) payload.longestThrows = longestThrows;
    }
    if (personalBests != null) {
      if (dataLoaded || personalBests.length > 0 || !Array.isArray(existingPersonalBests) || existingPersonalBests.length === 0) payload.personalBests = personalBests;
    }
    // merge: true — only updates provided fields; existing data preserved when we skip empty overwrite
    safeBatchSet(batch, userRef, payload, { merge: true });

    await safeBatchCommit(batch);
    console.log('[sync] ✅ Discs written successfully');
    console.log('[sync] ✅ Aces written successfully');
    console.log('[sync] ✅ Tournaments/LongestThrows/PersonalBests written successfully');
    console.log('[syncAces] Firestore save SUCCESS', { userId, aceCount: aces?.length ?? 0, discCount: discs?.length ?? 0 });
    // Backup to localStorage on every successful write
    try {
      backupUserData(userId, {
        discs: discs ?? [],
        bags: bags ?? [],
        aceHistory: aces ?? [],
        tournaments: tournaments ?? [],
        longestThrows: longestThrows ?? [],
        personalBests: personalBests ?? [],
      });
    } catch (backupErr) {
      console.warn('[sync] backupUserData after write failed', backupErr);
    }
  } catch (e) {
    console.error('[sync] ❌ Firestore sync FAILED:', e);
    console.error('[sync] Error code:', e?.code);
    console.error('[sync] Error message:', e?.message);
    console.warn('Firestore sync failed', e);
    throw e;
  }
}

export async function loadFromFirestore(userId) {
  if (!userId || !db) return null;
  try {
    console.log('[load] userId used for read:', userId);
    const userRef = doc(db, 'users', userId);
    const discsCol = collection(userRef, 'discs');
    const acesCol = collection(userRef, 'aces');

    console.log('[load] Path discs:', `users/${userId}/discs`);
    console.log('[load] Path aces:', `users/${userId}/aces`);
    console.log('[load] Querying Firestore for discs and aces, user:', userId);

    const [userSnap, discsSnap, acesSnap] = await Promise.all([
      getDoc(userRef),
      getDocs(discsCol),
      getDocs(acesCol),
    ]);

    const discs = discsSnap.docs.map(d => normalizeDisc(d.data(), d.id));
    const aces = acesSnap.docs.map(a => normalizeAce(a.data(), a.id));
    console.log('[load] Found discs in Firestore:', discs.length, 'for user:', userId);
    console.log('[load] Discs data:', JSON.stringify(discs));
    if (discs.length === 0) {
      console.warn('[load] ⚠️ No discs found in Firestore for this user — collection may be empty or path may be wrong');
    }

    console.log('[load] Found aces in Firestore:', aces.length, 'for user:', userId);
    console.log('[load] Aces data:', JSON.stringify(aces));
    if (aces.length === 0) {
      console.warn('[load] ⚠️ No aces found in Firestore for this user — collection may be empty or path may be wrong');
    }

    let data;
    if (!userSnap.exists()) {
      data = {
        discs,
        bags: [],
        aceHistory: aces,
        tournaments: [],
        longestThrows: [],
        personalBests: [],
      };
    } else {
      const d = userSnap.data() || {};
      const bagsRaw = Array.isArray(d.bags) ? d.bags : [];
      const tournamentsRaw = Array.isArray(d.tournaments) ? d.tournaments : [];
      const longestThrowsRaw = Array.isArray(d.longestThrows) ? d.longestThrows : [];
      const personalBestsRaw = Array.isArray(d.personalBests) ? d.personalBests : [];
      data = {
        discs,
        bags: bagsRaw.map(normalizeBag),
        aceHistory: aces,
        tournaments: tournamentsRaw.map(t => t && typeof t === 'object' ? { id: t.id ?? '', name: t.name ?? '', date: t.date ?? '', course: t.course ?? '', division: t.division ?? '', placement: t.placement ?? '', ...t } : { id: '', name: '', date: '', course: '', division: '', placement: '' }),
        longestThrows: longestThrowsRaw.map(lt => lt && typeof lt === 'object' ? { id: lt.id ?? '', discId: lt.discId ?? '', distance: lt.distance ?? 0, ...lt } : { id: '', discId: '', distance: 0 }),
        personalBests: personalBestsRaw.map(pb => pb && typeof pb === 'object' ? { id: pb.id ?? '', category: pb.category ?? '', value: pb.value ?? '', course: pb.course ?? '', date: pb.date ?? '', ...pb } : { id: '', category: '', value: '', course: '', date: '' }),
      };
    }

    // Emergency recovery: save backup to localStorage on every successful load (login)
    backupUserData(userId, data);

    return data;
  } catch (e) { console.warn('Firestore load failed', e); return null; }
}

export async function deleteUserDataFromFirestore(userId) {
  if (!userId || !db) return;
  try {
    const userRef = doc(db, 'users', userId);

    // Delete subcollections discs and aces
    const discsCol = collection(userRef, 'discs');
    const acesCol = collection(userRef, 'aces');
    const [discsSnap, acesSnap] = await Promise.all([getDocs(discsCol), getDocs(acesCol)]);
    await Promise.all([
      ...discsSnap.docs.map((d) => safeDeleteDoc(d.ref, { backupToDeletedItems: false })),
      ...acesSnap.docs.map((a) => safeDeleteDoc(a.ref, { backupToDeletedItems: false })),
    ]);

    // Delete root user document
    await safeDeleteDoc(userRef, { backupToDeletedItems: false });
  } catch (e) {
    console.warn('Firestore delete failed', e);
    throw e;
  }
}
