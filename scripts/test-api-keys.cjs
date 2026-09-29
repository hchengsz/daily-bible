const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

// Run the actual TypeScript handlers with mocked network/storage, without Metro.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

delete process.env.DEV_PROXY_URL;
delete process.env.GEMINI_API_BASE_URL;
delete process.env.GOOGLE_TRANSLATE_BASE_URL;
process.env.GEMINI_API_KEY = 'server-gemini-placeholder';
process.env.GOOGLE_TRANSLATE_API_KEY = 'server-google-placeholder';
process.env.SUPABASE_URL = 'https://cache.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cache-placeholder';

const google = require('../app/api/translate+api.ts');
const ai = require('../app/api/ai-translate+api.ts');
const vocabulary = require('../app/api/vocabulary+api.ts');
const { getRequestApiKey } = require('../src/server/api-keys.ts');
const storage = require('../src/features/settings/api-key-storage.ts');
const store = require('../src/features/settings/api-key-store.ts');
const chunks = [{ id: 'one', text: 'In the beginning' }];
const request = (header, key) => new Request('https://app.example.test/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(header ? { [header]: key } : {}) },
  body: JSON.stringify({ chunks }),
});

test('request credentials override server keys without changing shared configuration', () => {
  assert.equal(getRequestApiKey(request('X-Gemini-Api-Key', 'personal'), 'ai'), 'personal');
  assert.equal(getRequestApiKey(request(), 'ai'), 'server-gemini-placeholder');
  assert.equal(getRequestApiKey(request('X-Gemini-Api-Key', ''), 'ai'), '');
  assert.equal(getRequestApiKey(request(), 'google'), 'server-google-placeholder');
});

for (const [name, handler, header, payload] of [
  ['Google translation', google.POST, 'X-Google-Translate-Api-Key', { data: { translations: [{ translatedText: '起初' }] } }],
  ['AI translation', ai.POST, 'X-Gemini-Api-Key', { output_text: JSON.stringify({ translations: [{ id: 'one', text: '起初' }] }) }],
  ['Vocabulary', vocabulary.POST, 'X-Gemini-Api-Key', { output_text: JSON.stringify({ results: [{ id: 'one', terms: [] }] }) }],
]) {
  test(`${name}: personal keys reach only the provider and bypass shared cache`, async t => {
    let calls = 0;
    t.mock.method(global, 'fetch', async (url, init) => {
      calls++;
      assert.ok(!String(url).includes('cache.example.test'));
      assert.ok(!String(url).includes('personal-key-placeholder'));
      assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'personal-key-placeholder');
      assert.ok(!init.body.includes('personal-key-placeholder'));
      return Response.json(payload);
    });
    const response = await handler(request(header, 'personal-key-placeholder'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!JSON.stringify(await response.json()).includes('personal-key-placeholder'));
    assert.equal(calls, 1);
  });

  test(`${name}: rejected personal keys do not retry using server credentials`, async t => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
      calls++;
      return Response.json({ error: { message: 'Invalid personal-key-placeholder' } }, { status: 403 });
    });
    const response = await handler(request(header, 'personal-key-placeholder'));
    assert.ok(!response.ok);
    assert.equal(calls, 1);
    assert.ok(!(await response.text()).includes('personal-key-placeholder'));
  });

  test(`${name}: network errors do not echo credentials`, async t => {
    t.mock.method(global, 'fetch', async () => { throw new Error('personal-key-placeholder'); });
    const response = await handler(request(header, 'personal-key-placeholder'));
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('personal-key-placeholder'));
  });
}

test('settings support independent keys, disabled shared service, failed save retry, and removal', async t => {
  process.env.EXPO_PUBLIC_AI_FEATURES_ENABLED = 'false';
  await store.loadApiKeys();
  await assert.rejects(store.getApiKeyHeaders('ai'), /首页/);
  await store.saveApiKeys({ gemini: '  personal-gemini-placeholder  ', google: '' });
  assert.deepEqual(await store.getApiKeyHeaders('ai'), { 'X-Gemini-Api-Key': 'personal-gemini-placeholder' });
  await assert.rejects(store.getApiKeyHeaders('google'), /首页/);
  await assert.rejects(store.saveApiKeys({ gemini: 'contains spaces', google: '' }), /格式/);
  const revision = store.useApiKeyStore.getState().revision;
  const failedWrite = t.mock.method(storage, 'writeApiKeys', async () => { throw new Error('disk failure'); });
  await assert.rejects(store.saveApiKeys({ gemini: '', google: 'personal-google-placeholder' }), /disk failure/);
  assert.equal(store.useApiKeyStore.getState().revision, revision);
  assert.equal(store.useApiKeyStore.getState().gemini, 'personal-gemini-placeholder');
  failedWrite.mock.restore();
  await store.saveApiKeys({ gemini: '', google: 'personal-google-placeholder' });
  assert.deepEqual(await store.getApiKeyHeaders('google'), { 'X-Google-Translate-Api-Key': 'personal-google-placeholder' });
  await store.saveApiKeys({ gemini: '', google: '' });
  assert.equal(await storage.readApiKeys(), null);
  assert.equal(store.useApiKeyStore.getState().google, '');
  process.env.EXPO_PUBLIC_AI_FEATURES_ENABLED = 'true';
  assert.deepEqual(await store.getApiKeyHeaders('google'), {});
});
