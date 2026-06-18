// LAYER: Service
// RULE: Handles OpenAI API calls only. No DB access. No HTTP route handling.

type JsonSchema = Record<string, unknown>

const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_OUTPUT_TOKENS = 800

function extractOutputText(response: unknown): string {
  const r = response as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string }> }>
  }
  if (r.output_text) return r.output_text
  return r.output?.flatMap(item => item.content ?? []).map(content => content.text ?? '').join('') ?? ''
}

function supportsReasoning(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model)
}

export const openAIService = {
  async generateStructuredJson<T>(data: {
    instructions: string
    input: unknown
    schemaName: string
    schema: JsonSchema
    maxOutputTokens?: number
  }): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

    const controller = new AbortController()
    const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const requestBody: Record<string, unknown> = {
      model,
      max_output_tokens: data.maxOutputTokens ?? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS),
      instructions: data.instructions,
      input: JSON.stringify(data.input),
      text: {
        format: {
          type: 'json_schema',
          name: data.schemaName,
          strict: true,
          schema: data.schema,
        },
      },
    }

    if (supportsReasoning(model)) {
      requestBody.reasoning = {
        effort: process.env.OPENAI_REASONING_EFFORT || 'minimal',
      }
      requestBody.text = {
        ...(requestBody.text as Record<string, unknown>),
        verbosity: process.env.OPENAI_TEXT_VERBOSITY || 'low',
      }
    }

    let res: Response
    try {
      res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('OpenAI request timed out. Try a shorter prompt or retry.')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    const json = await res.json()
    if (!res.ok) {
      const message = json?.error?.message || 'OpenAI request failed'
      throw new Error(message)
    }

    const outputText = extractOutputText(json)
    if (!outputText) throw new Error('OpenAI returned an empty response')
    return JSON.parse(outputText) as T
  },
}
