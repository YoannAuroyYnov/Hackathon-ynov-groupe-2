import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { Search, Trash2 } from 'lucide-react'
import type { ChatMessage } from '#/components/Chat/types'
import { useServerStatus } from '#/hooks/useServerStatus'

export const CHAT_SELECTED_EVENT = 'chat:selected'
export const CHAT_MESSAGE_APPENDED_EVENT = 'chat:message-appended'

const STORAGE_KEY = 'techcorp.chats'

export type ChatHistoryItem = {
  id: string
  title: string
  messages: Array<ChatMessage>
}

function loadChatsFromStorage(): Array<ChatHistoryItem> {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<ChatHistoryItem>
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveChatsToStorage(chats: Array<ChatHistoryItem>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // quota exceeded ou acces bloque : on ignore
  }
}

function buildTitleFromMessages(messages: Array<ChatMessage>): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) {
    const now = new Date()
    return `Nouveau chat ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  const snippet = firstUser.content.trim().slice(0, 40)
  return snippet.length < firstUser.content.length ? `${snippet}…` : snippet
}

function emitChatSelected(chat: ChatHistoryItem): void {
  window.dispatchEvent(
    new CustomEvent(CHAT_SELECTED_EVENT, {
      detail: {
        chatId: chat.id,
        messages: chat.messages,
      },
    }),
  )
}

export const SidebarLayout = () => {
  const [chats, setChats] = useState<Array<ChatHistoryItem>>(() =>
    loadChatsFromStorage(),
  )
  const [activeChatId, setActiveChatId] = useState<null | string>(null)
  const serverStatus = useServerStatus()

  // Persistance : sauve chaque changement en localStorage
  useEffect(() => {
    saveChatsToStorage(chats)
  }, [chats])

  // Ecoute les messages ajoutes par Chat pour maintenir l'historique a jour
  useEffect(() => {
    const handleMessageAppended = (event: Event) => {
      const detail = (
        event as CustomEvent<
          { conversationId: string; messages: Array<ChatMessage> } | undefined
        >
      ).detail
      if (!detail?.conversationId) return

      setChats((previousChats) => {
        const existing = previousChats.find(
          (c) => c.id === detail.conversationId,
        )

        if (existing) {
          // Met a jour le chat existant (title recalcule si pas encore defini)
          return previousChats.map((c) =>
            c.id === detail.conversationId
              ? {
                  ...c,
                  messages: detail.messages,
                  title:
                    c.title.startsWith('Nouveau chat') ||
                    c.title === 'Sans titre'
                      ? buildTitleFromMessages(detail.messages)
                      : c.title,
                }
              : c,
          )
        }

        // Nouveau chat cree cote Chat sans passer par la sidebar (ex: 1er message direct)
        const newChat: ChatHistoryItem = {
          id: detail.conversationId,
          title: buildTitleFromMessages(detail.messages),
          messages: detail.messages,
        }
        return [newChat, ...previousChats]
      })

      setActiveChatId(detail.conversationId)
    }

    window.addEventListener(CHAT_MESSAGE_APPENDED_EVENT, handleMessageAppended)
    return () => {
      window.removeEventListener(
        CHAT_MESSAGE_APPENDED_EVENT,
        handleMessageAppended,
      )
    }
  }, [])

  const deleteChat = (chatId: string) => {
    setChats((previousChats) => previousChats.filter((c) => c.id !== chatId))
    if (activeChatId === chatId) {
      setActiveChatId(null)
      // Vide le Chat courant si on supprime la conversation affichee
      window.dispatchEvent(
        new CustomEvent(CHAT_SELECTED_EVENT, {
          detail: { chatId: undefined, messages: [] },
        }),
      )
    }
  }

  const createNewChat = () => {
    // On ne cree PAS d'entree dans l'historique tant qu'aucun message n'est envoye.
    // On pre-genere juste l'ID et on vide le Chat courant ; l'entree sera ajoutee
    // automatiquement par le handler CHAT_MESSAGE_APPENDED_EVENT au 1er message.
    const newId = `chat-${Date.now()}`
    setActiveChatId(newId)
    emitChatSelected({ id: newId, title: '', messages: [] })
  }

  return (
    <Box
      component="aside"
      sx={{
        width: 288,
        height: '100%',
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderRight: 1,
        borderColor: 'divider',
        px: 2,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ px: 1, fontWeight: 700 }}>
        Conversations
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={createNewChat}
        sx={{
          justifyContent: 'flex-start',
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        + Nouveau chat
      </Button>

      <Button
        color="primary"
        startIcon={<Search size={16} />}
        sx={{
          justifyContent: 'flex-start',
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        Rechercher des chats
      </Button>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
            fontWeight: 700,
            letterSpacing: 1,
            px: 1,
          }}
        >
          Historique
        </Typography>

        <List dense disablePadding>
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId

            return (
              <ListItemButton
                key={chat.id}
                selected={isActive}
                onClick={() => {
                  setActiveChatId(chat.id)
                  emitChatSelected(chat)
                }}
                sx={{
                  borderRadius: 1.5,
                  mt: 0.5,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  bgcolor: isActive ? 'action.selected' : 'transparent',
                  pr: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:hover .delete-btn': { opacity: 1 },
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: 'action.selected',
                  },
                  '&.Mui-selected .delete-btn': { opacity: 1 },
                }}
              >
                <ListItemText
                  primary={chat.title}
                  slotProps={{
                    primary: {
                      noWrap: true,
                    },
                  }}
                />
                <IconButton
                  className="delete-btn"
                  size="small"
                  aria-label="Supprimer la conversation"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  sx={{
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    ml: 1,
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </ListItemButton>
            )
          })}
        </List>
      </Box>

      <Box
        sx={{
          mt: 'auto',
          pt: 1.5,
          px: 1,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor:
              serverStatus === 'up'
                ? 'success.main'
                : serverStatus === 'down'
                  ? 'error.main'
                  : 'warning.main',
          }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {serverStatus === 'up'
            ? 'Serveur en ligne'
            : serverStatus === 'down'
              ? 'Serveur hors ligne'
              : 'Verification du serveur...'}
        </Typography>
      </Box>
    </Box>
  )
}
