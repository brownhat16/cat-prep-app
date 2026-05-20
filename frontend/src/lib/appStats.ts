import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_STATS_KEY = 'cat-master:app-stats:v1';

type SectionKey = 'VARC' | 'DILR' | 'Quants';

type SectionStats = {
  attempted: number;
  correct: number;
  timeSeconds: number;
};

export type RecentActivity = {
  id: string;
  type: 'mock' | 'arena' | 'flashcard';
  title: string;
  metric: string;
  durationLabel?: string;
  createdAt: string;
};

type StoredStats = {
  lastActiveDate: string | null;
  currentStreak: number;
  totalTests: number;
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  arenaAttempts: number;
  arenaCorrect: number;
  flashcardReviews: number;
  sectionStats: Record<SectionKey, SectionStats>;
  netScoreTrend: Array<{ value: number; label: string; createdAt: string }>;
  recentActivity: RecentActivity[];
};

export type DashboardAnalytics = {
  totalTests: number;
  currentStreak: number;
  globalAccuracy: number;
  netScoreTrend: Array<{ value: number; label: string }>;
  sectionalAccuracy: Array<{ value: number; label: string; frontColor: string }>;
  criticalAlert: string;
  recentActivity: RecentActivity[];
  arenaAttempts: number;
  flashcardReviews: number;
  currentFocus: string;
  recommendedPath: string;
};

const DEFAULT_STATS: StoredStats = {
  lastActiveDate: null,
  currentStreak: 0,
  totalTests: 0,
  totalQuestionsAttempted: 0,
  totalQuestionsCorrect: 0,
  arenaAttempts: 0,
  arenaCorrect: 0,
  flashcardReviews: 0,
  sectionStats: {
    VARC: { attempted: 0, correct: 0, timeSeconds: 0 },
    DILR: { attempted: 0, correct: 0, timeSeconds: 0 },
    Quants: { attempted: 0, correct: 0, timeSeconds: 0 },
  },
  netScoreTrend: [],
  recentActivity: [],
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function durationLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function withStreak(stats: StoredStats): StoredStats {
  const today = todayKey();
  if (stats.lastActiveDate === today) {
    return stats;
  }

  if (!stats.lastActiveDate) {
    return {
      ...stats,
      lastActiveDate: today,
      currentStreak: 1,
    };
  }

  const previous = new Date(stats.lastActiveDate);
  const current = new Date(today);
  const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000);

  return {
    ...stats,
    lastActiveDate: today,
    currentStreak: diffDays === 1 ? stats.currentStreak + 1 : 1,
  };
}

async function readStats(): Promise<StoredStats> {
  try {
    const raw = await AsyncStorage.getItem(APP_STATS_KEY);
    if (!raw) {
      return DEFAULT_STATS;
    }
    return {
      ...DEFAULT_STATS,
      ...JSON.parse(raw),
      sectionStats: {
        ...DEFAULT_STATS.sectionStats,
        ...(JSON.parse(raw).sectionStats || {}),
      },
    } as StoredStats;
  } catch {
    return DEFAULT_STATS;
  }
}

async function writeStats(stats: StoredStats) {
  await AsyncStorage.setItem(APP_STATS_KEY, JSON.stringify(stats));
}

async function mutateStats(mutator: (stats: StoredStats) => StoredStats | Promise<StoredStats>) {
  const current = await readStats();
  const updated = await mutator(withStreak(current));
  await writeStats(updated);
  return updated;
}

function pushActivity(stats: StoredStats, activity: RecentActivity): StoredStats {
  return {
    ...stats,
    recentActivity: [activity, ...stats.recentActivity].slice(0, 8),
  };
}

export async function recordArenaResult(payload: { correct: boolean; durationSeconds: number }) {
  await mutateStats((stats) => {
    const updated: StoredStats = {
      ...stats,
      arenaAttempts: stats.arenaAttempts + 1,
      arenaCorrect: stats.arenaCorrect + (payload.correct ? 1 : 0),
      totalQuestionsAttempted: stats.totalQuestionsAttempted + 1,
      totalQuestionsCorrect: stats.totalQuestionsCorrect + (payload.correct ? 1 : 0),
      sectionStats: {
        ...stats.sectionStats,
        DILR: {
          attempted: stats.sectionStats.DILR.attempted + 1,
          correct: stats.sectionStats.DILR.correct + (payload.correct ? 1 : 0),
          timeSeconds: stats.sectionStats.DILR.timeSeconds + payload.durationSeconds,
        },
      },
    };
    return pushActivity(updated, {
      id: `arena-${Date.now()}`,
      type: 'arena',
      title: 'Puzzle Arena',
      metric: payload.correct ? 'Correct' : 'Incorrect',
      durationLabel: durationLabel(payload.durationSeconds),
      createdAt: new Date().toISOString(),
    });
  });
}

export async function recordFlashcardReview(payload: { topic: string; difficulty: 'Hard' | 'Good' | 'Easy' }) {
  await mutateStats((stats) =>
    pushActivity(
      {
        ...stats,
        flashcardReviews: stats.flashcardReviews + 1,
      },
      {
        id: `flashcard-${Date.now()}`,
        type: 'flashcard',
        title: `Flashcards: ${payload.topic}`,
        metric: payload.difficulty,
        createdAt: new Date().toISOString(),
      },
    ),
  );
}

export async function recordMockExamSubmission(payload: {
  sectionBreakdown: Partial<Record<SectionKey, { attempted: number; correct: number; timeSeconds: number }>>;
  totalQuestions: number;
  totalCorrect: number;
  durationSeconds: number;
}) {
  await mutateStats((stats) => {
    const sectionStats = { ...stats.sectionStats };
    for (const section of Object.keys(payload.sectionBreakdown) as SectionKey[]) {
      const incoming = payload.sectionBreakdown[section];
      if (!incoming) continue;
      sectionStats[section] = {
        attempted: sectionStats[section].attempted + incoming.attempted,
        correct: sectionStats[section].correct + incoming.correct,
        timeSeconds: sectionStats[section].timeSeconds + incoming.timeSeconds,
      };
    }

    const accuracy = payload.totalQuestions ? Math.round((payload.totalCorrect / payload.totalQuestions) * 100) : 0;
    const updated: StoredStats = {
      ...stats,
      totalTests: stats.totalTests + 1,
      totalQuestionsAttempted: stats.totalQuestionsAttempted + payload.totalQuestions,
      totalQuestionsCorrect: stats.totalQuestionsCorrect + payload.totalCorrect,
      sectionStats,
      netScoreTrend: [
        ...stats.netScoreTrend,
        {
          value: accuracy,
          label: `T${stats.totalTests + 1}`,
          createdAt: new Date().toISOString(),
        },
      ].slice(-7),
    };

    return pushActivity(updated, {
      id: `mock-${Date.now()}`,
      type: 'mock',
      title: `Mock Test #${stats.totalTests + 1}`,
      metric: `${accuracy}% accuracy`,
      durationLabel: durationLabel(payload.durationSeconds),
      createdAt: new Date().toISOString(),
    });
  });
}

export async function loadDashboardAnalytics(): Promise<DashboardAnalytics> {
  const stats = withStreak(await readStats());
  if (stats.lastActiveDate !== (await readStats()).lastActiveDate) {
    await writeStats(stats);
  }

  const globalAccuracy = stats.totalQuestionsAttempted
    ? Math.round((stats.totalQuestionsCorrect / stats.totalQuestionsAttempted) * 100)
    : 0;

  const sectionalAccuracy = ([
    ['Quants', stats.sectionStats.Quants, '#ff7e2d'],
    ['DILR', stats.sectionStats.DILR, '#a4c9ff'],
    ['VARC', stats.sectionStats.VARC, '#ddb7ff'],
  ] as const).map(([label, section, frontColor]) => ({
    label,
    value: section.attempted ? Math.round((section.correct / section.attempted) * 100) : 0,
    frontColor,
  }));

  const weakest = [...sectionalAccuracy].sort((a, b) => a.value - b.value)[0];

  const timeAlerts = ([
    ['Quants', stats.sectionStats.Quants],
    ['DILR', stats.sectionStats.DILR],
    ['VARC', stats.sectionStats.VARC],
  ] as const)
    .map(([label, section]) => ({
      label,
      average: section.attempted ? section.timeSeconds / section.attempted : 0,
    }))
    .filter((item) => item.average > 120)
    .sort((a, b) => b.average - a.average);

  const criticalAlert = timeAlerts[0]
    ? `Average time in ${timeAlerts[0].label} is ${Math.round(timeAlerts[0].average)} seconds per question. Reduce solve time before accuracy drops.`
    : weakest.value < 60 && stats.totalQuestionsAttempted > 0
      ? `${weakest.label} is currently your weakest area. Prioritize targeted practice there before starting a new mock.`
      : 'No critical alerts right now. Keep your streak alive and maintain section balance.';

  return {
    totalTests: stats.totalTests,
    currentStreak: stats.currentStreak,
    globalAccuracy,
    netScoreTrend: stats.netScoreTrend.map(({ value, label }) => ({ value, label })),
    sectionalAccuracy,
    criticalAlert,
    recentActivity: stats.recentActivity,
    arenaAttempts: stats.arenaAttempts,
    flashcardReviews: stats.flashcardReviews,
    currentFocus: weakest.value === 0 && stats.totalQuestionsAttempted === 0 ? 'Start your first mock or arena puzzle' : `${weakest.label} improvement`,
    recommendedPath: weakest.value === 0 && stats.totalQuestionsAttempted === 0
      ? 'Begin with Puzzle Arena or Flashcards to start generating real analytics.'
      : `Focus on ${weakest.label}. Your live data shows that it needs the most attention right now.`,
  };
}
