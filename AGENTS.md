# InterviewIQ Agent Guidelines

## Project Overview

InterviewIQ is a full-stack resume intelligence and voice interview practice
application. A candidate uploads a resume, optionally pastes a job
description, receives a LUMEN job-fit analysis, completes a voice-only
interview, and receives an AI-generated score and feedback.

The repository has two applications:

- `backend/` is a Node.js CommonJS Express API.
- `frontend/` is a Create React App client using React functional components.

The backend calls the Groq OpenAI-compatible API. LUMEN is the application
persona implemented by the backend prompts; it is not a separate provider or
frontend API.

## User Flow

1. The candidate uploads a PDF, TXT, or Markdown resume.
2. The candidate pastes an optional job description.
3. The backend extracts resume text and LUMEN returns:
   - Candidate details and summary
   - Job-fit score and matched requirements
   - Skills, experience, education, projects, and certifications
   - Strengths, improvements, and suggested roles
4. The candidate starts a LUMEN voice interview.
5. LUMEN asks five personalized behavioral, technical, and role-fit questions.
6. Browser Speech Synthesis reads questions aloud.
7. Browser Speech Recognition captures answers; there is intentionally no typed
   answer input in the interview flow.
8. LUMEN evaluates the transcript and returns overall, technical,
   communication, and relevance scores with feedback.

## Technology and Runtime

### Backend

- Node.js with Express
- `multer` for in-memory resume uploads
- `pdf-parse` for PDF text extraction
- `dotenv` for environment configuration
- Groq Chat Completions API for all LUMEN analysis
- In-memory interview sessions; sessions are lost when the process restarts
- Local API: `http://localhost:8000`

Backend entry point: `backend/server.js`.

### Frontend

- React and Create React App
- Browser Speech Recognition for voice answers
- Browser Speech Synthesis for LUMEN questions and completion messages
- Local development URL: `http://localhost:3000`
- Backend URL is read from `REACT_APP_API_URL`

Frontend entry point: `frontend/src/App.js`.

## API Contracts

Preserve the `/api` prefix and existing response shapes.

- `GET /api/health`
- `POST /api/resume/analyze`
  - Multipart field: `resume`
  - Optional multipart field: `jobDescription`
  - Supports PDF, TXT, and Markdown files up to 5 MB
- `POST /api/interview/start`
  - JSON body: `{ analysis, jobDescription }`
  - Returns `{ interviewId, question }`
- `POST /api/interview/:interviewId/answer`
  - JSON body: `{ answer }`
  - Returns the next question or final score data

Routes should handle HTTP concerns. Groq prompting and response parsing should
remain in backend service/helper functions rather than being duplicated in
frontend code.

## Environment and Secrets

Backend secrets belong only in `backend/.env` or the Render backend service:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
FRONTEND_URL=http://localhost:3000
```

The frontend may contain only the public backend URL:

```env
REACT_APP_API_URL=http://localhost:8000
```

Never put `GROQ_API_KEY` or another secret in `frontend/.env`. Create React App
embeds `REACT_APP_*` values into browser JavaScript, making them public.
Never commit `.env` files, API keys, tokens, database credentials, or generated
local data.

## Deployment

`render.yaml` defines the intended Render services:

- `interviewiq-api`: Node backend with private `GROQ_API_KEY`
- `interviewiq-web`: optional Render static frontend

The current frontend may also be deployed on Vercel. For the current deployed
URLs, backend Render configuration must allow the exact Vercel origin:

```env
FRONTEND_URL=https://interview-iq-three-dusky.vercel.app
```

The Vercel project must build with:

```env
REACT_APP_API_URL=https://interviewiq-ornw.onrender.com
```

After changing frontend environment variables, trigger a new Vercel build.
After changing backend source or environment variables, wait for the Render
deployment to finish before testing CORS or API behavior.

The backend CORS allowlist must remain explicit. Do not allow arbitrary
origins in production.

## Repository Conventions

- Keep backend changes in `backend/server.js` unless a focused helper/module is
  clearly warranted.
- Keep frontend UI and browser integration in `frontend/src/`.
- Use existing functional React and hook patterns.
- Keep the LUMEN name and user-facing voice consistent.
- Validate upload types, file size, request bodies, and external API failures.
- Keep Groq credentials server-side and never expose them in API responses,
  frontend source, logs, or error messages.
- Do not edit `backend/node_modules/`, `frontend/node_modules/`, or generated
  frontend `build/` output.
- Update `README.md` when setup, deployment, endpoint contracts, or
  user-visible behavior changes.
- Avoid unrelated refactors and preserve existing resume-analysis behavior when
  changing interview behavior.

## Local Development

From the repository root on Windows:

```bat
cd backend
npm install
npm start
```

In a second terminal:

```bat
cd frontend
npm install
npm start
```

Copy `frontend/.env.example` to `frontend/.env` and set the local or deployed
backend URL before starting the frontend.

## Validation

Run the smallest relevant checks:

```bat
cd backend
npm test
```

```bat
cd frontend
npm run build
```

For deployment troubleshooting, verify:

1. `GET /api/health` returns HTTP 200.
2. The backend Render service is running the latest deployment.
3. `FRONTEND_URL` exactly matches the browser origin, without a trailing slash.
4. The built frontend points to the correct `REACT_APP_API_URL`.
5. Browser microphone permission is granted and the browser supports Speech
   Recognition, such as Chrome or Edge.

There is currently no comprehensive automated test suite. Add focused tests or
document reproducible manual verification when introducing new behavior.

## Change Safety

- Surface Groq, parsing, upload, and speech-related failures explicitly.
- Do not silently return fabricated analysis, scores, or fallback success data.
- Do not broaden CORS to `*` while credentials or user data are involved.
- Preserve the backend-only secret boundary.
- Do not perform destructive data or filesystem operations without explicit
  user approval.
