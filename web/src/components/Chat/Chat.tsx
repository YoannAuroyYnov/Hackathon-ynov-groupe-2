import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Send } from 'lucide-react'
import { sendToModelServer } from '#/services/modelServer'
import {
  CHAT_MESSAGE_APPENDED_EVENT,
  CHAT_SELECTED_EVENT,
} from '#/layout/SidebarLayout'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage, ChatProps } from './types'

const DEFAULT_SYSTEM_PROMPT =
  'Tu es un assistant financier pour TechCorp Industries. Réponds de manière précise et professionnelle en français.'

function generateConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function emitMessageAppended(
  conversationId: string,
  messages: Array<ChatMessage>,
): void {
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGE_APPENDED_EVENT, {
      detail: { conversationId, messages },
    }),
  )
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  conversationId: string,
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    content,
    createdAt: Date.now(),
  }
}

export function Chat({
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  initialMessages = [],
  onMessageSent,
  onMessageReceived,
  onConversationStart,
}: ChatProps) {
  const [messages, setMessages] = useState<Array<ChatMessage>>(initialMessages)
  const [conversationId, setConversationId] = useState<string | null>(
    initialMessages[0]?.conversationId ?? null,
  )
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isServerUnavailable] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Health check au montage + toutes les 30s
  useEffect(() => {
    // todo: to be reworked
    // check()
    // const interval = setInterval(check, 30_000)
    // return () => {
    //   controller.abort()
    //   clearInterval(interval)
    // }
  }, [])

  // Auto-scroll bas
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isSending])

  // Recharge les messages quand l'utilisateur change de conversation.
  useEffect(() => {
    const handleChatSelected = (event: Event) => {
      const detail = (
        event as CustomEvent<
          | { chatId?: string; messages?: Array<ChatMessage> }
          | undefined
        >
      ).detail
      setMessages(detail?.messages ?? [])
      setConversationId(
        detail?.chatId ?? detail?.messages?.[0]?.conversationId ?? null,
      )
      setError(null)
    }

    window.addEventListener(CHAT_SELECTED_EVENT, handleChatSelected)
    return () => {
      window.removeEventListener(CHAT_SELECTED_EVENT, handleChatSelected)
    }
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return

    // Génération de l'ID au premier message de la conversation
    let cid = conversationId
    if (!cid) {
      cid = generateConversationId()
      setConversationId(cid)
      onConversationStart?.(cid)
    }

    const userMsg = createMessage('user', text, cid)
    const nextMessages = [...messages, userMsg]

    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    setError(null)
    onMessageSent?.(userMsg)
    emitMessageAppended(cid, nextMessages)

    try {
      const reply = await sendToModelServer(nextMessages, systemPrompt)
      const botMsg = createMessage('assistant', reply, cid)
      const messagesWithBot = [...nextMessages, botMsg]
      setMessages(messagesWithBot)
      onMessageReceived?.(botMsg)
      emitMessageAppended(cid, messagesWithBot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Stack
      sx={{
        height: '100%',
        minHeight: 0,
        width: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* Zone messages scrollable */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, md: 4 },
          py: 3,
        }}
      >
        {messages.length === 0 ? (
          <Stack
            sx={{
              height: '100%',
              color: 'text.secondary',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
              TechCorp Financial Assistant
            </Typography>
            <Typography variant="body2">
              Posez votre première question pour démarrer la conversation.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ maxWidth: 900, mx: 'auto' }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isSending && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ pl: 6, color: 'text.secondary', alignItems: 'center' }}
              >
                <CircularProgress size={14} />
                <Typography variant="body2">L'assistant réfléchit…</Typography>
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      {/* Erreur */}
      {error && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Input sticky bas */}
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: { xs: 2, md: 4 },
          py: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ maxWidth: 900, mx: 'auto', alignItems: 'flex-end' }}
        >
          <TextField
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isServerUnavailable
                ? 'Serveur indisponible…'
                : 'Écrivez votre message (Entrée pour envoyer)'
            }
            disabled={isSending || isServerUnavailable}
            fullWidth
            multiline
            maxRows={6}
            size="small"
            autoFocus
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || isSending || isServerUnavailable}
            sx={{ mb: 0.5 }}
          >
            <Send size={20} />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  )
}
