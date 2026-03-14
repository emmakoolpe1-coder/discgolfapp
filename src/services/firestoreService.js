/**
 * =============================================================================
 * FIRESTORE SERVICE — Single Source of Truth for All Firestore Operations
 * =============================================================================
 *
 * IMPORTANT: This file is the ONLY way our app should talk to Firestore.
 *
 * - NO file should import setDoc, updateDoc, addDoc, or deleteDoc directly
 *   from 'firebase/firestore'.
 * - ALL Firestore writes MUST go through the safe wrapper functions below.
 * - Every write automatically adds a "lastUpdated" timestamp.
 *
 * =============================================================================
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.js';

// -----------------------------------------------------------------------------
// Known subcollections for backup/restore. Add new ones here as the app grows.
// -----------------------------------------------------------------------------
const USER_SUBCOLLECTIONS = ['discs', 'aces'];

// -----------------------------------------------------------------------------
// Batch operations — use these for bulk writes instead of individual safe* calls
// -----------------------------------------------------------------------------

/**
 * createBatch()
 *
 * Returns a Firestore write batch. Use with safeBatchSet, safeBatchDelete,
 * and safeBatchCommit. All batch writes go through these wrappers.
 *
 * @returns {WriteBatch}
 */
export function createBatch() {
  return writeBatch(db);
}

/**
 * safeBatchSet(batch, docRef, data, options)
 *
 * Adds a set operation to the batch. Adds lastUpdated automatically.
 * Use for creating or updating documents in a batch.
 *
 * @param {WriteBatch} batch - From createBatch()
 * @param {DocumentReference} docRef - Document reference
 * @param {object} data - Document data
 * @param {object} [options] - { merge: true } for merge behavior
 */
export function safeBatchSet(batch, docRef, data, options = {}) {
  if (!batch || !docRef || !data) {
    throw new Error('batch, docRef, and data are required for safeBatchSet');
  }
  const payload = withLastUpdated(data);
  batch.set(docRef, payload, options);
}

/**
 * safeBatchDelete(batch, docRef)
 *
 * Adds a delete operation to the batch.
 *
 * @param {WriteBatch} batch - From createBatch()
 * @param {DocumentReference} docRef - Document reference
 */
export function safeBatchDelete(batch, docRef) {
  if (!batch || !docRef) {
    throw new Error('batch and docRef are required for safeBatchDelete');
  }
  batch.delete(docRef);
}

/**
 * safeBatchCommit(batch)
 *
 * Commits the batch. Wraps in try/catch and logs errors.
 *
 * @param {WriteBatch} batch - From createBatch()
 */
export async function safeBatchCommit(batch) {
  try {
    if (!batch) throw new Error('batch is required');
    await batch.commit();
  } catch (e) {
    console.error('[firestoreService] safeBatchCommit failed:', e?.message ?? e);
    throw e;
  }
}

// -----------------------------------------------------------------------------
// Helper: Add lastUpdated to every write payload
// -----------------------------------------------------------------------------
function withLastUpdated(data) {
  return {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Helper: Check if data has empty array fields (potential data loss)
// -----------------------------------------------------------------------------
function hasEmptyArrayFields(data) {
  if (!data || typeof data !== 'object') return [];
  const emptyArrays = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length === 0) {
      emptyArrays.push(key);
    }
  }
  return emptyArrays;
}

/**
 * safeUpdateDoc(docRef, data)
 *
 * Updates an EXISTING document. Uses updateDoc (never setDoc) so we never
 * accidentally overwrite fields that aren't in the payload.
 *
 * - Validates that the data object is not empty
 * - Refuses to write if any array field (e.g. discs, bags) is empty — logs
 *   a warning instead to prevent accidental data loss
 * - Adds lastUpdated automatically
 * - Wraps in try/catch and logs errors
 *
 * @param {DocumentReference} docRef - Firestore document reference
 * @param {object} data - Fields to update (will be merged)
 * @returns {Promise<boolean>} - true if written, false if refused
 */
export async function safeUpdateDoc(docRef, data) {
  try {
    if (!docRef || !data) {
      console.warn('[firestoreService] safeUpdateDoc: docRef or data is missing');
      return false;
    }

    const keys = Object.keys(data);
    if (keys.length === 0) {
      console.warn('[firestoreService] safeUpdateDoc: data object is empty, refusing to write');
      return false;
    }

    const emptyArrays = hasEmptyArrayFields(data);
    if (emptyArrays.length > 0) {
      console.warn(
        '[firestoreService] safeUpdateDoc: refusing to write — empty array field(s) would cause data loss:',
        emptyArrays
      );
      return false;
    }

    const payload = withLastUpdated(data);
    await updateDoc(docRef, payload);
    return true;
  } catch (e) {
    console.error('[firestoreService] safeUpdateDoc failed:', e?.message ?? e);
    throw e;
  }
}

/**
 * safeCreateDoc(collectionRef, data)
 *
 * Creates a NEW document. This is the ONLY place setDoc or addDoc should be
 * used for creating documents. Use addDoc when you don't need a specific ID;
 * use setDoc when you need to specify the document ID.
 *
 * - Adds lastUpdated automatically
 * - Logs what was created
 *
 * @param {CollectionReference} collectionRef - Firestore collection reference
 * @param {object} data - Document data
 * @param {string} [docId] - Optional. If provided, uses setDoc with this ID.
 *   If omitted, uses addDoc and returns the auto-generated ID.
 * @returns {Promise<string>} - The document ID (provided or auto-generated)
 */
export async function safeCreateDoc(collectionRef, data, docId = null) {
  try {
    if (!collectionRef || !data) {
      throw new Error('collectionRef and data are required');
    }

    const payload = withLastUpdated(data);

    if (docId) {
      const docRef = doc(collectionRef, docId);
      // SAFE: Creating brand new document for the first time (e.g. user registration, backup restore).
      // setDoc without merge is correct here — we are creating, not updating.
      await setDoc(docRef, payload);
      console.log('[firestoreService] safeCreateDoc: created document with ID', docId);
      return docId;
    } else {
      const docRef = await addDoc(collectionRef, payload);
      console.log('[firestoreService] safeCreateDoc: created document with auto-generated ID', docRef.id);
      return docRef.id;
    }
  } catch (e) {
    console.error('[firestoreService] safeCreateDoc failed:', e?.message ?? e);
    throw e;
  }
}

/**
 * safeDeleteDoc(docRef, options)
 *
 * Deletes a document. Logs what was deleted and the timestamp.
 * Optionally saves a copy to a "deleted_items" subcollection before deleting.
 *
 * @param {DocumentReference} docRef - Firestore document reference
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.backupToDeletedItems=true] - Save copy to deleted_items before delete
 */
export async function safeDeleteDoc(docRef, options = {}) {
  const { backupToDeletedItems = true } = options;

  try {
    if (!docRef) {
      throw new Error('docRef is required');
    }

    const path = docRef.path;
    const timestamp = new Date().toISOString();

    if (backupToDeletedItems) {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const parentCol = docRef.parent;
        const deletedItemsCol = collection(parentCol, 'deleted_items');
        const backupId = `deleted_${Date.now()}_${path.replace(/\//g, '_')}`;
        await safeCreateDoc(deletedItemsCol, {
          ...snap.data(),
          _deletedAt: timestamp,
          _originalPath: path,
        }, backupId);
        console.log('[firestoreService] safeDeleteDoc: backed up to deleted_items before delete');
      }
    }

    await deleteDoc(docRef);
    console.log('[firestoreService] safeDeleteDoc: deleted', path, 'at', timestamp);
  } catch (e) {
    console.error('[firestoreService] safeDeleteDoc failed:', e?.message ?? e);
    throw e;
  }
}

/**
 * backupUserData(uid, data)
 *
 * Emergency recovery: Saves a copy of the user's Firestore data to localStorage
 * every time they log in. Used as a safety net if data is ever lost.
 *
 * @param {string} uid - User ID (e.g. from emailToUserId)
 * @param {object} data - Full user data: { discs, aceHistory, bags, tournaments, longestThrows, personalBests }
 */
export function backupUserData(uid, data) {
  try {
    if (!uid || !data) return;
    const backupTimestamp = new Date().toISOString();
    const backup = {
      backupTimestamp,
      discs: data.discs ?? [],
      aceHistory: data.aceHistory ?? [],
      bags: data.bags ?? [],
      tournaments: data.tournaments ?? [],
      longestThrows: data.longestThrows ?? [],
      personalBests: data.personalBests ?? [],
    };
    const key = `firestoreBackup_${uid}`;
    localStorage.setItem(key, JSON.stringify(backup));
    console.log(`Backup saved for ${uid} at ${backupTimestamp}`);
  } catch (e) {
    console.warn('[firestoreService] backupUserData failed (localStorage may be full):', e?.message ?? e);
  }
}

/**
 * restoreUserData(uid)
 *
 * Emergency recovery: Reads the localStorage backup and returns the data object.
 * Does NOT write to Firestore — for manual use only (e.g. from browser console).
 * Call this to inspect or manually restore data after data loss.
 *
 * @param {string} uid - User ID (e.g. from emailToUserId)
 * @returns {object|null} - The backup data { discs, aceHistory, bags, tournaments, longestThrows, personalBests, backupTimestamp } or null if no backup
 */
export function restoreUserData(uid) {
  try {
    if (!uid) return null;
    const key = `firestoreBackup_${uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      console.log('[restoreUserData] No backup found for', uid);
      return null;
    }
    const data = JSON.parse(raw);
    console.log('[restoreUserData] Found backup for', uid, 'from', data.backupTimestamp);
    return data;
  } catch (e) {
    console.warn('[firestoreService] restoreUserData failed:', e?.message ?? e);
    return null;
  }
}
