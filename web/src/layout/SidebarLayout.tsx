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

export const CHAT_SELECTED_EVENT = 'chat:selected'
export const CHAT_MESSAGE_APPENDED_EVENT = 'chat:message-appended'

const STORAGE_KEY = 'techcorp.chats'

export type ChatHistoryItem = {
  id: string
  title: string
  messages: Array<ChatMessage>
}

export const initialChats: ChatHistoryItem[] = [
  {
    id: 'chat-1',
    title: 'Budget personnel avril',
    messages: [
      {
        id: 'seed-01',
        role: 'user',
        content:
          'Je gagne 2 450 EUR net. Peux-tu me proposer un budget mensuel simple avec epargne incluse ?',
        createdAt: new Date('2026-04-22T08:40:00').getTime(),
      },
      {
        id: 'seed-02',
        role: 'assistant',
        content:
          'Proposition 50/30/20 adaptee: besoins 1 225 EUR, envies 735 EUR, epargne 490 EUR. Si tes charges fixes sont elevees, vise plutot 55/25/20 les 3 premiers mois.',
        createdAt: new Date('2026-04-22T08:40:21').getTime(),
      },
      {
        id: 'seed-03',
        role: 'user',
        content: "Et si je veux constituer un fonds d'urgence de 6 mois ?",
        createdAt: new Date('2026-04-22T08:41:05').getTime(),
      },
      {
        id: 'seed-04',
        role: 'assistant',
        content:
          "Avec 1 225 EUR de besoins, cible fonds d'urgence = 7 350 EUR. A 490 EUR/mois d'epargne, objectif atteint en environ 15 mois hors rendement.",
        createdAt: new Date('2026-04-22T08:41:30').getTime(),
      },
    ],
  },
  {
    id: 'chat-2',
    title: 'Analyse depenses fixes',
    messages: [
      {
        id: 'seed-1',
        role: 'user',
        content:
          'Peux-tu analyser mes depenses fixes mensuelles: loyer 850 EUR, abonnements 62 EUR, transport 90 EUR, assurance 45 EUR, energie 110 EUR ?',
        createdAt: new Date('2026-04-23T09:14:00').getTime(),
      },
      {
        id: 'seed-2',
        role: 'assistant',
        content:
          "Total depenses fixes: 1 157 EUR/mois. Le poste principal est le loyer (73.5%). Une optimisation rapide serait de cibler les abonnements et l'energie: un gain de 15% representerait environ 26 EUR/mois.",
        createdAt: new Date('2026-04-23T09:14:24').getTime(),
      },
      {
        id: 'seed-3',
        role: 'user',
        content:
          'Si je veux epargner 400 EUR par mois avec un revenu net de 2 300 EUR, est-ce realiste ?',
        createdAt: new Date('2026-04-23T09:15:10').getTime(),
      },
      {
        id: 'seed-4',
        role: 'assistant',
        content:
          "Oui, c'est realiste. Taux d'epargne cible: 17.4% du revenu net. Avec 1 157 EUR de fixes, il te reste 1 143 EUR pour variables + epargne. Je recommande un plafond variables a 700 EUR pour garder une marge de securite.",
        createdAt: new Date('2026-04-23T09:15:34').getTime(),
      },
    ],
  },
  {
    id: 'chat-3',
    title: 'Objectif epargne 2026',
    messages: [
      {
        id: 'seed-09',
        role: 'user',
        content:
          "Mon objectif est 10 000 EUR d'epargne fin 2026. J'ai deja 2 800 EUR. Quel effort mensuel dois-je faire ?",
        createdAt: new Date('2026-04-21T18:12:00').getTime(),
      },
      {
        id: 'seed-10',
        role: 'assistant',
        content:
          'Reste a epargner: 7 200 EUR. Sur 8 mois, effort moyen = 900 EUR/mois. Sur 12 mois, effort = 600 EUR/mois.',
        createdAt: new Date('2026-04-21T18:12:20').getTime(),
      },
      {
        id: 'seed-11',
        role: 'user',
        content:
          '600 EUR/mois est plus realiste pour moi. Une strategie simple ?',
        createdAt: new Date('2026-04-21T18:13:03').getTime(),
      },
      {
        id: 'seed-12',
        role: 'assistant',
        content:
          'Automatise un virement de 450 EUR le jour du salaire + 150 EUR en fin de mois. Si tu depasses un budget variable, compense des le mois suivant pour tenir la trajectoire annuelle.',
        createdAt: new Date('2026-04-21T18:13:28').getTime(),
      },
    ],
  },
]

function loadChatsFromStorage(): Array<ChatHistoryItem> {
  if (typeof window === 'undefined') return initialChats
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialChats
    const parsed = JSON.parse(raw) as Array<ChatHistoryItem>
    if (!Array.isArray(parsed)) return initialChats
    return parsed
  } catch {
    return initialChats
  }
}

function saveChatsToStorage(chats: Array<ChatHistoryItem>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // quota exceeded ou accès bloqué : on ignore
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

  // Persistance : sauve chaque changement en localStorage
  useEffect(() => {
    saveChatsToStorage(chats)
  }, [chats])

  // Écoute les messages ajoutés par Chat pour maintenir l'historique à jour
  useEffect(() => {
    const handleMessageAppended = (event: Event) => {
      const detail = (
        event as CustomEvent<
          | { conversationId: string; messages: Array<ChatMessage> }
          | undefined
        >
      ).detail
      if (!detail?.conversationId) return

      setChats((previousChats) => {
        const existing = previousChats.find(
          (c) => c.id === detail.conversationId,
        )

        if (existing) {
          // Met à jour le chat existant (title recalculé si pas encore défini)
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

        // Nouveau chat créé côté Chat sans passer par la sidebar (ex: 1er message direct)
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
      // Vide le Chat courant si on supprime la conversation affichée
      window.dispatchEvent(
        new CustomEvent(CHAT_SELECTED_EVENT, {
          detail: { chatId: undefined, messages: [] },
        }),
      )
    }
  }

  const createNewChat = () => {
    // On ne crée PAS d'entrée dans l'historique tant qu'aucun message n'est envoyé.
    // On pré-génère juste l'ID et on vide le Chat courant ; l'entrée sera ajoutée
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
    </Box>
  )
}
