import { Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import { Bot, User } from 'lucide-react'
import type { ChatMessage } from './types'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        width: '100%',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
      }}
    >
      {!isUser && (
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <Bot size={20} />
        </Avatar>
      )}

      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: '75%',
          bgcolor: isUser ? 'primary.main' : 'grey.100',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          borderTopRightRadius: isUser ? 0 : 2,
          borderTopLeftRadius: isUser ? 2 : 0,
        }}
      >
        <Typography
          variant="body1"
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {message.content}
        </Typography>
        <Box
          component="span"
          sx={{
            display: 'block',
            mt: 0.5,
            fontSize: '0.7rem',
            opacity: 0.7,
          }}
        >
          {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Box>
      </Paper>

      {isUser && (
        <Avatar sx={{ bgcolor: 'grey.700', width: 36, height: 36 }}>
          <User size={20} />
        </Avatar>
      )}
    </Stack>
  )
}
