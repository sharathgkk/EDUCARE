import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Radio,
  Send,
  Users,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  ChatConnectionState,
  ChatMessage,
  ChatParticipant,
  LanguageCode,
  LiveClassSession,
  UserAccount,
} from '../types';
import { EduCareChatClient } from '../services/chatSdk';
import { speakAloud } from '../utils/speech';

interface ClassroomChatPanelProps {
  currentUser: UserAccount;
  language: LanguageCode;
  liveClasses: LiveClassSession[];
  initialRoomId?: string;
  hideSoundControls?: boolean;
  title?: string;
  subtitle?: string;
}

const STUDENT_QUICK_CHATS = [
  'I have a question about this step.',
  'Could you please repeat that slowly?',
  'May I share my answer in chat?',
  'Thank you, that makes sense!',
];

const TEACHER_QUICK_CHATS = [
  'Welcome to live chat — ask questions anytime.',
  'Take your time — typing or sign glosses are welcome.',
  'Great question! Let us review that step together.',
];

export const ClassroomChatPanel: React.FC<ClassroomChatPanelProps> = ({
  currentUser,
  language,
  liveClasses,
  initialRoomId = 'classroom-general',
  hideSoundControls = false,
  title = 'Live Classroom Chat',
  subtitle = 'Real-time accessible chat between students and teachers with screen-reader & sign-friendly support.',
}) => {
  const roomOptions = useMemo(() => {
    const base = [
      { id: 'classroom-general', label: 'General Inclusive Classroom' },
      { id: 'teacher-support', label: 'Teacher & Student Support Desk' },
    ];
    const seen = new Set(base.map((b) => b.id));
    for (const cls of liveClasses) {
      const cleanId = cls.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanId && !seen.has(cleanId)) {
        seen.add(cleanId);
        base.push({ id: cleanId, label: cls.title });
      }
    }
    return base;
  }, [liveClasses]);

  const [roomId, setRoomId] = useState<string>(initialRoomId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [status, setStatus] = useState<ChatConnectionState>('connecting');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [speakIncoming, setSpeakIncoming] = useState<boolean>(
    !hideSoundControls && currentUser.disabilityProfile === 'blind'
  );

  const sdkRef = useRef<EduCareChatClient | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const speakIncomingRef = useRef<boolean>(speakIncoming);
  speakIncomingRef.current = speakIncoming;
  const languageRef = useRef<LanguageCode>(language);
  languageRef.current = language;
  const hideSoundRef = useRef<boolean>(hideSoundControls);
  hideSoundRef.current = hideSoundControls;

  useEffect(() => {
    const client = new EduCareChatClient(roomId, currentUser, {
      onMessagesChange: setMessages,
      onParticipantsChange: setParticipants,
      onTypingChange: setTypingUsers,
      onStatusChange: setStatus,
      onIncomingMessage: (msg) => {
        if (speakIncomingRef.current && !hideSoundRef.current) {
          speakAloud(`${msg.senderName} says: ${msg.text}`, languageRef.current);
        }
      },
    });
    sdkRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      if (sdkRef.current === client) {
        sdkRef.current = null;
      }
    };
    // Re-initialize SDK only when authenticated user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const handleRoomChange = (nextRoomId: string) => {
    setRoomId(nextRoomId);
    setSendError('');
    sdkRef.current?.joinRoom(nextRoomId);
  };

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || !sdkRef.current) return;

    setSending(true);
    setSendError('');
    setDraft('');
    const sent = await sdkRef.current.sendMessage(clean);
    setSending(false);
    if (!sent) {
      setDraft(clean);
      setSendError('Could not send message right now. Please check your connection and try again.');
    }
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    setSendError('');
    sdkRef.current?.sendTyping(val.trim().length > 0);
  };

  const quickChips =
    currentUser.role === 'teacher' ? TEACHER_QUICK_CHATS : STUDENT_QUICK_CHATS;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const statusMeta =
    status === 'connected'
      ? { label: 'Live Connected', tone: 'text-[#159B83] dark:text-emerald-400', online: true }
      : status === 'reconnecting' || status === 'connecting'
        ? { label: 'Connecting...', tone: 'text-[#C67F21] dark:text-amber-400', online: true }
        : status === 'unauthorized'
          ? { label: 'Sign in to sync live chat', tone: 'text-red-600 dark:text-red-400', online: false }
          : { label: 'Offline (Cached)', tone: 'text-amber-700 dark:text-amber-400', online: false };

  return (
    <section
      aria-labelledby="classroom-chat-heading"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
    >
      {/* Header + Room Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <MessageSquare
              className="w-5 h-5 text-[#1D6CE0] dark:text-sky-400 shrink-0"
              aria-hidden="true"
            />
            <h3
              id="classroom-chat-heading"
              className="text-lg font-bold text-[#153B70] dark:text-slate-100"
            >
              {title}
            </h3>
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusMeta.tone}`}
            >
              {statusMeta.online ? (
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{statusMeta.label}</span>
            </span>
          </div>
          <p className="text-xs text-[#52657C] dark:text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFD] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#153B70] dark:text-slate-200 tabular-nums">
            <Users className="w-3.5 h-3.5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
            <span>
              {Math.max(1, participants.length)} active
            </span>
          </div>

          <label htmlFor="classroom-chat-room" className="sr-only">
            Select Chat Channel
          </label>
          <select
            id="classroom-chat-room"
            value={roomId}
            onChange={(e) => handleRoomChange(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#153B70] dark:text-slate-100 cursor-pointer"
          >
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.label}
              </option>
            ))}
          </select>

          {!hideSoundControls && (
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16253B] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={speakIncoming}
                onChange={(e) => setSpeakIncoming(e.target.checked)}
                className="w-4 h-4 accent-[#159B83]"
              />
              <span>Read new messages</span>
            </label>
          )}
        </div>
      </div>

      {/* Active Participants Strip */}
      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#52657C] dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Radio className="w-3.5 h-3.5 text-[#159B83] dark:text-emerald-400" aria-hidden="true" />
            <span>In room:</span>
          </span>
          {participants.map((p) => (
            <span
              key={p.id}
              className="px-2 py-0.5 rounded-md bg-[#F1F6FC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-[#153B70] dark:text-slate-200"
            >
              {p.name} ({p.role === 'teacher' ? 'Teacher' : 'Student'})
            </span>
          ))}
        </div>
      )}

      {/* Message Thread */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Classroom chat messages"
        className="h-72 overflow-y-auto rounded-xl bg-[#F8FAFD] dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-sm text-[#52657C] dark:text-slate-400">
              No messages in this classroom channel yet. Send a message below to start a live
              conversation with your class.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 border text-sm space-y-1 ${
                    isOwn
                      ? 'bg-[#153B70] dark:bg-sky-700 text-white border-[#153B70] dark:border-sky-600'
                      : 'bg-white dark:bg-slate-900 text-[#16253B] dark:text-slate-100 border-slate-200 dark:border-slate-700'
                  } ${msg.pending ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span
                      className={`font-bold ${
                        isOwn
                          ? 'text-blue-100'
                          : msg.senderRole === 'teacher'
                            ? 'text-[#C67F21] dark:text-amber-300'
                            : 'text-[#159B83] dark:text-emerald-300'
                      }`}
                    >
                      {isOwn ? 'You' : msg.senderName} ·{' '}
                      {msg.senderRole === 'teacher' ? 'Teacher' : 'Student'}
                    </span>
                    <span
                      className={`tabular-nums ${
                        isOwn ? 'text-blue-200' : 'text-[#52657C] dark:text-slate-400'
                      }`}
                    >
                      {msg.pending ? 'Sending...' : formatTime(msg.createdAt)}
                    </span>
                  </div>

                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>

                  {!hideSoundControls && !isOwn && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => speakAloud(`${msg.senderName} wrote: ${msg.text}`, language)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" aria-hidden="true" />
                        <span>Read aloud</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <p className="text-xs font-medium text-[#1E66BE] dark:text-sky-400" aria-live="polite">
          {typingUsers.map((u) => u.userName).join(', ')}{' '}
          {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </p>
      )}

      {/* Quick Accessible Phrases */}
      <div className="flex flex-wrap gap-1.5">
        {quickChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleDraftChange(chip)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:bg-[#E9F4FF] dark:hover:bg-slate-700 text-xs font-medium text-[#153B70] dark:text-slate-200 cursor-pointer transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {sendError && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
        >
          {sendError}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col sm:flex-row gap-2.5">
        <label htmlFor="classroom-chat-input" className="sr-only">
          Type a classroom message
        </label>
        <input
          id="classroom-chat-input"
          type="text"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Type a message for the live classroom..."
          maxLength={1500}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1D6CE0] dark:focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1D6CE0] hover:bg-[#1659BD] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>{sending ? 'Sending...' : 'Send Message'}</span>
        </button>
      </form>
    </section>
  );
};
