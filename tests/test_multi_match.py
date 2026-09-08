"""
tests/test_multi_match.py
=========================
Validates the multi-JD matching logic against sample resume data and multiple JDs.
Confirms scoring, ranking, best-fit identification, and response shape.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from job_match_scorer import compute_job_match

SAMPLE_RESUME = {
    "contact_info": {
        "name": "Alex Mercer",
        "email": "alex@example.com",
    },
    "skills": [
        "React", "TypeScript", "JavaScript", "HTML5", "CSS3",
        "Python", "FastAPI", "PostgreSQL", "Docker", "Git", "REST APIs"
    ],
    "experience": [
        {
            "title_company": "Full-Stack Developer at CloudScale",
            "dates": "2022 - Present",
            "bullets": [
                "Built user-facing React applications with TypeScript.",
                "Engineered scalable REST APIs in Python using FastAPI and PostgreSQL.",
                "Containerized applications using Docker and deployed via CI/CD.",
            ]
        }
    ],
    "education": [{"raw": "B.S. Computer Science", "dates": "2018 - 2022"}],
    "projects": [],
    "certifications": [],
}

SAMPLE_JDS = [
    {
        "label": "Full-Stack Developer",
        "jd": """We are looking for a Full-Stack Developer to build features end-to-end across our React frontend and Python/Node backend services.
        Key Requirements:
        • Strong proficiency in React, JavaScript, TypeScript, and modern CSS.
        • Solid backend experience with Python, Node.js, and RESTful API architecture.
        • Experience with relational databases such as PostgreSQL and caching layers like Redis.
        • Familiarity with Docker, Git version control, and CI/CD pipelines.""",
    },
    {
        "label": "Data Scientist / ML Engineer",
        "jd": """We are seeking a Machine Learning Engineer to train, evaluate, and deploy deep learning models.
        Key Requirements:
        • Proficiency in PyTorch, TensorFlow, scikit-learn, and Pandas.
        • Strong foundation in statistical modeling, neural networks, and MLOps.
        • Experience with Kubernetes cluster training and GPU acceleration.""",
    },
    {
        "label": "Frontend Developer",
        "jd": """We are hiring a Frontend Developer to build responsive web interfaces using React.
        Key Requirements:
        • 2+ years of experience with React, TypeScript, HTML5, and CSS3.
        • Strong UI/UX sensibilities and design system implementation.
        • Familiarity with REST APIs, modern build tools, and Git.""",
    }
]

def run_test():
    print("=== Testing Multi-JD Comparison Logic ===")
    results = []
    best_score = -1
    best_label = None

    for item in SAMPLE_JDS:
        res = compute_job_match(SAMPLE_RESUME, item["jd"])
        score = int(res.get("job_match_score", 0))
        results.append({
            "label": item["label"],
            "score": score,
            "matched_skills": res.get("matched_skills", []),
            "missing_skills": res.get("missing_skills", []),
            "summary": res.get("summary", ""),
        })
        if score > best_score:
            best_score = score
            best_label = item["label"]

    print(f"Total JDs compared: {len(results)}")
    for r in results:
        print(f"\n  • Role: {r['label']}")
        print(f"    Match Score: {r['score']}%")
        print(f"    Matched ({len(r['matched_skills'])}): {r['matched_skills'][:4]}")
        print(f"    Missing ({len(r['missing_skills'])}): {r['missing_skills'][:3]}")

    print(f"\n★ BEST FIT IDENTIFIED: '{best_label}' with {best_score}% match.")
    assert best_label in ("Full-Stack Developer", "Frontend Developer"), f"Unexpected best fit: {best_label}"
    assert results[1]["score"] < results[0]["score"], "Data Scientist score should be lower than Full-Stack for this resume"
    print("\n[PASSED] Multi-JD comparison correctly identified strongest fit!")

if __name__ == "__main__":
    run_test()
