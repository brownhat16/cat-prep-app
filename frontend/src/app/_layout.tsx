import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PuterProvider } from '../providers/PuterProvider';
import "../global.css";

export default function Layout() {
  // We're using hardcoded dark theme colors in tailwind.config.js, 
  // so we don't need to manually force NativeWind's dark mode.

  return (
    <SafeAreaProvider>
      <PuterProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f131d' } }} />
      </PuterProvider>
    </SafeAreaProvider>
  );
}
