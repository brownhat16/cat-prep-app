import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { Menu, Timer, BookmarkPlus, Grid as GridIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { mockExamService } from '../../api/client';

export default function MockExam() {
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<number | null>(1);
  const [showGrid, setShowGrid] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(12);
  const [markedQuestions, setMarkedQuestions] = useState<number[]>([4]);

  const handleSaveAndNext = () => {
    setSelectedOption(null);
    setCurrentQuestion((prev) => (prev >= 40 ? 1 : prev + 1));
  };

  const toggleReview = () => {
    setMarkedQuestions((prev) =>
      prev.includes(currentQuestion)
        ? prev.filter((question) => question !== currentQuestion)
        : [...prev, currentQuestion]
    );
  };

  const goToQuestion = (questionNumber: number) => {
    setCurrentQuestion(questionNumber);
    setShowGrid(false);
  };

  const handleSubmit = async () => {
    try {
      // Dummy answers payload
      const result = await mockExamService.submitExam({"q12": String(selectedOption)}, "12:34");
      alert(result.message + " | Score: " + result.score);
    } catch (e) {
      console.error(e);
      alert("Failed to submit exam");
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Top App Bar */}
      <View className="w-full bg-surface/80 border-b border-outline-variant/30 flex-row items-center justify-between px-4 h-16 z-50">
        <View className="flex-row items-center gap-4">
          <Link href="/" asChild>
            <Pressable className="p-2 rounded-full active:bg-primary/10">
              <Menu color="#a4c9ff" size={24} />
            </Pressable>
          </Link>
          <Text className="font-bold text-xl text-primary tracking-tighter">CAT MASTER AI</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-2 bg-surface-container py-1 px-3 rounded-full border border-outline-variant/50 shadow shadow-primary/20">
            <Timer color="#a4c9ff" size={16} />
            <Text className="text-xs font-medium tracking-widest text-primary">39:59</Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 relative">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Section Header */}
          <View className="flex-row items-center justify-between border-b border-outline-variant/30 py-4 mb-4">
            <View className="flex-row items-center gap-3">
              <View className="px-2 py-1 bg-surface-container rounded-md border border-primary/20">
                <Text className="text-[10px] font-medium tracking-widest text-primary">VARC</Text>
              </View>
              <Text className="text-sm font-semibold text-on-surface-variant">Question {currentQuestion} of 40</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-full bg-error" />
              <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">High Difficulty</Text>
            </View>
          </View>

          {/* Passage Container */}
          <View className="glass-card rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-on-surface mb-4">Read the following passage and answer the questions that follow:</Text>
            <Text className="text-base text-on-surface-variant leading-relaxed mb-4">
              The advent of artificial intelligence in educational assessment paradigms presents both unprecedented opportunities and profound epistemological challenges. While algorithmic evaluation promises scalability and supposedly objective metrics, it fundamentally relies on historical datasets that are inherently imbued with human biases. Consequently, the notion of 'fairness' in AI-driven testing is not merely a technical hurdle but a deeply philosophical one...
            </Text>
            <Text className="text-base text-on-surface-variant leading-relaxed">
              Furthermore, the opaque nature of complex neural networks—often referred to as 'black boxes'—means that the rationale behind specific evaluations remains inaccessible to both educators and examinees.
            </Text>
          </View>

          {/* Specific Question */}
          <View className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 mb-6">
            <Text className="text-lg font-semibold text-on-surface mb-6">Based on the passage, the author's primary concern regarding the use of complex neural networks in assessment is that they:</Text>
            
            {/* Options */}
            <View className="gap-3">
              {[
                { id: 0, letter: 'A', text: 'perpetuate historical biases present in their training datasets.' },
                { id: 1, letter: 'B', text: 'obscure the evaluative process, thereby hindering educational feedback.' },
                { id: 2, letter: 'C', text: 'transform assessments entirely into technical hurdles rather than philosophical ones.' },
                { id: 3, letter: 'D', text: 'fail to provide scalable metrics compared to traditional evaluation methods.' }
              ].map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <Pressable 
                    key={opt.id}
                    onPress={() => setSelectedOption(opt.id)}
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

          {/* Action Buttons */}
          <View className="flex-row items-center justify-between pt-4">
            <Pressable onPress={toggleReview} className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 active:bg-surface-variant ${markedQuestions.includes(currentQuestion) ? 'border-tertiary bg-tertiary-container/10' : 'border-outline-variant'}`}>
              <BookmarkPlus color="#c1c7d3" size={16} />
              <Text className="text-sm font-semibold text-on-surface-variant">{markedQuestions.includes(currentQuestion) ? 'Marked' : 'Mark Review'}</Text>
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable className="px-4 py-2 rounded-lg border border-outline-variant active:bg-surface-variant" onPress={() => setSelectedOption(null)}>
                <Text className="text-sm font-semibold text-on-surface-variant">Clear</Text>
              </Pressable>
              <Pressable onPress={handleSaveAndNext} className="px-6 py-2 rounded-lg bg-primary active:opacity-80">
                <Text className="text-sm font-semibold text-on-primary">Save & Next</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Mobile Action Bar */}
        <View className="absolute bottom-0 left-0 w-full bg-surface-container-highest border-t border-outline-variant/20 p-4 flex-row justify-between items-center z-30">
          <Pressable className="flex-row items-center gap-2" onPress={() => setShowGrid(!showGrid)}>
            <GridIcon color="#c1c7d3" size={20} />
            <Text className="text-sm font-semibold text-on-surface-variant">Palette</Text>
          </Pressable>
          <Pressable onPress={handleSaveAndNext} className="px-6 py-3 rounded-lg bg-primary active:opacity-80">
            <Text className="text-sm font-semibold text-on-primary">Save & Next</Text>
          </Pressable>
        </View>

        {/* Question Grid Modal/BottomSheet equivalent */}
        {showGrid && (
          <View className="absolute bottom-16 left-0 w-full bg-surface-container-high rounded-t-xl border-t border-outline-variant/30 p-4 z-40 max-h-[60%]">
            <View className="w-12 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
            <Text className="text-lg font-semibold text-on-surface mb-2">Question Palette</Text>
            
            {/* Legend */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-answered" /><Text className="text-[10px] text-on-surface-variant">Answered</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-unanswered" /><Text className="text-[10px] text-on-surface-variant">Not Answered</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-status-review" /><Text className="text-[10px] text-on-surface-variant">Marked</Text></View>
              <View className="flex-row items-center gap-1"><View className="w-3 h-3 rounded-sm bg-surface-container border border-outline-variant" /><Text className="text-[10px] text-on-surface-variant">Not Visited</Text></View>
            </View>

            {/* Grid */}
            <ScrollView className="mb-4">
              <View className="flex-row flex-wrap gap-2">
                {Array.from({ length: 40 }).map((_, i) => {
                  const num = i + 1;
                  let bgClass = "bg-surface-container border border-outline-variant";
                  let textClass = "text-on-surface-variant";
                  if (num === 1 || num === 2 || num === 5) { bgClass = "bg-status-answered"; textClass = "text-surface-dim"; }
                  if (num === 3 || num === 11) { bgClass = "bg-status-unanswered"; textClass = "text-surface-dim"; }
                  if (markedQuestions.includes(num)) { bgClass = "bg-status-review"; textClass = "text-surface-dim"; }
                  if (num === currentQuestion) { bgClass = "bg-primary border-2 border-white"; textClass = "text-on-primary"; }
                  return (
                    <Pressable key={i} onPress={() => goToQuestion(num)} className={`w-[18%] aspect-square rounded-md items-center justify-center ${bgClass}`}>
                      <Text className={`text-xs font-medium ${textClass}`}>{num}</Text>
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
