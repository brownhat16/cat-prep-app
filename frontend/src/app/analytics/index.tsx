import React from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { Menu, TriangleAlert, ClipboardList, Flame, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { Link } from 'expo-router';
import { analyticsService } from '../../api/client';

export default function AnalyticsDashboard() {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await analyticsService.getAnalytics();
        setAnalytics(data);
      } catch (e) {
        console.error("Failed to load analytics", e);
        // Fallback
        setAnalytics({
          totalTests: 14,
          currentStreak: 12,
          globalAccuracy: 84,
          netScoreTrend: [
            { value: 65, label: 'M1' }, { value: 72, label: 'M2' }, { value: 68, label: 'M3' }, { value: 85, label: 'M4' }, { value: 82, label: 'M5' }, { value: 95, label: 'M6' }, { value: 105, label: 'M7' }
          ],
          sectionalAccuracy: [
            { value: 75, label: 'Quants', frontColor: '#6f00be' }, { value: 88, label: 'DILR', frontColor: '#a4c9ff' }, { value: 92, label: 'VARC', frontColor: '#ff7e2d' }
          ],
          criticalAlert: "Average time on Quantitative Aptitude exceeds 150 seconds. AI recommends reviewing time management strategies for Algebra modules."
        });
      }
    };
    fetchAnalytics();
  }, []);

  const lineData = analytics?.netScoreTrend || [];
  const barData = analytics?.sectionalAccuracy || [];

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
        <Pressable className="p-1 rounded-full border border-outline-variant/50 overflow-hidden">
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKDfmwxGiQe-rvkkgQXfNlLAxOztmBApsXJs1KgtVInI5RodSP4bpYR-wIwbM21dDCzg-qUyH-Mooh27lbnSRBr-aQqtWtTepE9ZgmKwGr7ubeQstnFX1MA_grzU638PsOvAeVUAApfKmtW5Y45AzO2_MzEfin5cYj_ilXMBolWlEqYz9kkQE5VBLMVv8zjEwxEZyoLo7HpKhy6wNDeb6adzFPsQwz2odPZ7BgB7wbQ7EjwNSbSGfPFNZ0R0z2EgPjCGwKq1zJFDQ' }}
            className="w-8 h-8 rounded-full"
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header Section */}
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-3xl font-bold text-on-surface tracking-tighter">Performance Analytics</Text>
            <Text className="text-base text-on-surface-variant mt-1">Detailed breakdown of your CAT preparation journey.</Text>
          </View>
        </View>

        {/* Alert Box */}
        {analytics?.criticalAlert && (
          <View className="bg-error-container/20 border border-error/50 rounded-lg p-4 flex-row items-start gap-3 mb-6">
            <TriangleAlert color="#ffb4ab" size={24} className="mt-1" fill="#ffb4ab" />
            <View className="flex-1">
              <Text className="text-lg font-semibold text-error mb-1">Critical Action Required</Text>
              <Text className="text-sm text-on-error-container">
                Warning: {analytics.criticalAlert}
              </Text>
            </View>
          </View>
        )}

        {/* Stat Cards */}
        <View className="gap-4 mb-6">
          <View className="glass-card rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">Total Tests</Text>
              <ClipboardList color="#a4c9ff" size={16} opacity={0.7} />
            </View>
            <Text className="text-3xl font-bold text-on-surface mb-1">{analytics?.totalTests || 0}</Text>
            <Text className="text-sm text-primary">+2 this week</Text>
          </View>

          <View className="glass-card rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">Current Streak</Text>
              <Flame color="#ff7e2d" size={16} fill="#ff7e2d" />
            </View>
            <View className="flex-row items-baseline gap-1 mb-1">
              <Text className="text-3xl font-bold text-on-surface">{analytics?.currentStreak || 0}</Text>
              <Text className="text-lg font-semibold text-on-surface-variant">Days</Text>
            </View>
            <Text className="text-sm text-secondary">Top 15% of aspirants</Text>
          </View>

          <View className="glass-card rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[10px] font-medium tracking-widest text-on-surface-variant">Global Accuracy</Text>
              <Target color="#a4c9ff" size={16} opacity={0.7} />
            </View>
            <Text className="text-3xl font-bold text-on-surface mb-2">{analytics?.globalAccuracy || 0}%</Text>
            <View className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
              <View className="bg-primary h-1.5" style={{ width: `${analytics?.globalAccuracy || 0}%` }} />
            </View>
          </View>
        </View>

        {/* Charts */}
        <View className="gap-4 mb-6">
          {/* Line Chart */}
          <View className="glass-card rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-semibold text-on-surface">Net Score Trend</Text>
              <Text className="text-[10px] font-medium tracking-widest text-primary">VIEW ALL</Text>
            </View>
            <LineChart
              data={lineData}
              width={280}
              height={200}
              color="#a4c9ff"
              thickness={3}
              dataPointsColor="#0f131d"
              dataPointsRadius={4}
              yAxisTextStyle={{ color: '#8b919d', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#8b919d', fontSize: 10 }}
              rulesColor="rgba(65, 71, 81, 0.2)"
              hideYAxisText={false}
              yAxisLabelWidth={30}
              hideRules={false}
              curved
            />
          </View>

          {/* Bar Chart */}
          <View className="glass-card rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-semibold text-on-surface">Sectional Accuracy</Text>
              <Text className="text-[10px] font-medium tracking-widest text-primary">DETAILS</Text>
            </View>
            <BarChart
              data={barData}
              width={280}
              height={200}
              barWidth={40}
              barBorderRadius={6}
              yAxisTextStyle={{ color: '#8b919d', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#8b919d', fontSize: 10 }}
              rulesColor="rgba(65, 71, 81, 0.2)"
              yAxisLabelWidth={30}
              maxValue={100}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
