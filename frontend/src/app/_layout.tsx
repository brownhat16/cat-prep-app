import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import "../global.css";

export default function Layout() {
  // We're using hardcoded dark theme colors in tailwind.config.js, 
  // so we don't need to manually force NativeWind's dark mode.

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f131d' } }} />
    </SafeAreaProvider>
  );
}
