import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { Menu, Lightbulb, Bot } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { aiService } from '../../api/client';

export default function QuickSolve() {
  const insets = useSafeAreaInsets();
  const [showHint, setShowHint] = useState(false);
  const [loadingClone, setLoadingClone] = useState(false);

  // Dummy question state
  const [question, setQuestion] = useState({
    text: "Five people (A, B, C, D, E) stand in a line. B is not at either end. C is immediately between A and E. D is immediately between B and C. If A is at the first position, what is the order?",
    hint: "If A is 1st, then C must be 2nd and E must be 3rd to satisfy 'C is between A and E'. Then D is 4th and B is 5th.",
    options: ["A, C, E, D, B", "A, E, C, B, D", "A, C, D, B, E", "A, B, C, D, E"]
  });

  const handleGenerateClone = async () => {
    setLoadingClone(true);
    try {
      // In a real app, you'd pass the topic from a selector. Hardcoding "Algebra" for testing.
      const cloneData = await aiService.generateClone("Algebra", "Medium");
      setQuestion({
        text: cloneData.question_text,
        hint: cloneData.concept_hint,
        options: cloneData.options
      });
      setShowHint(false);
    } catch (error) {
      console.error("Failed to generate clone:", error);
      // Fallback to dummy if backend is unreachable
      setQuestion({
        text: "Five cars (Red, Blue, Green, Yellow, Black) are parked in a row. Blue is not at either end. Green is immediately between Red and Black. Yellow is immediately between Blue and Green. If Red is parked first, what is the order?",
        hint: "Follow the same logical deduction structure as the original puzzle.",
        options: ["Red, Green, Black, Yellow, Blue", "Red, Black, Green, Blue, Yellow", "Red, Green, Yellow, Blue, Black", "Red, Blue, Green, Yellow, Black"]
      });
    } finally {
      setLoadingClone(false);
    }
  };

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
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKDfmwxGiQe-rvkkgQXfNlLAxOztmBApsXJs1KgtVInI5RodSP4bpYR-wIwbM21dDCzg-qUyH-Mooh27lbnSRBr-aQqtWtTepE9ZgmKwGr7ubeQstnFX1MA_grzU638PsOvAeVUAApfKmtW5Y45AzO2_MzEfin5cYj_ilXMBolWlEqYz9kkQE5VBLMVv8zjEwxEZyoLo7HpKhy6wNDeb6adzFPsQwz2odPZ7BgB7wbQ7EjwNSbSGfPFNZ0R0z2EgPjCGwKq1zJFDQ' }}
            className="w-8 h-8 rounded-full"
          />
        </Pressable>
      </View>

      <View className="flex-1 px-4 pt-6 justify-center items-center">
        {/* Main Card */}
        <View className="w-full max-w-md glass-card rounded-3xl p-6 border border-outline-variant/50 mb-8 relative overflow-hidden">
          {loadingClone && (
            <View className="absolute inset-0 bg-surface/80 items-center justify-center z-10 rounded-3xl">
              <ActivityIndicator size="large" color="#a4c9ff" />
              <Text className="text-primary font-semibold mt-4">Generating AI Clone...</Text>
            </View>
          )}

          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-sm font-semibold tracking-widest text-primary">PUZZLE ARENA</Text>
            <Text className="text-sm font-semibold text-secondary">02:18</Text>
          </View>

          <Text className="text-xl font-bold text-on-surface mb-6 leading-relaxed">
            {question.text}
          </Text>

          <View className="gap-3 mb-6">
            {question.options.map((opt, i) => (
              <Pressable key={i} className="w-full p-4 rounded-xl border border-outline-variant/50 active:bg-surface-variant flex-row items-center gap-3">
                <View className="w-6 h-6 rounded-full border border-outline-variant items-center justify-center">
                  <Text className="text-xs text-on-surface-variant font-medium">{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text className="flex-1 text-base text-on-surface">{opt}</Text>
              </Pressable>
            ))}
          </View>

          {showHint && (
            <View className="bg-tertiary-container/10 p-4 rounded-xl border border-tertiary/20 mb-4">
              <Text className="text-sm font-semibold text-tertiary mb-1">Concept Hint:</Text>
              <Text className="text-sm text-on-surface-variant">{question.hint}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="w-full max-w-md flex-row gap-4">
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
            <Text className="text-base font-semibold text-white">Generate Clone</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
