import type { ChatConnectionState, ChatMessage, ChatParticipant, UserAccount } from '../types';
import { apiFetch, apiWebSocketUrl } from './api';
import {
  bootstrapNexconnSession,
  exitNexconnOpenChannel,
  joinNexconnOpenChannel,
  sendNexconnOpenChannelText,
  subscribeNexconnMessages,
} from './nexconnClient';

export interface ChatSdkCallbacks {
  onMessagesChange: (messages: ChatMessage[]) => void;
  onParticipantsChange: (participants: ChatParticipant[]) => void;
  onTypingChange: (typingUsers: Array<{ userId: string; userName: string }>) => void;
  onStatusChange: (status: ChatConnectionState) => void;
  onIncomingMessage?: (message: ChatMessage) => void;
}

type ServerChatEvent =
  | {
      type: 'chat:sync';
      roomId: string;
      messages: ChatMessage[];
      participants: ChatParticipant[];
    }
  | {
      type: 'chat:message';
      roomId: string;
      message: ChatMessage;
    }
  | {
      type: 'chat:presence';
      roomId: string;
      participants: ChatParticipant[];
    }
  | {
      type: 'chat:typing';
      roomId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }
  | {
      type: 'chat:pong';
      ts: number;
    };

export class EduCareChatClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private currentUser: UserAccount;
  private callbacks: ChatSdkCallbacks;
  private messages: ChatMessage[] = [];
  private participants: ChatParticipant[] = [];
  private typingMap = new Map<string, { userName: string; expiresAt: number }>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private typingCleanupTimer: number | null = null;
  private nexconnUnsub: (() => void) | null = null;
  private disposed = false;

  constructor(initialRoomId: string, currentUser: UserAccount, callbacks: ChatSdkCallbacks) {
    this.roomId = initialRoomId || 'classroom-general';
    this.currentUser = currentUser;
    this.callbacks = callbacks;
  }

  public connect(): void {
    this.disposed = false;
    void this.syncFromRest(this.roomId);
    this.openSocket();
    void this.attachNexconnRoom(this.roomId);

    this.typingCleanupTimer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [uid, info] of this.typingMap.entries()) {
        if (info.expiresAt <= now) {
          this.typingMap.delete(uid);
          changed = true;
        }
      }
      if (changed) {
        this.emitTyping();
      }
    }, 1000);
  }

  public disconnect(): void {
    this.disposed = true;
    this.clearTimers();
    if (this.nexconnUnsub) {
      this.nexconnUnsub();
      this.nexconnUnsub = null;
    }
    void exitNexconnOpenChannel(this.roomId);
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }

  public joinRoom(nextRoomId: string): void {
    const clean = nextRoomId.trim() || 'classroom-general';
    if (clean === this.roomId && this.ws?.readyState === WebSocket.OPEN) return;

    const prevRoom = this.roomId;
    this.roomId = clean;
    this.messages = [];
    this.participants = [];
    this.typingMap.clear();
    this.callbacks.onMessagesChange([]);
    this.callbacks.onParticipantsChange([]);
    this.emitTyping();

    if (prevRoom && prevRoom !== clean) {
      void exitNexconnOpenChannel(prevRoom);
    }

    void this.syncFromRest(clean);
    void this.attachNexconnRoom(clean);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat:join', roomId: clean }));
    } else if (!this.disposed) {
      this.openSocket();
    }
  }

  private async attachNexconnRoom(roomId: string): Promise<void> {
    if (this.nexconnUnsub) {
      this.nexconnUnsub();
      this.nexconnUnsub = null;
    }

    this.nexconnUnsub = subscribeNexconnMessages(roomId, (incoming) => {
      if (this.disposed || this.roomId !== roomId) return;
      this.upsertMessage(incoming, true);
    });

    const state = await bootstrapNexconnSession(this.currentUser);
    if (this.disposed || !state.connected || this.roomId !== roomId) {
      return;
    }

    const ncHistory = await joinNexconnOpenChannel(roomId);
    if (!this.disposed && this.roomId === roomId && ncHistory.length > 0) {
      this.reconcileList([...this.messages, ...ncHistory]);
    }
  }

  public sendTyping(isTyping: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'chat:typing',
          roomId: this.roomId,
          isTyping,
        })
      );
    }
  }

  public async sendMessage(rawText: string, signGlosses?: string[]): Promise<ChatMessage | null> {
    const text = rawText.trim();
    if (!text) return null;

    const msgId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `msg-${crypto.randomUUID()}`
        : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const optimistic: ChatMessage = {
      id: msgId,
      roomId: this.roomId,
      senderId: this.currentUser.id,
      senderName: this.currentUser.name,
      senderRole: this.currentUser.role,
      senderProfile: this.currentUser.disabilityProfile,
      text,
      signGlosses: signGlosses && signGlosses.length > 0 ? signGlosses : undefined,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    this.upsertMessage(optimistic, false);
    this.sendTyping(false);

    // Mirror over Nexconn OpenChannel when NEXCONN_APP_KEY + token are active
    void sendNexconnOpenChannelText(
      this.roomId,
      text,
      this.currentUser,
      msgId,
      signGlosses
    );

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'chat:send',
          id: msgId,
          roomId: this.roomId,
          text,
          signGlosses,
        })
      );
      return optimistic;
    }

    try {
      const res = await apiFetch(
        `/api/chat/rooms/${encodeURIComponent(this.roomId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: msgId, text, signGlosses }),
        }
      );
      if (!res.ok) {
        this.removeMessage(msgId);
        return null;
      }
      const data = (await res.json()) as { message?: ChatMessage };
      if (data.message) {
        this.upsertMessage({ ...data.message, pending: false }, false);
        return data.message;
      }
      return optimistic;
    } catch {
      this.removeMessage(msgId);
      return null;
    }
  }

  private async syncFromRest(roomId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.callbacks.onStatusChange('offline');
      return;
    }
    try {
      const res = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        this.callbacks.onStatusChange('unauthorized');
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as {
        roomId?: string;
        messages?: ChatMessage[];
        participants?: ChatParticipant[];
      };
      if (this.disposed || roomId !== this.roomId) return;
      if (Array.isArray(data.messages)) {
        this.reconcileList(data.messages);
      }
      if (Array.isArray(data.participants) && data.participants.length > 0) {
        this.participants = data.participants;
        this.callbacks.onParticipantsChange(this.participants);
      }
    } catch {
      // Keep existing local messages when offline
    }
  }

  private openSocket(): void {
    if (this.disposed || typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.callbacks.onStatusChange('offline');
      this.scheduleReconnect();
      return;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }

    this.callbacks.onStatusChange(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const wsUrl = apiWebSocketUrl('/ws/chat');
    wsUrl.searchParams.set('roomId', this.roomId);

    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      if (this.disposed || this.ws !== socket) return;
      this.reconnectAttempts = 0;
      this.callbacks.onStatusChange('connected');
      if (this.pingTimer !== null) {
        window.clearInterval(this.pingTimer);
      }
      this.pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'chat:ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      if (this.disposed || this.ws !== socket) return;
      try {
        const data = JSON.parse(String(event.data)) as ServerChatEvent;
        if (data.type === 'chat:sync' && data.roomId === this.roomId) {
          this.reconcileList(data.messages);
          this.participants = data.participants;
          this.callbacks.onParticipantsChange(this.participants);
          return;
        }
        if (data.type === 'chat:presence' && data.roomId === this.roomId) {
          this.participants = data.participants;
          this.callbacks.onParticipantsChange(this.participants);
          return;
        }
        if (data.type === 'chat:typing' && data.roomId === this.roomId) {
          if (data.userId === this.currentUser.id) return;
          if (data.isTyping) {
            this.typingMap.set(data.userId, {
              userName: data.userName,
              expiresAt: Date.now() + 4000,
            });
          } else {
            this.typingMap.delete(data.userId);
          }
          this.emitTyping();
          return;
        }
        if (data.type === 'chat:message' && data.roomId === this.roomId) {
          this.upsertMessage({ ...data.message, pending: false }, true);
        }
      } catch {
        // Ignore malformed server payload
      }
    };

    socket.onclose = (event) => {
      if (this.ws === socket) {
        this.ws = null;
      }
      if (this.pingTimer !== null) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.disposed) return;
      if (event.code === 1008 || event.code === 4401) {
        this.callbacks.onStatusChange('unauthorized');
        return;
      }
      this.callbacks.onStatusChange(
        typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting'
      );
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose handles reconnect
    };
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== null) return;
    const delayMs = Math.min(10000, 1000 * Math.pow(1.6, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.disposed) {
        this.openSocket();
      }
    }, delayMs);
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.typingCleanupTimer !== null) {
      window.clearInterval(this.typingCleanupTimer);
      this.typingCleanupTimer = null;
    }
  }

  private reconcileList(incoming: ChatMessage[]): void {
    const byId = new Map<string, ChatMessage>();
    for (const msg of this.messages) {
      if (msg.pending) {
        byId.set(msg.id, msg);
      }
    }
    for (const msg of incoming) {
      byId.set(msg.id, { ...msg, pending: false });
    }
    this.messages = Array.from(byId.values()).sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
    this.callbacks.onMessagesChange([...this.messages]);
  }

  private upsertMessage(msg: ChatMessage, notifyIncoming: boolean): void {
    const idx = this.messages.findIndex((m) => m.id === msg.id);
    const isBrandNew = idx === -1;
    if (isBrandNew) {
      this.messages = [...this.messages, msg];
    } else {
      const next = [...this.messages];
      next[idx] = msg;
      this.messages = next;
    }
    this.callbacks.onMessagesChange([...this.messages]);
    if (
      notifyIncoming &&
      isBrandNew &&
      msg.senderId !== this.currentUser.id
    ) {
      this.callbacks.onIncomingMessage?.(msg);
    }
  }

  private removeMessage(msgId: string): void {
    this.messages = this.messages.filter((m) => m.id !== msgId);
    this.callbacks.onMessagesChange([...this.messages]);
  }

  private emitTyping(): void {
    const active = Array.from(this.typingMap.entries()).map(([userId, info]) => ({
      userId,
      userName: info.userName,
    }));
    this.callbacks.onTypingChange(active);
  }
}
