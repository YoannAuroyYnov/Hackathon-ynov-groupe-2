import { useState } from 'react'
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { Search } from 'lucide-react'

type ChatHistoryItem = {
  id: string
  title: string
}

const initialChats: ChatHistoryItem[] = [
  { id: 'chat-1', title: 'Budget personnel avril' },
  { id: 'chat-2', title: 'Analyse depenses fixes' },
  { id: 'chat-3', title: 'Objectif epargne 2026' },
]

export const SidebarLayout = () => {
  const [chats, setChats] = useState<ChatHistoryItem[]>(initialChats)
  const [activeChatId, setActiveChatId] = useState<string>(
    initialChats[0]?.id ?? '',
  )

  const createNewChat = () => {
    const now = new Date()
    const newChat: ChatHistoryItem = {
      id: `chat-${now.getTime()}`,
      title: `Nouveau chat ${now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    }

    setChats((previousChats) => [newChat, ...previousChats])
    setActiveChatId(newChat.id)
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
        variant="outlined"
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
                onClick={() => setActiveChatId(chat.id)}
                sx={{
                  borderRadius: 1.5,
                  mt: 0.5,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  bgcolor: isActive ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: 'action.selected',
                  },
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
              </ListItemButton>
            )
          })}
        </List>
      </Box>
    </Box>
  )
}
