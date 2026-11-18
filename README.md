# NeuroClarity mobile

A separate React Native / Expo doctor companion for Android and iOS, sharing the existing NeuroClarity backend. JavaScript and JSX; NC Studio and raw imaging tools are excluded.

## Run locally

```sh
npm install
npm start
```

Open the QR code with a compatible Expo Go version, or use `npm run android` / `npm run ios` with a running simulator. `npm run web` starts a browser preview. Native package identifiers are provisional (`com.neuroclarity.doctors`); confirm ownership before creating store builds.

Without local configuration, choose **Explore demo**. It contains only synthetic cases and makes no application-backend requests. A gold banner identifies demo data throughout the workspace. Demo documents explain the connected behavior instead of opening fictional files. Profile edits last only for that demo session.

## Connect the shared development backend

Copy `config/local.example.json` to `config/local.json` and fill in the **public** Firebase web-app registration values for your existing development Firebase project, the development web API origin, and the existing password-reset email Cloud Function URL. The local file is ignored by Git. Restart Expo after changing it.

`environment` must be `development` for connected testing. The Firebase project must match the environment that serves `apiBaseUrl`. Sign in with an existing approved development doctor account; this app does not create replacement accounts or a separate patient database. No administrator, AWS, service-account, or private API credentials belong in mobile configuration. The app config whitelists only public client values.

Native connected operation is the target. A browser preview hosted on a separate origin may be blocked by the existing backend's CORS policy. Demo mode is fully supported on web; this repository does not change backend CORS, rules, or deployments.

The optional password-reset URL accepts `POST { email }` and must point to the existing reset-email issuer, **not** `/api/reset-password` (which consumes an emailed token).

Production remains opt-in: `environment: "production"` additionally requires `NC_MOBILE_PRODUCTION_BUILD=1` when generating the app configuration. Production configuration and testing are outside this initial setup.

## Included

- Email/password sign-in, approval/identity gates, password-reset requests, and sign-out.
- Searchable, status-filtered, paginated doctor patient registry.
- Read-only patient summaries, clinical information, processing status and requested analyses.
- Released PDF reports and clinical-document opening/saving through fresh authorized file links.
- Patient document attachments from files, photo library or camera, with categories, size validation, upload progress and retry.
- Opt-in native push alerts for patient status changes, with authorized patient navigation on tap.
- Session-scoped case activity, and editable professional profile fields.
- Explicit sample-data preview, including pending/unreleased and completed/reportless cases.

Google/native OAuth, patient creation/sharing, raw imaging uploads and full EPIC workflows remain follow-up work. **Updates is a view of loaded case statuses, not a persistent notification inbox.**

## Checks

```sh
npm test
npm run lint
npm run export:web
npm run export:native
npm run test:e2e
```

Unit tests use Node's built-in test runner and never contact a backend. See [architecture and backend contracts](docs/architecture.md) for data access, security boundaries and remaining verification.

The Playwright smoke suite checks the synthetic doctor flow at phone and desktop sizes on localhost only. Install its browser once with `npx playwright install chromium`. It blocks external HTTP requests and never submits sign-in credentials or reset requests.

## Install a standalone Android test build

With Android Studio's SDK, Java and an ARM64 Android device available, run `npm run android:apk`. This generates the ignored Android project and an optimized, debug-signed APK at `artifacts/neuroclarity-development.apk`. It embeds the current public configuration and JavaScript, so it runs without Metro. It is a local test build; confirm app identifiers and configure a private signing key before store distribution.

Enable USB debugging on the phone, accept the computer's debugging authorization, and install with `adb -s DEVICE_SERIAL install -r artifacts/neuroclarity-development.apk`. Use the serial from `adb devices -l` so installation targets the intended device.

## Attach patient documents

Open a patient, choose **Documents**, then **Choose files**, **Take photo** or **Photo library**. Pick a category for each file and choose **Upload attachments**. The app uses the website's existing owner-authorized upload/finalize APIs; documents appear in the same patient record on both clients. Up to 10 files per upload and 50 documents per patient are supported: 25 MiB per ordinary document/image, or 500 MiB per `.pptx`. Native uploads stream from the temporary file rather than buffering large files in JavaScript. Failed finalization can be retried without re-uploading the bytes. Leaving the patient cancels unfinished local uploads and removes temporary copies. Demo actions only explain the connected flow and never open a camera, pick patient files or contact the backend.

## Enable patient status push alerts

The app uses Expo's push service for Android FCM and iOS APNs. Complete the native setup once; an updated standalone app binary is required after adding these native modules.

1. Create/link an Expo project under the intended account and put its public UUID in `config/local.json` as `expoProjectId`, plus `expoOwner` for the account/organization. The dynamic config exposes the same ID as `extra.eas.projectId`.
2. Register `com.neuroclarity.doctors` as an Android app in the same existing **development** Firebase project. Download its public `google-services.json` to `config/google-services.json`; set `androidGoogleServicesFile` to `./config/google-services.json`. This local registration file is ignored by Git. Never put service-account private keys in this app.
3. Configure that project's FCM v1 sender credentials in Expo/EAS for Android. For iOS, configure an Apple push key and the app's provisioning profile/notification entitlement in EAS. `eas.json` supplies an internal `development` build profile for credential management; it does not run a cloud build automatically.
4. Deploy the backend's authenticated `POST`/`DELETE /api/mobile/push-tokens` API and the `notifyClientPatientStatus` and `mobilePushReceipts` Cloud Functions to development **only after explicit deployment authorization**. Push setup does not change Firestore/Storage rules. Existing upload APIs already serve document attachments.
5. Rebuild/install the app and sign in with an approved development doctor. In **Profile**, choose **Enable notifications** and allow the device permission. The app reports enabled only after the device token is registered successfully with the backend. Denied permission or missing native setup leaves an actionable message and does not block attachments.

Android push requires an installed native build and a physical device, rather than Expo Go. Browser preview does not register push devices. Check delivery with a synthetic development patient's status transition and test notification taps from foreground, background and a cold launch. Device/FCM/APNs delivery is best effort; background OS restrictions can delay alerts. Lockscreen text contains no patient name, status value or clinical detail. Tapping rechecks the signed-in owner and fetches the current patient record.

Registration refreshes when the app becomes active and when its native token changes. Disabling alerts or signing out locks the workspace immediately and attempts a bounded unregister before clearing the account. If sign-out occurs offline, server unregister can fail; remaining generic alerts contain no patient details, and registration expires after 30 days without refresh. Use OS notification settings to stop device delivery immediately in that situation. Do not enable Expo's enhanced push-security access-token requirement until the backend sender is updated to provide its server-only bearer credential.
