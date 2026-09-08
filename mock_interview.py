"""
mock_interview.py — Interactive AI Mock Interview Engine
=========================================================
Generates personalized interview questions grounded in the user's parsed resume
and target job description, evaluates user answers with constructive critique
(strengths, improvements, suggested STAR angle), and aggregates an overall
session readiness report.

ISOLATION PRINCIPLE
-------------------
This module is purely diagnostic practice. It never mutates ATS scores or
job match history. All sessions live independently in the `interview_sessions` collection.

Provider chain (mirrors bullet_improver.py):
--------------------------------------------
1. Gemini (google-generativeai)  — primary
2. Groq (groq)                   — fallback if Gemini rate-limits or fails
3. Mock generator                — offline fallback; always succeeds, zero external calls
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY:   Optional[str] = os.getenv("GROQ_API_KEY")

# Tunable model configurations
GEMINI_MODEL: str = "gemini-1.5-flash"
GROQ_MODEL:   str = "llama-3.1-8b-instant"
DEFAULT_SESSION_QUESTIONS: int = 5


# ---------------------------------------------------------------------------
# JSON Extraction Helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Optional[Any]:
    """Extract valid JSON from LLM response text, stripping fences or extra text."""
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Strip markdown code blocks
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Extract first {...} or [...]
    obj_match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if obj_match:
        try:
            return json.loads(obj_match.group(1))
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# LLM Provider Callers
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, system_instruction: str = "") -> Optional[Any]:
    """Call Gemini API and return parsed JSON."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            GEMINI_MODEL,
            system_instruction=system_instruction if system_instruction else None
        )
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
        text = response.text or ""
        return _extract_json(text)
    except Exception as exc:
        print(f"[mock_interview] Gemini call failed: {exc}", file=sys.stderr)
        return None


def _call_groq(prompt: str, system_instruction: str = "") -> Optional[Any]:
    """Call Groq API and return parsed JSON."""
    if not GROQ_API_KEY:
        return None
    try:
        from groq import Groq  # type: ignore

        client = Groq(api_key=GROQ_API_KEY)
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
        text = completion.choices[0].message.content or ""
        return _extract_json(text)
    except Exception as exc:
        print(f"[mock_interview] Groq call failed: {exc}", file=sys.stderr)
        return None


def _call_llm_json(prompt: str, system_instruction: str = "") -> Optional[Any]:
    """Chain: Gemini -> Groq -> None."""
    data = _call_gemini(prompt, system_instruction)
    if data is not None:
        return data
    data = _call_groq(prompt, system_instruction)
    if data is not None:
        return data
    return None


# ---------------------------------------------------------------------------
# Question Generation
# ---------------------------------------------------------------------------

def _summarize_resume(parsed_resume: Dict[str, Any]) -> str:
    """Extract key resume anchors (skills, top roles, projects) for prompts."""
    skills = parsed_resume.get("skills", [])
    exp_list = parsed_resume.get("experience", [])
    proj_list = parsed_resume.get("projects", [])

    lines = [f"Skills: {', '.join(skills[:15]) if skills else 'None specified'}"]
    if exp_list:
        lines.append("Work Experience:")
        for exp in exp_list[:3]:
            role = exp.get("title_company", "Role")
            bullets = exp.get("bullets", [])
            lines.append(f"  • {role}")
            for b in bullets[:2]:
                lines.append(f"      - {b}")

    if proj_list:
        lines.append("Projects:")
        for p in proj_list[:2]:
            lines.append(f"  • {p.get('name', 'Project')}: {p.get('description', '')}")

    return "\n".join(lines)


def _generate_mock_questions(parsed_resume: Dict[str, Any], jd_text: Optional[str], count: int) -> List[Dict[str, Any]]:
    """Deterministic fallback questions grounded in candidate's resume data."""
    skills = parsed_resume.get("skills", ["Software Engineering"])
    exp = parsed_resume.get("experience", [])
    primary_skill = skills[0] if skills else "System Design"
    secondary_skill = skills[1] if len(skills) > 1 else "Modern Frameworks"
    
    first_role = exp[0].get("title_company", "your recent position") if exp else "your previous work"
    first_bullet = exp[0].get("bullets", ["delivering key project requirements"])[0] if exp and exp[0].get("bullets") else "a critical project delivery"

    questions: List[Dict[str, Any]] = [
        {
            "index": 0,
            "category": "warm_up",
            "question": "To start off, could you walk me through your background and what motivated you to pursue this role?",
            "context": "Initial conversational icebreaker to evaluate high-level narrative and career trajectory.",
            "suggested_focus": "Provide a concise 90-second journey: past foundations, recent achievements, and current alignment."
        },
        {
            "index": 1,
            "category": "behavioral",
            "question": f"In your role at {first_role}, you noted: \"{first_bullet}\". Could you walk me through a technical roadblock you encountered on that initiative and how you navigated it?",
            "context": "Behavioral inquiry grounded directly in your resume experience.",
            "suggested_focus": "Structure your answer using the STAR method (Situation, Task, Action, Result) with clear technical decisions."
        },
        {
            "index": 2,
            "category": "technical",
            "question": f"Given your experience with {primary_skill}, how do you approach architectural trade-offs such as scalability vs. delivery velocity when designing production systems?",
            "context": f"Core technical competency inquiry focused on {primary_skill}.",
            "suggested_focus": "Discuss specific design patterns, caching, concurrency, or testing strategies you've employed."
        }
    ]

    if jd_text:
        questions.append({
            "index": 3,
            "category": "technical",
            "question": f"The target job description emphasizes handling complex operational workflows with {secondary_skill}. Can you detail a production scenario where you utilized this tool under real-world constraints?",
            "context": "Direct assessment against core job description requirements.",
            "suggested_focus": "Highlight technical specifics, performance metrics, and edge cases you resolved."
        })
        questions.append({
            "index": 4,
            "category": "behavioral",
            "question": "Tell me about a time you had a technical disagreement with a teammate or stakeholder regarding project requirements or tech stack choices. How did you resolve it?",
            "context": "Interpersonal collaboration and conflict resolution assessment.",
            "suggested_focus": "Emphasize objective data-driven decision making, empathy, and positive team alignment."
        })
    else:
        questions.append({
            "index": 3,
            "category": "behavioral",
            "question": f"Can you describe an initiative where you had to quickly learn a new technology or framework to unblock a deliverable?",
            "context": "Adaptability and rapid learning capacity.",
            "suggested_focus": "Focus on your learning process, hands-on experimentation, and impact on project delivery."
        })
        questions.append({
            "index": 4,
            "category": "technical",
            "question": "How do you ensure code quality, observability, and regression prevention in continuous integration environments?",
            "context": "Engineering rigor and software craftsmanship.",
            "suggested_focus": "Mention unit/integration testing strategies, monitoring, and automated deployment pipelines."
        })

    return questions[:count]


def generate_interview_questions(
    parsed_resume: Dict[str, Any],
    jd_text: Optional[str] = None,
    num_questions: int = DEFAULT_SESSION_QUESTIONS,
) -> List[Dict[str, Any]]:
    """
    Generates a personalized question set based on resume experience + target JD.
    Returns a list of question dicts with category, question, context, suggested_focus.
    """
    num_questions = max(3, min(8, num_questions))
    resume_summary = _summarize_resume(parsed_resume)
    jd_snippet = (jd_text.strip()[:1200] if jd_text else "No target JD provided — focus broadly on candidate's technical profile.")

    system_prompt = (
        "You are an elite technical interviewer and engineering hiring manager. "
        "Your task is to generate realistic, personalized, rigorous interview questions "
        "tailored precisely to the candidate's resume and target job description.\n"
        "Return strictly valid JSON with no conversational filler."
    )

    user_prompt = f"""Generate exactly {num_questions} interview questions for this candidate.

[CANDIDATE RESUME SUMMARY]
{resume_summary}

[TARGET JOB DESCRIPTION]
{jd_snippet}

Requirements for the question sequence:
1. Question 0: Category "warm_up" — natural introductory question linking their background to the target domain.
2. Questions 1 to 2: Category "behavioral" — directly grounded in actual projects or bullet points from their resume (STAR format expected).
3. Remaining Questions: Category "technical" — probing technical depth on technologies mentioned in the JD and resume, architecture trade-offs, or skill gap areas.

Output format must be a JSON list of objects:
[
  {{
    "index": 0,
    "category": "warm_up",
    "question": "Question text...",
    "context": "Brief explanation of why this question is being asked based on their resume/JD",
    "suggested_focus": "Key elements the candidate should emphasize (e.g., STAR method, metrics)"
  }}
]
"""

    llm_output = _call_llm_json(user_prompt, system_prompt)

    if isinstance(llm_output, list) and len(llm_output) >= 3:
        cleaned_questions: List[Dict[str, Any]] = []
        for i, q in enumerate(llm_output[:num_questions]):
            cleaned_questions.append({
                "index": i,
                "category": str(q.get("category", "technical")),
                "question": str(q.get("question", "")).strip(),
                "context": str(q.get("context", "General interview question")),
                "suggested_focus": str(q.get("suggested_focus", "Focus on clear structured details")),
            })
        if len(cleaned_questions) >= 3:
            return cleaned_questions

    # Fallback to deterministic mock generator
    return _generate_mock_questions(parsed_resume, jd_text, num_questions)


# ---------------------------------------------------------------------------
# Answer Evaluation
# ---------------------------------------------------------------------------

def _mock_evaluate_answer(question: Dict[str, Any], answer: str) -> Dict[str, Any]:
    """Deterministic grounded critique when LLMs are offline."""
    words = answer.strip().split()
    length = len(words)

    strengths = []
    improvements = []

    if length >= 50:
        strengths.append("Thorough response length that allowed depth of explanation.")
    else:
        improvements.append("Response is somewhat brief; flesh out concrete actions and technical context.")

    # Check for metrics
    has_metrics = bool(re.search(r"\b(\d+%|\$\d+|\d+\s*(users|ms|seconds|x|million|k))\b", answer, re.I))
    if has_metrics:
        strengths.append("Included quantifiable metrics or numeric indicators of outcome.")
    else:
        improvements.append("Add measurable outcomes (e.g. latency reduction, scale, team velocity impact).")

    # Check for action verbs or STAR structure
    has_action = any(v in answer.lower() for v in ["designed", "built", "spearheaded", "implemented", "resolved", "led", "optimized"])
    if has_action:
        strengths.append("Used active ownership verbs that clarify your direct contribution.")
    else:
        improvements.append("Use the first-person active voice ('I architected', 'I diagnosed') rather than passive team phrasing.")

    if not strengths:
        strengths.append("Directly addressed the subject matter of the prompt.")
    if not improvements:
        improvements.append("Consider detailing any counter-measures or fallbacks you had in place.")

    score = 7 if (has_metrics and length >= 40) else (8 if length >= 70 else 6)
    readiness = "Strong Answer" if score >= 8 else ("Good Foundation" if score >= 6 else "Needs Polish")

    return {
        "strengths": strengths,
        "improvements": improvements,
        "suggested_angle": (
            f"Frame your response using the STAR model: state the technical constraint upfront, "
            f"detail 2 specific technical steps you took, and conclude with the measurable business or system result."
        ),
        "score": score,
        "readiness_label": readiness,
        "provider": "mock",
    }


def evaluate_answer(
    question: Dict[str, Any],
    answer: str,
    parsed_resume: Optional[Dict[str, Any]] = None,
    jd_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates candidate's answer to an interview question with structured, constructive critique.
    Returns:
      {
        "strengths": [str, ...],
        "improvements": [str, ...],
        "suggested_angle": str,
        "score": int (1-10),
        "readiness_label": str ("Strong Answer" | "Good Foundation" | "Needs Polish"),
        "provider": str
      }
    """
    if not answer or len(answer.strip()) < 10:
        return {
            "strengths": [],
            "improvements": ["Answer was too short or empty to evaluate. Aim for at least 3-4 structured sentences."],
            "suggested_angle": "Provide a complete response outlining the situation, your specific role, and the final outcome.",
            "score": 3,
            "readiness_label": "Needs Polish",
            "provider": "rule",
        }

    q_text = question.get("question", "")
    category = question.get("category", "general")
    focus = question.get("suggested_focus", "")

    system_prompt = (
        "You are an expert technical interviewer evaluating a job candidate's answer. "
        "Provide honest, constructive, grounded critique. Avoid empty praise or patronizing language. "
        "Assess structure (e.g. STAR method for behavioral), technical depth, clarity, and metrics. "
        "Return strictly valid JSON."
    )

    user_prompt = f"""[INTERVIEW QUESTION]
Category: {category}
Question: {q_text}
Key Expectation: {focus}

[CANDIDATE'S ANSWER]
"{answer}"

Critique this answer and return JSON with:
1. "strengths": List of 1-3 specific strong points (e.g., clear ownership, technical specificity, good structure).
2. "improvements": List of 1-3 actionable areas to strengthen (e.g., missing metrics, vague outcomes, lack of STAR progression).
3. "suggested_angle": A single concise paragraph showing how to reframe or elevate this answer into a top-tier executive response.
4. "score": Integer rating from 1 to 10 (10 = exceptional, 7-8 = solid hireable response, 4-6 = needs refinement, <4 = weak).
5. "readiness_label": Exactly one of "Strong Answer", "Good Foundation", or "Needs Polish".

JSON template:
{{
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "suggested_angle": "...",
  "score": 8,
  "readiness_label": "Strong Answer"
}}
"""

    llm_output = _call_llm_json(user_prompt, system_prompt)

    if isinstance(llm_output, dict) and "strengths" in llm_output and "improvements" in llm_output:
        score_val = int(llm_output.get("score", 7))
        score_val = max(1, min(10, score_val))
        readiness = llm_output.get("readiness_label") or ("Strong Answer" if score_val >= 8 else ("Good Foundation" if score_val >= 6 else "Needs Polish"))

        return {
            "strengths": [str(s) for s in llm_output.get("strengths", []) if s],
            "improvements": [str(i) for i in llm_output.get("improvements", []) if i],
            "suggested_angle": str(llm_output.get("suggested_angle", "")).strip(),
            "score": score_val,
            "readiness_label": str(readiness),
            "provider": "llm",
        }

    # Fallback to mock evaluator
    return _mock_evaluate_answer(question, answer)


# ---------------------------------------------------------------------------
# Session Summary Generation
# ---------------------------------------------------------------------------

def generate_session_summary(
    questions: List[Dict[str, Any]],
    answers: List[Dict[str, Any]],
    feedback_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Synthesizes overall interview performance across all completed turns.
    """
    scores = [fb.get("score", 7) for fb in feedback_list if isinstance(fb, dict) and "score" in fb]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 7.0

    all_strengths = []
    all_improvements = []
    for fb in feedback_list:
        if isinstance(fb, dict):
            all_strengths.extend(fb.get("strengths", []))
            all_improvements.extend(fb.get("improvements", []))

    # Take unique top strengths and improvements
    unique_strengths = list(dict.fromkeys(all_strengths))[:4]
    unique_improvements = list(dict.fromkeys(all_improvements))[:4]

    if avg_score >= 8.0:
        overall_verdict = "Interview Ready — High Confidence"
        takeaway = (
            f"You demonstrated compelling technical clarity and clear problem-solving ownership throughout the session. "
            f"Your responses averaged {avg_score}/10, reflecting strong narrative structure. Continue polishing quantifiable "
            f"impact numbers to make your answers truly unforgettable."
        )
    elif avg_score >= 6.0:
        overall_verdict = "Solid Baseline — Targeted Polish Needed"
        takeaway = (
            f"You established a solid foundation (average score: {avg_score}/10) with relevant technical context. "
            f"To elevate to top-tier status, adhere more strictly to the STAR methodology on behavioral queries and "
            f"articulate architectural trade-offs explicitly."
        )
    else:
        overall_verdict = "Developing — Needs Rehearsal"
        takeaway = (
            f"Your session (average score: {avg_score}/10) showed promising technical exposure, but answers lacked "
            f"depth and specific outcomes. Focus on preparing 3-4 anchor project stories with clear metrics before your live interview."
        )

    return {
        "average_score": avg_score,
        "overall_verdict": overall_verdict,
        "total_questions_answered": len(answers),
        "key_strengths": unique_strengths or ["Addressed each question directly with enthusiasm."],
        "key_growth_areas": unique_improvements or ["Incorporate more quantified metrics in project explanations."],
        "executive_takeaway": takeaway,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
