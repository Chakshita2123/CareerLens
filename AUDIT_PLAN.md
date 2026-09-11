# CareerLens — Full System Audit & 9-Phase Polish Plan

## Production Status & Deployment Baseline
- **Frontend**: `https://careerlens-1-y5zn.onrender.com/` (Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Lucide)
- **Backend**: `https://careerlens-d3vi.onrender.com/` (FastAPI, Python 3.10+, Motor/MongoDB, Sentence-Transformers `all-MiniLM-L6-v2`, spaCy, ReportLab, Gemini/Groq LLM fallbacks)

---

## Phase 1 Audit

### 1. Current Strengths
- **Modular Pipeline**: Clean separation between deterministic rule-based algorithms (ATS scoring in `ats_scorer.py`, job matching in `job_match_scorer.py`), embedding NLP (`semantic_engine.py`), and LLM generative enhancements (`bullet_improver.py`, `mock_interview.py`).
- **Resilient Fallbacks**: Three-tier LLM fallback (`Gemini 1.5 Flash` → `Groq Llama 3.1 8B` → offline template mock) ensures zero crashes when API keys are absent or rate-limited.
- **Render Memory Tuning**: Explicit thread caps (`OMP_NUM_THREADS=1`, `TORCH_NUM_THREADS=1`) and `.hf_cache` local caching prevent memory blowouts on 512MB RAM free-tier instances.
- **Feature Richness**: Resume parsing (PDF/DOCX), 7-category ATS scoring, single and multi-JD semantic matching, 25+ curated tech roles recommendation, AI bullet re-writing, historical version tracking with deltas, interactive mock interview sessions with answer feedback, and ReportLab PDF diagnostic export.

### 2. Current UX/UI Problems
- **Hero & Landing Page Hierarchy**: The landing page immediately displays an upload dropzone without first establishing the value proposition, pipeline explanation, or visual demonstrations.
- **Over-indexed Technical Terminology**: Overuse of optical/camera jargon ("f-stop compatibility", "optical blindspots", "aperture calibrating") confuses users looking for straightforward recruiter insights.
- **Score Breakdown Clarity**: ATS results show raw categories, but do not clearly group into **Strengths** (what's working), **Issues** (what's hurting the score), and **Actionable Improvements** (step-by-step remedies).
- **Cold Start Feedback**: Render free-tier spin-up takes 30–60s on cold requests. When the backend is waking up, users see generic loading spinners and may believe the app has frozen.
- **Direct Version-to-Version Comparison**: While `comparison/page.tsx` shows an area chart of scores over time, it lacks an explicit "Version A vs Version B" differential analysis (comparing specific skills added/removed and per-category score jumps).

### 3. Broken or Fragile Flows
- **Mobile Navigation**: Navigation items hide their text labels on small viewports, leaving unlabeled icons without a dedicated mobile drawer or menu.
- **Error Messages**: If the backend returns a network failure or a 500 error, some screens display raw HTTP error details or toast messages without a retry button or helpful troubleshooting instructions.
- **Local Sandbox Stored State Sync**: `useSelectedVersion` relies on localStorage, which can desynchronize if a version was deleted or if multiple tabs are open with different user sessions.
- **Empty States**: If a user navigates to `/match`, `/roles`, `/improve`, or `/interview` without uploading a resume first, they encounter disconnected states.

### 4. Visual Inconsistencies & Aesthetics
- **Card Padding & Borders**: Inconsistent card radiuses (mix of `rounded-xl` and `rounded-2xl`) and border opacity levels across pages.
- **Button Styles**: Varied button heights, styles, and hover transitions across the 6 different sub-pages.
- **HUD & Reticles**: Reticle corner marks are hardcoded with varied sizes and inconsistent opacity on cards.

### 5. Performance Issues
- **Unnecessary Re-renders in Long Lists**: Interview transcripts and Multi-JD comparisons re-render heavy motion components on state changes.
- **Bundle Optimization**: Framer motion layout animations on large DOM subtrees can cause micro-stutters on mobile.

### 6. Accessibility (A11y)
- Select dropdowns and file inputs lack explicit `<label>` associations in some components.
- Color contrast for muted slate text (`text-slate-500` on `#0e121a`) fails WCAG AA contrast ratio standards in some metadata footers.
- Interactive score breakdown cards lack `aria-expanded` and keyboard navigation support (`onKeyDown` for Enter/Space).

### 7. Mobile / Responsive Issues
- Multi-JD comparison tables overflow horizontally on mobile screens under 640px width.
- The ApertureGauge can dominate mobile viewports if sized too large.
- Sticky navbar takes vertical screen real estate without collapsing on scroll.

### 8. Opportunities to Make CareerLens Feel Like an Elite SaaS Product
- Add an authentic **"Scan → Understand → Improve → Prepare"** visual workflow.
- Introduce an interactive **Resume Live Viewfinder Scanner** visualization on the landing page.
- Clear **Strengths / Issues / Actionable Advice** tri-fold in the ATS Dashboard.
- Provide a side-by-side **Version Comparison Diff** (Version A vs Version B).
- Enhance the **Mock Interview** experience with structured STAR feedback, answer coaching, and session debriefs.
- Friendly, branded **Render Cold-Start Assistant** that reassures users during backend spin-up.

---

## 9-Phase Implementation Roadmap

- **Phase 1**: Audit existing code and understand architecture. *(Completed)*
- **Phase 2**: Fix critical bugs/reliability issues (cold-start feedback, error boundaries, retry states).
- **Phase 3**: Improve global design system (typography, tokens, accessible components, cohesive dark mode).
- **Phase 4**: Improve landing page & navigation (hero, optical scan showcase, mobile navigation drawer).
- **Phase 5**: Improve core analysis flows (ATS dashboard strengths/issues/actions, job match 5-sec scannability, role guidance).
- **Phase 6**: Improve AI features & mock interview (bullet rewrites with STAR clarity, Version A vs B comparison, mock interview structured feedback).
- **Phase 7**: Responsive, accessibility & performance pass (WCAG contrast, touch targets, keyboard navigation).
- **Phase 8**: Recruiter-ready README & documentation (architecture, AI/ML breakdown, 60-second overview).
- **Phase 9**: Final checklist & verification report.
