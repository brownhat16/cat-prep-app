import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

type PuterContextType = {
  isConnected: boolean;
  apiKey: string | null;
  saveApiKey: (key: string) => Promise<void>;
  disconnect: () => Promise<void>;
  chat: (prompt: string, model?: string) => Promise<string>;
};

const PuterContext = createContext<PuterContextType>({
  isConnected: false,
  apiKey: null,
  saveApiKey: async () => {},
  disconnect: async () => {},
  chat: async () => '',
});

export const usePuter = () => useContext(PuterContext);

const PUTER_API_KEY_STORAGE = 'puter_api_key';

export function PuterProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PUTER_API_KEY_STORAGE).then((saved) => {
      if (saved) setApiKey(saved);
    });
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    await AsyncStorage.setItem(PUTER_API_KEY_STORAGE, trimmed);
  }, []);

  const disconnect = useCallback(async () => {
    setApiKey(null);
    await AsyncStorage.removeItem(PUTER_API_KEY_STORAGE);
  }, []);

  const chat = useCallback(async (prompt: string, model: string = 'gpt-4o-mini'): Promise<string> => {
    if (!apiKey) {
      throw new Error('Puter API key is not configured');
    }

    try {
      const response = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
      console.error('Puter direct chat API call failed:', error);
      throw error;
    }
  }, [apiKey]);

  return (
    <PuterContext.Provider value={{ isConnected: !!apiKey, apiKey, saveApiKey, disconnect, chat }}>
      {children}
    </PuterContext.Provider>
  );
}
