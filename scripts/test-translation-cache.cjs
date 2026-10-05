const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { progressStorage } = require('../src/features/progress/progress-storage.ts');
const fresh = () => {
  const path = require.resolve('../src/features/reading/translation-cache.ts');
  delete require.cache[path];
  return require(path);
};

test('React Native signals without throwIfAborted support translation and cancellation', async () => {
  const cache = fresh();
  const signal = { aborted: false };
  const chunks = [{ id: 'native', text: 'Native runtime test' }];
  assert.deepEqual(await cache.translateWithLocalCache('native', chunks, async () => ({ native: '译文' }), signal), { native: '译文' });
  signal.aborted = true;
  await assert.rejects(cache.translateWithLocalCache('native', chunks, async () => { throw new Error('must not fetch'); }, signal), { name: 'AbortError' });
});

test('persistent translations survive reload, work offline, and only fetch missing source text', async () => {
  let apiCalls = 0;
  const request = async chunks => {
    apiCalls++;
    return Object.fromEntries(chunks.map(c => [c.id, `译文:${c.text}`]));
  };
  const first = [{ id: 'verse', text: 'Original passage' }];
  await fresh().translateWithLocalCache('reading-v1', first, request);
  assert.equal(apiCalls, 1);
  const offline = async () => { throw new Error('network unavailable'); };
  assert.deepEqual(await fresh().translateWithLocalCache('reading-v1', [{ id: 'new-id', text: first[0].text }], offline), { 'new-id': '译文:Original passage' });
  await fresh().translateWithLocalCache('reading-v1', [...first, { id: 'second', text: 'New passage' }], async chunks => {
    assert.deepEqual(chunks, [{ id: 'second', text: 'New passage' }]);
    return request(chunks);
  });
  await fresh().translateWithLocalCache('reading-v1', [{ id: 'verse', text: 'Changed passage' }], request);
  await fresh().translateWithLocalCache('different-language', first, request);
  assert.equal(apiCalls, 4);
});

test('invalid upstream responses and cancellation do not become saved translations', async () => {
  const cache = fresh();
  const chunks = [{ id: 'bad', text: 'Uncached text' }];
  await assert.rejects(cache.translateWithLocalCache('invalid', chunks, async () => ({})), /incomplete/);
  await assert.rejects(fresh().translateWithLocalCache('invalid', chunks, async () => { throw new Error('offline'); }), /offline/);
  const controller = new AbortController(); controller.abort();
  let called = false;
  await assert.rejects(cache.translateWithLocalCache('cancelled', chunks, async () => { called = true; return {}; }, controller.signal), { name: 'AbortError' });
  assert.equal(called, false);
});

test('save failure retains generated work and retries storage without more tokens', async t => {
  const cache = fresh();
  const chunks = [{ id: 'one', text: 'Save failure test' }];
  const failure = t.mock.method(progressStorage, 'setItem', async () => { throw new Error('disk full'); });
  assert.deepEqual(await cache.translateWithLocalCache('save-retry', chunks, async () => ({ one: '成功译文' })), { one: '成功译文' });
  assert.ok(cache.useTranslationCacheStatus.getState().warning);
  failure.mock.restore();
  const noRequest = async () => { throw new Error('should not call AI'); };
  await cache.translateWithLocalCache('save-retry', chunks, noRequest);
  assert.equal(cache.useTranslationCacheStatus.getState().warning, null);
  assert.deepEqual(await fresh().translateWithLocalCache('save-retry', chunks, noRequest), { one: '成功译文' });
});

test('unreadable storage stops before a paid request; duplicate passages share one translation', async t => {
  const cache = fresh();
  const chunks = [{ id: 'a', text: 'Duplicate test' }, { id: 'b', text: 'Duplicate test' }];
  const failure = t.mock.method(progressStorage, 'getItem', async () => { throw new Error('read error'); });
  let calls = 0;
  const request = async parts => { calls++; assert.equal(parts.length, 1); return { [parts[0].id]: '相同译文' }; };
  await assert.rejects(cache.translateWithLocalCache('dedup', chunks, request), /Could not read/);
  assert.equal(calls, 0);
  failure.mock.restore();
  assert.deepEqual(await cache.translateWithLocalCache('dedup', chunks, request), { a: '相同译文', b: '相同译文' });
  assert.equal(calls, 1);
});
