import type { ChatMessage } from '#/components/Chat/types'

const MODEL_SERVER_URL =
  (import.meta.env.VITE_MODEL_SERVER_URL as string | undefined) ??
  'http://localhost:11434'

const MODEL_NAME =
  (import.meta.env.VITE_MODEL_NAME as string | undefined) ?? 'phi3-financial'

const MOCK_MODE = import.meta.env.VITE_MOCK === 'true'

const MOCK_REPLIES = [
  "Le ratio P/E (Price/Earnings) mesure le prix d'une action par rapport à ses bénéfices. Un P/E élevé indique souvent de fortes attentes de croissance.",
  "Pour évaluer la santé financière d'une entreprise, examinez son ratio d'endettement, sa marge nette et son free cash flow.",
  'Le ROE (Return on Equity) indique la rentabilité pour les actionnaires. Un ROE > 15% est généralement considéré comme solide.',
  "Le CAPEX (dépenses d'investissement) reflète les investissements long-terme. Un ratio CAPEX/Revenue élevé suggère une phase d'expansion.",
  "La diversification sectorielle permet de réduire le risque systémique d'un portefeuille.",
]

function pickMockReply(): string {
  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)]
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new Error('aborted'))
    })
  })
}

interface OllamaGenerateResponse {
  model: string
  response: string
  done: boolean
}

/**
 * Ne renvoie que le dernier texte saisi par l'utilisateur.
 * Le format conversationnel est géré côté serveur.
 */
function buildPrompt(messages: Array<ChatMessage>): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role === 'user') {
      return message.content.trim()
    }
  }

  return ''
}

/**
 * Certains modèles réémettent le prompt complet.
 * On ne garde que le texte après le dernier marqueur assistant.
 */
function extractAssistantReply(fullOutput: string, sentPrompt: string): string {
  const trimmed = fullOutput.trim()

  if (trimmed.startsWith(sentPrompt)) {
    const afterPrompt = trimmed.slice(sentPrompt.length).trim()
    if (afterPrompt.length > 0) return afterPrompt
  }

  const assistantMarker = 'Assistant:'
  const markerIndex = trimmed.lastIndexOf(assistantMarker)
  if (markerIndex !== -1) {
    const afterMarker = trimmed
      .slice(markerIndex + assistantMarker.length)
      .trim()
    if (afterMarker.length > 0) return afterMarker
  }

  return trimmed
}

/**
 * L'UI affiche du texte brut (pas de rendu LaTeX).
 * On normalise donc les échappements et on retire les délimiteurs `\[` `\]`.
 */
function normalizeModelOutput(rawOutput: string): string {
  return rawOutput
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .trim()
}

/**
 * Vérifie que le serveur Ollama est accessible.
 * GET /api/tags renvoie la liste des modèles disponibles.
 */
export async function checkModelServerHealth(
  signal?: AbortSignal,
): Promise<boolean> {
  if (MOCK_MODE) return true
  try {
    const res = await fetch(`${MODEL_SERVER_URL.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      signal,
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Envoie l'historique au serveur modèle et renvoie la réponse de l'assistant.
 */
export async function sendToModelServer(
  messages: Array<ChatMessage>,
  systemPrompt?: string,
  signal?: AbortSignal,
): Promise<string> {
  if (MOCK_MODE) {
    await sleep(800 + Math.random() * 1200, signal)
    return pickMockReply()
  }

  void systemPrompt
  const prompt = buildPrompt(messages)
  if (!prompt) {
    throw new Error('Aucun message utilisateur a envoyer')
  }

  const body = {
    model: MODEL_NAME,
    prompt,
    stream: false,
  }

  const res = await fetch(
    `${MODEL_SERVER_URL.replace(/\/$/, '')}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Model server ${res.status}: ${errorText}`)
  }

  const json = (await res.json()) as OllamaGenerateResponse
  if (typeof json.response !== 'string' || json.response.trim().length === 0) {
    throw new Error('Réponse modèle invalide : response manquant')
  }

  const assistantReply = extractAssistantReply(json.response, prompt)
  return normalizeModelOutput(assistantReply)
}
