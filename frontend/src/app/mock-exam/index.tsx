import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Menu, Timer, BookmarkPlus, Grid as GridIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { recordMockExamSubmission } from '../../lib/appStats';

type Section = 'VARC' | 'DILR' | 'Quants';

type MockQuestion = {
  id: string;
  section: Section;
  difficulty: 'Easy' | 'Medium' | 'High';
  prompt: string;
  passage?: string;
  options: { id: number; letter: string; text: string }[];
  correctOption: number;
};

const MOCK_DURATION_SECONDS = 40 * 60;

const QUESTIONS: MockQuestion[] = [
  {
    id: 'varc-1',
    section: 'VARC',
    difficulty: 'High',
    passage:
      "The advent of artificial intelligence in educational assessment paradigms presents both unprecedented opportunities and profound epistemological challenges. While algorithmic evaluation promises scalability and supposedly objective metrics, it fundamentally relies on historical datasets that are inherently imbued with human biases. Consequently, the notion of 'fairness' in AI-driven testing is not merely a technical hurdle but a deeply philosophical one. Furthermore, the opaque nature of complex neural networks means that the rationale behind specific evaluations often remains inaccessible to both educators and examinees.",
    prompt:
      "Based on the passage, the author's primary concern regarding the use of complex neural networks in assessment is that they:",
    options: [
      { id: 0, letter: 'A', text: 'perpetuate historical biases present in their training datasets.' },
      { id: 1, letter: 'B', text: 'obscure the evaluative process, thereby hindering educational feedback.' },
      { id: 2, letter: 'C', text: 'transform assessments entirely into technical hurdles rather than philosophical ones.' },
      { id: 3, letter: 'D', text: 'fail to provide scalable metrics compared to traditional evaluation methods.' },
    ],
    correctOption: 1,
  },
  {
    id: 'dilr-1',
    section: 'DILR',
    difficulty: 'Medium',
    prompt:
      'Five project teams P, Q, R, S, and T present on different days from Monday to Friday. Q is after P, T is before S, and R is not on Monday or Friday. If P is on Monday, which one of the following must be true?',
    options: [
      { id: 0, letter: 'A', text: 'Q is on Tuesday' },
      { id: 1, letter: 'B', text: 'R is on Wednesday or Thursday' },
      { id: 2, letter: 'C', text: 'T is on Tuesday' },
      { id: 3, letter: 'D', text: 'S is on Friday' },
    ],
    correctOption: 1,
  },
  {
    id: 'quants-1',
    section: 'Quants',
    difficulty: 'Medium',
    prompt:
      'A shopkeeper mixes two varieties of rice costing Rs. 40/kg and Rs. 55/kg in the ratio 3:2. At what price per kg should the mixture be sold to earn a profit of 20%?',
    options: [
      { id: 0, letter: 'A', text: 'Rs. 57.60' },
      { id: 1, letter: 'B', text: 'Rs. 58.80' },
      { id: 2, letter: 'C', text: 'Rs. 60.00' },
      { id: 3, letter: 'D', text: 'Rs. 61.20' },
    ],
    correctOption: 1,
  },
  {
    id: 'varc-2',
    section: 'VARC',
    difficulty: 'Medium',
    prompt:
      'Choose the option that best captures the meaning of the sentence: "The committee’s objections were not so much principled as procedural."',
    options: [
      { id: 0, letter: 'A', text: 'The committee opposed the proposal because it violated ethical values.' },
      { id: 1, letter: 'B', text: 'The committee objected mainly to how the proposal was handled.' },
      { id: 2, letter: 'C', text: 'The committee did not object to the proposal at all.' },
      { id: 3, letter: 'D', text: 'The committee objected because the proposal lacked ambition.' },
    ],
    correctOption: 1,
  },
  {
    id: 'dilr-2',
    section: 'DILR',
    difficulty: 'High',
    prompt:
      'Three statements are given: (1) Exactly one of A or B is true. (2) If C is true, B is false. (3) A and C cannot both be false. If B is false, which statement must be true?',
    options: [
      { id: 0, letter: 'A', text: 'A is false' },
      { id: 1, letter: 'B', text: 'C is false' },
      { id: 2, letter: 'C', text: 'A is true' },
      { id: 3, letter: 'D', text: 'Both A and C are true' },
    ],
    correctOption: 2,
  },
  {
    id: 'quants-2',
    section: 'Quants',
    difficulty: 'High',
    prompt:
      'The average of 8 numbers is 24. If one number is excluded, the average becomes 22. What is the excluded number?',
    options: [
      { id: 0, letter: 'A', text: '30' },
      { id: 1, letter: 'B', text: '34' },
      { id: 2, letter: 'C', text: '38' },
      { id: 3, letter: 'D', text: '40' },
    ],
    correctOption: 3,
  },
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function MockExam() {
  const insets = useSafeAreaInsets();
  const [showGrid, setShowGrid] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markedQuestions, setMarkedQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({ [QUESTIONS[0].id]: true });
  const [timeLeft, setTimeLeft] = useState(MOCK_DURATION_SECONDS);
  const examStartedAtRef = useRef(Date.now());

  const currentQuestion = QUESTIONS[currentIndex];
  const selectedOption = answers[currentQuestion.id] ?? null;

  useEffect(() => {
    examStartedAtRef.current = Date.now();
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const goToIndex = (index: number) => {
    const question = QUESTIONS[index];
    setCurrentIndex(index);
    setVisited((prev) => ({ ...prev, [question.id]: true }));
    setShowGrid(false);
  };

  const handleSaveAndNext = () => {
    if (currentIndex >= QUESTIONS.length - 1) {
      return;
    }
    goToIndex(currentIndex + 1);
  };

  const toggleReview = () => {
    const number = currentIndex + 1;
    setMarkedQuestions((prev) =>
      prev.includes(number) ? prev.filter((item) => item !== number) : [...prev, number],
    );
  };

  const clearCurrent = () => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: null }));
  };

  const handleSubmit = async () => {
    const sectionBreakdown: Partial<Record<Section, { attempted: number; correct: number; timeSeconds: number }>> = {};
    let totalCorrect = 0;
    let totalAttempted = 0;

    for (const question of QUESTIONS) {
      const answer = answers[question.id];
      const attempted = answer !== null && answer !== undefined;
      if (!attempted) continue;

      totalAttempted += 1;
      const correct = answer === question.correctOption;
      if (correct) {
        totalCorrect += 1;
      }

      const existing = sectionBreakdown[question.section] || { attempted: 0, correct: 0, timeSeconds: 0 };
      sectionBreakdown[question.section] = {
        attempted: existing.attempted + 1,
        correct: existing.correct + (correct ? 1 : 0),
        timeSeconds: existing.timeSeconds,
      };
    }

    const elapsed = Math.max(1, MOCK_DURATION_SECONDS - timeLeft);
    const attemptedSections = Object.keys(sectionBreakdown) as Section[];
    const splitTime = attemptedSections.length > 0 ? Math.floor(elapsed / attemptedSections.length) : elapsed;
    for (const section of attemptedSections) {
      if (sectionBreakdown[section]) {
        sectionBreakdown[section]!.timeSeconds = splitTime;
      }
    }

    await recordMockExamSubmission({
      sectionBreakdown,
      totalQuestions: totalAttempted,
      totalCorrect,
      durationSeconds: elapsed,
    });

    const accuracy = totalAttempted ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    Alert.alert('Section submitted', `Attempted: ${totalAttempted}/${QUESTIONS.length}\nAccuracy: ${accuracy}%`);
  };

  const paletteMeta = useMemo(
    () =>
      QUESTIONS.map((question, index) => {
        const number = index + 1;
        const answered = answers[question.id] !== null && answers[question.id] !== undefined;
        const marked = markedQuestions.includes(number);
        const hasVisited = !!visited[question.id];
        return { question, number, answered, marked, hasVisited };
      }),
    [answers, markedQuestions, visited],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="w-full bg-surface/80 border-b border-outline-variant/30 flex-row items-center justify-between px-4 h-16 z-50">
        <View className="flex-row items-center gap-4">
          <Link href="/" asChild>
            <Pressable className="p-2 rounded-full active:bg-primary/10">
              <Menu color="#a4c9ff" size={24} />
            </Pressable>
          </Link>
          <Text className="font-bold text-xl text-primary tracking-tighter">CAT MASTER AI</Text>
        </View>
        <View className="flex-row items-center gap-2 bg-surface-container py-1 px-3 rounded-full border border-outline-variant/50 shadow shadow-primary/20">
          <Timer color="#a4c9ff" size={16} />
          <Text className="text-xs font-medium tracking-widest text-primary">{formatTime(timeLeft)}</Text>
        </View>
      </View>

      <View className="flex-1 relative">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="flex-row items-center justify-between border-b border-outline-variant/30 py-4 mb-4">
            <View className="flex-row items-center gap-3">
              <View className="px-2 py-1 bg-surface-container rounded-md border border-primary/20">
                <Text className="text-[10px] font-medium tracking-widest text-primary">{currentQuestion.section}</Text>
              </View>
              <Text className="text-sm font-semibold text-on-surface-variant">
                Question {currentIndex + 1} of {QUESTIONS.length}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className={`w-2 h-2 rounded-full ${currentQuestion.difficulty === 'High' ? 'bg-error' : currentQuestion.difficulty === 'Medium' ? 'bg-tertiary' : 'bg-status-answered'}`} />
              <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">{currentQuestion.difficulty} Difficulty</Text>
            </View>
          </View>

          {currentQuestion.passage ? (
            <View className="glass-card rounded-xl p-4 mb-6">
              <Text className="text-lg font-semibold text-on-surface mb-4">Read the following passage and answer the question:</Text>
              <Text className="text-base text-on-surface-variant leading-relaxed">{currentQuestion.passage}</Text>
            </View>
          ) : null}

          <View className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 mb-6">
            <Text className="text-lg font-semibold text-on-surface mb-6">{currentQuestion.prompt}</Text>
            <View className="gap-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt.id }))}
                    className={`flex-row items-start gap-3 p-4 rounded-lg border ${isSelected ? 'border-primary bg-primary/10' : 'border-outline-variant/50'} active:bg-surface-variant`}
                  >
                    <View className={`w-6 h-6 rounded-full border items-center justify-center ${isSelected ? 'border-primary bg-primary/10' : 'border-outline-variant'}`}>
                      <Text className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>{opt.letter}</Text>
                    </View>
                    <Text className="flex-1 text-base text-on-surface mt-0.5">{opt.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="flex-row items-center justify-between pt-4">
            <Pressable
              onPress={toggleReview}
              className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 active:bg-surface-variant ${markedQuestions.includes(currentIndex + 1) ? 'border-tertiary bg-tertiary-container/10' : 'border-outline-variant'}`}
            >
              <BookmarkPlus color="#c1c7d3" size={16} />
              <Text className="text-sm font-semibold text-on-surface-variant">{markedQuestions.includes(currentIndex + 1) ? 'Marked' : 'Mark Review'}</Text>
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable className="px-4 py-2 rounded-lg border border-outline-variant active:bg-surface-variant" onPress={clearCurrent}>
                <Text className="text-sm font-semibold text-on-surface-variant">Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveAndNext}
                className={`px-6 py-2 rounded-lg ${currentIndex >= QUESTIONS.length - 1 ? 'bg-surface-container-high border border-outline-variant/40' : 'bg-primary'} active:opacity-80`}
              >
                <Text className={`text-sm font-semibold ${currentIndex >= QUESTIONS.length - 1 ? 'text-on-surface-variant' : 'text-on-primary'}`}>
                  {currentIndex >= QUESTIONS.length - 1 ? 'Last Question' : 'Save & Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View className="absolute bottom-0 left-0 w-full bg-surface-container-highest border-t border-outline-variant/20 p-4 flex-row justify-between items-center z-30">
          <Pressable className="flex-row items-center gap-2" onPress={() => setShowGrid(!showGrid)}>
            <GridIcon color="#c1c7d3" size={20} />
            <Text className="text-sm font-semibold text-on-surface-variant">Palette</Text>
          </Pressable>
          <Pressable onPress={handleSubmit} className="px-6 py-3 rounded-lg bg-primary active:opacity-80">
            <Text className="text-sm font-semibold text-on-primary">Submit Section</Text>
          </Pressable>
        </View>

        {showGrid && (
          <View className="absolute bottom-16 left-0 w-full bg-surface-container-high rounded-t-xl border-t border-outline-variant/30 p-4 z-40 max-h-[60%]">
            <View className="w-12 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
            <Text className="text-lg font-semibold text-on-surface mb-2">Question Palette</Text>

            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-answered" /><Text className="text-[10px] text-on-surface-variant">Answered</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-unanswered" /><Text className="text-[10px] text-on-surface-variant">Visited</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-review" /><Text className="text-[10px] text-on-surface-variant">Marked</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-surface-container border border-outline-variant" /><Text className="text-[10px] text-on-surface-variant">Not Visited</Text></View>
            </View>

            <ScrollView className="mb-4">
              <View className="flex-row flex-wrap gap-2">
                {paletteMeta.map(({ number, answered, marked, hasVisited }, index) => {
                  let bgClass = 'bg-surface-container border border-outline-variant';
                  let textClass = 'text-on-surface-variant';
                  if (answered) {
                    bgClass = 'bg-status-answered';
                    textClass = 'text-surface-dim';
                  } else if (marked) {
                    bgClass = 'bg-status-review';
                    textClass = 'text-surface-dim';
                  } else if (hasVisited) {
                    bgClass = 'bg-status-unanswered';
                    textClass = 'text-surface-dim';
                  }
                  if (index === currentIndex) {
                    bgClass = 'bg-primary border-2 border-white';
                    textClass = 'text-on-primary';
                  }
                  return (
                    <Pressable key={number} onPress={() => goToIndex(index)} className={`w-[18%] aspect-square rounded-md items-center justify-center ${bgClass}`}>
                      <Text className={`text-xs font-medium ${textClass}`}>{number}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable onPress={handleSubmit} className="w-full py-3 rounded-lg bg-error-container active:opacity-80 items-center">
              <Text className="text-sm font-semibold text-on-error-container">Submit Section</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
