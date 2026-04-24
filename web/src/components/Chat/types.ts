export type Role = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  createdAt: number
}

export interface ChatProps {
  /** Prompt système envoyé au modèle (persona) */
  systemPrompt?: string
  /** Messages injectés depuis le parent (optionnel, sinon géré en interne) */
  initialMessages?: Array<ChatMessage>
  /** Callback à chaque envoi utilisateur */
  onMessageSent?: (message: ChatMessage) => void
  /** Callback à chaque réponse reçue */
  onMessageReceived?: (message: ChatMessage) => void
}
