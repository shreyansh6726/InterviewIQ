# InterviewIQ Agent Guidelines

## Project Context

InterviewIQ is an AI-assisted mock interview and performance analysis platform for students and job candidates preparing for technical and HR placement interviews. It combines resume-aware interview questions, browser-based voice interaction, speech analysis, interview scoring, and dashboards for candidates and recruiters.

The primary user flow is:

1. A candidate registers or logs in.
2. The candidate uploads a PDF or text resume.
3. The candidate selects a target role and interview round.
4. The system generates or selects relevant questions using the resume and configured AI integrations.
5. The candidate answers through text or browser speech recognition while using the webcam preview.
6. The backend analyzes answers and speech patterns, stores the session, and calculates technical, communication, and confidence scores.
7. The candidate reviews a report with strengths, weaknesses, recommendations, and benchmark answers.
8. Recruiters or administrators review candidate history and cohort-level readiness metrics.

## Problem Statement

Candidates often have the required academic knowledge but lack realistic interview practice, immediate feedback, and a consistent way to measure improvement. Generic question lists do not adapt to a candidate’s resume or target role, while human-led practice is difficult to schedule and does not always provide objective analysis of communication, fluency, or technical depth.

The project addresses the need for an accessible practice environment that simulates an interview, evaluates both the content and delivery of answers, and turns each session into actionable preparation feedback.

## Proposed Solution

InterviewIQ provides an end-to-end practice loop through a web application:

- Resume parsing extracts skills, frameworks, and projects to personalize questions.
- A configurable AI question and evaluation service uses LLM integrations when available and retains intelligent rule-based or curated fallbacks when they are not.
- Browser Speech APIs provide text-to-speech questions and speech-to-text answers without requiring a separate voice service.
- Backend NLP heuristics measure speech cadence, words per minute, hesitation, filler words, and answer quality.
- SQLAlchemy and SQLite persist users, resumes, interview sessions, questions, answers, and reports.
- Candidate dashboards show historical scores and placement-readiness trends.
- Admin dashboards provide candidate rosters, batch performance, and cohort analytics.

## Project Overview

InterviewIQ is a full-stack mock-interview platform:

- `backend/` contains the FastAPI API, SQLAlchemy models, SQLite persistence, authentication, resume parsing, interview services, and admin endpoints.
- `frontend/` contains the React 18/Vite client, Tailwind styling, interview flows, dashboards, and browser speech/webcam integrations.
- The API is served on `http://localhost:8000`; the Vite development server is served on `http://localhost:5173`.
- The backend uses Python 3.12, FastAPI, Uvicorn, Pydantic, SQLAlchemy, SQLite, JWT authentication, PDF extraction, and optional Groq, Gemini, or OpenAI integrations.
- The frontend uses React 18, Vite, Tailwind CSS, Lucide icons, Canvas Confetti, browser speech recognition, and webcam preview components.
- See [README.md](README.md) for the full feature list, architecture diagram, and setup details.

## Repository Conventions

- Keep backend changes within the existing FastAPI structure: routes handle HTTP concerns, schemas define request/response validation, models define persistence, and services contain interview, NLP, and resume-processing logic.
- Keep frontend changes organized by responsibility: reusable UI belongs in `frontend/src/components/`, screen-level flows in `frontend/src/pages/`, and API/browser helpers in `frontend/src/utils/`.
- Preserve the existing API prefix (`/api`) and the endpoint contracts consumed by `frontend/src/utils/api.js`.
- Use the existing React functional-component and hook patterns. Match the current Tailwind utility styling and dark visual theme.
- Use environment variables for secrets and optional LLM keys. Never commit `.env` files, API keys, tokens, database credentials, or generated local databases.
- Do not edit `backend/venv/` or `frontend/node_modules/`; they are local dependency directories.
- Make focused changes and update the README when setup, scripts, endpoints, or user-visible behavior changes.

## Local Development

From the repository root on Windows:

```bat
setup.bat
start.bat
```

For manual startup, use separate terminals:

```bat
cd backend
venv\Scripts\activate
python run.py
```

```bat
cd frontend
npm install
npm run dev
```

Backend environment values belong in `backend/.env`; use `.env.example` as the template. The FastAPI Swagger UI is available at `http://localhost:8000/docs`.

## Validation

- Frontend production build: `cd frontend && npm run build`
- Frontend local preview: `cd frontend && npm run preview`
- Backend smoke check: start the backend with `python run.py` and verify `http://localhost:8000/docs`.
- There is currently no configured automated test suite; when adding behavior, add focused tests or document a reproducible manual verification path.
- Run the smallest relevant validation after each change, then report any checks that could not be run.

## Change Safety

- Preserve authentication and authorization boundaries, especially the JWT flow and admin-only endpoints.
- Validate uploaded files, request payloads, and user-controlled content at the API boundary.
- Use SQLAlchemy/database helpers rather than ad hoc database access, and avoid destructive schema or data changes unless explicitly requested.
- Keep fallback behavior for optional LLM integrations intact unless the task explicitly changes it.
- Do not silently swallow new errors or return success-shaped fallback data; surface failures using the project’s existing error-handling patterns.
