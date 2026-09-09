# =============================================================================
# CareerLens Backend — Hugging Face Spaces (Docker SDK)
# =============================================================================
# Target: HF Spaces free CPU tier (16 GB RAM)
# App port: 7860 (HF Spaces default for Docker SDK apps)
#
# Build:  docker build -t careerlens-backend .
# Run:    docker run -p 7860:7860 careerlens-backend
# =============================================================================

FROM python:3.11-slim

# ---------------------------------------------------------------------------
# System dependencies
# ---------------------------------------------------------------------------
# We need:
#   - build-essential / gcc   → compiling any C-extension wheels
#   - libgomp1                → OpenMP runtime (required by sentence-transformers
#                               / PyTorch on CPU via libgomp)
#   - curl                    → optional healthcheck / debugging
# WeasyPrint is NOT used; pdf_report.py uses ReportLab (pure Python) → no
# libpango/libcairo needed.
# spaCy is not imported anywhere in the codebase → no model download needed.
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libgomp1 \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Working directory
# ---------------------------------------------------------------------------
WORKDIR /app

# ---------------------------------------------------------------------------
# Python dependencies
# Install in a dedicated layer so Docker caches it unless requirements.txt
# changes. The extra-index-url for CPU-only PyTorch is already declared inside
# requirements.txt, so pip picks it up automatically.
# ---------------------------------------------------------------------------
COPY requirements.txt .

RUN pip install --upgrade pip --no-cache-dir \
    && pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Application code
# ---------------------------------------------------------------------------
COPY . .

# ---------------------------------------------------------------------------
# Environment — placeholder defaults
# Real secrets are injected at runtime via HF Spaces' Secrets UI (Settings →
# Repository secrets). Never bake credentials into the image.
# ---------------------------------------------------------------------------
ENV MONGO_URI=""
ENV DATABASE_NAME="careerlens"
ENV GEMINI_API_KEY=""
ENV GROQ_API_KEY=""

# Redirect HuggingFace / sentence-transformers model cache into /app/.hf_cache
# (same path that main.py already sets via os.environ.setdefault).
# This prevents models being downloaded on every cold start if the cache dir
# is mounted as a persistent volume.
ENV HF_HOME="/app/.hf_cache"
ENV TRANSFORMERS_CACHE="/app/.hf_cache"
ENV SENTENCE_TRANSFORMERS_HOME="/app/.hf_cache"
ENV HF_HUB_DISABLE_SYMLINKS_WARNING="1"

# ---------------------------------------------------------------------------
# Port — HF Spaces Docker SDK expects the app on 7860
# ---------------------------------------------------------------------------
EXPOSE 7860

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
