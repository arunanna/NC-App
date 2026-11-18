# NeuroClarity mobile guide

- Canonical app source is `App.js` and `src/`. This repository uses JavaScript/JSX and Expo/React Native.
- Preserve unrelated user work. Do not read or print `.env*`, private credentials or patient data.
- Public local configuration is `config/local.json`, ignored by Git. Keep only whitelisted Firebase client configuration and public service URLs in Expo config; never add server/Admin SDK or AWS credentials.
- Shared APIs, Cloud Functions, rules and schema belong to the existing backend repository. Do not deploy or change production resources unless explicitly requested in the current task.
- Preserve current-account authorization, exact email binding, approval and ownership checks, and report release policy. Patient-data access changes require careful review.
- Keep demo cases explicitly synthetic and isolated from backend traffic. Do not test against production or mutate real patient data.
- Run checks proportionate to changes: `npm test`, `npm run lint`, `npm run export:web`, `npm run export:native`. Native connected tests need development credentials; report skips and limitations exactly.
- Keep documentation current when changing configuration, backend contracts, security or key flows. NC Studio and raw imaging are outside the mobile scope.
