import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { Menu, Lightbulb, Bot, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { aiService } from '../../api/client';
import { usePuter } from '../../providers/PuterProvider';

export default function QuickSolve() {
  const insets = useSafeAreaInsets();
  const [showHint, setShowHint] = useState(false);
  const [loadingClone, setLoadingClone] = useState(false);
  const [aiSource, setAiSource] = useState<'gemini' | 'puter' | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const { isConnected, chat: puterChat } = usePuter();

  // Dummy question state
  const [question, setQuestion] = useState({
    text: "Five people (A, B, C, D, E) stand in a line. B is not at either end. C is immediately between A and E. D is immediately between B and C. If A is at the first position, what is the order?",
    hint: "If A is 1st, then C must be 2nd and E must be 3rd to satisfy 'C is between A and E'. Then D is 4th and B is 5th.",
    options: ["A, C, E, D, B", "A, E, C, B, D", "A, C, D, B, E", "A, B, C, D, E"]
  });

  const handleGenerateClone = async () => {
    setLoadingClone(true);
    setAiSource(null);
    try {
      // Try Gemini first via backend
      const cloneData = await aiService.generateClone("Algebra", "Medium");
      setQuestion({
        text: cloneData.question_text,
        hint: cloneData.concept_hint,
        options: cloneData.options
      });
      setSelectedOption(null);
      setShowHint(false);
      setAiSource('gemini');
    } catch (error) {
      console.warn("Gemini failed, trying Puter fallback...", error);
      
      // Fallback to Puter AI if signed in
      if (isConnected) {
        try {
          const prompt = `You are an expert CAT exam setter. Generate a NEW, high-quality multiple choice question on Algebra with Medium difficulty.
It should test logical reasoning and quantitative aptitude.
Include 4 options, the correct answer, and a concept hint.
Return ONLY valid JSON (no markdown, no code blocks): {"question_text": "...", "options": ["A", "B", "C", "D"], "answer": "...", "concept_hint": "..."}`;

          const responseText = await puterChat(prompt, 'claude-sonnet-4-20250514');
          
          // Parse the JSON response
          let cleaned = responseText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
          }
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
          }
          cleaned = cleaned.trim();
          
          const cloneData = JSON.parse(cleaned);
          setQuestion({
            text: cloneData.question_text,
            hint: cloneData.concept_hint,
            options: cloneData.options
          });
          setSelectedOption(null);
          setShowHint(false);
          setAiSource('puter');
        } catch (puterError) {
          console.error("Puter fallback also failed:", puterError);
          // Final fallback to dummy
          setQuestion({
            text: "Five cars (Red, Blue, Green, Yellow, Black) are parked in a row. Blue is not at either end. Green is immediately between Red and Black. Yellow is immediately between Blue and Green. If Red is parked first, what is the order?",
            hint: "Follow the same logical deduction structure as the original puzzle.",
            options: ["Red, Green, Black, Yellow, Blue", "Red, Black, Green, Blue, Yellow", "Red, Green, Yellow, Blue, Black", "Red, Blue, Green, Yellow, Black"]
          });
          setSelectedOption(null);
        }
      } else {
        // No Puter, use dummy fallback
        setQuestion({
          text: "Five cars (Red, Blue, Green, Yellow, Black) are parked in a row. Blue is not at either end. Green is immediately between Red and Black. Yellow is immediately between Blue and Green. If Red is parked first, what is the order?",
          hint: "Follow the same logical deduction structure as the original puzzle.",
          options: ["Red, Green, Black, Yellow, Blue", "Red, Black, Green, Blue, Yellow", "Red, Green, Yellow, Blue, Black", "Red, Blue, Green, Yellow, Black"]
        });
        setSelectedOption(null);
      }
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
            <View className="flex-row items-center gap-2">
              {aiSource && (
                <View className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${aiSource === 'gemini' ? 'bg-primary/10' : 'bg-tertiary-container/10'}`}>
                  {aiSource === 'puter' ? <Zap color="#ff7e2d" size={10} /> : <Bot color="#a4c9ff" size={10} />}
                  <Text className={`text-[9px] font-bold tracking-wider ${aiSource === 'gemini' ? 'text-primary' : 'text-tertiary'}`}>
                    {aiSource === 'gemini' ? 'GEMINI' : 'PUTER'}
                  </Text>
                </View>
              )}
              <Text className="text-sm font-semibold text-secondary">02:18</Text>
            </View>
          </View>

          <Text className="text-xl font-bold text-on-surface mb-6 leading-relaxed">
            {question.text}
          </Text>

          <View className="gap-3 mb-6">
            {question.options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => setSelectedOption(i)}
                className={`w-full p-4 rounded-xl border flex-row items-center gap-3 active:bg-surface-variant ${selectedOption === i ? 'border-primary bg-primary/10' : 'border-outline-variant/50'}`}
              >
                <View className={`w-6 h-6 rounded-full border items-center justify-center ${selectedOption === i ? 'border-primary bg-primary/10' : 'border-outline-variant'}`}>
                  <Text className={`text-xs font-medium ${selectedOption === i ? 'text-primary' : 'text-on-surface-variant'}`}>{String.fromCharCode(65 + i)}</Text>
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
