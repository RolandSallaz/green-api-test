import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteOne,
  extractTextMessage,
  normalizeChatId,
  receiveOne,
  sendTextMessage,
  type ChatMessage,
  type GreenCredentials,
} from './greenApi';
import './App.css';

const DEFAULT_API_URL = 'https://api.green-api.com';

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState('');
  const [chats, setChats] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState('');
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const timer = useRef<number | null>(null);

  const creds: GreenCredentials = {
    apiUrl,
    idInstance,
    apiTokenInstance: apiToken,
  };

  const pushLog = (s: string) =>
    setLog((p) => [`${new Date().toLocaleTimeString()} ${s}`, ...p].slice(0, 50));

  const connect = () => {
    setError('');
    if (!idInstance.trim() || !apiToken.trim()) {
      setError('Введите idInstance и apiTokenInstance из GREEN-API');
      return;
    }
    setConnected(true);
    setPolling(true);
    pushLog('Подключено. Опрос входящих каждые 5с.');
  };

  const disconnect = () => {
    setConnected(false);
    setPolling(false);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  const createChat = () => {
    setError('');
    if (!phone.trim()) {
      setError('Введите номер телефона получателя');
      return;
    }
    const chatId = normalizeChatId(phone);
    setChats((p) => (p.includes(chatId) ? p : [...p, chatId]));
    setActiveChat(chatId);
    setMessages((p) => (p[chatId] ? p : { ...p, [chatId]: [] }));
    pushLog(`Чат создан: ${chatId}`);
  };

  const send = async () => {
    setError('');
    if (!activeChat) {
      setError('Создайте чат (введите телефон)');
      return;
    }
    if (!draft.trim()) return;
    const text = draft.trim();
    // optimistic
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      chatId: activeChat,
      text,
      fromMe: true,
      timestamp: Date.now(),
    };
    setMessages((p) => ({
      ...p,
      [activeChat]: [...(p[activeChat] || []), optimistic],
    }));
    setDraft('');
    try {
      const idMessage = await sendTextMessage(creds, activeChat, text);
      pushLog(`Отправлено (${idMessage}) в ${activeChat}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
      pushLog('Ошибка отправки');
    }
  };

  const pollOnce = useCallback(async () => {
    if (!idInstance.trim() || !apiToken.trim()) return;
    try {
      const n = await receiveOne({ apiUrl, idInstance, apiTokenInstance: apiToken });
      if (!n || !n.receiptId) return;
      const msg = extractTextMessage(n);
      if (msg) {
        setMessages((p) => ({
          ...p,
          [msg.chatId]: [...(p[msg.chatId] || []), msg],
        }));
        setChats((p) => (p.includes(msg.chatId) ? p : [...p, msg.chatId]));
        setActiveChat((a) => a || msg.chatId);
        pushLog(`Входящее от ${msg.chatId}: ${msg.text.slice(0, 60)}`);
      }
      await deleteOne({ apiUrl, idInstance, apiTokenInstance: apiToken }, n.receiptId);
    } catch (e) {
      // не спамим ошибками опроса, только в лог
      pushLog(e instanceof Error ? `poll: ${e.message.slice(0, 120)}` : 'poll error');
    }
  }, [apiUrl, idInstance, apiToken]);

  useEffect(() => {
    if (!polling) return;
    pollOnce();
    timer.current = window.setInterval(pollOnce, 5000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [polling, pollOnce]);

  const activeMessages = activeChat ? messages[activeChat] || [] : [];

  return (
    <div className="max-app">
      <header className="max-header">
        <div className="max-logo">MAX chat · GREEN-API test</div>
        <div className="max-sub">React · только текстовые сообщения · HTTP API polling</div>
      </header>

      <section className="creds">
        <label>
          apiUrl
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} disabled={connected} />
        </label>
        <label>
          idInstance *
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="1101000001"
            disabled={connected}
          />
        </label>
        <label>
          apiTokenInstance *
          <input
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="token"
            type="password"
            disabled={connected}
          />
        </label>
        {!connected ? (
          <button onClick={connect}>Войти</button>
        ) : (
          <button onClick={disconnect} className="ghost">
            Отключиться
          </button>
        )}
      </section>

      {error && <div className="error">{error}</div>}

      <div className="layout">
        <aside className="sidebar">
          <div className="newchat">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Номер: 79991234567"
              disabled={!connected}
            />
            <button onClick={createChat} disabled={!connected}>
              + Чат
            </button>
          </div>
          <div className="chatlist">
            {chats.length === 0 && <div className="empty">Чатов пока нет</div>}
            {chats.map((c) => (
              <button
                key={c}
                className={c === activeChat ? 'chat active' : 'chat'}
                onClick={() => setActiveChat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="hint">
            chatId = телефон@c.us
            <br />
            Отправка: SendMessage
            <br />
            Получение: Receive/DeleteNotification (5с)
          </div>
        </aside>

        <main className="chat">
          {!activeChat ? (
            <div className="empty">Выберите или создайте чат</div>
          ) : (
            <>
              <div className="chat-head">{activeChat}</div>
              <div className="msgs">
                {activeMessages.map((m) => (
                  <div key={m.id} className={m.fromMe ? 'msg me' : 'msg them'}>
                    <div className="bubble">{m.text}</div>
                    <div className="time">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {activeMessages.length === 0 && (
                  <div className="empty">Пока пусто. Напишите первое сообщение.</div>
                )}
              </div>
              <div className="composer">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') send();
                  }}
                  placeholder="Сообщение..."
                  disabled={!connected}
                />
                <button onClick={send} disabled={!connected}>
                  ➤
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <details className="debug">
        <summary>Лог ({log.length})</summary>
        <ul>
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
