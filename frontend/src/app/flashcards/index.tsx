import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Image, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { Menu, RefreshCcw, Volume2, Hand, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { flashcardService } from '../../api/client';
import { usePuter } from '../../providers/PuterProvider';

export default function Flashcards() {
  const insets = useSafeAreaInsets();
  const [flipped, setFlipped] = useState(false);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('Algebra');
  const flipAnim = useRef(new Animated.Value(0)).current;
  const { isConnected, chat: puterChat } = usePuter();

  const topics = ['Algebra', 'Probability', 'Geometry', 'Number Systems', 'Permutations', 'Time & Work', 'Profit & Loss', 'Averages'];

  const handleGenerateFlashcards = async () => {
    setGenerating(true);
    try {
      const data = await flashcardService.generateFlashcards(selectedTopic, 5);
      if (data?.flashcards?.length > 0) {
        setFlashcards(data.flashcards);
        setCurrentIndex(0);
        if (flipped) flipCard();
      }
    } catch (error) {
      console.warn('Backend flashcard gen failed, trying Puter...', error);
      if (isConnected) {
        try {
          const prompt = `Generate 5 CAT exam flashcards for "${selectedTopic}". Return ONLY JSON array: [{"front":"...","back":"...","explanation":"...","topic":"${selectedTopic}"}]`;
          const text = await puterChat(prompt, 'claude-sonnet-4-20250514');
          let cleaned = text.trim();
          if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
          if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
          if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
          const cards = JSON.parse(cleaned.trim());
          cards.forEach((c: any, i: number) => { c.id = `puter-${Date.now()}-${i}`; });
          setFlashcards(cards);
          setCurrentIndex(0);
          if (flipped) flipCard();
        } catch (pe) { console.error('Puter flashcard gen failed:', pe); }
      }
    } finally {
      setGenerating(false);
    }
  };

  React.useEffect(() => {
    const loadFlashcards = async () => {
      try {
        const data = await flashcardService.getFlashcards();
        if (data && data.length > 0) {
          setFlashcards(data);
        }
      } catch (error) {
        console.error("Failed to load flashcards:", error);
        // Fallback dummy
        setFlashcards([{
          id: "dummy-1",
          topic: "Probability",
          front: "Bayes' Theorem Formula",
          back: "P(A|B) = [P(B|A) * P(A)] / P(B)",
          explanation: "Describes the probability of an event, based on prior knowledge of conditions that might be related to the event."
        }]);
      }
    };
    loadFlashcards();
  }, []);

  const flipCard = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const handleReview = async (difficulty: "Hard" | "Good" | "Easy") => {
    if (flashcards.length === 0) return;
    try {
      await flashcardService.reviewFlashcard(flashcards[currentIndex].id, difficulty);
      // Move to next card, flip back
      if (flipped) flipCard();
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % flashcards.length);
      }, 300);
    } catch (e) {
      console.error(e);
    }
  };

  const currentCard = flashcards[currentIndex];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Top App Bar */}
      <View className="w-full bg-surface/80 border-b border-outline-variant/30 flex-row items-center justify-between px-4 h-16 z-50">
        <Link href="/" asChild>
          <Pressable className="p-2 rounded-full active:bg-primary/10">
            <Menu color="#a4c9ff" size={24} />
          </Pressable>
        </Link>
        <Text className="font-bold text-xl text-primary tracking-tighter">CAT MASTER AI</Text>
        <Pressable className="p-1 rounded-full border border-outline-variant/50 overflow-hidden">
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBWIf5Ro8Y0lxBXiXaj8mw0LsB6oHUa4GJkFzP6szk2u_jnNTNnKNAThPxMyPg2c0ty1cx_Z-20M8W3K_1RkBPVlXGCAMTf4Fo2R3fK8vRNGQv31OUVtJchRE4J250oZTB70d9qoi8HJjYz72EfpdC_0IGFVMoFT5GJmER4EAbpeS8VRKvzOVCuloWjKnJUFPPGXcJ3-V4o6s-0WiMQq3lCX0PgCoUHafVCrixTN45kjIM595WSzxBpdwaWlT8KJxocgM6qEzSJUY8' }}
            className="w-8 h-8 rounded-full"
          />
        </Pressable>
      </View>

      <View className="flex-1 items-center px-4 pt-8">
        {/* Progress Indicator */}
        <View className="w-full max-w-md flex-row items-center justify-between mb-8">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 items-center justify-center">
            <Text className="text-primary font-semibold">{flashcards.length > 0 ? currentIndex + 1 : 0}</Text>
          </View>
          <Text className="text-on-surface-variant text-sm">/ {flashcards.length}</Text>
        </View>
        <View className="flex-1 mx-4 h-2 bg-surface-container rounded-full overflow-hidden">
          <View className="h-full bg-primary" style={{ width: `${flashcards.length ? ((currentIndex + 1) / flashcards.length) * 100 : 0}%` }} />
        </View>
        <View className="flex-row gap-1">
          <View className="px-2 py-1 rounded-full bg-surface-container-high border border-outline-variant">
            <Text className="text-[10px] text-on-surface-variant tracking-widest font-medium">CONCEPT</Text>
          </View>
          <View className="px-2 py-1 rounded-full bg-secondary-container/30 border border-secondary/30">
            <Text className="text-[10px] text-secondary tracking-widest font-medium">{currentCard?.topic?.toUpperCase() || "UNKNOWN"}</Text>
          </View>
        </View>
        </View>

        {/* Topic Selector & Generate */}
        <View className="w-full max-w-md mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {topics.map((t) => (
              <Pressable
                key={t}
                onPress={() => setSelectedTopic(t)}
                className={`px-3 py-2 rounded-full border ${selectedTopic === t ? 'bg-primary/20 border-primary/50' : 'border-outline-variant/50 bg-surface-container-high'}`}
              >
                <Text className={`text-xs font-medium ${selectedTopic === t ? 'text-primary' : 'text-on-surface-variant'}`}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={handleGenerateFlashcards}
            disabled={generating}
            className="mt-3 py-3 rounded-xl bg-secondary-container/30 border border-secondary/30 items-center flex-row justify-center gap-2 active:opacity-80"
          >
            {generating ? (
              <ActivityIndicator size="small" color="#ddb7ff" />
            ) : (
              <Sparkles color="#ddb7ff" size={18} />
            )}
            <Text className="text-sm font-semibold text-secondary">
              {generating ? 'Generating...' : `Generate ${selectedTopic} Flashcards`}
            </Text>
          </Pressable>
        </View>

      {/* Flashcard Container */}
      {currentCard ? (
        <Pressable onPress={flipCard} className="w-full max-w-md aspect-[3/4] relative perspective-1000">
          {/* Front */}
          <Animated.View 
            className="absolute w-full h-full glass-card rounded-3xl border border-outline-variant/50 items-center justify-center p-6 bg-surface-container-low/80"
            style={{ transform: [{ rotateY: frontInterpolate }], backfaceVisibility: 'hidden' }}
          >
            <View className="absolute top-4 right-4 flex-row items-center gap-1 opacity-50">
              <Hand color="#c1c7d3" size={14} />
              <Text className="text-[10px] tracking-widest font-medium text-on-surface-variant">TAP TO FLIP</Text>
            </View>
            <Text className="text-3xl font-bold text-primary text-center leading-tight">
              {currentCard.front}
            </Text>
            <View className="mt-8 w-12 h-12 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
              <RefreshCcw color="#a4c9ff" size={24} />
            </View>
          </Animated.View>

          {/* Back */}
          <Animated.View 
            className="absolute w-full h-full glass-card rounded-3xl border border-outline-variant/50 p-6 bg-surface-container-high/90 border-t-4 border-t-secondary"
            style={{ transform: [{ rotateY: backInterpolate }], backfaceVisibility: 'hidden' }}
          >
            <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-outline-variant/30">
              <Text className="text-lg font-semibold text-secondary">Formula & Explanation</Text>
              <Pressable>
                <Volume2 color="#c1c7d3" size={20} />
              </Pressable>
            </View>
            
            <View className="flex-1 justify-center space-y-6">
              <View className="bg-surface-dim/80 p-4 rounded-xl border border-outline-variant/40 items-center mb-6">
                <Text className="text-lg font-medium text-on-surface font-mono tracking-wider">
                  {currentCard.back}
                </Text>
              </View>
              
              <Text className="text-base text-on-surface-variant leading-relaxed mb-6">
                {currentCard.explanation}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      ) : (
        <View className="w-full max-w-md aspect-[3/4] items-center justify-center">
           <Text className="text-on-surface-variant">Loading flashcards...</Text>
        </View>
      )}

      {/* SRS Controls */}
        <View className="w-full max-w-md mt-12 flex-row gap-4">
          <Pressable onPress={() => handleReview("Hard")} className="flex-1 items-center justify-center py-4 rounded-xl bg-error-container/20 border border-error/30 active:opacity-80">
            <Text className="text-lg font-semibold text-error mb-1">Hard</Text>
            <Text className="text-[10px] tracking-widest font-medium text-error/70">{"< 1m"}</Text>
          </Pressable>
          <Pressable onPress={() => handleReview("Good")} className="flex-1 items-center justify-center py-4 rounded-xl bg-primary-container/20 border border-primary/30 active:opacity-80">
            <Text className="text-lg font-semibold text-primary mb-1">Good</Text>
            <Text className="text-[10px] tracking-widest font-medium text-primary/70">10m</Text>
          </Pressable>
          <Pressable onPress={() => handleReview("Easy")} className="flex-1 items-center justify-center py-4 rounded-xl bg-[#004d40]/40 border border-[#4ade80]/30 active:opacity-80">
            <Text className="text-lg font-semibold text-[#4ade80] mb-1">Easy</Text>
            <Text className="text-[10px] tracking-widest font-medium text-[#4ade80]/70">4d</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
