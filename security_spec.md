# EduCare Firestore Security Specification

## 1. Data Invariants
1. **Strict PII Ownership**: Every `/users/{userId}` document and `/users/{userId}/loginLogs/{logId}` subcollection document contains PII (`email`, `name`). Only the authenticated, email-verified owner (`request.auth.uid == userId`) can read or write their own documents. No cross-user reads or blanket `isSignedIn()` reads are permitted.
2. **Master Gate Relational Sync**: A `LoginLog` under `/users/{userId}/loginLogs/{logId}` can only be created or updated if the parent `/users/{userId}` document exists.
3. **Teacher-Controlled Study Notes**: A `StudyNote` in `/studyNotes/{noteId}` can only be created by a verified user whose `/users/{uid}` document has `portalRole == 'teacher'`, and can only be deleted by the publishing teacher (`existing().teacherUid == request.auth.uid`). Published notes remain available to all verified students and teachers (`visibility == 'published'`) until deleted by the teacher.
4. **Immutable Identity & Timestamps**: `uid`, `authProvider`, and `createdAt` (on `UserProfile`), `uid`, `authProvider`, and `loggedInAt` (on `LoginLog`), and `StudyNote` records are immutable after creation. All server timestamps (`createdAt`, `lastLoginAt`, `loggedInAt`, `signedOutAt`) must strictly equal `request.time`.
5. **Terminal State Locking**: Once a `LoginLog` transitions to `status: "signed_out"`, no further updates are allowed.
6. **Strict Schema & Bounds**: Every string has explicit `.size()` bounds matching `firebase-blueprint.json`, every path ID matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars), and shadow fields are rejected via `hasOnly` / `affectedKeys().hasOnly()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/users/uid123` or `/studyNotes/note1` with `request.auth == null`.
2. **Cross-User PII Read**: Authenticated user `uidA` attempts `get` on `/users/uidB`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/users/uidA` or `/studyNotes/note1`.
4. **Identity Spoofing**: User `uidA` creates `/users/uidA` with `uid: "uidB"`, or creates `/studyNotes/note1` with `teacherUid: "uidB"`.
5. **Shadow Field Injection**: User `uidA` creates `/users/uidA` or `/studyNotes/note1` with extra ghost field `isAdmin: true`.
6. **Timestamp Forgery**: User `uidA` creates `/users/uidA` or `/studyNotes/note1` with client-forged `createdAt` != `request.time`.
7. **ID Poisoning**: User `uidA` writes `/studyNotes/<150-char-invalid-id!@#>` or `/users/uidA/loginLogs/<invalid>`.
8. **Oversized String (Denial of Wallet)**: Teacher submits a `StudyNote` with `content` > 20,000 chars or `title` > 160 chars.
9. **Student Privilege Escalation on Notes**: A student (`portalRole == 'student'`) attempts to create or delete a document in `/studyNotes/{noteId}`.
10. **Cross-Teacher Note Deletion**: Teacher `uidB` attempts to delete `/studyNotes/note1` owned by Teacher `uidA`.
11. **Terminal State Re-opening**: User `uidA` updates a `LoginLog` with `status: "signed_out"` back to `status: "active"`.
12. **Unauthorized Collection List**: User `uidA` attempts to list `/users` or `/studyNotes` without `visibility == 'published'`.
