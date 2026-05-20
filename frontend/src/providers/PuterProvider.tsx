import React, { useRef, useCallback, useState, createContext, useContext } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { View, Modal, Pressable, Text } from 'react-native';
import { X } from 'lucide-react-native';

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

type PuterContextType = {
  isSignedIn: boolean;
  username: string | null;
  signIn: () => void;
  signOut: () => void;
  chat: (prompt: string, model?: string) => Promise<string>;
};

const PuterContext = createContext<PuterContextType>({
  isSignedIn: false,
  username: null,
  signIn: () => {},
  signOut: () => {},
  chat: async () => '',
});

export const usePuter = () => useContext(PuterContext);

const BRIDGE_HTML = `
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://js.puter.com/v2/"></script>
</head><body style="margin:0;background:#0f131d;">
<script>
function sendToRN(type, payload) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
}
window.addEventListener('load', function() {
  setTimeout(function() {
    sendToRN('auth_status', { signedIn: puter.auth.isSignedIn() });
  }, 1000);
});
document.addEventListener('message', function(e) {
  window.dispatchEvent(new MessageEvent('message', { data: e.data }));
});
window.addEventListener('message', async function(e) {
  try {
    var msg = JSON.parse(e.data);
    if (msg.action === 'check_auth') {
      sendToRN('auth_status', { signedIn: puter.auth.isSignedIn() });
    }
    else if (msg.action === 'sign_in') {
      puter.auth.signIn().then(function() {
        var u = puter.auth.getUser();
        if (u && u.then) { u.then(function(user) { sendToRN('auth_result', { success: true, username: user.username }); }); }
        else { sendToRN('auth_result', { success: true, username: '' }); }
      }).catch(function(err) { sendToRN('auth_result', { success: false, error: String(err) }); });
    }
    else if (msg.action === 'sign_out') {
      puter.auth.signOut();
      sendToRN('auth_status', { signedIn: false });
    }
    else if (msg.action === 'chat') {
      puter.ai.chat(msg.prompt, { model: msg.model || 'gpt-4o-mini' }).then(function(resp) {
        var text = '';
        if (typeof resp === 'string') text = resp;
        else if (resp && resp.message && resp.message.content) text = resp.message.content;
        else text = JSON.stringify(resp);
        sendToRN('chat_result', { success: true, text: text, requestId: msg.requestId });
      }).catch(function(err) {
        sendToRN('error', { message: String(err), requestId: msg.requestId });
      });
    }
  } catch(err) { console.log('bridge error', err); }
});
</script></body></html>
`;

export function PuterProvider({ children }: { children: React.ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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
        setIsSignedIn(msg.payload.signedIn);
      } else if (msg.type === 'auth_result') {
        if (msg.payload.success) {
          setIsSignedIn(true);
          setUsername(msg.payload.username || null);
          setShowModal(false);
        }
      } else if (msg.type === 'chat_result') {
        const p = pendingRequests.current.get(msg.payload.requestId);
        if (p) { p.resolve(msg.payload.text); pendingRequests.current.delete(msg.payload.requestId); }
      } else if (msg.type === 'error') {
        const p = pendingRequests.current.get(msg.payload.requestId);
        if (p) { p.reject(new Error(msg.payload.message)); pendingRequests.current.delete(msg.payload.requestId); }
      }
    } catch (e) { console.warn('[Puter] parse error', e); }
  }, []);

  const signIn = useCallback(() => {
    setShowModal(true);
    setTimeout(() => sendToWebView('sign_in'), 500);
  }, [sendToWebView]);

  const signOut = useCallback(() => {
    sendToWebView('sign_out');
    setIsSignedIn(false);
    setUsername(null);
  }, [sendToWebView]);

  const chat = useCallback((prompt: string, model: string = 'gpt-4o-mini'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = `r_${Date.now()}`;
      pendingRequests.current.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.get(requestId)!.reject(new Error('Timeout'));
          pendingRequests.current.delete(requestId);
        }
      }, 60000);
      sendToWebView('chat', { prompt, model, requestId });
    });
  }, [sendToWebView]);

  const webViewComponent = (
    <WebView
      ref={webViewRef}
      source={{ html: BRIDGE_HTML }}
      onMessage={onMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      thirdPartyCookiesEnabled={true}
      javaScriptCanOpenWindowsAutomatically={true}
      setSupportMultipleWindows={false}
      originWhitelist={['*']}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback={true}
      style={showModal ? { flex: 1 } : { height: 0, width: 0, opacity: 0 }}
    />
  );

  return (
    <PuterContext.Provider value={{ isSignedIn, username, signIn, signOut, chat }}>
      {children}
      {showModal ? (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: '#0f131d' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50 }}>
              <Text style={{ color: '#a4c9ff', fontSize: 18, fontWeight: '700' }}>Connect Puter AI</Text>
              <Pressable onPress={() => setShowModal(false)} style={{ padding: 8 }}>
                <X color="#8b919d" size={24} />
              </Pressable>
            </View>
            <Text style={{ color: '#c1c7d3', fontSize: 14, paddingHorizontal: 16, marginBottom: 16 }}>
              Sign in to your free Puter account to enable unlimited AI fallback.
            </Text>
            {webViewComponent}
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
