import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// This local test APK uses Expo's generated debug signing key. It is not a
// store-signing workflow and does not deploy any shared backend resource.
run(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install']);
run('./gradlew', ['app:assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '--max-workers=4'], join(root, 'android'));
mkdirSync(join(root, 'artifacts'), { recursive: true });
copyFileSync(join(root, 'android/app/build/outputs/apk/release/app-release.apk'), join(root, 'artifacts/neuroclarity-development.apk'));
console.log('Standalone ARM64 test APK: artifacts/neuroclarity-development.apk');
