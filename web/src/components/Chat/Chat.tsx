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
import { checkTritonHealth, sendToTriton } from '#/services/triton'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage, ChatProps } from './types'

const DEFAULT_SYSTEM_PROMPT =
  'Tu es un assistant financier pour TechCorp Industries. Réponds de manière précise et professionnelle en français.'

function createMessage(
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
}: ChatProps) {
  const [messages, setMessages] = useState<Array<ChatMessage>>(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverReady, setServerReady] = useState<boolean | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Health check au montage + toutes les 30s
  useEffect(() => {
    const controller = new AbortController()
    const check = async () => {
      const ok = await checkTritonHealth(controller.signal)
      setServerReady(ok)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  // Auto-scroll bas
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isSending])

  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return

    const userMsg = createMessage('user', text)
    const nextMessages = [...messages, userMsg]

    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    setError(null)
    onMessageSent?.(userMsg)

    try {
      const reply = await sendToTriton(nextMessages, systemPrompt)
      const botMsg = createMessage('assistant', reply)
      setMessages((prev) => [...prev, botMsg])
      onMessageReceived?.(botMsg)
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
      sx={{ height: '100%', width: '100%', bgcolor: 'background.default' }}
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
              serverReady === false
                ? 'Serveur Triton indisponible…'
                : 'Écrivez votre message (Entrée pour envoyer)'
            }
            disabled={isSending || serverReady === false}
            fullWidth
            multiline
            maxRows={6}
            size="small"
            autoFocus
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || isSending || serverReady === false}
            sx={{ mb: 0.5 }}
          >
            <Send size={20} />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  )
}
