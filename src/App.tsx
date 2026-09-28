import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Container,
  Flex,
  Grid,
  Input,
  Typography,
} from '@maxhub/max-ui';
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
      const creds: GreenCredentials = { apiUrl, idInstance, apiTokenInstance: apiToken };
      const idMessage = await sendTextMessage(creds, activeChat, text);
      pushLog(`Отправлено (${idMessage}) в ${activeChat}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
      pushLog('Ошибка отправки');
    }
  };

  const pollOnce = useCallback(async () => {
    if (!idInstance.trim() || !apiToken.trim()) return;
    const creds: GreenCredentials = { apiUrl, idInstance, apiTokenInstance: apiToken };
    try {
      const n = await receiveOne(creds);
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
      await deleteOne(creds, n.receiptId);
    } catch (e) {
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
    <div className="max-panel">
      <Container className="max-container">
        <Flex direction="column" gap={12}>
          <Flex align="center" gap={12}>
            <Avatar.Container size={48} form="circle">
              <Avatar.Text>MX</Avatar.Text>
            </Avatar.Container>
            <Flex direction="column" gap={2}>
              <Typography.Title>MAX chat</Typography.Title>
              <Typography.Body>GREEN-API · только текст · HTTP API</Typography.Body>
            </Flex>
          </Flex>

          <Grid cols={4} gap={8}>
            <Input
              mode="default"
              placeholder="apiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.currentTarget.value)}
              disabled={connected}
            />
            <Input
              mode="default"
              placeholder="idInstance *"
              value={idInstance}
              onChange={(e) => setIdInstance(e.currentTarget.value)}
              disabled={connected}
            />
            <Input
              mode="default"
              placeholder="apiTokenInstance *"
              value={apiToken}
              onChange={(e) => setApiToken(e.currentTarget.value)}
              disabled={connected}
            />
            {!connected ? (
              <Button variant="primary" size="medium" stretched onClick={connect}>
                Войти
              </Button>
            ) : (
              <Button variant="secondary" size="medium" stretched onClick={disconnect}>
                Отключиться
              </Button>
            )}
          </Grid>

          {error && <Typography.Body className="max-error">{error}</Typography.Body>}

          <Grid cols={2} gap={12} className="max-layout">
            <Flex direction="column" gap={8}>
              <Flex gap={8}>
                <Input
                  mode="default"
                  placeholder="Номер: 79991234567"
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  disabled={!connected}
                />
                <Button variant="primary" size="medium" onClick={createChat} disabled={!connected}>
                  + Чат
                </Button>
              </Flex>
              <Flex direction="column" gap={6}>
                {chats.length === 0 && (
                  <Typography.Body>Чатов пока нет</Typography.Body>
                )}
                {chats.map((c) => (
                  <Button
                    key={c}
                    variant={c === activeChat ? 'primary' : 'secondary'}
                    size="medium"
                    stretched
                    onClick={() => setActiveChat(c)}
                  >
                    {c}
                  </Button>
                ))}
              </Flex>
              <Typography.Body className="max-hint">
                chatId = телефон@c.us · SendMessage · Receive/DeleteNotification (5с)
              </Typography.Body>
            </Flex>

            <Flex direction="column" gap={8} className="max-chat">
              <Typography.Title>{activeChat || 'Выберите или создайте чат'}</Typography.Title>
              <Flex direction="column" gap={6} className="max-msgs">
                {activeMessages.map((m) => (
                  <Container
                    key={m.id}
                    className={m.fromMe ? 'max-bubble me' : 'max-bubble them'}
                  >
                    <Typography.Body>{m.text}</Typography.Body>
                    <Typography.Label className="max-time">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </Typography.Label>
                  </Container>
                ))}
                {activeChat !== '' && activeMessages.length === 0 && (
                  <Typography.Body>Пока пусто. Напишите первое сообщение.</Typography.Body>
                )}
              </Flex>
              <Flex gap={8}>
                <Input
                  mode="default"
                  placeholder="Сообщение..."
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') send();
                  }}
                  disabled={!connected || !activeChat}
                />
                <Button variant="primary" onClick={send} disabled={!connected || !activeChat}>
                  ➤
                </Button>
              </Flex>
            </Flex>
          </Grid>

          <details className="debug">
            <summary>Лог ({log.length})</summary>
            <ul>
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        </Flex>
      </Container>
    </div>
  );
}
