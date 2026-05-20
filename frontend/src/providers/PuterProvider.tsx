import React, { useRef, useCallback, useState, createContext, useContext } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { View } from 'react-native';

// -- Types --
type PuterMessage =
  | { type: 'auth_status'; payload: { signedIn: boolean } }
  | { type: 'auth_result'; payload: { success: boolean; username?: string; error?: string } }
  | { type: 'chat_result'; payload: { success: boolean; text: string; requestId?: string } }
  | { type: 'error'; payload: { message: string; requestId?: string } };

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

// -- Context --
type PuterContextType = {
  isSignedIn: boolean;
  username: string | null;
  signIn: () => void;
  signOut: () => void;
  chat: (prompt: string, model?: string) => Promise<string>;
  isReady: boolean;
};

const PuterContext = createContext<PuterContextType>({
  isSignedIn: false,
  username: null,
  signIn: () => {},
  signOut: () => {},
  chat: async () => '',
  isReady: false,
});

export const usePuter = () => useContext(PuterContext);

// -- Provider --
export function PuterProvider({ children }: { children: React.ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const sendToWebView = useCallback((action: string, data?: Record<string, unknown>) => {
    if (webViewRef.current) {
      const msg = JSON.stringify({ action, ...data });
      webViewRef.current.postMessage(msg);
    }
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: PuterMessage = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'auth_status':
          setIsSignedIn(msg.payload.signedIn);
          setIsReady(true);
          break;

        case 'auth_result':
          if (msg.payload.success) {
            setIsSignedIn(true);
            setUsername(msg.payload.username ?? null);
          }
          break;

        case 'chat_result': {
          const reqId = msg.payload.requestId;
          if (reqId && pendingRequests.current.has(reqId)) {
            const pending = pendingRequests.current.get(reqId)!;
            if (msg.payload.success) {
              pending.resolve(msg.payload.text);
            } else {
              pending.reject(new Error('Chat failed'));
            }
            pendingRequests.current.delete(reqId);
          }
          break;
        }

        case 'error': {
          const errReqId = msg.payload.requestId;
          if (errReqId && pendingRequests.current.has(errReqId)) {
            pendingRequests.current.get(errReqId)!.reject(new Error(msg.payload.message));
            pendingRequests.current.delete(errReqId);
          }
          break;
        }
      }
    } catch (e) {
      console.warn('[PuterProvider] Failed to parse message:', e);
    }
  }, []);

  const signIn = useCallback(() => {
    sendToWebView('sign_in');
  }, [sendToWebView]);

  const signOut = useCallback(() => {
    sendToWebView('sign_out');
    setIsSignedIn(false);
    setUsername(null);
  }, [sendToWebView]);

  const chat = useCallback((prompt: string, model: string = 'gpt-4o-mini'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      pendingRequests.current.set(requestId, { resolve, reject });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.get(requestId)!.reject(new Error('Puter chat timeout'));
          pendingRequests.current.delete(requestId);
        }
      }, 60000);

      sendToWebView('chat', { prompt, model, requestId });
    });
  }, [sendToWebView]);

  const bridgeHtml = require('../../assets/puter-bridge.html');

  return (
    <PuterContext.Provider value={{ isSignedIn, username, signIn, signOut, chat, isReady }}>
      {children}
      {/* Hidden WebView that loads puter.js */}
      <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}>
        <WebView
          ref={webViewRef}
          source={bridgeHtml}
          onMessage={onMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          originWhitelist={['*']}
          onError={(e) => console.warn('[PuterWebView] Error:', e.nativeEvent)}
        />
      </View>
    </PuterContext.Provider>
  );
}
