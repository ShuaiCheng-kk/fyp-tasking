/**
 * AIService — AI-powered features for the Tasking platform.
 *
 * Responsibilities:
 *   - Candidate scoring: rank applications by matching worker skills/history
 *     against job requirements using an LLM (Gemini or OpenAI).
 *   - Smart suggestions: recommend workers for a shift based on past performance.
 *   - Anomaly detection: flag unusual attendance patterns (e.g. repeated late arrivals).
 *
 * LLM provider: Gemini (google-generative-ai) preferred; OpenAI as fallback.
 * API keys are read from process.env — never hard-code them here.
 *
 * Environment variables required:
 *   GEMINI_API_KEY   — Google Gemini API key
 *   OPENAI_API_KEY   — OpenAI API key (fallback)
 *
 * This service calls:
 *   - jobRepository   to fetch job requirements
 *   - userRepository  to fetch worker skill profiles
 *   - attendanceRepository to fetch historical performance
 *
 * Results are persisted by the calling service (e.g. recruitmentService saves
 * the ai_score back to the job_applications row via jobRepository).
 *
 * Never call the Supabase client directly here — always go through a repository.
 */

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

/**
 * Score a job application by comparing the worker's profile against
 * the job's required_skills array.
 *
 * Returns a score from 0–100 where 100 is a perfect match.
 *
 * Implementation notes:
 *   - Build a prompt that includes: job title, required skills, and the
 *     worker's skill list plus their past attendance rate.
 *   - Ask the LLM to return a JSON object: { score: number, reasoning: string }
 *   - Parse and validate the response before returning.
 *
 * TODO: implement once LLM client is initialised in @/lib/gemini.ts
 */
export async function scoreApplication(
  applicationId: string,
  requiredSkills: string[],
  workerId: string,
): Promise<number> {
  // TODO:
  //   1. const worker = await userRepository.findById(workerId) — fetch skills
  //   2. const attendanceRate = await attendanceService.computeAttendanceRate(workerId)
  //   3. Build prompt string
  //   4. Call Gemini API: geminiClient.generateContent(prompt)
  //   5. Parse JSON response, validate score is 0–100
  //   6. Return score

  console.warn('aiService.scoreApplication: not yet implemented', { applicationId, requiredSkills, workerId })
  return 0
}

// ---------------------------------------------------------------------------
// Worker recommendations
// ---------------------------------------------------------------------------

/**
 * Recommend the top N casual workers for an open shift, ranked by:
 *   1. Skill match with the department's typical requirements
 *   2. Historical attendance rate (workers with >90% attendance ranked higher)
 *   3. Number of previous shifts in this department (familiarity bonus)
 *
 * @param shiftId  - the shift to fill
 * @param topN     - how many workers to return (default 5)
 *
 * Returns an ordered list of worker IDs with scores and reasoning.
 *
 * TODO: implement once LLM and attendance history are available.
 */
export async function recommendWorkersForShift(
  shiftId: string,
  topN = 5,
): Promise<Array<{ workerId: string; score: number; reasoning: string }>> {
  // TODO:
  //   1. findShiftById(shiftId) — get department and required skills
  //   2. findUsersByRole('casual_worker') — candidate pool
  //   3. For each candidate, compute a score (attendance rate + skill match)
  //   4. Optionally ask the LLM to rank and explain the top N
  //   5. Return sorted array

  console.warn('aiService.recommendWorkersForShift: not yet implemented', { shiftId, topN })
  return []
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/**
 * Analyse a worker's attendance history and return a risk flag if patterns
 * suggest unreliability (e.g. 3+ late arrivals in 30 days, recurring absences
 * on the same weekday, etc.).
 *
 * Used by the manager dashboard to surface at-risk workers before scheduling.
 *
 * Returns null if no anomaly is detected, or an object describing the issue.
 *
 * TODO: implement once attendance data is populated.
 */
export async function detectAttendanceAnomalies(
  workerId: string,
): Promise<{ flag: string; detail: string } | null> {
  // TODO:
  //   1. findAttendanceByWorker(workerId, last 30 days)
  //   2. Count late / absent events
  //   3. Apply rule-based thresholds first (cheap)
  //   4. Optionally send to LLM for narrative explanation
  //   5. Return null (clean) or { flag, detail }

  console.warn('aiService.detectAttendanceAnomalies: not yet implemented', { workerId })
  return null
}
