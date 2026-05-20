import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { Menu, Lightbulb, Bot } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { aiService } from '../../api/client';

type ArenaQuestion = {
  text: string;
  hint: string;
  options: string[];
  answer: string;
  source: 'gemini' | 'puter' | 'local';
};

const NEXT_QUESTION_KEY = 'arena:next_question:v1';
const FALLBACK_INDEX_KEY = 'arena:fallback_index:v1';

const INITIAL_QUESTION: ArenaQuestion = {
  text: 'Five people (A, B, C, D, E) stand in a line. B is not at either end. C is immediately between A and E. D is immediately between B and C. If A is at the first position, what is the order?',
  hint: "If A is 1st, then C must be 2nd and E must be 3rd to satisfy 'C is between A and E'. Then D is 4th and B is 5th.",
  options: ['A, C, E, D, B', 'A, E, C, B, D', 'A, C, D, B, E', 'A, B, C, D, E'],
  answer: 'A, C, E, D, B',
  source: 'local',
};

const LOCAL_FALLBACK_QUESTIONS: ArenaQuestion[] = [
  {
    text: 'Five cars (Red, Blue, Green, Yellow, Black) are parked in a row. Blue is not at either end. Green is immediately between Red and Black. Yellow is immediately between Blue and Green. If Red is parked first, what is the order?',
    hint: 'Place Red first, satisfy the adjacency constraints, then fit Blue away from both ends.',
    options: ['Red, Green, Black, Yellow, Blue', 'Red, Black, Green, Blue, Yellow', 'Red, Green, Yellow, Blue, Black', 'Red, Blue, Green, Yellow, Black'],
    answer: 'Red, Blue, Green, Yellow, Black',
    source: 'local',
  },
  {
    text: 'Six analysts sit around a circular table. Maya sits opposite Kabir. Nia sits immediately to the left of Maya. Rohan is not adjacent to Kabir. Which arrangement is possible?',
    hint: 'Lock Maya and Kabir first, then place Nia to Maya’s left before checking where Rohan can sit.',
    options: ['Maya, Nia, Rohan, Kabir, Tara, Om', 'Maya, Tara, Nia, Kabir, Om, Rohan', 'Maya, Nia, Tara, Kabir, Rohan, Om', 'Maya, Om, Nia, Kabir, Tara, Rohan'],
    answer: 'Maya, Nia, Tara, Kabir, Rohan, Om',
    source: 'local',
  },
  {
    text: 'A set has three statements, exactly one of which is true. If P says "Q is false", Q says "R is false", and R says "P and Q are both false", who is truthful?',
    hint: 'Assume each speaker is the only truthful one and discard cases that create contradictions.',
    options: ['P only', 'Q only', 'R only', 'None of them'],
    answer: 'P only',
    source: 'local',
  },
  {
    text: 'Three pipes fill a tank in 6, 10, and 15 hours. If all three are opened together, how long will the tank take to fill?',
    hint: 'Add their per-hour work rates, then invert the combined rate.',
    options: ['3 hours', '4 hours', '5 hours', '6 hours'],
    answer: '3 hours',
    source: 'local',
  },
  {
    text: 'A trader marks a product 25% above cost price and gives a 10% discount. What is the profit percentage?',
    hint: 'Apply the discount on the marked price first, then compare the final selling price to cost price.',
    options: ['10%', '12.5%', '15%', '20%'],
    answer: '12.5%',
    source: 'local',
  },
  {
    text: 'In a class, the ratio of boys to girls is 7:5. If 24 more girls join, the ratio becomes 7:8. How many boys are there initially?',
    hint: 'Let the common multiplier be x and write both ratio equations before solving.',
    options: ['35', '42', '49', '56'],
    answer: '42',
    source: 'local',
  },
];

function normalizeBackendClone(clone: {
  question_text: string;
  options: string[];
  concept_hint: string;
  answer: string;
}): ArenaQuestion {
  return {
    text: clone.question_text,
    hint: clone.concept_hint,
    options: clone.options,
    answer: clone.answer,
    source: 'gemini',
  };
}

async function readNextQuestion(): Promise<ArenaQuestion | null> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_QUESTION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ArenaQuestion;
  } catch {
    return null;
  }
}

async function saveNextQuestion(question: ArenaQuestion | null): Promise<void> {
  if (!question) {
    await AsyncStorage.removeItem(NEXT_QUESTION_KEY);
    return;
  }
  await AsyncStorage.setItem(NEXT_QUESTION_KEY, JSON.stringify(question));
}

async function getNextLocalFallback(): Promise<ArenaQuestion> {
  let index = 0;
  try {
    const raw = await AsyncStorage.getItem(FALLBACK_INDEX_KEY);
    index = raw ? Number(raw) || 0 : 0;
  } catch {
    index = 0;
  }
  const question = LOCAL_FALLBACK_QUESTIONS[index % LOCAL_FALLBACK_QUESTIONS.length];
  await AsyncStorage.setItem(FALLBACK_INDEX_KEY, String((index + 1) % LOCAL_FALLBACK_QUESTIONS.length));
  return question;
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

async function fetchArenaQuestion(): Promise<ArenaQuestion> {
  try {
    const clone = await withTimeout(aiService.generateClone('Algebra', 'Medium'), 6000);
    if (clone?.question_text && Array.isArray(clone.options) && clone.options.length === 4 && clone.concept_hint) {
      return normalizeBackendClone(clone);
    }
  } catch (error) {
    console.warn('Arena clone request failed, using local fallback...', error);
  }
  return getNextLocalFallback();
}

export default function QuickSolve() {
  const insets = useSafeAreaInsets();
  const [showHint, setShowHint] = useState(false);
  const [loadingClone, setLoadingClone] = useState(false);
  const [aiSource, setAiSource] = useState<'gemini' | 'puter' | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ArenaQuestion>(INITIAL_QUESTION);
  const [nextQuestion, setNextQuestion] = useState<ArenaQuestion | null>(null);
  const isMountedRef = useRef(true);
  const isPrefetchingRef = useRef(false);

  const applyQuestion = (question: ArenaQuestion) => {
    setCurrentQuestion(question);
    setAiSource(question.source === 'local' ? null : question.source);
    setSelectedOption(null);
    setSubmitted(false);
    setIsCorrect(null);
    setShowHint(false);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || submitted) {
      return;
    }
    const chosen = currentQuestion.options[selectedOption];
    setSubmitted(true);
    setIsCorrect(chosen === currentQuestion.answer);
  };

  const prefetchNextQuestion = async () => {
    if (isPrefetchingRef.current) {
      return;
    }
    isPrefetchingRef.current = true;
    try {
      const fetched = await fetchArenaQuestion();
      if (!isMountedRef.current) {
        return;
      }
      setNextQuestion(fetched);
      await saveNextQuestion(fetched);
    } finally {
      isPrefetchingRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const initialize = async () => {
      const cached = await readNextQuestion();
      if (!isMountedRef.current) {
        return;
      }
      if (cached) {
        setNextQuestion(cached);
      } else {
        void prefetchNextQuestion();
      }
    };

    void initialize();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleGenerateClone = async () => {
    if (loadingClone) {
      return;
    }

    if (nextQuestion) {
      const immediate = nextQuestion;
      setNextQuestion(null);
      await saveNextQuestion(null);
      applyQuestion(immediate);
      void prefetchNextQuestion();
      return;
    }

    setLoadingClone(true);
    try {
      const fetched = await fetchArenaQuestion();
      if (!isMountedRef.current) {
        return;
      }
      applyQuestion(fetched);
      void prefetchNextQuestion();
    } finally {
      if (isMountedRef.current) {
        setLoadingClone(false);
      }
    }
  };

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
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKDfmwxGiQe-rvkkgQXfNlLAxOztmBApsXJs1KgtVInI5RodSP4bpYR-wIwbM21dDCzg-qUyH-Mooh27lbnSRBr-aQqtWtTepE9ZgmKwGr7ubeQstnFX1MA_grzU638PsOvAeVUAApfKmtW5Y45AzO2_MzEfin5cYj_ilXMBolWlEqYz9kkQE5VBLMVv8zjEwxEZyoLo7HpKhy6wNDeb6adzFPsQwz2odPZ7BgB7wbQ7EjwNSbSGfPFNZ0R0z2EgPjCGwKq1zJFDQ' }}
              className="w-8 h-8 rounded-full"
            />
          </Pressable>
        </Link>
      </View>

      <View className="flex-1 px-4 pt-6 justify-center items-center">
        <View className="w-full max-w-md glass-card rounded-3xl p-6 border border-outline-variant/50 mb-8 relative overflow-hidden">
          {loadingClone && (
            <View className="absolute inset-0 bg-surface/80 items-center justify-center z-10 rounded-3xl">
              <ActivityIndicator size="large" color="#a4c9ff" />
              <Text className="text-primary font-semibold mt-4">Generating AI Clone...</Text>
            </View>
          )}

          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-sm font-semibold tracking-widest text-primary">PUZZLE ARENA</Text>
            <View className="flex-row items-center gap-2">
              {aiSource && (
                <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
                  <Bot color="#a4c9ff" size={10} />
                  <Text className="text-[9px] font-bold tracking-wider text-primary">{aiSource === 'puter' ? 'PUTER' : 'GEMINI'}</Text>
                </View>
              )}
              <View className="px-2 py-1 rounded-full bg-surface-container border border-outline-variant/40">
                <Text className="text-[9px] font-bold tracking-wider text-on-surface-variant">
                  {nextQuestion ? 'NEXT READY' : 'PREFETCHING'}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-secondary">02:18</Text>
            </View>
          </View>

          <Text className="text-xl font-bold text-on-surface mb-6 leading-relaxed">
            {currentQuestion.text}
          </Text>

          <View className="gap-3 mb-6">
            {currentQuestion.options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  if (submitted) {
                    return;
                  }
                  setSelectedOption(i);
                }}
                className={`w-full p-4 rounded-xl border flex-row items-center gap-3 active:bg-surface-variant ${
                  submitted && opt === currentQuestion.answer
                    ? 'border-status-answered bg-status-answered/10'
                    : submitted && selectedOption === i && opt !== currentQuestion.answer
                      ? 'border-error bg-error/10'
                      : selectedOption === i
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/50'
                }`}
              >
                <View className={`w-6 h-6 rounded-full border items-center justify-center ${
                  submitted && opt === currentQuestion.answer
                    ? 'border-status-answered bg-status-answered/10'
                    : submitted && selectedOption === i && opt !== currentQuestion.answer
                      ? 'border-error bg-error/10'
                      : selectedOption === i
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant'
                }`}>
                  <Text className={`text-xs font-medium ${
                    submitted && opt === currentQuestion.answer
                      ? 'text-status-answered'
                      : submitted && selectedOption === i && opt !== currentQuestion.answer
                        ? 'text-error'
                        : selectedOption === i
                          ? 'text-primary'
                          : 'text-on-surface-variant'
                  }`}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text className="flex-1 text-base text-on-surface">{opt}</Text>
              </Pressable>
            ))}
          </View>

          {submitted && (
            <View className={`p-4 rounded-xl border mb-4 ${isCorrect ? 'bg-status-answered/10 border-status-answered/30' : 'bg-error/10 border-error/30'}`}>
              <Text className={`text-sm font-semibold mb-1 ${isCorrect ? 'text-status-answered' : 'text-error'}`}>
                {isCorrect ? 'Correct answer' : 'Incorrect answer'}
              </Text>
              <Text className="text-sm text-on-surface-variant">
                Correct option: {currentQuestion.answer}
              </Text>
            </View>
          )}

          {showHint && (
            <View className="bg-tertiary-container/10 p-4 rounded-xl border border-tertiary/20 mb-4">
              <Text className="text-sm font-semibold text-tertiary mb-1">Concept Hint:</Text>
              <Text className="text-sm text-on-surface-variant">{currentQuestion.hint}</Text>
            </View>
          )}
        </View>

        <View className="w-full max-w-md gap-4">
          <Pressable
            onPress={handleSubmitAnswer}
            disabled={selectedOption === null || submitted}
            className={`py-4 rounded-xl items-center justify-center flex-row gap-2 ${
              selectedOption === null || submitted
                ? 'bg-surface-container-high border border-outline-variant/40'
                : 'bg-primary'
            }`}
          >
            <Text className={`text-base font-semibold ${selectedOption === null || submitted ? 'text-on-surface-variant' : 'text-white'}`}>
              {submitted ? 'Answer Submitted' : 'Submit Answer'}
            </Text>
          </Pressable>

          <View className="flex-row gap-4">
          <Pressable
            onPress={() => setShowHint(!showHint)}
            className="flex-1 py-4 rounded-xl border border-tertiary/50 bg-tertiary-container/10 active:bg-tertiary-container/20 items-center justify-center flex-row gap-2"
          >
            <Lightbulb color="#ffb690" size={20} />
            <Text className="text-base font-semibold text-tertiary">Concept Hint</Text>
          </Pressable>
          <Pressable
            onPress={handleGenerateClone}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-secondary-container to-primary items-center justify-center flex-row gap-2 active:opacity-80"
          >
            <Bot color="#ffffff" size={20} />
            <Text className="text-base font-semibold text-white">{submitted ? 'Next Question' : 'Generate Clone'}</Text>
          </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
