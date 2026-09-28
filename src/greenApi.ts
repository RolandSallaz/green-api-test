// GREEN-API MAX (v3) minimal client via HTTP API.
// Docs:
// - Send: POST {apiUrl}/waInstance{id}/sendMessage/{token} {chatId, message}
// - Poll: GET {apiUrl}/waInstance{id}/receiveNotification/{token}
// - Confirm: DELETE {apiUrl}/waInstance{id}/deleteNotification/{token}/{receiptId}

export interface GreenCredentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  type?: string;
}

export function normalizeApiUrl(apiUrl: string): string {
  const v = (apiUrl || '').trim() || 'https://api.green-api.com';
  return v.replace(/\/+$/, '');
}

export function normalizeChatId(input: string): string {
  const v = (input || '').trim();
  if (!v) return v;
  if (v.includes('@')) return v;
  // digits only -> personal chat
  const digits = v.replace(/\D/g, '');
  if (!digits) return v;
  // MAX/WhatsApp personal chat format
  return `${digits}@c.us`;
}

function baseUrl(creds: GreenCredentials): string {
  return `${normalizeApiUrl(creds.apiUrl)}/waInstance${creds.idInstance.trim()}`;
}

export async function sendTextMessage(
  creds: GreenCredentials,
  chatId: string,
  message: string,
): Promise<string> {
  const url = `${baseUrl(creds)}/sendMessage/${creds.apiTokenInstance.trim()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: normalizeChatId(chatId), message }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`SendMessage ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { idMessage?: string };
  if (!data?.idMessage) throw new Error('SendMessage: пустой ответ (нет idMessage)');
  return data.idMessage;
}

interface ReceiveResponse {
  receiptId?: number;
  body?: {
    typeWebhook?: string;
    messageData?: {
      typeMessage?: string;
      textMessageData?: { textMessage?: string };
      extendedTextMessageData?: { text?: string };
    };
    senderData?: { chatId?: string; sender?: string };
    instanceData?: { idInstance?: number };
    timestamp?: number;
    idMessage?: string;
  };
}

export async function receiveOne(
  creds: GreenCredentials,
): Promise<ReceiveResponse | null> {
  const url = `${baseUrl(creds)}/receiveNotification/${creds.apiTokenInstance.trim()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`receiveNotification ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json().catch(() => null)) as ReceiveResponse | null;
  if (!data || !data.receiptId) return null;
  return data;
}

export async function deleteOne(creds: GreenCredentials, receiptId: number): Promise<void> {
  const url = `${baseUrl(creds)}/deleteNotification/${creds.apiTokenInstance.trim()}/${receiptId}`;
  const res = await fetch(url, { method: 'DELETE' });
  // 200 OK expected, ignore body
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`deleteNotification ${res.status}: ${t.slice(0, 200)}`);
  }
}

export function extractTextMessage(n: ReceiveResponse): ChatMessage | null {
  const body = n.body;
  if (!body) return null;
  const type = body.typeWebhook || '';
  const md = body.messageData;
  if (!md) return null;

  let text = '';
  if (md.typeMessage === 'textMessage') text = md.textMessageData?.textMessage || '';
  else if (md.typeMessage === 'extendedTextMessage')
    text = md.extendedTextMessageData?.text || '';
  else return null; // only text per task
  if (!text) return null;

  const chatId =
    body.senderData?.chatId || body.senderData?.sender || 'unknown';
  const fromMe =
    type.toLowerCase().includes('outgoing') ||
    type.toLowerCase().includes('outgoingapimessage');
  return {
    id: body.idMessage || `${Date.now()}-${Math.random()}`,
    chatId,
    text,
    fromMe,
    timestamp: (body.timestamp || Date.now() / 1000) * 1000,
    type,
  };
}
