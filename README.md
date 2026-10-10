# InterviewIQ

InterviewIQ turns a resume and job description into a structured interview profile using
LUMEN, an InterviewIQ voice interview coach powered only by the server-side Groq API.

## Run locally

1. Put your Groq key in `backend/.env`:

   ```env
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=llama-3.3-70b-versatile
   ```

2. Start the API:

   ```bat
   cd backend
   npm install
   npm start
   ```

3. Start the React client in another terminal:

   ```bat
   cd frontend
   npm install
   npm start
   ```

The frontend runs at `http://localhost:3000` and the API at `http://localhost:8000`.

The frontend reads its backend URL from `frontend/.env`. Copy
`frontend/.env.example` to `frontend/.env` for local development:

```env
REACT_APP_API_URL=http://localhost:8000
```

`REACT_APP_API_URL` is a public browser configuration value. Never put
`GROQ_API_KEY`, an API token, or any backend secret in `frontend/.env`.

## Resume analysis API

`POST /api/resume/analyze` accepts a multipart form upload with the field name
`resume`. PDF, TXT, and Markdown files up to 5 MB are supported. The response
contains the original file name and a structured analysis covering candidate
contact details, summary, skills, experience, education, projects,
certifications, strengths, improvement areas, and suggested roles.

The Groq key is used only by the backend and is never sent to the browser.

## LUMEN voice interview

After resume analysis, select **Start voice interview**. LUMEN asks five
personalized behavioral, technical, and role-fit questions. The browser's
Speech Recognition API captures answers and Speech Synthesis reads questions
aloud; there is no typed answer field. At the end, LUMEN evaluates the
transcript and returns overall, technical, communication, and job-relevance
scores plus strengths, improvements, and a recommendation.

The interview endpoints are:

- `POST /api/interview/start` with `{ analysis, jobDescription }`
- `POST /api/interview/:interviewId/answer` with `{ answer }`

Voice input requires a browser with Speech Recognition support, such as
Chrome or Edge. Interview sessions are held in backend memory and expire when
the server restarts.

## Deploy with Render

The root `render.yaml` contains a two-service placeholder:

- `interviewiq-api`: Node backend with a private `GROQ_API_KEY` environment variable
- `interviewiq-web`: React static site configured to call the backend URL

In Render, create the Blueprint from `render.yaml`, enter the Groq key when
prompted for the `sync: false` variable, and replace the placeholder
`interviewiq-api.onrender.com` and `interviewiq-web.onrender.com` values with
the actual service URLs if Render assigns different names. The backend
`FRONTEND_URL` value controls CORS and may contain comma-separated frontend
origins.