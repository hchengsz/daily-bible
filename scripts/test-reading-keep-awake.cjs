const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function mount(playing, foreground = 'active') {
  const effects = [];
  const released = [];
  const activated = [];
  let finishActivation;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/features/reading/use-reading-keep-awake.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: name => ({
      react: {
        useEffect: effect => effects.push(effect),
        useId: () => 'test',
        useRef: value => ({ current: value }),
        useState: value => [value, () => {}],
      },
      'react-native': { AppState: { currentState: foreground, addEventListener: () => ({ remove() {} }) } },
      'expo-keep-awake': {
        activateKeepAwakeAsync: tag => {
          activated.push(tag);
          return new Promise(resolve => { finishActivation = resolve; });
        },
        deactivateKeepAwake: async tag => { released.push(tag); },
      },
    })[name],
  });
  exports.useReadingKeepAwake(playing);
  const cleanups = effects.map(effect => effect());
  return { activated, released, finish: () => finishActivation?.(), cleanup: () => cleanups.forEach(fn => fn?.()) };
}

test('playing holds a wake lock and cleanup releases even a late activation', async () => {
  const view = mount(true);
  assert.equal(view.activated.length, 1);
  view.cleanup();
  assert.deepEqual(view.released, view.activated);
  view.finish();
  await Promise.resolve();
  assert.equal(view.released.length, 2);
  assert.equal(view.released[1], view.activated[0]);
});

test('paused, stopped and background playback do not prevent automatic sleep', () => {
  for (const [playing, state] of [[false, 'active'], [true, 'background'], [true, 'inactive']]) {
    const view = mount(playing, state);
    assert.equal(view.activated.length, 0);
    view.cleanup();
    assert.equal(view.released.length, 0);
  }
});
