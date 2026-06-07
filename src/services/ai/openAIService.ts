// LAYER: Service
// RULE: Handles OpenAI API calls only. No DB access. No HTTP route handling.

type JsonSchema = Record<string, unknown>

function extractOutputText(response: unknown): string {
  const r = response as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string }> }>
  }
  if (r.output_text) return r.output_text
  return r.output?.flatMap(item => item.content ?? []).map(content => content.text ?? '').join('') ?? ''
}

export const openAIService = {
  async generateStructuredJson<T>(data: {
    instructions: string
    input: unknown
    schemaName: string
    schema: JsonSchema
  }): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
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
      }),
    })

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
