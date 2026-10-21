import {initializeApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {clamp, type GaussianSplatMode} from './gestureMath';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on boot
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// Blueprint validation constants synced verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_SPECIES_ID_LENGTH = 40;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 160;
export const MAX_PRESET_TITLE_LENGTH = 64;
export const MAX_TAGS_COUNT = 5;
export const MAX_TAG_LENGTH = 24;

export interface SavedBotanicalPreset {
  presetId: string;
  ownerId: string;
  title: string;
  speciesId: string;
  environmentId: string;
  bloomPct: number;
  pitchRad: number;
  yawRad: number;
  rollRad: number;
  gaussianSplatMode: GaussianSplatMode;
  sensitivityPct: number;
  tags: string[];
  status: 'active' | 'archived';
}

export function sanitizeId(raw: string, maxLen = MAX_ID_LENGTH): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'default_id';
}

export function sanitizeText(raw: string, maxLen: number, fallback: string): string {
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function ensureUserProfileBootstrapped(
  user: User,
  preferredSpeciesId = 'lotus',
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = sanitizeId(user.uid, MAX_ID_LENGTH);
  if (!BLUEPRINT_ID_PATTERN.test(uid)) return;

  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/profile`;
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'profile');

  try {
    const existingSnap = await getDoc(userRef);
    const displayName = sanitizeText(
      user.displayName || user.email?.split('@')[0] || 'FLORA Botanist',
      MAX_DISPLAY_NAME_LENGTH,
      'FLORA Botanist',
    );
    const cleanSpeciesId = sanitizeId(preferredSpeciesId, MAX_SPECIES_ID_LENGTH);

    if (!existingSnap.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid,
        displayName,
        preferredSpeciesId: cleanSpeciesId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (user.email && user.email.length >= 3) {
        batch.set(privateRef, {
          uid,
          email: user.email.slice(0, MAX_EMAIL_LENGTH),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } else {
      await updateDoc(userRef, {
        displayName,
        preferredSpeciesId: cleanSpeciesId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} | ${privatePath}`);
  }
}

export async function signInWithGooglePopup(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    await ensureUserProfileBootstrapped(result.user);
  }
  return result.user;
}

export async function signOutFromFlora(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

export function subscribeToUserPresets(
  user: User,
  onUpdate: (presets: SavedBotanicalPreset[]) => void,
): Unsubscribe {
  const uid = sanitizeId(user.uid, MAX_ID_LENGTH);
  const presetsPath = `users/${uid}/presets`;
  const q = query(
    collection(db, 'users', uid, 'presets'),
    where('ownerId', '==', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedBotanicalPreset[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status === 'active') {
          list.push({
            presetId: String(d.presetId || docSnap.id),
            ownerId: String(d.ownerId || uid),
            title: String(d.title || 'Saved Flora'),
            speciesId: String(d.speciesId || 'lotus'),
            environmentId: String(d.environmentId || 'zen-pond'),
            bloomPct: Number(d.bloomPct ?? 78),
            pitchRad: Number(d.pitchRad ?? 0.56),
            yawRad: Number(d.yawRad ?? 0),
            rollRad: Number(d.rollRad ?? 0),
            gaussianSplatMode:
              d.gaussianSplatMode === 'pure-3dgs' ||
              d.gaussianSplatMode === 'pbr-mesh'
                ? d.gaussianSplatMode
                : 'hybrid-3dgs',
            sensitivityPct: Number(d.sensitivityPct ?? 55),
            tags: Array.isArray(d.tags)
              ? d.tags.slice(0, MAX_TAGS_COUNT).map(String)
              : [],
            status: 'active',
          });
        }
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, presetsPath);
    },
  );
}

export async function saveBotanicalPresetToCloud(
  user: User,
  input: {
    presetId?: string;
    title: string;
    speciesId: string;
    environmentId: string;
    bloomPct: number;
    pitchRad: number;
    yawRad: number;
    rollRad: number;
    gaussianSplatMode: GaussianSplatMode;
    sensitivityPct: number;
    tags?: string[];
  },
): Promise<string> {
  const uid = sanitizeId(user.uid, MAX_ID_LENGTH);
  await ensureUserProfileBootstrapped(user, input.speciesId);

  const presetId = sanitizeId(
    input.presetId || `preset_${Date.now()}`,
    MAX_ID_LENGTH,
  );
  const docPath = `users/${uid}/presets/${presetId}`;
  const presetRef = doc(db, 'users', uid, 'presets', presetId);

  const cleanTitle = sanitizeText(
    input.title,
    MAX_PRESET_TITLE_LENGTH,
    '云端花姿预设',
  );
  const cleanSpeciesId = sanitizeId(input.speciesId, MAX_SPECIES_ID_LENGTH);
  const cleanEnvId = sanitizeId(input.environmentId, MAX_SPECIES_ID_LENGTH);
  const cleanBloom = Math.round(clamp(input.bloomPct, 0, 100));
  const cleanPitch = Number(clamp(input.pitchRad, -1.6, 1.6).toFixed(4));
  const cleanYaw = Number(clamp(input.yawRad, -6.5, 6.5).toFixed(4));
  const cleanRoll = Number(clamp(input.rollRad, -1.6, 1.6).toFixed(4));
  const cleanMode: GaussianSplatMode =
    input.gaussianSplatMode === 'pure-3dgs' ||
    input.gaussianSplatMode === 'pbr-mesh'
      ? input.gaussianSplatMode
      : 'hybrid-3dgs';
  const cleanSens = Math.round(clamp(input.sensitivityPct, 20, 100));
  const cleanTags = (input.tags || [cleanSpeciesId, cleanMode])
    .slice(0, MAX_TAGS_COUNT)
    .map((t) => sanitizeText(String(t), MAX_TAG_LENGTH, 'flora'));

  try {
    const existing = await getDoc(presetRef);
    if (!existing.exists()) {
      await setDoc(presetRef, {
        presetId,
        ownerId: uid,
        title: cleanTitle,
        speciesId: cleanSpeciesId,
        environmentId: cleanEnvId,
        bloomPct: cleanBloom,
        pitchRad: cleanPitch,
        yawRad: cleanYaw,
        rollRad: cleanRoll,
        gaussianSplatMode: cleanMode,
        sensitivityPct: cleanSens,
        tags: cleanTags,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(presetRef, {
        title: cleanTitle,
        speciesId: cleanSpeciesId,
        environmentId: cleanEnvId,
        bloomPct: cleanBloom,
        pitchRad: cleanPitch,
        yawRad: cleanYaw,
        rollRad: cleanRoll,
        gaussianSplatMode: cleanMode,
        sensitivityPct: cleanSens,
        tags: cleanTags,
        updatedAt: serverTimestamp(),
      });
    }
    return presetId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function archiveBotanicalPresetInCloud(
  user: User,
  presetId: string,
): Promise<void> {
  const uid = sanitizeId(user.uid, MAX_ID_LENGTH);
  const cleanPresetId = sanitizeId(presetId, MAX_ID_LENGTH);
  const docPath = `users/${uid}/presets/${cleanPresetId}`;
  const presetRef = doc(db, 'users', uid, 'presets', cleanPresetId);

  try {
    await updateDoc(presetRef, {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}
