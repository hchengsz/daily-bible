export interface BibleVerse {
  verse: string;
  text: string;
}

export interface BibleChapter {
  chapter: string;
  verses: BibleVerse[];
}

export interface BibleBook {
  book: string;
  count: number;
  chapters: BibleChapter[];
}
