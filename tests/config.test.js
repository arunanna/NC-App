import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeUrl, resolveConfig } from '../src/domain/config.js';

const connected = { environment: 'development', apiBaseUrl: 'https://dev.example.invalid/', firebase: { apiKey: 'public-key', authDomain: 'dev.example.invalid', projectId: 'sample-dev', appId: 'sample-app' } };
test('default configuration is explicitly isolated demo mode', () => { assert.equal(resolveConfig().connected, false); assert.equal(resolveConfig().environment, 'demo'); assert.equal(resolveConfig().error, null); });
test('complete development configuration enables connected mode', () => { assert.equal(resolveConfig(connected).connected, true); assert.equal(resolveConfig(connected).apiBaseUrl, 'https://dev.example.invalid'); });
test('incomplete connected configuration shows an error rather than silently selecting live or demo', () => { const config = resolveConfig({ ...connected, firebase: {} }); assert.equal(config.connected, false); assert.ok(config.error); assert.equal(config.environment, 'development'); });
test('production requires explicit build authorization and HTTPS', () => {
  assert.equal(resolveConfig({ ...connected, environment: 'production' }).connected, false);
  assert.equal(resolveConfig({ ...connected, environment: 'production', productionBuild: true }).connected, true);
  assert.equal(resolveConfig({ ...connected, environment: 'production', productionBuild: true, apiBaseUrl: 'http://localhost:3000' }).connected, false);
});
test('document URLs reject scripts, credentials and arbitrary plain HTTP', () => {
  for (const url of ['javascript:alert(1)', 'file:///private/data', 'http://untrusted.invalid', 'https://user:pass@example.invalid', 'not a URL']) assert.equal(isSafeUrl(url), false);
  assert.equal(isSafeUrl('http://localhost:3000', 'development'), true);
  assert.equal(isSafeUrl('http://localhost:3000', 'production'), false);
});
