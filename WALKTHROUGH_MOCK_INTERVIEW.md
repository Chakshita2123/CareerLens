# Walkthrough — Interactive Mock Interview Feature

We have built and integrated an end-to-end **Interactive Mock Interview** feature for CareerLens. This feature allows candidates to practice multi-turn interview questions tailored specifically to their parsed resume and target job description, with turn-by-turn AI feedback and a comprehensive final performance debrief.

---

## What Was Built

### 1. Backend Engine (`mock_interview.py`)
- **Multi-Tier Fallback Provider**: Reuses the provider chain established in `bullet_improver.py`:
  1. **Gemini 1.5 Flash** (primary)
  2. **Groq Llama 3.1 8B** (fallback)
  3. **Deterministic Mock Generator** (offline fallback — never crashes the session even without API keys).
- **Personalized Question Generation**: Formulates 3 question categories:
  - **Warm-Up**: Natural introductory question assessing communication narrative.
  - **Behavioral (STAR)**: Grounded directly in actual bullet points and project challenges from the candidate's resume.
  - **Technical Alignment**: Questions probing technical architecture, trade-offs, and target JD requirements.
- **Answer Evaluation**: Returns structured critique:
  - `strengths`: Concrete things done well.
  - `improvements`: Specific missing elements or vague phrasing.
  - `suggested_angle`: Actionable reframing or STAR blueprint for a top-tier answer.
  - `score`: Numeric rating (1–10) and qualitative badge (`Strong Answer`, `Good Foundation`, `Needs Polish`).
- **Session Summary**: Synthesizes recurring strengths, growth areas, and an executive readiness takeaway.

---

### 2. Database & Data Models
- **`database.py`**: Added `COLLECTION_INTERVIEWS = "interview_sessions"` and `get_interviews_collection()`.
- **`models.py`**: Added Pydantic schemas:
  - `InterviewQuestion`, `InterviewFeedback`, `InterviewAnswerRecord`
  - `InterviewStartRequest`, `InterviewStartResponse`
  - `InterviewAnswerRequest`, `InterviewAnswerResponse`
  - `InterviewSessionDetailResponse`, `InterviewSessionSummaryItem`

---

### 3. FastAPI Endpoints (`main.py`)
- `POST /interviews/start`: Initiates session from resume version (+ optional job match) and yields Question #1.
- `POST /interviews/{session_id}/answer`: Evaluates submitted answer, records turn, returns critique + next question (or triggers final debrief).
- `GET /interviews/{session_id}`: Fetches full session transcript and state for resuming or reviewing.
- `GET /interviews/user/{user_id}`: Lists past interview sessions for the user with score history.
- *Note:* All heavy operations are wrapped in `asyncio.to_thread` to ensure Uvicorn's event loop is never blocked.

---

### 4. Next.js Frontend (`careerlens-ui`)
- **`Navbar.tsx`**: Added the **Interview** navigation tab (`/interview`) with `MessageSquareCode` icon.
- **`api.ts`**: Added typed client functions: `startInterview`, `submitInterviewAnswer`, `getInterviewSession`, `listUserInterviews`.
- **`app/interview/page.tsx`**: Full multi-state interactive interface:
  1. **Setup Screen**: Pick resume version, optionally supply target JD, select question count (3, 5, 7), and review past sessions.
  2. **Active Q&A Terminal**: Progress HUD, question category badges, contextual explanation ("Why this question was chosen"), coach guidance, live word/char counters, and STAR method helper tags.
  3. **Turn Feedback Modal**: Instant color-coded critique (Strengths, Areas to Polish, Suggested Stronger Angle, and Score out of 10).
  4. **Session Summary Debrief**: Executive readiness rating, overall score, key strengths vs growth focus, and expandable turn-by-turn transcript review.
