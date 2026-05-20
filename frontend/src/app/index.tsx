import React from 'react';
import { View, Text, ScrollView, Pressable, Image, SafeAreaView } from 'react-native';
import { Link } from 'expo-router';
import { Menu, Flame, Lightbulb, ClipboardList, Swords, Library, BarChart2, Timer, ArrowRight, TrendingUp, Zap, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePuter } from '../providers/PuterProvider';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { isConnected, signIn, signOut } = usePuter();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* TopAppBar */}
      <View className="w-full bg-surface/60 border-b border-outline-variant/30 flex-row items-center justify-between px-4 h-16">
        <Pressable className="p-2 rounded-full active:bg-primary/10">
          <Menu color="#a4c9ff" size={24} />
        </Pressable>
        <Text className="font-bold text-2xl text-primary tracking-tighter">CAT MASTER AI</Text>
        <Pressable className="p-1 rounded-full border border-primary/30 overflow-hidden">
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJAhGXW17ZUrva_IWI_y66KZK17jFucuWdBOGiY27DiEAXMxpAyMVvq2qM1ZkzoByTdjHmP6iKhLp-xDLHYCKBASdPvOHo9cSGYh3P4RoaDInTo_WNcIS95Uzuqv2zs1jEEsNcNQqDA8ATht0iJeThc2bxlChQBE7f-9lwz15fPTOaD8PvtC_4sD4TGKM6suvjqm-U6vzVkpQLjbVp-8j2BM-jlJT22mGe5r4gg4B9bSyjFDgt90UfKdVRvRKdtzan0KYWo4rcx-4' }}
            className="w-8 h-8 rounded-full"
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero Section */}
        <View className="glass-card rounded-xl p-6 relative overflow-hidden mb-6">
          <View className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <Text className="font-semibold text-2xl text-on-surface mb-2">Welcome back, Aspirant</Text>
          <View className="flex-row items-center mb-6 gap-2">
            <Flame color="#ff7e2d" size={16} fill="#ff7e2d" />
            <Text className="text-sm text-on-surface-variant">12 Day Streak</Text>
          </View>

          <View className="bg-surface-container-low/50 p-4 rounded-lg border border-outline-variant/50">
            <Text className="text-xs font-medium text-primary tracking-widest mb-1">CURRENT FOCUS</Text>
            <Text className="text-lg font-semibold text-on-surface mb-4">Data Interpretation: Radar Charts</Text>
            <Pressable className="bg-primary-container py-2 px-6 rounded-lg items-center active:opacity-80">
              <Text className="text-on-primary-container font-semibold">Continue Learning</Text>
            </Pressable>
          </View>
        </View>

        {/* AI Study Plan */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Lightbulb color="#ddb7ff" size={20} />
            <Text className="text-lg font-semibold text-on-surface">AI Recommended Path</Text>
          </View>
          <View className="bg-surface-container-high rounded-xl p-5 border border-outline-variant/50 flex-row gap-4">
            <View className="bg-secondary-container/20 p-3 rounded-full h-12 w-12 items-center justify-center">
              <TrendingUp color="#ddb7ff" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-on-surface mb-1">Focus: Algebra & Number Systems</Text>
              <Text className="text-sm text-on-surface-variant mb-3">Your recent mock showed a 15% dip in quadratic equations accuracy. We've curated 10 high-yield questions for you.</Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-primary text-sm font-semibold">Start Module</Text>
                <ArrowRight color="#a4c9ff" size={16} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Puter AI Fallback */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Zap color="#ff7e2d" size={20} />
            <Text className="text-lg font-semibold text-on-surface">AI Fallback Engine</Text>
          </View>
          {isConnected ? (
            <View className="bg-surface-container-high rounded-xl p-5 border border-status-answered/30">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-3 h-3 rounded-full bg-status-answered" />
                  <View>
                    <Text className="text-sm font-semibold text-status-answered">Puter AI Connected</Text>
                    <Text className="text-xs text-on-surface-variant">Active fallback for Gemini rate limits</Text>
                  </View>
                </View>
                <Pressable
                  onPress={signOut}
                  className="px-3 py-2 rounded-lg border border-outline-variant/50 active:bg-surface-variant"
                >
                  <LogOut color="#8b919d" size={16} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={signIn}
              className="bg-surface-container-high rounded-xl p-5 border border-tertiary/30 active:bg-surface-container-highest"
            >
              <View className="flex-row items-center gap-3">
                <View className="bg-tertiary-container/20 p-3 rounded-full">
                  <Zap color="#ff7e2d" size={24} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-on-surface mb-1">Connect Puter AI</Text>
                  <Text className="text-xs text-on-surface-variant">Free unlimited AI fallback when Gemini hits rate limits. No API keys required!</Text>
                </View>
                <ArrowRight color="#ff7e2d" size={20} />
              </View>
            </Pressable>
          )}
        </View>

        {/* Quick Actions Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4 mb-6">
          <Link href="/mock-exam" asChild>
            <Pressable className="w-[48%] glass-card rounded-xl p-4 items-center active:opacity-80">
              <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-3">
                <ClipboardList color="#a4c9ff" size={24} />
              </View>
              <Text className="text-lg font-semibold text-on-surface mb-1">Mocks</Text>
              <Text className="text-[10px] tracking-widest font-medium text-on-surface-variant opacity-80">NEXT: SUNDAY</Text>
            </Pressable>
          </Link>
          
          <Link href="/quick-solve" asChild>
            <Pressable className="w-[48%] glass-card rounded-xl p-4 items-center active:opacity-80">
              <View className="w-12 h-12 bg-tertiary-container/10 rounded-full items-center justify-center mb-3">
                <Swords color="#ff7e2d" size={24} />
              </View>
              <Text className="text-lg font-semibold text-on-surface mb-1">Arena</Text>
              <Text className="text-[10px] tracking-widest font-medium text-error opacity-80">DAILY LIVE</Text>
            </Pressable>
          </Link>

          <Link href="/flashcards" asChild>
            <Pressable className="w-[48%] glass-card rounded-xl p-4 items-center active:opacity-80">
              <View className="w-12 h-12 bg-secondary/10 rounded-full items-center justify-center mb-3">
                <Library color="#ddb7ff" size={24} />
              </View>
              <Text className="text-lg font-semibold text-on-surface mb-1">Library</Text>
              <Text className="text-[10px] tracking-widest font-medium text-on-surface-variant opacity-80">50 DUE TODAY</Text>
            </Pressable>
          </Link>

          <Link href="/analytics" asChild>
            <Pressable className="w-[48%] glass-card rounded-xl p-4 items-center active:opacity-80">
              <View className="w-12 h-12 bg-primary-container/10 rounded-full items-center justify-center mb-3">
                <BarChart2 color="#d4e3ff" size={24} />
              </View>
              <Text className="text-lg font-semibold text-on-surface mb-1">Stats</Text>
              <Text className="text-[10px] tracking-widest font-medium text-on-surface-variant opacity-80">VIEW INSIGHTS</Text>
            </Pressable>
          </Link>
        </View>

        {/* Recent Activity */}
        <View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-on-surface">Recent Activity</Text>
            <Text className="text-xs font-medium tracking-widest text-primary">VIEW ALL</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-4" contentContainerStyle={{ gap: 16 }}>
            <View className="w-[280px] glass-card rounded-xl p-4 flex-col min-h-[100px]">
              <View className="flex-row justify-between mb-2">
                <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">MOCK TEST #12</Text>
                <Text className="text-sm text-tertiary-fixed font-semibold">98.5 %ile</Text>
              </View>
              <View className="mt-auto">
                <View className="w-full bg-surface-container-highest rounded-full h-1.5 mb-1 overflow-hidden">
                  <View className="bg-primary h-1.5" style={{ width: '85%' }} />
                </View>
                <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">SCORE: 112/198</Text>
              </View>
            </View>

            <View className="w-[280px] glass-card rounded-xl p-4 flex-col min-h-[100px]">
              <View className="flex-row justify-between mb-2">
                <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">PUZZLE ARENA</Text>
                <Text className="text-sm text-secondary font-semibold">Won</Text>
              </View>
              <View className="mt-auto flex-row items-center gap-2">
                <Timer color="#c1c7d3" size={14} />
                <Text className="text-sm text-on-surface-variant">02:14</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* BottomNavBar */}
      <View className="absolute bottom-0 w-full bg-surface-container/90 border-t border-outline-variant/20 flex-row justify-around items-center h-20" style={{ paddingBottom: insets.bottom }}>
        <Link href="/quick-solve" asChild>
          <Pressable className="items-center opacity-70">
            <Swords color="#c1c7d3" size={24} />
            <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant mt-1">Arena</Text>
          </Pressable>
        </Link>
        <Link href="/mock-exam" asChild>
          <Pressable className="items-center opacity-70">
            <ClipboardList color="#c1c7d3" size={24} />
            <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant mt-1">Mocks</Text>
          </Pressable>
        </Link>
        <Link href="/flashcards" asChild>
          <Pressable className="items-center opacity-70">
            <Library color="#c1c7d3" size={24} />
            <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant mt-1">Library</Text>
          </Pressable>
        </Link>
        <Link href="/analytics" asChild>
          <Pressable className="items-center opacity-70">
            <BarChart2 color="#c1c7d3" size={24} />
            <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant mt-1">Stats</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
