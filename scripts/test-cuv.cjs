/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function loadTs(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const result = { exports: {} };
  const localRequire = createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: result.exports, module: result, require: (name) => overrides[name] ?? localRequire(name), console });
  return result.exports;
}
const cuv = loadTs('src/data/bible/cuv.ts');
const niv = loadTs('src/data/bible/index.ts');
const utils = loadTs('src/features/reading/reading-plan-utils.ts', {
  '../../data/bible/cuv': cuv, '../../data/bible': niv, '../../data/reading-plan': { readingPlanDays: [] },
});
const db = new DatabaseSync(path.join(root, 'src/data/bible/bible_cuv.db'), { readOnly: true });
try {
  const text = (chapter, verse) => db.prepare('SELECT Lection FROM Bible WHERE VolumeSN=1 AND ChapterSN=? AND VerseSN=?').get(chapter, verse).Lection.trim();
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '1'), text(1, 1));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '1-3'), [1, 2, 3].map((v) => text(1, v)).join(' '));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '31-2:2'), [text(1, 31), text(2, 1), text(2, 2)].join(' '));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '1b'), text(1, 1));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '1, 3'), [text(1, 1), text(1, 3)].join(' '));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '1–3'), [1, 2, 3].map((v) => text(1, v)).join(' '));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, ''), cuv.getCuvScriptureText('Genesis', 1, '1-31'));
  assert.equal(cuv.getCuvScriptureText('Psalm', 23, '1'), cuv.getCuvScriptureText('Psalms', 23, '1'));
  assert.equal(cuv.getCuvScriptureText('Genesis', 1, '3-1'), '');
  assert.equal(cuv.getCuvScriptureText('Genesis', 999, '1'), '');
  assert.match(cuv.getCuvScriptureText('Genesis', 24, '30'), /未单独列文/);
  const paragraph = { references: [{ book: 'Genesis', chapter: 1, verse: '1' }] };
  assert.equal(utils.getParagraphScripture(paragraph, 'cuv'), text(1, 1));
  assert.match(utils.getParagraphScripture(paragraph), /In the beginning/);
  assert.equal(utils.getParagraphScripture({ ...paragraph, text: 'Supplement text' }, 'cuv'), 'Supplement text');
  assert.equal(utils.getParagraphReferenceLabel(paragraph, 'cuv'), '创世记 1:1');
  assert.match(utils.getParagraphScripture({ references: [{ book: 'Tobit', chapter: 1, verse: '1' }] }, 'cuv'), /暂无对应经文/);
  const generated = require('../src/data/bible/cuv.generated.json');
  const names = Object.keys(generated);
  assert.equal(names.length, 66);
  let verified = 0;
  for (const row of db.prepare('SELECT VolumeSN,ChapterSN,VerseSN,Lection FROM Bible').all()) {
    assert.equal(generated[names[row.VolumeSN - 1]].chapters[row.ChapterSN][row.VerseSN], row.Lection);
    verified++;
  }
  console.log(`PASS: ${verified} source records preserved; CUV/NIV selection, ranges, aliases, partial verses, gaps and supplements.`);
} finally { db.close(); }
