import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  Avatar,
  ChatContainer,
  Conversation,
  ConversationHeader,
  ConversationList,
  MainContainer,
  Message,
  MessageInput,
  MessageList,
  MessageSeparator,
  Sidebar,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react';
import { Bot, Hand, Users, Volume2, Wifi, WifiOff } from 'lucide-react';
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
import type { SignActionCue } from './LiveSignClassroomTools';

export interface TutorConversationTurn {
  id: string;
  question: string;
  answer: string;
  signSteps?: SignActionCue[];
  createdAt: string;
}

interface TutorChatSdkProps {
  currentUser: UserAccount;
  language: LanguageCode;
  liveClasses: LiveClassSession[];
  aiHistory: TutorConversationTurn[];
  aiLoading: boolean;
  aiWelcomeText: string;
  signLanguageMode?: boolean;
  hideSoundControls?: boolean;
  draft: string;
  onDraftChange: (next: string) => void;
  onSendAiMessage: (text: string) => Promise<void>;
  onResetAiChat: () => void;
  onReplaySignTurn?: (turn: TutorConversationTurn) => void;
  activeChannelRequest?: { id: string; nonce: number } | null;
}

const AI_CHANNEL_ID = 'ai-tutor';

function createInitialsAvatarUri(initials: string, bgHex: string, fgHex = '#ffffff'): string {
  const clean = initials.slice(0, 2).toUpperCase() || 'EC';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bgHex}"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="${fgHex}">${clean}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`;
}

function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const STUDENT_QUICK_CHAT = [
  'Could a teacher explain this question step by step?',
  'I need help understanding this concept.',
  'Thank you!',
];

const TEACHER_QUICK_CHAT = [
  'Hello everyone — feel free to ask questions here.',
  'Let us review this topic together step by step.',
  'Great question! Here is a quick clarification.',
];

export const TutorChatSdk: React.FC<TutorChatSdkProps> = ({
  currentUser,
  language,
  liveClasses,
  aiHistory,
  aiLoading,
  aiWelcomeText,
  signLanguageMode = false,
  hideSoundControls = false,
  draft,
  onDraftChange,
  onSendAiMessage,
  onResetAiChat,
  onReplaySignTurn,
  activeChannelRequest = null,
}) => {
  const liveChannels = useMemo(() => {
    const base = [
      {
        id: 'classroom-general',
        name: 'Student & Teacher Chat',
        subtitle: 'Inclusive live classroom channel',
        initials: 'ST',
        color: '#159B83',
      },
      {
        id: 'teacher-support',
        name: 'Teacher Support Desk',
        subtitle: 'Direct help from teachers',
        initials: 'TS',
        color: '#DF922C',
      },
    ];
    const seen = new Set(base.map((b) => b.id));
    for (const cls of liveClasses) {
      const cleanId = cls.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanId && !seen.has(cleanId)) {
        seen.add(cleanId);
        base.push({
          id: cleanId,
          name: cls.title,
          subtitle: cls.teacherName ? `With ${cls.teacherName}` : 'Live class chat',
          initials: getInitials(cls.title),
          color: '#1D6CE0',
        });
      }
    }
    return base;
  }, [liveClasses]);

  const [activeChannelId, setActiveChannelId] = useState<string>(AI_CHANNEL_ID);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Real-time WebSocket Classroom Chat state
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [wsStatus, setWsStatus] = useState<ChatConnectionState>('connecting');
  const [liveDraft, setLiveDraft] = useState<string>('');
  const [liveError, setLiveError] = useState<string>('');
  const [speakIncomingLive, setSpeakIncomingLive] = useState<boolean>(
    !hideSoundControls && currentUser.disabilityProfile === 'blind'
  );

  const sdkRef = useRef<EduCareChatClient | null>(null);
  const activeChannelRef = useRef<string>(activeChannelId);
  activeChannelRef.current = activeChannelId;
  const speakIncomingRef = useRef<boolean>(speakIncomingLive);
  speakIncomingRef.current = speakIncomingLive;
  const hideSoundRef = useRef<boolean>(hideSoundControls);
  hideSoundRef.current = hideSoundControls;
  const languageRef = useRef<LanguageCode>(language);
  languageRef.current = language;
  const lastChannelReqNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeChannelRequest) return;
    if (activeChannelRequest.nonce === lastChannelReqNonceRef.current) return;
    lastChannelReqNonceRef.current = activeChannelRequest.nonce;
    setActiveChannelId(activeChannelRequest.id);
    if (activeChannelRequest.id !== AI_CHANNEL_ID) {
      sdkRef.current?.joinRoom(activeChannelRequest.id);
    }
  }, [activeChannelRequest]);

  // Connect real-time EduCareChatClient WebSocket SDK for Student-Teacher chat
  useEffect(() => {
    const initialLiveRoom = liveChannels[0]?.id || 'classroom-general';
    const client = new EduCareChatClient(initialLiveRoom, currentUser, {
      onMessagesChange: setLiveMessages,
      onParticipantsChange: setParticipants,
      onTypingChange: setTypingUsers,
      onStatusChange: setWsStatus,
      onIncomingMessage: (msg) => {
        if (
          activeChannelRef.current !== AI_CHANNEL_ID &&
          speakIncomingRef.current &&
          !hideSoundRef.current
        ) {
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
    // Re-initialize WebSocket session only when authenticated user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setSidebarOpen(false);
    setLiveError('');
    if (channelId !== AI_CHANNEL_ID) {
      sdkRef.current?.joinRoom(channelId);
    }
  };

  const isAiChannel = activeChannelId === AI_CHANNEL_ID;
  const currentLiveChannel =
    liveChannels.find((c) => c.id === activeChannelId) ?? liveChannels[0];

  const aiAvatar = useMemo(
    () => createInitialsAvatarUri('AI', signLanguageMode ? '#0D9488' : '#1D6CE0'),
    [signLanguageMode]
  );

  const handleSend = (_innerHtml: string, textContent: string) => {
    const clean = textContent.trim();
    if (!clean) return;

    if (isAiChannel) {
      onDraftChange('');
      void onSendAiMessage(clean);
      return;
    }

    if (!sdkRef.current) return;
    setLiveError('');
    setLiveDraft('');
    void sdkRef.current.sendMessage(clean).then((sent) => {
      if (!sent) {
        setLiveDraft(clean);
        setLiveError('Unable to send message right now. Please check your connection.');
      }
    });
  };

  const handleInputChange = (_innerHtml: string, textContent: string) => {
    if (isAiChannel) {
      onDraftChange(textContent);
      return;
    }
    setLiveDraft(textContent);
    setLiveError('');
    sdkRef.current?.sendTyping(textContent.trim().length > 0);
  };

  const statusMeta =
    wsStatus === 'connected'
      ? { label: 'Live Connected', online: true }
      : wsStatus === 'reconnecting' || wsStatus === 'connecting'
        ? { label: 'Connecting...', online: true }
        : wsStatus === 'unauthorized'
          ? { label: 'Sign in required', online: false }
          : { label: 'Offline (Cached)', online: false };

  const orderedAiTurns = useMemo(() => [...aiHistory].reverse(), [aiHistory]);
  const quickChips =
    currentUser.role === 'teacher' ? TEACHER_QUICK_CHAT : STUDENT_QUICK_CHAT;

  return (
    <div className="space-y-3">
      {/* Accessible Channel Switcher Strip (also keeps mobile & screen-reader navigation effortless) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Tutor and classroom chat channels"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isAiChannel}
            onClick={() => handleSelectChannel(AI_CHANNEL_ID)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              isAiChannel
                ? 'bg-[#153B70] dark:bg-sky-700 text-white border-[#153B70] dark:border-sky-600'
                : 'bg-[#F8FAFD] dark:bg-slate-800 text-[#153B70] dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-[#E9F4FF] dark:hover:bg-slate-700'
            }`}
          >
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            <span>AI Tutor Chat</span>
          </button>

          {liveChannels.map((ch) => {
            const active = activeChannelId === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectChannel(ch.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#159B83] text-white border-[#159B83]'
                    : 'bg-[#F8FAFD] dark:bg-slate-800 text-[#153B70] dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-[#E8F7F4] dark:hover:bg-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {!isAiChannel && (
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1 font-semibold ${
                statusMeta.online
                  ? 'text-[#159B83] dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {statusMeta.online ? (
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{statusMeta.label}</span>
            </span>
          )}
          {isAiChannel && aiHistory.length > 0 && (
            <button
              type="button"
              onClick={onResetAiChat}
              className="text-xs font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer"
            >
              New AI Chat
            </button>
          )}
        </div>
      </div>

      {/* Chatscope React Chat SDK Container */}
      <div className="educare-chat-sdk relative h-[480px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <MainContainer responsive>
          <Sidebar
            position="left"
            scrollable
            className={sidebarOpen ? 'educare-chat-sidebar-open' : ''}
          >
            <ConversationList>
              <Conversation
                name="AI Personal Tutor"
                lastSenderName="AI Tutor"
                info={
                  aiHistory[0]?.question
                    ? aiHistory[0].question
                    : 'Multi-turn subject helper'
                }
                active={isAiChannel}
                onClick={() => handleSelectChannel(AI_CHANNEL_ID)}
              >
                <Avatar
                  src={aiAvatar}
                  name="AI Personal Tutor"
                  status="available"
                />
              </Conversation>

              {liveChannels.map((ch) => (
                <Conversation
                  key={ch.id}
                  name={ch.name}
                  info={ch.subtitle}
                  active={activeChannelId === ch.id}
                  onClick={() => handleSelectChannel(ch.id)}
                >
                  <Avatar
                    src={createInitialsAvatarUri(ch.initials, ch.color)}
                    name={ch.name}
                    status={wsStatus === 'connected' ? 'available' : 'away'}
                  />
                </Conversation>
              ))}
            </ConversationList>
          </Sidebar>

          <ChatContainer>
            <ConversationHeader>
              <ConversationHeader.Back
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle chat channels list"
              />
              <Avatar
                src={
                  isAiChannel
                    ? aiAvatar
                    : createInitialsAvatarUri(
                        currentLiveChannel.initials,
                        currentLiveChannel.color
                      )
                }
                name={isAiChannel ? 'AI Personal Tutor' : currentLiveChannel.name}
                status={
                  isAiChannel
                    ? 'available'
                    : wsStatus === 'connected'
                      ? 'available'
                      : 'away'
                }
              />
              <ConversationHeader.Content
                userName={
                  isAiChannel ? 'AI Personal Tutor' : currentLiveChannel.name
                }
                info={
                  isAiChannel
                    ? signLanguageMode
                      ? 'Sign Language & Visual AI Chat'
                      : 'Voice + Multi-Turn Text Chat'
                    : `${Math.max(1, participants.length)} active · Real-time Student–Teacher Chat`
                }
              />
              <ConversationHeader.Actions>
                {!isAiChannel && !hideSoundControls && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16253B] dark:text-slate-200 cursor-pointer pr-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={speakIncomingLive}
                      onChange={(e) => setSpeakIncomingLive(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#159B83]"
                    />
                    <span className="hidden sm:inline">Speak incoming</span>
                  </label>
                )}
              </ConversationHeader.Actions>
            </ConversationHeader>

            <MessageList
              autoScrollToBottom
              autoScrollToBottomOnMount
              scrollBehavior="smooth"
              typingIndicator={
                isAiChannel && aiLoading ? (
                  <TypingIndicator content="AI Tutor is preparing an explanation" />
                ) : !isAiChannel && typingUsers.length > 0 ? (
                  <TypingIndicator
                    content={`${typingUsers.map((u) => u.userName).join(', ')} ${
                      typingUsers.length === 1 ? 'is' : 'are'
                    } typing`}
                  />
                ) : undefined
              }
            >
              {isAiChannel ? (
                <>
                  <MessageSeparator content="AI Tutor Session" />
                  <Message
                    model={{
                      sender: 'AI Personal Tutor',
                      sentTime: 'Ready',
                      direction: 'incoming',
                      position: 'single',
                      type: 'custom',
                    }}
                  >
                    <Avatar src={aiAvatar} name="AI Personal Tutor" />
                    <Message.Header sender="AI Personal Tutor" />
                    <Message.CustomContent>
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {aiWelcomeText}
                      </p>
                    </Message.CustomContent>
                  </Message>

                  {orderedAiTurns.map((turn) => (
                    <React.Fragment key={turn.id}>
                      <Message
                        model={{
                          sender: currentUser.name,
                          sentTime: formatShortTime(turn.createdAt),
                          direction: 'outgoing',
                          position: 'single',
                          type: 'custom',
                        }}
                      >
                        <Message.Header
                          sender="You"
                          sentTime={formatShortTime(turn.createdAt)}
                        />
                        <Message.CustomContent>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {turn.question}
                          </p>
                        </Message.CustomContent>
                      </Message>

                      <Message
                        model={{
                          sender: 'AI Personal Tutor',
                          sentTime: formatShortTime(turn.createdAt),
                          direction: 'incoming',
                          position: 'single',
                          type: 'custom',
                        }}
                      >
                        <Avatar src={aiAvatar} name="AI Personal Tutor" />
                        <Message.Header
                          sender="AI Tutor"
                          sentTime={formatShortTime(turn.createdAt)}
                        />
                        <Message.CustomContent>
                          <div className="space-y-2">
                            <p className="text-sm leading-relaxed whitespace-pre-line break-words">
                              {turn.answer}
                            </p>
                            {(!hideSoundControls ||
                              (signLanguageMode &&
                                turn.signSteps &&
                                turn.signSteps.length > 0)) && (
                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                {!hideSoundControls && !signLanguageMode && (
                                  <button
                                    type="button"
                                    onClick={() => speakAloud(turn.answer, language)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#159B83] dark:text-emerald-400 hover:underline cursor-pointer"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Read aloud</span>
                                  </button>
                                )}
                                {signLanguageMode &&
                                  turn.signSteps &&
                                  turn.signSteps.length > 0 &&
                                  onReplaySignTurn && (
                                    <button
                                      type="button"
                                      onClick={() => onReplaySignTurn(turn)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 hover:underline cursor-pointer"
                                    >
                                      <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Replay in Sign Language</span>
                                    </button>
                                  )}
                              </div>
                            )}
                          </div>
                        </Message.CustomContent>
                      </Message>
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <>
                  <MessageSeparator content={currentLiveChannel.name} />
                  {liveMessages.length === 0 ? (
                    <Message
                      model={{
                        sender: 'Classroom Channel',
                        direction: 'incoming',
                        position: 'single',
                        type: 'custom',
                      }}
                    >
                      <Message.CustomContent>
                        <p className="text-sm text-[#52657C] dark:text-slate-300">
                          No messages in this student–teacher channel yet. Send a message below to
                          start a live discussion.
                        </p>
                      </Message.CustomContent>
                    </Message>
                  ) : (
                    liveMessages.map((msg) => {
                      const isOwn = msg.senderId === currentUser.id;
                      const roleLabel =
                        msg.senderRole === 'teacher' ? 'Teacher' : 'Student';
                      const timeLabel = msg.pending
                        ? 'Sending...'
                        : formatShortTime(msg.createdAt);
                      return (
                        <Message
                          key={msg.id}
                          model={{
                            sender: msg.senderName,
                            sentTime: timeLabel,
                            direction: isOwn ? 'outgoing' : 'incoming',
                            position: 'single',
                            type: 'custom',
                          }}
                        >
                          {!isOwn && (
                            <Avatar
                              src={createInitialsAvatarUri(
                                getInitials(msg.senderName),
                                msg.senderRole === 'teacher' ? '#DF922C' : '#159B83'
                              )}
                              name={msg.senderName}
                            />
                          )}
                          <Message.Header
                            sender={
                              isOwn
                                ? `You · ${roleLabel}`
                                : `${msg.senderName} · ${roleLabel}`
                            }
                            sentTime={timeLabel}
                          />
                          <Message.CustomContent>
                            <div className="space-y-1.5">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                              {!hideSoundControls && !isOwn && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    speakAloud(
                                      `${msg.senderName} wrote: ${msg.text}`,
                                      language
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D6CE0] dark:text-sky-400 hover:underline cursor-pointer"
                                >
                                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                                  <span>Read aloud</span>
                                </button>
                              )}
                            </div>
                          </Message.CustomContent>
                        </Message>
                      );
                    })
                  )}
                </>
              )}
            </MessageList>

            <MessageInput
              value={isAiChannel ? draft : liveDraft}
              onChange={handleInputChange}
              onSend={handleSend}
              attachButton={false}
              disabled={isAiChannel && aiLoading}
              placeholder={
                isAiChannel
                  ? signLanguageMode
                    ? 'Ask the AI Sign Tutor a question...'
                    : 'Type a study question for the AI Tutor...'
                  : `Message ${currentLiveChannel.name}...`
              }
            />
          </ChatContainer>
        </MainContainer>
      </div>

      {/* Live Student-Teacher Channel Extras: Active Roster & Quick Phrases */}
      {!isAiChannel && (
        <div className="space-y-2 pt-1">
          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#52657C] dark:text-slate-400">
              <span className="font-semibold text-[#153B70] dark:text-slate-200">
                Active in channel:
              </span>
              <span>
                {participants
                  .map(
                    (p) => `${p.name} (${p.role === 'teacher' ? 'Teacher' : 'Student'})`
                  )
                  .join(' · ')}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setLiveDraft(chip)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFD] dark:bg-slate-800 hover:bg-[#E9F4FF] dark:hover:bg-slate-700 text-xs font-medium text-[#153B70] dark:text-slate-200 cursor-pointer transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {liveError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
            >
              {liveError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
