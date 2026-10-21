# Phase 0: Payload-First Security TDD Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

1. **Master Gate Relational Invariant (`/users/{userId}`)**:
   - The root document `/users/{userId}` is the Master Source of Truth for a user's workspace.
   - A `UserPrivateInfo` document at `/users/{userId}/private/{infoId}` or a `BotanicalPreset` document at `/users/{userId}/presets/{presetId}` CANNOT be read, created, updated, or deleted unless the parent `/users/{userId}` document exists and its `uid` matches `request.auth.uid` (or is created atomically in the same batch via `existsAfter`).
2. **Verified Identity Invariant**:
   - Every write operation (`create`, `update`, `delete`) across all collections requires `request.auth != null` AND `request.auth.token.email_verified == true`.
   - Every document's `uid` or `ownerId` field must equal `request.auth.uid` and match the path variable `{userId}`.
3. **PII Isolation Invariant (Split Collection Strategy)**:
   - Public profiles at `/users/{userId}` never store `email` or any other PII.
   - Verified `email` is isolated in `/users/{userId}/private/{infoId}` (`infoId == 'profile'`) and is readable/writable strictly by the verified owner (`request.auth.uid == userId`).
4. **Strict Key & Volumetric Bounds Invariant**:
   - Every string field enforces both `is string`, `.size() >= min`, `.size() <= max`, and `.matches('^[a-zA-Z0-9_\\-]+$')` for IDs.
   - `tags` in `BotanicalPreset` is strictly bounded (`tags is list && tags.size() <= 5 && (tags.size() == 0 || (tags[0] is string && tags[0].size() <= 24))`).
5. **Temporal & Immutability Invariant**:
   - `createdAt == request.time` on `create`; `createdAt == resource.data.createdAt` (immutable) and `updatedAt == request.time` on `update`.
   - `ownerId`, `uid`, and `presetId` are immutable on `update`.
6. **Terminal State Locking Invariant**:
   - Once a `BotanicalPreset` reaches `resource.data.status == 'archived'`, all subsequent `update` operations are rejected.
7. **Secure List Query Invariant**:
   - `allow list` on `/users/{userId}/presets` explicitly checks `request.auth != null && request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without any `get()` or `exists()` calls inside `list`.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Payload 01 — Unverified Email Write Spoof**:
   - Authenticated user with `email_verified: false` attempts to create `/users/user_1`.
2. **Payload 02 — Cross-Tenant Identity Spoofing**:
   - User `attacker_99` attempts to create a preset at `/users/victim_1/presets/preset_1` with `ownerId: 'victim_1'`.
3. **Payload 03 — Shadow / Ghost Field Injection on Create**:
   - Owner sends valid `BotanicalPreset` fields plus an undeclared ghost field `{"isAdmin": true}` or `{"isVerified": true}`.
4. **Payload 04 — Anti-Update-Gap Value Poisoning**:
   - Owner updates an allowed key (`title`) on `/users/user_1/presets/preset_1` with a 5,000-character string or a boolean `true`.
5. **Payload 05 — Immutable Field Mutation (`ownerId` / `createdAt` Tampering)**:
   - Owner attempts to update `ownerId` or `createdAt` on an existing preset.
6. **Payload 06 — Client-Forged Timestamp Attack**:
   - Owner attempts to create or update a preset where `updatedAt` is a past/future timestamp instead of `request.time`.
7. **Payload 07 — Path Variable ID Poisoning**:
   - Owner attempts to create a preset with a poisoned document ID containing spaces/slashes or >128 chars (`preset_bad$id!`).
8. **Payload 08 — Unbounded Array Exhaustion ("Denial of Wallet")**:
   - Owner attempts to create a preset with `tags` containing 12 items (exceeding `size() <= 5`) or non-string first element `[12345]`.
9. **Payload 09 — Terminal State Lock Bypass**:
   - Owner attempts to update `title` or `bloomPct` on a preset whose existing `status` is already `'archived'`.
10. **Payload 10 — Orphaned Subcollection Write (Missing Master Gate Parent)**:
    - Owner attempts to create `/users/user_1/presets/preset_1` when `/users/user_1` does not exist in Firestore.
11. **Payload 11 — PII Leakage Across Users**:
    - Authenticated user `user_2` attempts `get` on `/users/user_1/private/profile`.
12. **Payload 12 — Unauthorized List Query Scraping**:
    - Authenticated user `user_2` attempts `list` on `/users/user_1/presets` or queries presets where `resource.data.ownerId != request.auth.uid`.

---

## 3. Automated Test Runner Verification

The complete test suite in `src/flora/firestore.rules.test.ts` executes all 12 Dirty Dozen payloads and verifies that every single adversarial payload returns `PERMISSION_DENIED`, while valid owner operations return `ALLOWED`.
