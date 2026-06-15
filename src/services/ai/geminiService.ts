// LAYER: Service
// RULE: Handles Gemini API calls only. No DB access. No HTTP route handling.

type JsonSchema = Record<string, unknown>

export const geminiService = {
  async generateStructuredJson<T>(data: {
    instructions: string
    input: unknown
    schemaName: string
    schema: JsonSchema
  }): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: data.instructions }] },
        contents: [{ parts: [{ text: `Input data:\n${JSON.stringify(data.input, null, 2)}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: data.schema,
        },
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      const message = json?.error?.message || 'Gemini request failed'
      throw new Error(message)
    }

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini returned an empty response')

    return JSON.parse(text) as T
  },
}
