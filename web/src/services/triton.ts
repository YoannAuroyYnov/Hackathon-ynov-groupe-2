import type { ChatMessage } from '#/components/Chat/types'

const TRITON_URL =
  (import.meta.env.VITE_TRITON_URL as string | undefined) ??
  'http://localhost:8000'

const MODEL_NAME = 'phi35_financial'

const MOCK_MODE = import.meta.env.VITE_MOCK === 'true'

const MOCK_REPLIES = [
  'Le ratio P/E (Price/Earnings) mesure le prix d\'une action par rapport à ses bénéfices. Un P/E élevé indique souvent de fortes attentes de croissance.',
  'Pour évaluer la santé financière d\'une entreprise, examinez son ratio d\'endettement, sa marge nette et son free cash flow.',
  'Le ROE (Return on Equity) indique la rentabilité pour les actionnaires. Un ROE > 15% est généralement considéré comme solide.',
  'Le CAPEX (dépenses d\'investissement) reflète les investissements long-terme. Un ratio CAPEX/Revenue élevé suggère une phase d\'expansion.',
  'La diversification sectorielle permet de réduire le risque systémique d\'un portefeuille.',
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

interface TritonResponse {
  model_name: string
  model_version: string
  outputs: Array<{
    name: string
    shape: Array<number>
    datatype: string
    data: Array<string>
  }>
}

/**
 * Formate l'historique au format chat Phi-3.5.
 * Template attendu : <|system|>...<|end|><|user|>...<|end|><|assistant|>
 */
function buildPrompt(
  messages: Array<ChatMessage>,
  systemPrompt?: string,
): string {
  let prompt = ''
  if (systemPrompt) {
    prompt += `<|system|>\n${systemPrompt}<|end|>\n`
  }
  for (const m of messages) {
    prompt += `<|${m.role}|>\n${m.content}<|end|>\n`
  }
  prompt += `<|assistant|>\n`
  return prompt
}

/**
 * Triton renvoie le prompt + la génération dans `text_output`.
 * On extrait uniquement la partie générée après le dernier `<|assistant|>`.
 */
function extractAssistantReply(fullOutput: string, sentPrompt: string): string {
  if (fullOutput.startsWith(sentPrompt)) {
    return fullOutput.slice(sentPrompt.length).replace(/<\|end\|>.*$/s, '').trim()
  }
  const marker = '<|assistant|>'
  const lastIdx = fullOutput.lastIndexOf(marker)
  if (lastIdx !== -1) {
    return fullOutput.slice(lastIdx + marker.length).replace(/<\|end\|>.*$/s, '').trim()
  }
  return fullOutput.trim()
}

/**
 * Vérifie que Triton est up et que le modèle est chargé.
 * GET /v2/models/{model}/ready → 200 si prêt
 */
export async function checkTritonHealth(signal?: AbortSignal): Promise<boolean> {
  if (MOCK_MODE) return true
  try {
    const res = await fetch(`${TRITON_URL}/v2/models/${MODEL_NAME}/ready`, {
      method: 'GET',
      signal,
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Envoie l'historique à Triton et renvoie uniquement la réponse de l'assistant.
 */
export async function sendToTriton(
  messages: Array<ChatMessage>,
  systemPrompt?: string,
  signal?: AbortSignal,
): Promise<string> {
  if (MOCK_MODE) {
    await sleep(800 + Math.random() * 1200, signal)
    return pickMockReply()
  }

  const prompt = buildPrompt(messages, systemPrompt)

  const body = {
    inputs: [
      {
        name: 'text_input',
        shape: [1],
        datatype: 'BYTES',
        data: [prompt],
      },
    ],
  }

  const res = await fetch(`${TRITON_URL}/v2/models/${MODEL_NAME}/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Triton ${res.status}: ${errorText}`)
  }

  const json = (await res.json()) as TritonResponse
  const output = json.outputs.find((o) => o.name === 'text_output')
  if (!output || output.data.length === 0) {
    throw new Error('Réponse Triton invalide : text_output manquant')
  }

  return extractAssistantReply(output.data[0], prompt)
}
