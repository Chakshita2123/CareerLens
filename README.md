# CareerLens — AI-Powered Resume Intelligence & Job Matching Platform

CareerLens is a full-stack AI/ML platform that analyzes a candidate's resume, benchmarks it against job descriptions using semantic (not just keyword) matching, and provides actionable, AI-guided feedback to improve job-search outcomes. It combines deterministic scoring, sentence-embedding-based NLP, and grounded LLM assistance into one cohesive career-intelligence tool.

> Built as both a college project and a portfolio piece, with a distinctive "Optical Lens & Viewfinder" visual identity — the UI treats scoring and analysis as a camera bringing your resume into focus.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Resume Parser** | Extracts structured data (skills, education, experience, projects, certifications, contact info) from PDF/DOCX resumes |
| **ATS Compatibility Score** | Deterministic, rule-based scoring across section completeness, contact info, bullet quality, resume length, skill density, and formatting — with a transparent per-category breakdown |
| **Semantic Job Matching** | Uses sentence-transformer embeddings to catch related skills even when exact keywords differ (e.g. "React" ↔ "component-based UI frameworks") |
| **Job Match Score** | Weighted combination of exact/semantic skill overlap, holistic semantic similarity, and experience-level alignment against a specific job description |
| **Multi-JD Comparison** | Compare one resume against multiple job descriptions side-by-side to find the strongest-fit role |
| **Job Role Recommender** | Benchmarks the resume against a curated bank of tech roles and surfaces skill gaps per role |
| **AI Bullet-Point Improvements** | LLM-powered rewrite suggestions for weak resume bullets — strictly grounded in the original claim, with placeholder metrics rather than invented numbers |
| **Resume Version Comparison** | Tracks ATS and Job Match scores across multiple saved resume versions, with score deltas over time |
| **PDF Export** | Download a clean, professional analysis report (ATS score, job match, role recommendations) |
| **Interactive Mock Interview** | AI-generated interview questions (behavioral + technical) grounded in your resume and target JD, with structured, honest feedback per answer and a session debrief |

---

## 🛠️ Tech Stack

**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
**Backend:** FastAPI (Python)
**Database:** MongoDB (via Motor, async driver)
**NLP/ML:**
- `sentence-transformers` (`all-MiniLM-L6-v2`) — semantic similarity & skill matching
- `spaCy` — named entity recognition / resume parsing
- `pdfplumber` / `python-docx` — resume text extraction
**LLM Layer:** Gemini (primary) → Groq (fallback) → deterministic mock (last resort) — used only for bullet-point suggestions and mock interview feedback, kept fully isolated from deterministic scoring
**PDF Generation:** WeasyPrint (HTML/CSS-based report rendering)

---

## 🏗️ Architecture

The backend is organized into independently testable modules that mirror the product's build phases:

```
parser.py              → Resume text extraction & structuring
ats_scorer.py           → Rule-based ATS Compatibility Score
semantic_matcher.py     → Sentence-embedding skill matching engine
job_match_scorer.py     → Combined Job Match Score
role_recommender.py     → Curated role bank + role fit ranking
bullet_improver.py      → LLM-powered bullet rewrite suggestions
mock_interview.py       → AI interview question generation + answer feedback
pdf_report.py           → PDF report generation
main.py                 → FastAPI routes tying it all together
database.py             → MongoDB collections & connection handling
models.py               → Pydantic request/response schemas
```

The frontend (`careerlens-ui/`) is a Next.js app with pages for Upload, Job Match, Roles, Improve, History, and Interview, all built around a shared "Optical Lens" design system (custom `ApertureGauge`, `ViewfinderFrame`, `ScanSweep`, and `SkillChip` components).

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (local instance or MongoDB Atlas free tier)
- Gemini and/or Groq API keys (optional — the app falls back to mock responses without them)

### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt --break-system-packages

# Download the spaCy model
python -m spacy download en_core_web_sm

# Set up environment variables
cp .env.example .env
# Fill in: MONGODB_URI, GEMINI_API_KEY, GROQ_API_KEY

# Run the FastAPI server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd careerlens-ui
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 📸 Screenshots

*(Add screenshots of the Landing page, ATS score result, Job Match analysis, and Mock Interview flow here)*

---

## 🗺️ Roadmap / Possible Future Additions

- Real authentication (currently uses a simple persisted user identifier, auth-ready schema)
- Cover letter generator
- Shareable public results link
- LinkedIn summary optimizer

---

## ⚠️ Disclaimer

CareerLens provides AI-generated guidance for resume and interview preparation. Scores and suggestions are meant to inform, not guarantee, outcomes with any specific ATS system or employer.

---

