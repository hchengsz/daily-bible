const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};
const { progressStorage } = require('../src/features/progress/progress-storage.ts');
const faith = require('../src/features/settings/tradition-store.ts');
const { useDailyProgressStore } = require('../src/features/progress/daily-progress-store.ts');
const { confessionSections, getConfessionDayForDate } = require('../src/features/catechism/confession-data.ts');

test('first launch, persistence, switching and failed save preserve the correct choice', async t => {
  await faith.loadTradition();
  assert.equal(faith.useTraditionStore.getState().tradition, null);
  assert.equal(faith.useTraditionStore.getState().hydrated, true);
  await faith.saveTradition('catholic');
  faith.useTraditionStore.setState({ tradition: null, hydrated: false });
  await faith.loadTradition();
  assert.equal(faith.useTraditionStore.getState().tradition, 'catholic');
  const failing = t.mock.method(progressStorage, 'setItem', () => { throw new Error('disk full'); });
  await assert.rejects(faith.saveTradition('protestant'), /disk full/);
  assert.equal(faith.useTraditionStore.getState().tradition, 'catholic');
  failing.mock.restore();
  await faith.saveTradition('protestant');
  faith.useTraditionStore.setState({ tradition: null, hydrated: false });
  await faith.loadTradition();
  assert.equal(faith.useTraditionStore.getState().tradition, 'protestant');
  const readFailure = t.mock.method(progressStorage, 'getItem', () => { throw new Error('read failed'); });
  faith.useTraditionStore.setState({ hydrated: false });
  await faith.loadTradition();
  assert.equal(faith.useTraditionStore.getState().hydrated, false);
  assert.ok(faith.useTraditionStore.getState().error);
  readFailure.mock.restore();
  await faith.loadTradition();
  assert.equal(faith.useTraditionStore.getState().tradition, 'protestant');
  assert.equal(faith.useTraditionStore.getState().error, null);
});

test('Catholic and Protestant completions are independent', () => {
  const dateKey = Date.UTC(2026, 9, 3);
  useDailyProgressStore.getState().completeTask(dateKey, 'catechism');
  assert.equal(useDailyProgressStore.getState().completions[`${dateKey}:confession`], undefined);
  useDailyProgressStore.getState().completeTask(dateKey, 'confession');
  assert.equal(useDailyProgressStore.getState().completions[`${dateKey}:catechism`], true);
  assert.equal(useDailyProgressStore.getState().completions[`${dateKey}:confession`], true);
});

test('all 33 chapters and 172 sections are present and reachable in daily reading', () => {
  assert.equal(confessionSections.length, 172);
  assert.equal(new Set(confessionSections.map(s => s.reference)).size, 172);
  assert.equal(new Set(confessionSections.map(s => s.reference.split('.')[0])).size, 33);
  assert.ok(confessionSections.every(s => s.text.trim().length > 0));
  const seen = new Set();
  for (let day = 1; day <= 365; day++) seen.add(getConfessionDayForDate(new Date(2026, 0, day)).reference);
  assert.equal(seen.size, 172);
  assert.equal(getConfessionDayForDate(new Date(2028, 1, 29)).reference, getConfessionDayForDate(new Date(2028, 1, 28)).reference);
});
