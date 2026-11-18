# Architecture and backend contracts

## Boundaries

The mobile repository owns presentation, client configuration, Firebase client authentication and shared-backend adapters. The existing Next.js/Firebase repository continues to own API routes, Cloud Functions, authorization rules, workflow transitions, email and patient-file storage. Demo preview needs no backend deployment. Connected attachments reuse existing APIs; push alerts add a server-owned device registry and delivery ledger in the shared backend.

React Navigation provides a Patients stack (list/detail), Updates and Profile. `AppContext` owns identity, server verification and session-scoped records. Domain helpers are importable without React Native and have Node tests. Platform-specific services use SecureStore on native and in-memory auth on web, and system-browser/file-sharing APIs for documents.

## Existing contracts

| Operation | Contract |
| --- | --- |
| Authentication | Firebase Auth email/password in the selected existing project |
| Doctor profile | Own `users/{uid}` Firestore document, fetched from server |
| Patient registry | `GET /api/patients?search=&status=&pageSize=20&cursor=&sortField=date&sortOrder=desc` with Firebase bearer ID token; `{patients, nextCursor, hasNext}` |
| Patient detail | Own `clients/{uid}/patients/{id}` Firestore document, read from server after an authenticated `GET /api/storage-usage` current-account authorization check |
| File link | `POST /api/download-url` with `{key, downloadAs?}` and bearer token; `{presignedUrl, expiresAt}` |
| Attachment presign | `POST /api/upload-url {fileName, contentType, expectedSize}`, then owner-scoped signed S3 PUT |
| Attachment finalize | `POST /api/patients/{id}/documents {documents:[{name,size,contentType,s3Key,type,presignedUrl,presignedUrlExpiresAt}]}` |
| Push preference | `POST /api/mobile/push-tokens {token,installationId,platform,revision}`; `DELETE` with `{installationId,revision}`; exact current identity/doctor approval required |
| Profile update | Own `users/{uid}`, only `name`, `designation`, `department`, `hospitalName`, `branch`, `phoneNumber` |
| Password-reset email | Configured existing Cloud Function, `POST {email}`; generic success response avoids account enumeration |

Patient detail has no existing GET endpoint; the direct owner Firestore read follows the web application's ownership/approval rules. These rules cannot independently look up the current Auth user record, so the server authorization check runs before each detail fetch. File authorization is independently enforced by the existing download API.

Search promises name/MRN/hospital ID. `report-generation-pending` renders as In Progress; the registry uses the server's `In Progress` filter to include both processing states. Counts describe the loaded current view; the app does not infer database-wide totals from a page. Updates merges cases loaded this session and describes the latest recorded status. Native push delivery is separate from that session-only feed; there is no persistent unread inbox.

## Security behavior

- The profile email must exactly match Firebase Auth email. Only approved client accounts enter the workspace. Pending, declined, missing-profile and admin accounts have explicit blocked screens.
- Auth/token or current-account authorization failures clear the visible workspace. Requests capture a session generation; stale responses and token failures cannot update or invalidate a newer session. Foregrounding revalidates the account.
- The app does not persist patient records, document metadata, passwords or signed file URLs. Firestore uses a memory cache. Native refresh-token persistence uses encrypted SecureStore chunks with a last-written generation manifest; web preview auth is in memory. On-device auth storage is removed at sign-out.
- Ownership is checked again in the client file adapter, and the server remains authoritative. A fresh patient read and download URL are requested for each file action. Stored bearer URLs are ignored. Temporary native downloads are removed when the share/save operation returns.
- Generated reports follow the web release policy: before completion only independent MDT PDFs are exposed; completed cases expose only the exact canonical generated final report, with the existing deterministic last-generated-report fallback for legacy cases. Completion without a report does not become “report ready.” On Hold hides generated reports. Clinical source attachments remain separate.
- No server/Admin SDK, AWS credentials, service-account keys or private API keys are bundled. `app.config.js` whitelists public configuration and does not load `.env` files. Production requires an explicit build flag and HTTPS.

The native system browser may retain opened file history and the user may explicitly save a document outside the app; those are device/user actions beyond the app's temporary cache. Do not claim an offline patient vault or automatic removal of user-exported files.

## Dependencies and verification

Expo SDK-compatible native packages are pinned through the generated lockfile. Scoped overrides keep Firestore's Node gRPC dependency at `@grpc/grpc-js` 1.14.7 and Expo fingerprint's `minimatch` at 11.0.9 to address audited transitive vulnerabilities; reevaluate those overrides when upgrading the affected packages.

Pure unit tests cover report release, identity binding, profile allowlisting, owner paths, safe URLs, pagination/filter encoding, auth retry/session races and encrypted auth-storage behavior. Native and web bundles are separate checks. Connected login, real report opening/saving and profile writes require approved development credentials and should be tested with synthetic cases only. Do not run tests against production.

## Follow-up release work

1. Verify connected flows on Android and iOS using development accounts and synthetic data.
2. Confirm final package/store identifiers, privacy wording and supported device versions.
3. Add native Google sign-in and end-to-end account/session regression tests.
4. Verify push delivery and notification taps on physical Android/iOS devices after configuring native credentials and deploying the new backend.
5. Scope optional patient drafts, invitations and lightweight EPIC access separately.

## Document upload lifecycle

The UI stages selected files only in memory. Native pickers create an isolated cache copy, removed after successful attachment, removal or leaving the patient. Picker-created cache inputs are also cleaned; provider/original files are never deleted. Native FileSystem upload tasks stream exact bytes using the presigned Content-Type; web uses the selected Blob directly. The Firebase bearer token goes only to the existing backend API, never to S3. Each async step checks the session generation and cancellation state. A successful PUT retains its owner-qualified key in the staged entry so retrying an uncertain finalization remains idempotent. Same-account foreground checks preserve navigation so returning from the camera does not lose staging; identity, role or approval failures still clear/block the workspace.

## Push lifecycle and security

`expo-notifications` obtains an Expo push token, which supports Android FCM and iOS APNs through Expo's HTTPS push API. A native APNs token is not sent to Firebase Admin Messaging. Public configuration whitelists only the Expo project ID, owner and an Android registration-file path; private FCM/APNs sender credentials belong in Expo/EAS, never in `extra` or the app bundle. The installed build must include the native config plugins. Missing setup and permission denial are handled independently of other app features.

The native device stores a non-PHI installation ID and disabled preference in SecureStore. Registration/logout operations share an abortable queue. Provider registration is bounded to 15 seconds and logout cleanup to 5 seconds; the workspace locks immediately, and Auth sign-out always progresses. A persisted monotonic operation revision and server revocation tombstone prevent a late POST from overtaking a newer unregister or account change. `mobilePushDevices/{sha256(installationId)}` and `mobilePushTokenOwners/{sha256(token)}` have one global token owner, exact current-auth email binding, platform and a 30-day expiry checked by the sender. A transaction handles account rebinding and token rotation. DELETE can remove only the authenticated owner's installation; it cannot remove a device rebound to another account. Registration is rate limited, with at most 20 active and 100 retained device entries per account. The collections remain server-only under the existing default-deny Firestore rules.

`notifyClientPatientStatus` compares raw status values on `clients/{uid}/patients/{patientId}` updates, including `report-generation-pending`; unrelated edits, deletion and unknown statuses do not notify. Before delivery, the function verifies the recipient's current Auth record, exact email binding, current doctor role and approval, current patient availability and current token ownership. The generic lockscreen body omits names and clinical/status details. Data includes only the UID, patient ID, event ID and notification kind. Foreground and cold-launch responses validate current ownership before a fresh authorized patient read/navigation.

The separate `mobilePushDeliveries` ledger claims each event/device/token combination with a one-minute sending lease. Accepted Expo tickets move to receipt checking; transient failures and crashed leases are retried. `mobilePushReceipts` runs every 15 minutes with one ordered `nextCheckAt <= now` query, bounded to 100 due records, so future work cannot starve due retries. Invalid tokens are removed conditionally so a replacement account/token survives a late failure. Terminal records remove their next-check field. Retries stop after eight attempts or 24 hours. This is best-effort, at-least-once transport; a crash between provider acceptance and ledger persistence can duplicate a generic alert. `expiresAt` fields are TTL-ready, but no TTL policy is changed by this implementation.

If a device signs out offline, server unregister may fail; the app clears its account and explains the limitation. No cached patient data is shown on a stale notification tap, and server registrations expire after 30 days without refresh. Immediate suppression of background OS-delivered alerts while offline requires device notification settings.

Both foreground receipt and notification taps publish a fresh authorized patient snapshot to an already-mounted matching patient screen. Session/owner guards reject stale account responses, older in-flight detail reads are discarded, and each event is applied only once without a refetch loop. New screen mounts still perform their own current server read.
