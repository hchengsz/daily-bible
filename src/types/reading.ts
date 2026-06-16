export interface ReadingDay {
  id: number;
  title: string;
  introduction: string;
  sections: ReadingSection[];
}

export interface ReadingSection {
  title: string;
  paragraphs: ReadingParagraph[];
}

export interface ReadingParagraph {
  title: string;
  references: ScriptureReference[];
}

export interface ScriptureReference {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}
