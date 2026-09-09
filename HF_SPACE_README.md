---
title: CareerLens Backend
emoji: 🔍
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---

# CareerLens Backend API

FastAPI backend for [CareerLens](https://github.com/Chakshita2123/CareerLens) — an AI-powered resume intelligence and job matching platform.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/resumes/upload` | Upload resume (.pdf/.docx) and get ATS score |
| `GET` | `/resumes/{user_id}` | List all saved resume versions for a user |
| `POST` | `/resumes/{version_id}/match` | Match a resume version against a job description |
| `POST` | `/resumes/{version_id}/match-multiple` | Compare resume against multiple JDs |
| `GET` | `/resumes/{user_id}/comparison` | Score progression across all resume versions |
| `POST` | `/resumes/{version_id}/improve-bullets` | LLM-powered bullet-point rewrite suggestions |
| `GET` | `/resumes/{version_id}/recommendations` | Top role recommendations |
| `GET` | `/resumes/{version_id}/pdf-report` | Download PDF analysis report |
| `POST` | `/interviews/start` | Start a mock interview session |
| `POST` | `/interviews/{session_id}/answer` | Submit an interview answer |
| `GET` | `/interviews/{session_id}` | Get interview session detail |
| `GET` | `/interviews/{session_id}/summary` | Get session debrief summary |

Interactive API docs are available at `/docs` (Swagger UI).

## Environment Variables (Secrets)

Set these via **Settings → Repository secrets** in the HF Space UI — never bake credentials into the image:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string (Atlas recommended) |
| `DATABASE_NAME` | MongoDB database name (default: `careerlens`) |
| `GEMINI_API_KEY` | Google Gemini API key (optional — falls back to Groq/mock) |
| `GROQ_API_KEY` | Groq API key (optional — falls back to mock) |

## Tech Stack

- **FastAPI** + **uvicorn** (port 7860)
- **sentence-transformers** (`all-MiniLM-L6-v2`) — semantic skill matching
- **ReportLab** — PDF report generation
- **Motor** — async MongoDB driver
- **CPU-only PyTorch** — keeps image size manageable on the free tier
