import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

type PuterContextType = {
  isConnected: boolean;
  signIn: () => void;
  signOut: () => void;
  chat: (prompt: string, model?: string) => Promise<string>;
};

const PuterContext = createContext<PuterContextType>({
  isConnected: false,
  signIn: () => {},
  signOut: () => {},
  chat: async () => '',
});

export const usePuter = () => useContext(PuterContext);

const PUTER_TOKEN_STORAGE = 'puter_token_key';

export function PuterProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PUTER_TOKEN_STORAGE).then((saved) => {
      if (saved) {
        setTokenState(saved);
        setIsConnected(true);
      }
    });
  }, []);

  const saveToken = useCallback(async (newToken: string) => {
    setTokenState(newToken);
    setIsConnected(true);
    await AsyncStorage.setItem(PUTER_TOKEN_STORAGE, newToken);
  }, []);

  // Listen for deep link redirects back from the secure browser
  useEffect(() => {
    const handleDeepLink = (event: Linking.EventType) => {
      const url = event.url;
      const parsed = Linking.parse(url);
      
      // If redirection URL is frontend://login?token=<TOKEN>
      if (parsed.queryParams?.token) {
        const retrievedToken = parsed.queryParams.token as string;
        saveToken(retrievedToken);
        WebBrowser.dismissBrowser(); // Close the system browser modal
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was launched via deep link from cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = Linking.parse(url);
        if (parsed.queryParams?.token) {
          saveToken(parsed.queryParams.token as string);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [saveToken]);

  const signIn = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL('/');
      // Opens secure Chrome Custom Tabs / Safari View Controller
      // where Google Sign-In is 100% allowed and supported!
      await WebBrowser.openAuthSessionAsync(
        `https://cdn.jsdelivr.net/gh/brownhat16/cat-prep-app@main/frontend/assets/puter-bridge.html?redirect=${encodeURIComponent(redirectUrl)}`,
        redirectUrl
      );
    } catch (error) {
      console.error('Failed to open secure authentication browser:', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    setTokenState(null);
    setIsConnected(false);
    await AsyncStorage.removeItem(PUTER_TOKEN_STORAGE);
  }, []);

  const chat = useCallback(async (prompt: string, model: string = 'gpt-4o-mini'): Promise<string> => {
    if (!token) {
      throw new Error('Puter authentication token is missing');
    }

    try {
      const response = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Puter API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response structure from Puter API');
      }

      return content;
    } catch (error: any) {
      console.error('Puter secure native chat call failed:', error);
      throw error;
    }
  }, [token]);

  return (
    <PuterContext.Provider value={{ isConnected, signIn, signOut, chat }}>
      {children}
    </PuterContext.Provider>
  );
}
