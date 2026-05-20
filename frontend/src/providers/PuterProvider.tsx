import React, { useRef, useCallback, useState, useEffect, createContext, useContext } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { View, Modal, Pressable, Text, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

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

// Standard Safari User-Agent to bypass Google secure browser blocks inside WebView
const SAFARI_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export function PuterProvider({ children }: { children: React.ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const sendToWebView = useCallback((action: string, data?: Record<string, unknown>) => {
    if (webViewRef.current) {
      const msg = JSON.stringify({ action, ...data });
      webViewRef.current.postMessage(msg);
    }
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'auth_status') {
        const isNowConnected = msg.payload.signedIn;
        setIsConnected(isNowConnected);
        if (isNowConnected) {
          setShowModal(false);
        }
      } else if (msg.type === 'auth_result') {
        if (msg.payload.success) {
          setIsConnected(true);
          setShowModal(false);
        }
      } else if (msg.type === 'chat_result') {
        const p = pendingRequests.current.get(msg.payload.requestId);
        if (p) { p.resolve(msg.payload.text); pendingRequests.current.delete(msg.payload.requestId); }
      } else if (msg.type === 'error') {
        const p = pendingRequests.current.get(msg.payload.requestId);
        if (p) { p.reject(new Error(msg.payload.message)); pendingRequests.current.delete(msg.payload.requestId); }
      }
    } catch (e) {
      // Ignored non-json messages
    }
  }, []);

  const signIn = useCallback(() => {
    setShowModal(true);
    setLoading(true);
    // Give webview a bit of time to spin up and load, then trigger the sign_in command
    setTimeout(() => {
      sendToWebView('sign_in');
    }, 1500);
  }, [sendToWebView]);

  const signOut = useCallback(() => {
    sendToWebView('sign_out');
    setIsConnected(false);
  }, [sendToWebView]);

  const chat = useCallback((prompt: string, model: string = 'gpt-4o-mini'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = `r_${Date.now()}`;
      pendingRequests.current.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.get(requestId)!.reject(new Error('Puter AI timeout'));
          pendingRequests.current.delete(requestId);
        }
      }, 60000);
      sendToWebView('chat', { prompt, model, requestId });
    });
  }, [sendToWebView]);

  const webViewComponent = (
    <WebView
      ref={webViewRef}
      source={{ uri: 'https://cat-backend-bdyo.onrender.com/puter-bridge' }}
      onMessage={onMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      thirdPartyCookiesEnabled={true}
      javaScriptCanOpenWindowsAutomatically={true}
      setSupportMultipleWindows={false}
      userAgent={SAFARI_USER_AGENT}
      originWhitelist={['*']}
      onLoadEnd={() => setLoading(false)}
      style={{ flex: 1 }}
    />
  );

  return (
    <PuterContext.Provider value={{ isConnected, signIn, signOut, chat }}>
      {children}
      {showModal ? (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: '#0f131d' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#20242f' }}>
              <Text style={{ color: '#a4c9ff', fontSize: 18, fontWeight: '700' }}>Connect Puter AI</Text>
              <Pressable onPress={() => setShowModal(false)} style={{ padding: 8 }}>
                <X color="#8b919d" size={24} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              {loading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f131d', zIndex: 10 }}>
                  <ActivityIndicator size="large" color="#a4c9ff" />
                  <Text style={{ color: '#8b919d', marginTop: 12, fontSize: 14 }}>Connecting to Puter...</Text>
                </View>
              )}
              {webViewComponent}
            </View>
          </View>
        </Modal>
      ) : (
        <View style={{ position: 'absolute', height: 0, width: 0, opacity: 0 }}>
          {webViewComponent}
        </View>
      )}
    </PuterContext.Provider>
  );
}
