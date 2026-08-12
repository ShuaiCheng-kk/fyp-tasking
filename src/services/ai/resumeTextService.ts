// LAYER: Service
// RULE: Business logic only — turns an uploaded resume file into plain text for the AI matcher.

// pdf-parse and mammoth are loaded lazily inside extractResumeText, not imported at the
// top. As top-level imports they initialise whenever anything in this module's import
// chain is loaded — including /api/ai/candidates — and if that initialisation fails in
// Vercel's serverless bundle the whole route module dies before its handler runs, so the
// client gets Next's 500 HTML page instead of JSON ("Unexpected token '<'"). Importing
// them on demand keeps a parser problem contained to the one call that needs a parser,
// which is what the "Never throws" contract below actually promises.

// Enough for the AI to judge fit without blowing up the prompt on long CVs.
const MAX_TEXT_LENGTH = 4000

export const UNPARSEABLE_RESUME =
  'Resume attached but could not be parsed (unsupported format or scanned document).'

export const resumeTextService = {
  // Never throws — an unreadable resume must not block the recommendation run; the AI is simply
  // told the resume exists but could not be read.
  async extractResumeText(resumeUrl: string): Promise<string> {
    try {
      const response = await fetch(resumeUrl)
      if (!response.ok) return UNPARSEABLE_RESUME
      const buffer = Buffer.from(await response.arrayBuffer())

      const path = new URL(resumeUrl).pathname.toLowerCase()
      let text = ''
      if (path.endsWith('.pdf')) {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        try {
          const parsed = await parser.getText()
          text = parsed.text ?? ''
        } finally {
          await parser.destroy()
        }
      } else if (path.endsWith('.docx')) {
        const mammoth = (await import('mammoth')).default
        const parsed = await mammoth.extractRawText({ buffer })
        text = parsed.value ?? ''
      } else {
        // .doc (legacy binary Word) has no reliable pure-JS parser
        return UNPARSEABLE_RESUME
      }

      const cleaned = text.replace(/\s+/g, ' ').trim()
      if (!cleaned) return UNPARSEABLE_RESUME
      return cleaned.length > MAX_TEXT_LENGTH ? `${cleaned.slice(0, MAX_TEXT_LENGTH)}…` : cleaned
    } catch {
      return UNPARSEABLE_RESUME
    }
  },
}
