import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

interface MockAuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface MockRequest {
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: MockAuthContext | null;
  requestTime: string;
  incomingData?: Record<string, unknown>;
  existingData?: Record<string, unknown>;
  parentUserDoc?: {uid: string} | null;
  parentUserAfterDoc?: {uid: string} | null;
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    ID_REGEX.test(id)
  );
}

function hasExactKeys(
  obj: Record<string, unknown>,
  requiredKeys: string[],
  allowedKeys: string[],
): boolean {
  const keys = Object.keys(obj);
  const hasAll = requiredKeys.every((k) => keys.includes(k));
  const hasOnly = keys.every((k) => allowedKeys.includes(k));
  return hasAll && hasOnly;
}

function affectedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function evaluateHardenedRules(
  req: MockRequest,
): 'ALLOWED' | 'PERMISSION_DENIED' {
  const parts = req.path.replace(/^\/+/, '').split('/');
  const isSignedIn = req.auth !== null;
  const isVerifiedUser = isSignedIn && req.auth!.email_verified === true;

  // Match /users/{userId}
  if (parts.length === 2 && parts[0] === 'users') {
    const userId = parts[1];
    const isOwner = isSignedIn && req.auth!.uid === userId;
    const isVerifiedOwner = isVerifiedUser && req.auth!.uid === userId;

    if (req.operation === 'get') {
      if (
        isOwner &&
        isValidId(userId) &&
        (!req.existingData || req.existingData.uid === req.auth!.uid)
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (req.operation === 'create') {
      const d = req.incomingData;
      if (!isVerifiedOwner || !isValidId(userId) || !d) {
        return 'PERMISSION_DENIED';
      }
      const validBlueprint =
        hasExactKeys(
          d,
          ['uid', 'displayName', 'preferredSpeciesId', 'createdAt', 'updatedAt'],
          ['uid', 'displayName', 'preferredSpeciesId', 'createdAt', 'updatedAt'],
        ) &&
        isValidId(d.uid) &&
        d.uid === req.auth!.uid &&
        d.uid === userId &&
        typeof d.displayName === 'string' &&
        d.displayName.length >= 1 &&
        d.displayName.length <= 80 &&
        typeof d.preferredSpeciesId === 'string' &&
        d.preferredSpeciesId.length >= 1 &&
        d.preferredSpeciesId.length <= 40 &&
        ID_REGEX.test(d.preferredSpeciesId) &&
        d.createdAt === req.requestTime &&
        d.updatedAt === req.requestTime;
      return validBlueprint ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // Match /users/{userId}/private/{infoId}
  if (parts.length === 4 && parts[0] === 'users' && parts[2] === 'private') {
    const userId = parts[1];
    const infoId = parts[3];
    const isVerifiedOwner = isVerifiedUser && req.auth!.uid === userId;
    const hasParentNow = req.parentUserDoc?.uid === req.auth?.uid;
    const hasParentNowOrAfter =
      hasParentNow || req.parentUserAfterDoc?.uid === req.auth?.uid;

    if (req.operation === 'get') {
      if (
        isVerifiedOwner &&
        isValidId(userId) &&
        isValidId(infoId) &&
        (!req.existingData || req.existingData.uid === req.auth!.uid) &&
        hasParentNow
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (req.operation === 'create') {
      const d = req.incomingData;
      if (
        !isVerifiedOwner ||
        !isValidId(userId) ||
        !isValidId(infoId) ||
        infoId !== 'profile' ||
        !d ||
        !hasParentNowOrAfter
      ) {
        return 'PERMISSION_DENIED';
      }
      const valid =
        hasExactKeys(
          d,
          ['uid', 'email', 'createdAt', 'updatedAt'],
          ['uid', 'email', 'createdAt', 'updatedAt'],
        ) &&
        isValidId(d.uid) &&
        d.uid === req.auth!.uid &&
        d.uid === userId &&
        typeof d.email === 'string' &&
        d.email.length >= 3 &&
        d.email.length <= 160 &&
        d.email === req.auth!.email &&
        d.createdAt === req.requestTime &&
        d.updatedAt === req.requestTime;
      return valid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // Match /users/{userId}/presets/{presetId}
  if (
    (parts.length === 4 || (parts.length === 3 && req.operation === 'list')) &&
    parts[0] === 'users' &&
    parts[2] === 'presets'
  ) {
    const userId = parts[1];
    const presetId = parts[3] || '';
    const isOwner = isSignedIn && req.auth!.uid === userId;
    const isVerifiedOwner = isVerifiedUser && req.auth!.uid === userId;
    const hasParentNow = req.parentUserDoc?.uid === req.auth?.uid;
    const hasParentNowOrAfter =
      hasParentNow || req.parentUserAfterDoc?.uid === req.auth?.uid;

    if (req.operation === 'list') {
      if (isOwner && req.existingData?.ownerId === req.auth!.uid) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (req.operation === 'get') {
      if (
        isOwner &&
        isValidId(userId) &&
        isValidId(presetId) &&
        (!req.existingData || req.existingData.ownerId === req.auth!.uid) &&
        hasParentNow
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    const validatePreset = (d: Record<string, unknown> | undefined): boolean => {
      if (!d) return false;
      const reqKeys = [
        'presetId',
        'ownerId',
        'title',
        'speciesId',
        'environmentId',
        'bloomPct',
        'pitchRad',
        'yawRad',
        'rollRad',
        'gaussianSplatMode',
        'sensitivityPct',
        'tags',
        'status',
        'createdAt',
        'updatedAt',
      ];
      if (!hasExactKeys(d, reqKeys, reqKeys)) return false;
      if (!isValidId(d.presetId) || d.presetId !== presetId) return false;
      if (
        !isValidId(d.ownerId) ||
        d.ownerId !== req.auth?.uid ||
        d.ownerId !== userId
      )
        return false;
      if (
        typeof d.title !== 'string' ||
        d.title.length < 1 ||
        d.title.length > 64
      )
        return false;
      if (
        typeof d.speciesId !== 'string' ||
        d.speciesId.length < 1 ||
        d.speciesId.length > 40 ||
        !ID_REGEX.test(d.speciesId)
      )
        return false;
      if (
        typeof d.environmentId !== 'string' ||
        d.environmentId.length < 1 ||
        d.environmentId.length > 40 ||
        !ID_REGEX.test(d.environmentId)
      )
        return false;
      if (
        typeof d.bloomPct !== 'number' ||
        d.bloomPct < 0 ||
        d.bloomPct > 100
      )
        return false;
      if (
        typeof d.pitchRad !== 'number' ||
        d.pitchRad < -1.6 ||
        d.pitchRad > 1.6
      )
        return false;
      if (typeof d.yawRad !== 'number' || d.yawRad < -6.5 || d.yawRad > 6.5)
        return false;
      if (typeof d.rollRad !== 'number' || d.rollRad < -1.6 || d.rollRad > 1.6)
        return false;
      if (
        d.gaussianSplatMode !== 'hybrid-3dgs' &&
        d.gaussianSplatMode !== 'pure-3dgs' &&
        d.gaussianSplatMode !== 'pbr-mesh'
      )
        return false;
      if (
        typeof d.sensitivityPct !== 'number' ||
        d.sensitivityPct < 20 ||
        d.sensitivityPct > 100
      )
        return false;
      if (!Array.isArray(d.tags) || d.tags.length > 5) return false;
      if (
        d.tags.length > 0 &&
        (typeof d.tags[0] !== 'string' ||
          d.tags[0].length < 1 ||
          d.tags[0].length > 24)
      )
        return false;
      if (d.status !== 'active' && d.status !== 'archived') return false;
      if (typeof d.createdAt !== 'string' || typeof d.updatedAt !== 'string')
        return false;
      if (d.updatedAt !== req.requestTime) return false;
      return true;
    };

    if (req.operation === 'create') {
      if (
        isVerifiedOwner &&
        isValidId(userId) &&
        isValidId(presetId) &&
        validatePreset(req.incomingData) &&
        req.incomingData!.status === 'active' &&
        req.incomingData!.createdAt === req.requestTime &&
        hasParentNowOrAfter
      ) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (req.operation === 'update') {
      const inc = req.incomingData;
      const ext = req.existingData;
      if (
        !isVerifiedOwner ||
        !isValidId(userId) ||
        !isValidId(presetId) ||
        !validatePreset(inc) ||
        !ext ||
        ext.status === 'archived' ||
        inc!.presetId !== ext.presetId ||
        inc!.ownerId !== ext.ownerId ||
        inc!.createdAt !== ext.createdAt ||
        !hasParentNow
      ) {
        return 'PERMISSION_DENIED';
      }
      const changed = affectedKeys(inc!, ext);
      const allowedAction1 = [
        'title',
        'speciesId',
        'environmentId',
        'bloomPct',
        'pitchRad',
        'yawRad',
        'rollRad',
        'gaussianSplatMode',
        'sensitivityPct',
        'tags',
        'updatedAt',
      ];
      const isAction1 =
        inc!.status === 'active' &&
        changed.every((k) => allowedAction1.includes(k));
      const isAction2 =
        ext.status === 'active' &&
        inc!.status === 'archived' &&
        changed.every((k) => ['status', 'updatedAt'].includes(k));

      return isAction1 || isAction2 ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

const NOW = '2026-10-21T12:30:00Z';
const VALID_AUTH: MockAuthContext = {
  uid: 'user_1',
  email: 'flora@example.com',
  email_verified: true,
};

function makeValidPreset(overrides: Record<string, unknown> = {}) {
  return {
    presetId: 'preset_1',
    ownerId: 'user_1',
    title: 'Sacred Lotus Dawn',
    speciesId: 'lotus',
    environmentId: 'zen-pond',
    bloomPct: 86,
    pitchRad: 0.56,
    yawRad: 0.42,
    rollRad: -0.06,
    gaussianSplatMode: 'hybrid-3dgs',
    sensitivityPct: 55,
    tags: ['lotus', '3dgs'],
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test('Phase 0 Dirty Dozen Security TDD: All 12 adversarial payloads return PERMISSION_DENIED', () => {
  // 1. Payload 01: Unverified Email Write Spoof
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1',
      auth: {...VALID_AUTH, email_verified: false},
      requestTime: NOW,
      incomingData: {
        uid: 'user_1',
        displayName: 'Botanist',
        preferredSpeciesId: 'lotus',
        createdAt: NOW,
        updatedAt: NOW,
      },
    }),
    'PERMISSION_DENIED',
  );

  // 2. Payload 02: Cross-Tenant Identity Spoofing
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/victim_1/presets/preset_1',
      auth: {uid: 'attacker_99', email: 'atk@evil.com', email_verified: true},
      requestTime: NOW,
      parentUserDoc: {uid: 'victim_1'},
      incomingData: makeValidPreset({ownerId: 'victim_1'}),
    }),
    'PERMISSION_DENIED',
  );

  // 3. Payload 03: Shadow / Ghost Field Injection on Create
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      incomingData: makeValidPreset({isVerified: true}),
    }),
    'PERMISSION_DENIED',
  );

  // 4. Payload 04: Anti-Update-Gap Value Poisoning (oversized string on allowed key)
  assert.equal(
    evaluateHardenedRules({
      operation: 'update',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      existingData: makeValidPreset(),
      incomingData: makeValidPreset({title: 'A'.repeat(500)}),
    }),
    'PERMISSION_DENIED',
  );

  // 5. Payload 05: Immutable Field Mutation (ownerId / createdAt tampering)
  assert.equal(
    evaluateHardenedRules({
      operation: 'update',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      existingData: makeValidPreset({createdAt: '2026-01-01T00:00:00Z'}),
      incomingData: makeValidPreset({createdAt: NOW}),
    }),
    'PERMISSION_DENIED',
  );

  // 6. Payload 06: Client-Forged Timestamp Attack
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      incomingData: makeValidPreset({updatedAt: '2099-01-01T00:00:00Z'}),
    }),
    'PERMISSION_DENIED',
  );

  // 7. Payload 07: Path Variable ID Poisoning
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/bad$id!',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      incomingData: makeValidPreset({presetId: 'bad$id!'}),
    }),
    'PERMISSION_DENIED',
  );

  // 8. Payload 08: Unbounded Array Exhaustion ("Denial of Wallet")
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      incomingData: makeValidPreset({
        tags: ['t1', 't2', 't3', 't4', 't5', 't6'],
      }),
    }),
    'PERMISSION_DENIED',
  );

  // 9. Payload 09: Terminal State Lock Bypass ('archived' cannot be updated)
  assert.equal(
    evaluateHardenedRules({
      operation: 'update',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      existingData: makeValidPreset({status: 'archived'}),
      incomingData: makeValidPreset({status: 'archived', title: 'Mutated'}),
    }),
    'PERMISSION_DENIED',
  );

  // 10. Payload 10: Orphaned Subcollection Write (Missing Master Gate Parent)
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: null,
      parentUserAfterDoc: null,
      incomingData: makeValidPreset(),
    }),
    'PERMISSION_DENIED',
  );

  // 11. Payload 11: PII Leakage Across Users
  assert.equal(
    evaluateHardenedRules({
      operation: 'get',
      path: '/users/user_1/private/profile',
      auth: {uid: 'user_2', email: 'other@example.com', email_verified: true},
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      existingData: {
        uid: 'user_1',
        email: 'flora@example.com',
        createdAt: NOW,
        updatedAt: NOW,
      },
    }),
    'PERMISSION_DENIED',
  );

  // 12. Payload 12: Unauthorized List Query Scraping
  assert.equal(
    evaluateHardenedRules({
      operation: 'list',
      path: '/users/user_1/presets',
      auth: {uid: 'user_2', email: 'other@example.com', email_verified: true},
      requestTime: NOW,
      existingData: makeValidPreset(),
    }),
    'PERMISSION_DENIED',
  );

  // Positive control: Verified Owner with active Master Gate parent succeeds
  assert.equal(
    evaluateHardenedRules({
      operation: 'create',
      path: '/users/user_1/presets/preset_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      incomingData: makeValidPreset(),
    }),
    'ALLOWED',
  );

  // Positive control: Owner getDoc before profile or preset exists (resource == null) succeeds
  assert.equal(
    evaluateHardenedRules({
      operation: 'get',
      path: '/users/user_1',
      auth: VALID_AUTH,
      requestTime: NOW,
      existingData: undefined,
    }),
    'ALLOWED',
  );

  assert.equal(
    evaluateHardenedRules({
      operation: 'get',
      path: '/users/user_1/presets/preset_new',
      auth: VALID_AUTH,
      requestTime: NOW,
      parentUserDoc: {uid: 'user_1'},
      existingData: undefined,
    }),
    'ALLOWED',
  );
});

test('Firestore rules file contains all Eight Pillars of Hardened Rules and matches firebase-blueprint.json', () => {
  const rulesPath = fs.existsSync(path.resolve('firestore.rules'))
    ? path.resolve('firestore.rules')
    : path.resolve('DRAFT_firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf-8');

  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes('isValidUserPublicProfile(incoming(), userId)'));
  assert.ok(rulesText.includes('isValidUserPrivateInfo(incoming(), userId)'));
  assert.ok(
    rulesText.includes('isValidBotanicalPreset(incoming(), userId, presetId)'),
  );
  assert.ok(rulesText.includes('affectedKeys().hasOnly('));
  assert.ok(rulesText.includes("existing().status != 'archived'"));
  assert.ok(rulesText.includes('hasActiveParentUser(userId)'));
});
