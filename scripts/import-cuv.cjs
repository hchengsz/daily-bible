/* global __dirname */
// Convert the supplied read-only SQLite source into a portable offline asset.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/data/bible');
const names = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|');
const db = new DatabaseSync(path.join(root, 'bible_cuv.db'), { readOnly: true });
try {
  const books = db.prepare('SELECT SN, FullName, ChapterNumber FROM BibleID ORDER BY SN').all();
  if (books.length !== names.length) throw new Error('Expected 66 CUV books');
  const result = {};
  let count = 0;
  for (const book of books) {
    const name = names[book.SN - 1];
    if (!name) throw new Error(`Unknown book ${book.SN}`);
    const chapters = {};
    const rows = db.prepare('SELECT ChapterSN, VerseSN, Lection FROM Bible WHERE VolumeSN = ? ORDER BY ChapterSN, VerseSN').all(book.SN);
    for (const row of rows) {
      if (typeof row.Lection !== 'string') throw new Error(`Invalid verse ${name} ${row.ChapterSN}:${row.VerseSN}`);
      chapters[row.ChapterSN] ??= {};
      if (Object.hasOwn(chapters[row.ChapterSN], row.VerseSN)) throw new Error('Duplicate verse');
      chapters[row.ChapterSN][row.VerseSN] = row.Lection;
      count++;
    }
    if (Object.keys(chapters).length !== book.ChapterNumber) throw new Error(`Missing chapters: ${name}`);
    result[name] = { name: book.FullName, chapters };
  }
  fs.writeFileSync(path.join(root, 'cuv.generated.json'), JSON.stringify(result));
  console.log(`Imported ${books.length} books / ${count} verses. Source database unchanged.`);
} finally { db.close(); }
