import type { LiveClassSession, RecordedLesson, StudyMaterial } from '../types';

export interface PlayableClassEntry {
  kind: 'live' | 'recorded';
  id: string;
  title: string;
  subject: string;
  instructor: string;
  spokenBody: string;
}

const ORDINAL_MAP: Record<string, number> = {
  '1': 0,
  one: 0,
  first: 0,
  '1st': 0,
  '2': 1,
  two: 1,
  second: 1,
  '2nd': 1,
  '3': 2,
  three: 2,
  third: 2,
  '3rd': 2,
  '4': 3,
  four: 3,
  fourth: 3,
  '4th': 3,
  '5': 4,
  five: 4,
  fifth: 4,
  '5th': 4,
  '6': 5,
  six: 5,
  sixth: 5,
  '6th': 5,
  '7': 6,
  seven: 6,
  seventh: 6,
  '7th': 6,
  '8': 7,
  eight: 7,
  eighth: 7,
  '8th': 7,
};

function extractOrdinalIndex(normalized: string): number | null {
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of words) {
    if (w in ORDINAL_MAP) {
      return ORDINAL_MAP[w];
    }
  }
  return null;
}

export function cleanVoiceSelectionQuery(raw: string, extraStopWords: string[]): string {
  const baseStopWords = new Set([
    'play',
    'open',
    'start',
    'select',
    'choose',
    'hear',
    'listen',
    'watch',
    'read',
    'show',
    'load',
    'the',
    'a',
    'an',
    'to',
    'of',
    'in',
    'on',
    'for',
    'please',
    'i',
    'want',
    'would',
    'like',
    'can',
    'you',
    'me',
    'tell',
    'about',
    'uploaded',
    ...extraStopWords,
  ]);

  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !baseStopWords.has(tok));

  return tokens.join(' ').trim();
}

export function buildPlayableClassCatalog(
  liveClasses: LiveClassSession[],
  recordedLessons: RecordedLesson[]
): PlayableClassEntry[] {
  const liveEntries: PlayableClassEntry[] = liveClasses.map((cls) => ({
    kind: 'live',
    id: cls.id,
    title: cls.title,
    subject: cls.subject,
    instructor: cls.teacherName,
    spokenBody: `Live class: ${cls.title}, taught by ${cls.teacherName}, subject ${cls.subject}. ${
      cls.notes || 'Live captions and screen-reader support are enabled.'
    } Today's class introduction: Welcome everyone to today's class. We will explain the core concept step by step with an example.`,
  }));

  const recordedEntries: PlayableClassEntry[] = recordedLessons.map((lesson) => ({
    kind: 'recorded',
    id: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    instructor: lesson.instructor,
    spokenBody: `${lesson.title}, by ${lesson.instructor}. Subject: ${lesson.subject}. Duration: ${lesson.duration}. ${lesson.transcript}`,
  }));

  return [...liveEntries, ...recordedEntries];
}

export function matchUploadedClass(
  rawQuery: string,
  liveClasses: LiveClassSession[],
  recordedLessons: RecordedLesson[]
): {
  matched: PlayableClassEntry | null;
  cleanedLabel: string;
  allTitles: string[];
} {
  const catalog = buildPlayableClassCatalog(liveClasses, recordedLessons);
  const allTitles = catalog.map((c) => c.title);
  const normalized = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanedLabel = cleanVoiceSelectionQuery(normalized, [
    'class',
    'classes',
    'lesson',
    'lessons',
    'session',
    'sessions',
    'recorded',
    'live',
    'online',
  ]);

  if (catalog.length === 0) {
    return { matched: null, cleanedLabel: cleanedLabel || rawQuery.trim(), allTitles };
  }

  // Ordinal match ("first", "class 2", "number 1") only when query has no conflicting subject keyword
  const ordIdx = extractOrdinalIndex(normalized);
  if (ordIdx !== null && ordIdx < catalog.length) {
    const withoutOrdinal = cleanedLabel
      .split(/\s+/)
      .filter((t) => !(t in ORDINAL_MAP) && t !== 'number')
      .join(' ')
      .trim();
    if (!withoutOrdinal) {
      return { matched: catalog[ordIdx], cleanedLabel: catalog[ordIdx].title, allTitles };
    }
  }

  if (!cleanedLabel) {
    return { matched: null, cleanedLabel: rawQuery.trim(), allTitles };
  }

  const queryTokens = cleanedLabel.split(/\s+/).filter((t) => t.length >= 2);
  let bestMatch: PlayableClassEntry | null = null;
  let bestScore = 0;

  for (const entry of catalog) {
    const haystack = `${entry.title} ${entry.subject} ${entry.instructor}`.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    const subjectLower = entry.subject.toLowerCase();

    if (titleLower === cleanedLabel || subjectLower === cleanedLabel) {
      return { matched: entry, cleanedLabel, allTitles };
    }

    let score = 0;
    if (titleLower.includes(cleanedLabel) || subjectLower.includes(cleanedLabel)) {
      score += 10 + cleanedLabel.length;
    }

    let tokenHits = 0;
    for (const tok of queryTokens) {
      if (haystack.includes(tok)) {
        tokenHits += 1;
        score += tok.length >= 4 ? 4 : 2;
      }
    }

    // Reject weak accidental overlap if user said a distinct multi-letter subject word not present
    if (queryTokens.length > 0 && tokenHits === 0) {
      score = 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return {
    matched: bestScore > 0 ? bestMatch : null,
    cleanedLabel,
    allTitles,
  };
}

export function matchUploadedMaterial(
  rawQuery: string,
  materials: StudyMaterial[]
): {
  matched: StudyMaterial | null;
  cleanedLabel: string;
  allTitles: string[];
} {
  const allTitles = materials.map((m) => m.title);
  const normalized = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanedLabel = cleanVoiceSelectionQuery(normalized, [
    'material',
    'materials',
    'note',
    'notes',
    'study',
    'file',
    'document',
  ]);

  if (materials.length === 0) {
    return { matched: null, cleanedLabel: cleanedLabel || rawQuery.trim(), allTitles };
  }

  const ordIdx = extractOrdinalIndex(normalized);
  if (ordIdx !== null && ordIdx < materials.length) {
    const withoutOrdinal = cleanedLabel
      .split(/\s+/)
      .filter((t) => !(t in ORDINAL_MAP) && t !== 'number')
      .join(' ')
      .trim();
    if (!withoutOrdinal) {
      return { matched: materials[ordIdx], cleanedLabel: materials[ordIdx].title, allTitles };
    }
  }

  if (!cleanedLabel) {
    return { matched: null, cleanedLabel: rawQuery.trim(), allTitles };
  }

  const queryTokens = cleanedLabel.split(/\s+/).filter((t) => t.length >= 2);
  let bestMatch: StudyMaterial | null = null;
  let bestScore = 0;

  for (const note of materials) {
    const haystack = `${note.title} ${note.subject} ${note.uploadedBy || ''}`.toLowerCase();
    const titleLower = note.title.toLowerCase();
    const subjectLower = note.subject.toLowerCase();

    if (titleLower === cleanedLabel || subjectLower === cleanedLabel) {
      return { matched: note, cleanedLabel, allTitles };
    }

    let score = 0;
    if (titleLower.includes(cleanedLabel) || subjectLower.includes(cleanedLabel)) {
      score += 10 + cleanedLabel.length;
    }

    let tokenHits = 0;
    for (const tok of queryTokens) {
      if (haystack.includes(tok)) {
        tokenHits += 1;
        score += tok.length >= 4 ? 4 : 2;
      }
    }

    if (queryTokens.length > 0 && tokenHits === 0) {
      score = 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = note;
    }
  }

  return {
    matched: bestScore > 0 ? bestMatch : null,
    cleanedLabel,
    allTitles,
  };
}
