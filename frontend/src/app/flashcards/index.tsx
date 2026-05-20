import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Menu, RefreshCcw, Hand, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, useLocalSearchParams } from 'expo-router';
import { flashcardService } from '../../api/client';
import { recordFlashcardReview } from '../../lib/appStats';

type Flashcard = {
  id: string;
  topic: string;
  front: string;
  back: string;
  explanation: string;
};

const TOPICS = ['Algebra', 'Probability', 'Geometry', 'Number Systems', 'Permutations', 'Time & Work', 'Profit & Loss', 'Averages'];
const DECK_SIZE = 10;

function deckStorageKey(topic: string) {
  return `flashcards:deck:v2:${topic.toLowerCase()}`;
}

function buildLocalFlashcards(topic: string, count: number = DECK_SIZE): Flashcard[] {
  const safeTopic = topic || 'CAT Concepts';
  return [
    {
      id: `local-${safeTopic}-1`,
      topic: safeTopic,
      front: `${safeTopic}: Core Formula`,
      back: 'Recall the primary formula, definition, or governing rule before solving.',
      explanation: `This is the fastest first-pass memory anchor for ${safeTopic}.`,
    },
    {
      id: `local-${safeTopic}-2`,
      topic: safeTopic,
      front: `${safeTopic}: Typical Trap`,
      back: 'Check constraints and assumptions before applying the first visible method.',
      explanation: `Many CAT ${safeTopic} questions are designed to punish rushed assumptions.`,
    },
    {
      id: `local-${safeTopic}-3`,
      topic: safeTopic,
      front: `${safeTopic}: Fast Strategy`,
      back: 'Use structural elimination before full computation whenever answer choices are spread apart.',
      explanation: 'This usually improves speed and reduces calculation errors.',
    },
    {
      id: `local-${safeTopic}-4`,
      topic: safeTopic,
      front: `${safeTopic}: Accuracy Check`,
      back: 'Confirm the exact quantity asked in the final line before locking the answer.',
      explanation: 'Correct solving still loses marks if you answer the wrong target.',
    },
    {
      id: `local-${safeTopic}-5`,
      topic: safeTopic,
      front: `${safeTopic}: Revision Prompt`,
      back: 'Explain the concept in one line and solve one representative question immediately after.',
      explanation: 'Active recall plus immediate use is the most reliable revision loop.',
    },
    {
      id: `local-${safeTopic}-6`,
      topic: safeTopic,
      front: `${safeTopic}: Pattern Trigger`,
      back: 'Look for symmetry, ratio, parity, sequencing, or hidden simplification before brute force.',
      explanation: 'Recurring structures often create the shortest path in CAT problems.',
    },
    {
      id: `local-${safeTopic}-7`,
      topic: safeTopic,
      front: `${safeTopic}: Estimation Move`,
      back: 'Estimate the scale of the answer before exact calculation.',
      explanation: 'This helps reject impossible options quickly.',
    },
    {
      id: `local-${safeTopic}-8`,
      topic: safeTopic,
      front: `${safeTopic}: Data Check`,
      back: 'List the values given, the variable required, and the hidden condition before solving.',
      explanation: 'This reduces avoidable setup errors.',
    },
    {
      id: `local-${safeTopic}-9`,
      topic: safeTopic,
      front: `${safeTopic}: Reverse Solve`,
      back: 'When options are far apart, test answer choices instead of deriving from scratch.',
      explanation: 'Option-driven solving is often the faster exam move.',
    },
    {
      id: `local-${safeTopic}-10`,
      topic: safeTopic,
      front: `${safeTopic}: Final Review`,
      back: 'Name the single mistake you are most likely to make on this topic.',
      explanation: 'Personal error awareness improves retention and exam accuracy.',
    },
  ].slice(0, Math.max(1, count));
}

async function readDeck(topic: string): Promise<Flashcard[]> {
  try {
    const raw = await AsyncStorage.getItem(deckStorageKey(topic));
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Flashcard[];
  } catch {
    return [];
  }
}

async function saveDeck(topic: string, deck: Flashcard[]): Promise<void> {
  await AsyncStorage.setItem(deckStorageKey(topic), JSON.stringify(deck));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function fetchFreshDeck(topic: string): Promise<Flashcard[]> {
  try {
    const data = await withTimeout(flashcardService.generateFlashcards(topic, DECK_SIZE), 6000);
    if (data?.flashcards?.length) {
      const normalized = data.flashcards
        .filter((card: Partial<Flashcard>) => typeof card.front === 'string' && typeof card.back === 'string' && typeof card.explanation === 'string')
        .map((card: Partial<Flashcard>, index: number) => ({
          id: card.id || `generated-${topic}-${Date.now()}-${index}`,
          topic: card.topic || topic,
          front: card.front as string,
          back: card.back as string,
          explanation: card.explanation as string,
        }));
      if (normalized.length > 0) {
        return normalized.slice(0, DECK_SIZE);
      }
    }
  } catch (error) {
    console.warn('Flashcard generation failed, using local fallback...', error);
  }
  return buildLocalFlashcards(topic, DECK_SIZE);
}

export default function Flashcards() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ topic?: string }>();
  const [selectedTopic, setSelectedTopic] = useState('Algebra');
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const isMountedRef = useRef(true);
  const isRefreshingRef = useRef(false);

  const currentCard = deck[currentIndex] ?? null;
  const progressPercent = deck.length ? Math.min(100, ((currentIndex + 1) / deck.length) * 100) : 0;

  const hydrateDeck = React.useCallback(async (topic: string) => {
    const cached = await readDeck(topic);
    if (cached.length > 0 && isMountedRef.current) {
      setDeck(cached);
      setCurrentIndex(0);
      setShowBack(false);
    }

    if (cached.length === 0) {
      setLoadingDeck(true);
    }

    try {
      const fresh = await fetchFreshDeck(topic);
      await saveDeck(topic, fresh);
      if (isMountedRef.current) {
        setDeck(fresh);
        setCurrentIndex(0);
        setShowBack(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingDeck(false);
      }
    }
  }, []);

  const topUpDeck = React.useCallback(async (topic: string) => {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    try {
      const fresh = await fetchFreshDeck(topic);
      const existing = await readDeck(topic);
      const seen = new Set(existing.map((card) => `${card.front}::${card.back}`));
      const merged = [...existing];
      for (const card of fresh) {
        const key = `${card.front}::${card.back}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(card);
        if (merged.length >= DECK_SIZE) {
          break;
        }
      }
      const nextDeck = merged.slice(0, DECK_SIZE);
      await saveDeck(topic, nextDeck);
      if (isMountedRef.current) {
        setDeck(nextDeck);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof params.topic === 'string' && TOPICS.includes(params.topic)) {
      setSelectedTopic(params.topic);
    }
  }, [params.topic]);

  useEffect(() => {
    isMountedRef.current = true;
    void hydrateDeck(selectedTopic);
    return () => {
      isMountedRef.current = false;
    };
  }, [hydrateDeck, selectedTopic]);

  const handleGenerateDeck = async () => {
    setLoadingDeck(true);
    try {
      const fresh = await fetchFreshDeck(selectedTopic);
      await saveDeck(selectedTopic, fresh);
      if (isMountedRef.current) {
        setDeck(fresh);
        setCurrentIndex(0);
        setShowBack(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingDeck(false);
      }
    }
  };

  const handleReview = async (difficulty: 'Hard' | 'Good' | 'Easy') => {
    if (!currentCard) {
      return;
    }

    const nextDeck = deck.filter((_, index) => index !== currentIndex);
    setDeck(nextDeck);
    setCurrentIndex(0);
    setShowBack(false);
    await saveDeck(selectedTopic, nextDeck);
    await recordFlashcardReview({ topic: currentCard.topic || selectedTopic, difficulty });

    if (nextDeck.length < 3) {
      void topUpDeck(selectedTopic);
    }
  };

  const statusLabel = useMemo(() => {
    if (loadingDeck && deck.length === 0) {
      return 'LOADING';
    }
    if (deck.length === 0) {
      return 'EMPTY';
    }
    return `${deck.length} READY`;
  }, [deck.length, loadingDeck]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="w-full bg-surface/80 border-b border-outline-variant/30 flex-row items-center justify-between px-4 h-16 z-50">
        <Link href="/" asChild>
          <Pressable className="p-2 rounded-full active:bg-primary/10">
            <Menu color="#a4c9ff" size={24} />
          </Pressable>
        </Link>
        <Text className="font-bold text-xl text-primary tracking-tighter">CAT MASTER AI</Text>
        <Link href="/analytics" asChild>
          <Pressable className="p-1 rounded-full border border-outline-variant/50 overflow-hidden">
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBWIf5Ro8Y0lxBXiXaj8mw0LsB6oHUa4GJkFzP6szk2u_jnNTNnKNAThPxMyPg2c0ty1cx_Z-20M8W3K_1RkBPVlXGCAMTf4Fo2R3fK8vRNGQv31OUVtJchRE4J250oZTB70d9qoi8HJjYz72EfpdC_0IGFVMoFT5GJmER4EAbpeS8VRKvzOVCuloWjKnJUFPPGXcJ3-V4o6s-0WiMQq3lCX0PgCoUHafVCrixTN45kjIM595WSzxBpdwaWlT8KJxocgM6qEzSJUY8' }}
              className="w-8 h-8 rounded-full"
            />
          </Pressable>
        </Link>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, alignItems: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 items-center justify-center">
              <Text className="text-primary font-semibold">{currentCard ? currentIndex + 1 : 0}</Text>
            </View>
            <Text className="text-on-surface-variant text-sm">/ {deck.length}</Text>
          </View>
          <View className="flex-1 mx-4 h-2 bg-surface-container rounded-full overflow-hidden">
            <View className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </View>
          <View className="px-2 py-1 rounded-full bg-surface-container-high border border-outline-variant">
            <Text className="text-[10px] text-on-surface-variant tracking-widest font-medium">{statusLabel}</Text>
          </View>
        </View>

        <View className="w-full max-w-md mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {TOPICS.map((topic) => (
              <Pressable
                key={topic}
                onPress={() => setSelectedTopic(topic)}
                className={`px-3 py-2 rounded-full border ${selectedTopic === topic ? 'bg-primary/20 border-primary/50' : 'border-outline-variant/50 bg-surface-container-high'}`}
              >
                <Text className={`text-xs font-medium ${selectedTopic === topic ? 'text-primary' : 'text-on-surface-variant'}`}>{topic}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={handleGenerateDeck}
            disabled={loadingDeck}
            className="mt-3 py-3 rounded-xl bg-secondary-container/30 border border-secondary/30 items-center flex-row justify-center gap-2 active:opacity-80"
          >
            {loadingDeck ? <ActivityIndicator size="small" color="#ddb7ff" /> : <Sparkles color="#ddb7ff" size={18} />}
            <Text className="text-sm font-semibold text-secondary">
              {loadingDeck ? 'Generating...' : `Generate ${selectedTopic} Flashcards`}
            </Text>
          </Pressable>
        </View>

        <View className="w-full max-w-md glass-card rounded-3xl border border-outline-variant/50 bg-surface-container-low/80 overflow-hidden mb-6">
          <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
            <View className="flex-row gap-2">
              <View className="px-2 py-1 rounded-full bg-surface-container-high border border-outline-variant">
                <Text className="text-[10px] text-on-surface-variant tracking-widest font-medium">FLASHCARD</Text>
              </View>
              <View className="px-2 py-1 rounded-full bg-secondary-container/30 border border-secondary/30">
                <Text className="text-[10px] text-secondary tracking-widest font-medium">{selectedTopic.toUpperCase()}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1 opacity-60">
              <Hand color="#c1c7d3" size={14} />
              <Text className="text-[10px] tracking-widest font-medium text-on-surface-variant">TAP TO FLIP</Text>
            </View>
          </View>

          <Pressable
            onPress={() => currentCard && setShowBack((prev) => !prev)}
            className="px-6 pb-6 min-h-[420px] justify-center"
          >
            {currentCard ? (
              !showBack ? (
                <View className="items-center justify-center">
                  <Text className="text-3xl font-bold text-primary text-center leading-tight">
                    {currentCard.front}
                  </Text>
                  <View className="mt-8 w-12 h-12 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
                    <RefreshCcw color="#a4c9ff" size={24} />
                  </View>
                </View>
              ) : (
                <View>
                  <Text className="text-lg font-semibold text-secondary mb-4">Answer</Text>
                  <Text className="text-2xl font-bold text-on-surface mb-6 leading-tight">{currentCard.back}</Text>
                  <Text className="text-xs font-medium tracking-widest text-primary mb-2">WHY IT MATTERS</Text>
                  <Text className="text-base text-on-surface-variant leading-relaxed">{currentCard.explanation}</Text>
                </View>
              )
            ) : (
              <View className="items-center justify-center flex-1">
                {loadingDeck ? (
                  <>
                    <ActivityIndicator size="large" color="#a4c9ff" />
                    <Text className="text-primary font-semibold mt-4">Loading flashcards...</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-2xl font-bold text-on-surface mb-3 text-center">No flashcards ready</Text>
                    <Text className="text-sm text-on-surface-variant text-center max-w-[260px]">
                      Generate a fresh deck for {selectedTopic} to start reviewing.
                    </Text>
                  </>
                )}
              </View>
            )}
          </Pressable>
        </View>

        <View className="w-full max-w-md gap-4">
          <Pressable
            onPress={() => currentCard && setShowBack((prev) => !prev)}
            disabled={!currentCard}
            className={`py-4 rounded-xl items-center justify-center flex-row gap-2 ${currentCard ? 'bg-primary' : 'bg-surface-container-high border border-outline-variant/40'}`}
          >
            <RefreshCcw color={currentCard ? '#ffffff' : '#8b919d'} size={18} />
            <Text className={`text-base font-semibold ${currentCard ? 'text-white' : 'text-on-surface-variant'}`}>
              {showBack ? 'Show Front' : 'Show Back'}
            </Text>
          </Pressable>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => handleReview('Hard')}
              disabled={!currentCard}
              className={`flex-1 py-4 rounded-xl items-center justify-center ${currentCard ? 'bg-error/90' : 'bg-surface-container-high border border-outline-variant/40'}`}
            >
              <Text className={`text-base font-semibold ${currentCard ? 'text-white' : 'text-on-surface-variant'}`}>Hard</Text>
            </Pressable>
            <Pressable
              onPress={() => handleReview('Good')}
              disabled={!currentCard}
              className={`flex-1 py-4 rounded-xl items-center justify-center ${currentCard ? 'bg-secondary' : 'bg-surface-container-high border border-outline-variant/40'}`}
            >
              <Text className={`text-base font-semibold ${currentCard ? 'text-white' : 'text-on-surface-variant'}`}>Good</Text>
            </Pressable>
            <Pressable
              onPress={() => handleReview('Easy')}
              disabled={!currentCard}
              className={`flex-1 py-4 rounded-xl items-center justify-center ${currentCard ? 'bg-status-answered' : 'bg-surface-container-high border border-outline-variant/40'}`}
            >
              <Text className={`text-base font-semibold ${currentCard ? 'text-white' : 'text-on-surface-variant'}`}>Easy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
