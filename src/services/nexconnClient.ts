import {
  AreaCode,
  ConnectionStatus,
  ConnectionStatusHandler,
  LogLevel,
  MessageHandler,
  MessageType,
  NCEngine,
  OpenChannel,
  SendTextMessageParams,
  type Message,
} from '@nexconn/chat';
import type { ChatMessage, DisabilityProfile, UserAccount, UserRole } from '../types';
import { apiFetch } from './api';

export type NexconnRegionString = 'SG' | 'NA' | 'SA' | 'BJ' | 'OM';

export interface NexconnRuntimeState {
  configured: boolean;
  initialized: boolean;
  connected: boolean;
  appKey: string | null;
  areaCode: NexconnRegionString;
  nexconnUserId: string | null;
  status: ConnectionStatus;
}

interface NexconnConfigResponse {
  configured?: boolean;
  appKey?: string | null;
  areaCode?: string;
  tokenServerReady?: boolean;
}

interface NexconnTokenResponse {
  configured?: boolean;
  appKey?: string;
  areaCode?: string;
  userId?: string;
  token?: string;
  error?: string;
}

interface NexconnExtraPayload {
  clientMsgId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: UserRole;
  senderProfile?: DisabilityProfile;
  signGlosses?: string[];
}

function mapRegionToAreaCode(region: string | undefined): AreaCode {
  switch ((region || 'SG').trim().toUpperCase()) {
    case 'NA':
    case 'US':
    case 'NORTH_AMERICA':
      return AreaCode.NA;
    case 'SA':
    case 'SOUTH_AMERICA':
    case 'SAU':
      return AreaCode.SA;
    case 'BJ':
    case 'CN':
      return AreaCode.BJ;
    case 'OM':
      return AreaCode.OM;
    case 'SG':
    default:
      return AreaCode.SG;
  }
}

function normalizeRegionString(region: string | undefined): NexconnRegionString {
  switch ((region || 'SG').trim().toUpperCase()) {
    case 'NA':
    case 'US':
    case 'NORTH_AMERICA':
      return 'NA';
    case 'SA':
    case 'SOUTH_AMERICA':
    case 'SAU':
      return 'SA';
    case 'BJ':
    case 'CN':
      return 'BJ';
    case 'OM':
      return 'OM';
    case 'SG':
    default:
      return 'SG';
  }
}

let initializedAppKey: string | null = null;
let initializedAreaCode: NexconnRegionString = 'SG';
let connectedEduCareUserId: string | null = null;
let connectPromise: Promise<boolean> | null = null;
let currentConnectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
let handlersRegistered = false;

const activeOpenChannels = new Map<string, OpenChannel>();
const roomListeners = new Map<string, Set<(msg: ChatMessage) => void>>();

function sanitizeChannelId(roomId: string): string {
  const cleaned = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'classroom-general';
}

function registerCoreHandlersOnce(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  NCEngine.addConnectionStatusHandler(
    'educare-main-connection',
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        currentConnectionStatus = status;
      },
    })
  );

  NCEngine.addMessageHandler(
    'educare-main-messages',
    new MessageHandler({
      onMessageReceived({ messages }) {
        for (const rawMsg of messages) {
          const parsed = convertNexconnMessage(rawMsg);
          if (!parsed) continue;
          const listeners = roomListeners.get(parsed.roomId);
          if (!listeners || listeners.size === 0) continue;
          for (const cb of listeners) {
            try {
              cb(parsed);
            } catch {
              // Ignore listener errors
            }
          }
        }
      },
    })
  );
}

function convertNexconnMessage(rawMsg: Message<Record<string, unknown>>): ChatMessage | null {
  if (!rawMsg || rawMsg.messageType !== MessageType.TEXT) {
    return null;
  }

  const content = (rawMsg.content || {}) as {
    text?: unknown;
    extra?: unknown;
    senderUserInfo?: { userId?: unknown; name?: unknown };
  };

  const text = typeof content.text === 'string' ? content.text.trim() : '';
  if (!text) return null;

  let meta: NexconnExtraPayload = {};
  if (typeof content.extra === 'string' && content.extra.trim()) {
    try {
      meta = JSON.parse(content.extra) as NexconnExtraPayload;
    } catch {
      meta = {};
    }
  }

  const roomId = sanitizeChannelId(rawMsg.channelIdentifier?.channelId || 'classroom-general');
  const id =
    typeof meta.clientMsgId === 'string' && meta.clientMsgId.trim()
      ? meta.clientMsgId.trim()
      : `nc-${rawMsg.messageId || Date.now()}`;

  const senderId =
    typeof meta.senderId === 'string' && meta.senderId.trim()
      ? meta.senderId
      : rawMsg.senderUserId ||
        (typeof content.senderUserInfo?.userId === 'string' ? content.senderUserInfo.userId : 'peer');

  const senderName =
    typeof meta.senderName === 'string' && meta.senderName.trim()
      ? meta.senderName
      : typeof content.senderUserInfo?.name === 'string' && content.senderUserInfo.name.trim()
        ? content.senderUserInfo.name
        : 'Classroom Member';

  const senderRole: UserRole = meta.senderRole === 'teacher' ? 'teacher' : 'student';

  return {
    id,
    roomId,
    senderId,
    senderName,
    senderRole,
    senderProfile: meta.senderProfile,
    text,
    signGlosses:
      Array.isArray(meta.signGlosses) && meta.signGlosses.length > 0
        ? meta.signGlosses.filter((g): g is string => typeof g === 'string')
        : undefined,
    createdAt: new Date(rawMsg.sentTime || Date.now()).toISOString(),
    pending: false,
  };
}

export function ensureNexconnInitialized(appKey: string, region?: string): boolean {
  const cleanKey = appKey.trim();
  if (!cleanKey) return false;
  if (initializedAppKey) {
    return true;
  }

  const normalizedRegion = normalizeRegionString(region);
  try {
    NCEngine.initialize({
      appKey: cleanKey,
      areaCode: mapRegionToAreaCode(normalizedRegion),
      logLevel: LogLevel.WARN,
    });
    initializedAppKey = cleanKey;
    initializedAreaCode = normalizedRegion;
    registerCoreHandlersOnce();
    return true;
  } catch (err) {
    console.warn('Nexconn NCEngine.initialize skipped or failed:', err);
    return false;
  }
}

export async function bootstrapNexconnSession(user: UserAccount): Promise<NexconnRuntimeState> {
  if (typeof window === 'undefined' || !user?.id) {
    return getNexconnRuntimeState();
  }

  // If browser build already has VITE_NEXCONN_APP_KEY, initialize engine immediately once.
  const viteAppKey = (import.meta.env.VITE_NEXCONN_APP_KEY || '').trim();
  const viteAreaCode = (import.meta.env.VITE_NEXCONN_AREA_CODE || 'SG').trim();
  if (viteAppKey) {
    ensureNexconnInitialized(viteAppKey, viteAreaCode);
  }

  if (
    connectedEduCareUserId === user.id &&
    NCEngine.getConnectionStatus() === ConnectionStatus.CONNECTED
  ) {
    return getNexconnRuntimeState();
  }

  if (connectPromise) {
    await connectPromise;
    return getNexconnRuntimeState();
  }

  connectPromise = (async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return false;
      }

      const cfgRes = await apiFetch('/api/nexconn/config', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!cfgRes.ok) {
        return false;
      }

      const cfg = (await cfgRes.json()) as NexconnConfigResponse;
      const resolvedAppKey = (cfg.appKey || viteAppKey || '').trim();
      const resolvedAreaCode = normalizeRegionString(cfg.areaCode || viteAreaCode);

      if (!resolvedAppKey) {
        return false;
      }

      ensureNexconnInitialized(resolvedAppKey, resolvedAreaCode);

      if (!cfg.tokenServerReady) {
        return false;
      }

      const tokenRes = await apiFetch('/api/nexconn/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!tokenRes.ok) {
        return false;
      }

      const tokenData = (await tokenRes.json()) as NexconnTokenResponse;
      if (!tokenData.token) {
        return false;
      }

      // If another EduCare user was connected earlier in the same tab, disconnect first
      if (connectedEduCareUserId && connectedEduCareUserId !== user.id) {
        await disconnectNexconnSession();
        ensureNexconnInitialized(resolvedAppKey, resolvedAreaCode);
      }

      const result = await NCEngine.connect({ token: tokenData.token });
      if (result.isOk) {
        connectedEduCareUserId = user.id;
        currentConnectionStatus = NCEngine.getConnectionStatus();
        return true;
      }

      console.warn('Nexconn connect returned non-OK code:', result.code, result.msg);
      return false;
    } catch {
      return false;
    } finally {
      connectPromise = null;
    }
  })();

  await connectPromise;
  return getNexconnRuntimeState();
}

export async function disconnectNexconnSession(): Promise<void> {
  for (const channel of activeOpenChannels.values()) {
    try {
      await channel.exitChannel();
    } catch {
      // Ignore exit failure during disconnect
    }
  }
  activeOpenChannels.clear();
  connectedEduCareUserId = null;

  if (!initializedAppKey) return;
  try {
    await NCEngine.disconnect();
  } catch {
    // Ignore disconnect errors if already disconnected
  } finally {
    currentConnectionStatus = ConnectionStatus.DISCONNECTED;
  }
}

export async function joinNexconnOpenChannel(roomId: string): Promise<ChatMessage[]> {
  if (!initializedAppKey) return [];
  if (NCEngine.getConnectionStatus() !== ConnectionStatus.CONNECTED) return [];

  const channelId = sanitizeChannelId(roomId);
  let channel = activeOpenChannels.get(channelId);
  if (!channel) {
    channel = new OpenChannel(channelId);
    const enterResult = await channel.enterChannel({ messageCount: 20 });
    if (!enterResult.isOk) {
      return [];
    }
    activeOpenChannels.set(channelId, channel);
  }

  try {
    const query = OpenChannel.createOpenChannelMessagesQuery({
      channelId,
      pageSize: 30,
    });
    const page = await query.loadNextPage();
    if (!page.isOk || !page.data?.data) return [];
    const converted: ChatMessage[] = [];
    for (const rawMsg of page.data.data) {
      const msg = convertNexconnMessage(rawMsg as Message<Record<string, unknown>>);
      if (msg) converted.push(msg);
    }
    return converted;
  } catch {
    return [];
  }
}

export async function exitNexconnOpenChannel(roomId: string): Promise<void> {
  const channelId = sanitizeChannelId(roomId);
  const channel = activeOpenChannels.get(channelId);
  if (!channel) return;
  activeOpenChannels.delete(channelId);
  try {
    await channel.exitChannel();
  } catch {
    // Ignore exit failure
  }
}

export function subscribeNexconnMessages(
  roomId: string,
  callback: (message: ChatMessage) => void
): () => void {
  const channelId = sanitizeChannelId(roomId);
  if (!roomListeners.has(channelId)) {
    roomListeners.set(channelId, new Set());
  }
  const set = roomListeners.get(channelId)!;
  set.add(callback);
  return () => {
    set.delete(callback);
    if (set.size === 0) {
      roomListeners.delete(channelId);
    }
  };
}

export async function sendNexconnOpenChannelText(
  roomId: string,
  text: string,
  user: UserAccount,
  clientMsgId: string,
  signGlosses?: string[]
): Promise<boolean> {
  if (!initializedAppKey) return false;
  if (NCEngine.getConnectionStatus() !== ConnectionStatus.CONNECTED) return false;

  const channelId = sanitizeChannelId(roomId);
  let channel = activeOpenChannels.get(channelId);
  if (!channel) {
    channel = new OpenChannel(channelId);
    const entered = await channel.enterChannel({ messageCount: 20 });
    if (!entered.isOk) return false;
    activeOpenChannels.set(channelId, channel);
  }

  const extraPayload: NexconnExtraPayload = {
    clientMsgId,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    senderProfile: user.disabilityProfile,
    signGlosses: signGlosses && signGlosses.length > 0 ? signGlosses : undefined,
  };

  try {
    const params = new SendTextMessageParams({
      text,
      senderUserInfo: {
        userId: user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'educareUser1',
        name: user.name,
      },
      extra: JSON.stringify(extraPayload),
    });

    const result = await channel.sendMessage(params);
    return result.isOk;
  } catch {
    return false;
  }
}

export function getNexconnRuntimeState(): NexconnRuntimeState {
  const status = initializedAppKey
    ? NCEngine.getConnectionStatus()
    : currentConnectionStatus;
  const userId = initializedAppKey ? NCEngine.getCurrentUserId() || null : null;

  return {
    configured: Boolean(initializedAppKey || (import.meta.env.VITE_NEXCONN_APP_KEY || '').trim()),
    initialized: Boolean(initializedAppKey),
    connected: status === ConnectionStatus.CONNECTED,
    appKey: initializedAppKey || (import.meta.env.VITE_NEXCONN_APP_KEY || '').trim() || null,
    areaCode: initializedAreaCode,
    nexconnUserId: userId,
    status,
  };
}
