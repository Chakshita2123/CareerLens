"""
Phase 5 — Curated Role Bank
============================
Hand-written starter set of ~25 common tech job roles used by the Phase 5
Role Recommender. Each entry is realistic enough for meaningful semantic
matching against a resume, but deliberately concise.

TODO (future phases): Replace or augment this with a real dataset — e.g.
from Kaggle job postings (https://www.kaggle.com/datasets/promptcloud/jobs-on-naukricom)
or similar — once we add MongoDB storage (Phase 6) and a data-ingestion pipeline.

Schema per role:
    role_title       : str          Human-readable job title
    description      : str          2-3 sentence realistic role summary
    required_skills  : List[str]    Key skills/technologies expected for this role.
                                    Use gazetteer-canonical names where possible
                                    (matches Phase 1 / Phase 3 skill names exactly)
                                    and descriptive phrases for softer skills.
    experience_level : str          "entry" | "mid" | "senior"
"""

from typing import Dict, List

# ---------------------------------------------------------------------------
# Type alias for readability
# ---------------------------------------------------------------------------
Role = Dict  # keys: role_title, description, required_skills, experience_level

# ---------------------------------------------------------------------------
# ROLE_BANK  — 25 hand-curated tech roles
# Edit freely: add roles, adjust required_skills, tune experience_level.
# The recommender re-ranks at runtime so order here does not matter.
# ---------------------------------------------------------------------------
ROLE_BANK: List[Role] = [

    # ── Frontend ─────────────────────────────────────────────────────────────
    {
        "role_title": "Frontend Developer",
        "description": (
            "Builds responsive, accessible user interfaces using modern JavaScript "
            "frameworks. Collaborates with designers to turn Figma/XD mockups into "
            "production-ready components and owns client-side performance."
        ),
        "required_skills": [
            "React", "JavaScript", "TypeScript", "HTML", "CSS",
            "responsive design", "REST", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Senior Frontend Engineer",
        "description": (
            "Leads front-end architecture decisions, mentors junior engineers, and "
            "drives performance optimisation and accessibility standards. Owns the "
            "component library and front-end build pipeline."
        ),
        "required_skills": [
            "React", "TypeScript", "Next.js", "JavaScript", "CSS",
            "performance optimisation", "CI/CD", "Git", "GraphQL",
        ],
        "experience_level": "senior",
    },

    # ── Backend ───────────────────────────────────────────────────────────────
    {
        "role_title": "Backend Developer",
        "description": (
            "Designs and maintains server-side APIs, business logic, and database "
            "schemas. Works closely with frontend and DevOps teams to ensure "
            "reliable, scalable service delivery."
        ),
        "required_skills": [
            "Python", "REST", "PostgreSQL", "SQL", "Docker", "Git",
            "API design", "Node.js",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Senior Backend Engineer",
        "description": (
            "Architects distributed backend systems for high throughput and "
            "reliability. Owns service decomposition, database performance, and "
            "on-call incident response for critical infrastructure."
        ),
        "required_skills": [
            "Python", "Go", "PostgreSQL", "Redis", "Kafka",
            "microservices", "Docker", "Kubernetes", "CI/CD", "AWS",
        ],
        "experience_level": "senior",
    },

    # ── Full-Stack ────────────────────────────────────────────────────────────
    {
        "role_title": "Full-Stack Developer",
        "description": (
            "Builds features end-to-end across the React frontend and Python/Node "
            "backend. Owns full feature delivery from database migrations through "
            "to polished UI, working closely with product managers."
        ),
        "required_skills": [
            "React", "JavaScript", "Node.js", "Python", "PostgreSQL",
            "REST", "Docker", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Full-Stack Engineer (Senior)",
        "description": (
            "Leads cross-functional squads to deliver full-stack features at scale. "
            "Sets technical standards, conducts design reviews, and drives "
            "infrastructure reliability alongside the DevOps team."
        ),
        "required_skills": [
            "React", "TypeScript", "Node.js", "Python", "PostgreSQL",
            "Redis", "Docker", "Kubernetes", "AWS", "CI/CD", "Git",
        ],
        "experience_level": "senior",
    },

    # ── Data & Analytics ──────────────────────────────────────────────────────
    {
        "role_title": "Data Analyst",
        "description": (
            "Extracts insights from structured data using SQL, Python, and BI tools. "
            "Builds dashboards, runs ad-hoc analyses, and communicates findings to "
            "non-technical stakeholders to support data-driven decisions."
        ),
        "required_skills": [
            "SQL", "Python", "Pandas", "data visualisation",
            "Excel", "statistics", "Git",
        ],
        "experience_level": "entry",
    },
    {
        "role_title": "Data Engineer",
        "description": (
            "Designs and maintains data pipelines, warehouses, and ETL workflows. "
            "Ensures reliable, performant data availability for analytics and "
            "machine learning teams."
        ),
        "required_skills": [
            "Python", "SQL", "Spark", "Kafka", "PostgreSQL",
            "cloud data warehousing", "AWS", "Docker", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Business Intelligence Developer",
        "description": (
            "Builds and maintains BI dashboards and reports for executive and "
            "operational teams. Partners with data engineering to model data in "
            "a warehouse and creates self-service analytics tooling."
        ),
        "required_skills": [
            "SQL", "data visualisation", "Tableau", "Power BI",
            "Python", "data modelling", "Pandas",
        ],
        "experience_level": "mid",
    },

    # ── Machine Learning / AI ─────────────────────────────────────────────────
    {
        "role_title": "Machine Learning Engineer",
        "description": (
            "Trains, evaluates, and deploys production ML models. Owns the model "
            "lifecycle from feature engineering and experimentation through to "
            "serving infrastructure and monitoring."
        ),
        "required_skills": [
            "Python", "scikit-learn", "TensorFlow", "PyTorch", "Pandas",
            "NumPy", "MLOps", "Docker", "AWS", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Data Scientist",
        "description": (
            "Uses statistical modelling and machine learning to turn raw data into "
            "actionable insights and predictive systems. Works closely with product "
            "and engineering to frame problems and validate hypotheses."
        ),
        "required_skills": [
            "Python", "scikit-learn", "Pandas", "NumPy", "statistics",
            "data visualisation", "SQL", "TensorFlow", "PyTorch",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "AI / LLM Engineer",
        "description": (
            "Builds applications and pipelines on top of large language models, "
            "fine-tunes or prompt-engineers foundation models, and evaluates "
            "LLM outputs for quality and safety at scale."
        ),
        "required_skills": [
            "Python", "PyTorch", "Hugging Face", "LangChain",
            "prompt engineering", "REST", "Docker", "AWS",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "ML Research Engineer",
        "description": (
            "Implements and benchmarks novel research ideas, translates academic "
            "papers into runnable code, and collaborates with research scientists "
            "to publish results and integrate findings into products."
        ),
        "required_skills": [
            "Python", "PyTorch", "TensorFlow", "NumPy", "Hugging Face",
            "research", "distributed training", "Git",
        ],
        "experience_level": "senior",
    },

    # ── DevOps / Platform ─────────────────────────────────────────────────────
    {
        "role_title": "DevOps Engineer",
        "description": (
            "Builds and maintains CI/CD pipelines, infrastructure-as-code, and "
            "monitoring stacks. Partners with engineering teams to improve "
            "deployment velocity and system reliability."
        ),
        "required_skills": [
            "Docker", "Kubernetes", "CI/CD", "AWS", "Terraform",
            "Linux", "Python", "Git", "monitoring",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Site Reliability Engineer (SRE)",
        "description": (
            "Owns uptime, latency, and error-rate SLOs for production services. "
            "Automates toil, conducts post-mortems, and leads capacity planning "
            "to keep large-scale systems reliable."
        ),
        "required_skills": [
            "Kubernetes", "Docker", "AWS", "Python", "Go",
            "CI/CD", "Linux", "observability", "Terraform",
        ],
        "experience_level": "senior",
    },
    {
        "role_title": "Cloud Infrastructure Engineer",
        "description": (
            "Provisions and manages cloud resources across AWS/GCP/Azure, defines "
            "infrastructure-as-code standards, and enforces security and cost "
            "governance policies at the organisational level."
        ),
        "required_skills": [
            "AWS", "GCP", "Azure", "Terraform", "Kubernetes",
            "Docker", "Linux", "CI/CD", "Python",
        ],
        "experience_level": "mid",
    },

    # ── Mobile ────────────────────────────────────────────────────────────────
    {
        "role_title": "iOS Developer",
        "description": (
            "Builds native iPhone and iPad applications in Swift, following Apple "
            "HIG guidelines. Owns end-to-end feature delivery from prototyping "
            "to App Store release and post-launch monitoring."
        ),
        "required_skills": [
            "Swift", "iOS", "Xcode", "REST", "Git",
            "mobile UI design", "unit testing",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Android Developer",
        "description": (
            "Designs and ships Android applications in Kotlin, following Material "
            "Design guidelines. Optimises for a wide range of device form-factors "
            "and Android versions."
        ),
        "required_skills": [
            "Kotlin", "Android", "Java", "REST", "Git",
            "Jetpack Compose", "mobile UI design",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "React Native Developer",
        "description": (
            "Builds cross-platform mobile apps that share a single React Native "
            "codebase across iOS and Android. Works with native module authors "
            "when bridging is required."
        ),
        "required_skills": [
            "React Native", "JavaScript", "TypeScript", "React",
            "REST", "Git", "mobile testing",
        ],
        "experience_level": "mid",
    },

    # ── QA & Security ─────────────────────────────────────────────────────────
    {
        "role_title": "QA Engineer",
        "description": (
            "Designs and maintains automated test suites (unit, integration, E2E) "
            "and gates releases through CI/CD pipelines. Advocates for quality "
            "across the engineering organisation."
        ),
        "required_skills": [
            "test automation", "Python", "JavaScript", "CI/CD",
            "Selenium", "REST API testing", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Security Engineer",
        "description": (
            "Identifies and remediates security vulnerabilities across application "
            "and infrastructure layers. Builds automated security tooling, manages "
            "threat modelling, and leads penetration testing exercises."
        ),
        "required_skills": [
            "Python", "Linux", "network security", "penetration testing",
            "AWS", "Docker", "cryptography", "Git",
        ],
        "experience_level": "senior",
    },

    # ── Specialised / Emerging ────────────────────────────────────────────────
    {
        "role_title": "Blockchain Developer",
        "description": (
            "Develops smart contracts and decentralised applications on Ethereum "
            "or similar chains. Audits contract security and integrates on-chain "
            "data with Web2 backends."
        ),
        "required_skills": [
            "Solidity", "Ethereum", "JavaScript", "Python",
            "smart contracts", "REST", "Git",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Embedded / Firmware Engineer",
        "description": (
            "Writes low-level firmware and device drivers for microcontrollers and "
            "embedded Linux platforms. Works with hardware teams to bring up new "
            "silicon and build real-time systems."
        ),
        "required_skills": [
            "C", "C++", "embedded systems", "Linux", "RTOS",
            "Git", "debugging", "communication protocols",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Database Administrator",
        "description": (
            "Manages database provisioning, performance tuning, backup/recovery, "
            "and schema migrations for relational and NoSQL systems. Ensures data "
            "integrity, availability, and access control."
        ),
        "required_skills": [
            "PostgreSQL", "MySQL", "SQL", "MongoDB",
            "database performance", "Linux", "AWS", "backup and recovery",
        ],
        "experience_level": "mid",
    },
    {
        "role_title": "Technical Lead / Engineering Manager",
        "description": (
            "Leads a squad of 4-8 engineers, sets technical direction, conducts "
            "design reviews, and partners with Product to define the roadmap. "
            "Balances hands-on coding with mentorship and project delivery."
        ),
        "required_skills": [
            "system design", "code review", "mentoring",
            "Python", "REST", "Docker", "AWS", "CI/CD", "Git",
            "stakeholder communication",
        ],
        "experience_level": "senior",
    },
]
