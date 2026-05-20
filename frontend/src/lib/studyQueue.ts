import AsyncStorage from '@react-native-async-storage/async-storage';

const ARENA_QUEUE_KEY = 'study_queue:arena';
const ARENA_SEEN_KEY = 'study_queue:arena_seen';
const FLASHCARD_QUEUE_PREFIX = 'study_queue:flashcards:';
const FLASHCARD_REVIEW_QUEUE_KEY = 'study_queue:flashcard_reviews';

export type CachedArenaQuestion = {
  text: string;
  hint: string;
  options: string[];
  source: 'gemini' | 'puter' | 'local';
};

export type CachedFlashcard = {
  id: string;
  topic: string;
  front: string;
  back: string;
  explanation: string;
};

export type PendingFlashcardReview = {
  flashcardId: string;
  difficulty: 'Hard' | 'Good' | 'Easy';
  queuedAt: string;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function flashcardQueueKey(topic: string) {
  return `${FLASHCARD_QUEUE_PREFIX}${topic.toLowerCase()}`;
}

export async function loadArenaQueue(): Promise<CachedArenaQuestion[]> {
  return readJson<CachedArenaQuestion[]>(ARENA_QUEUE_KEY, []);
}

export async function saveArenaQueue(queue: CachedArenaQuestion[]): Promise<void> {
  await writeJson(ARENA_QUEUE_KEY, queue);
}

export async function loadSeenArenaQuestions(): Promise<string[]> {
  return readJson<string[]>(ARENA_SEEN_KEY, []);
}

export async function saveSeenArenaQuestions(seen: string[]): Promise<void> {
  await writeJson(ARENA_SEEN_KEY, seen);
}

export async function markArenaQuestionSeen(questionText: string, maxSize: number = 250): Promise<string[]> {
  const existing = await loadSeenArenaQuestions();
  if (existing.includes(questionText)) {
    return existing;
  }
  const updated = [...existing, questionText].slice(-maxSize);
  await saveSeenArenaQuestions(updated);
  return updated;
}

export async function mergeArenaQueue(
  incoming: CachedArenaQuestion[],
  maxSize: number = 10,
): Promise<CachedArenaQuestion[]> {
  const existing = await loadArenaQueue();
  const served = await loadSeenArenaQuestions();
  const seen = new Set([...served, ...existing.map((item) => item.text)]);
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.text)) {
      continue;
    }
    seen.add(item.text);
    merged.push(item);
    if (merged.length >= maxSize) {
      break;
    }
  }
  const trimmed = merged.slice(0, maxSize);
  await saveArenaQueue(trimmed);
  return trimmed;
}

export async function shiftArenaQueue(): Promise<{
  next: CachedArenaQuestion | null;
  remaining: CachedArenaQuestion[];
  seen: string[];
}> {
  const queue = await loadArenaQueue();
  const [next, ...remaining] = queue;
  await saveArenaQueue(remaining);
  const seen = next ? await markArenaQuestionSeen(next.text) : await loadSeenArenaQuestions();
  return {
    next: next ?? null,
    remaining,
    seen,
  };
}

export async function loadFlashcardQueue(topic: string): Promise<CachedFlashcard[]> {
  return readJson<CachedFlashcard[]>(flashcardQueueKey(topic), []);
}

export async function saveFlashcardQueue(topic: string, cards: CachedFlashcard[]): Promise<void> {
  await writeJson(flashcardQueueKey(topic), cards);
}

export async function mergeFlashcardQueue(
  topic: string,
  incoming: CachedFlashcard[],
  maxSize: number = 10,
): Promise<CachedFlashcard[]> {
  const existing = await loadFlashcardQueue(topic);
  const seen = new Set(existing.map((card) => `${card.front}::${card.back}`));
  const merged = [...existing];
  for (const card of incoming) {
    const key = `${card.front}::${card.back}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(card);
    if (merged.length >= maxSize) {
      break;
    }
  }
  const trimmed = merged.slice(0, maxSize);
  await saveFlashcardQueue(topic, trimmed);
  return trimmed;
}

export async function queueFlashcardReview(
  review: Omit<PendingFlashcardReview, 'queuedAt'>,
): Promise<void> {
  const pending = await readJson<PendingFlashcardReview[]>(FLASHCARD_REVIEW_QUEUE_KEY, []);
  pending.push({
    ...review,
    queuedAt: new Date().toISOString(),
  });
  await writeJson(FLASHCARD_REVIEW_QUEUE_KEY, pending);
}

export async function flushFlashcardReviews(
  syncReview: (review: PendingFlashcardReview) => Promise<void>,
): Promise<void> {
  const pending = await readJson<PendingFlashcardReview[]>(FLASHCARD_REVIEW_QUEUE_KEY, []);
  if (pending.length === 0) {
    return;
  }

  const remaining: PendingFlashcardReview[] = [];
  for (const review of pending) {
    try {
      await syncReview(review);
    } catch {
      remaining.push(review);
    }
  }

  await writeJson(FLASHCARD_REVIEW_QUEUE_KEY, remaining);
}
