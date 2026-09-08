"""
Unit and functional test suite for mock_interview.py
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mock_interview import (
    generate_interview_questions,
    evaluate_answer,
    generate_session_summary,
    _generate_mock_questions,
    _mock_evaluate_answer,
)

def test_mock_interview_pipeline():
    sample_parsed = {
        "skills": ["Python", "FastAPI", "Docker", "PostgreSQL", "React", "Next.js"],
        "experience": [
            {
                "title_company": "Senior Software Engineer — TechCorp",
                "dates": "2021 - Present",
                "bullets": [
                    "Architected high-throughput microservices handling 10k req/sec with FastAPI and Redis.",
                    "Led team of 4 engineers in migrating frontend to Next.js, cutting p95 load times by 40%."
                ]
            }
        ],
        "projects": [
            {
                "name": "Cloud Observability Dashboard",
                "description": "Real-time metrics aggregator built using Python and Docker."
            }
        ]
    }

    sample_jd = (
        "We are looking for a Senior Full-Stack Engineer proficient in Python, FastAPI, Docker, and PostgreSQL. "
        "Experience building scalable microservices and leading technical initiatives is highly valued."
    )

    print("--> 1. Testing Question Generation...")
    questions = generate_interview_questions(sample_parsed, sample_jd, num_questions=5)
    assert len(questions) == 5, f"Expected 5 questions, got {len(questions)}"
    assert questions[0]["category"] == "warm_up"
    print(f"    Generated {len(questions)} questions successfully.")
    for q in questions:
        print(f"    [{q['category'].upper()}] {q['question'][:75]}...")

    print("\n--> 2. Testing Answer Evaluation...")
    q1 = questions[1]
    candidate_answer = (
        "When we were scaling our microservices at TechCorp, we hit a severe redis connection pool exhaustion "
        "issue under peak traffic. I investigated the connection lifecycle, redesigned our connection leasing "
        "using an asynchronous pool in FastAPI, and deployed the patch. This eliminated 502 errors and lowered "
        "p99 latency by 35%."
    )

    feedback = evaluate_answer(q1, candidate_answer, sample_parsed, sample_jd)
    assert "strengths" in feedback, "Missing strengths in feedback"
    assert "improvements" in feedback, "Missing improvements in feedback"
    assert "suggested_angle" in feedback, "Missing suggested_angle in feedback"
    assert "score" in feedback, "Missing score in feedback"
    assert 1 <= feedback["score"] <= 10, f"Invalid score: {feedback['score']}"
    print(f"    Evaluation completed: Score={feedback['score']}/10 ({feedback['readiness_label']})")
    print(f"    Strengths: {feedback['strengths']}")
    print(f"    Suggested Angle: {feedback['suggested_angle'][:80]}...")

    print("\n--> 3. Testing Session Summary Generation...")
    answers = [
        {"question_index": 0, "answer_text": "I'm a software engineer with 5 years experience.", "feedback": feedback},
        {"question_index": 1, "answer_text": candidate_answer, "feedback": feedback},
    ]
    summary = generate_session_summary(questions[:2], answers, [feedback, feedback])
    assert "average_score" in summary
    assert "overall_verdict" in summary
    assert "executive_takeaway" in summary
    print(f"    Summary generated: Avg Score={summary['average_score']}, Verdict='{summary['overall_verdict']}'")

    print("\n[SUCCESS] Mock Interview unit test suite passed completely!")

if __name__ == "__main__":
    test_mock_interview_pipeline()
