# InterviewIQ

InterviewIQ turns a resume into a structured interview profile using Groq.

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

## Resume analysis API

`POST /api/resume/analyze` accepts a multipart form upload with the field name
`resume`. PDF, TXT, and Markdown files up to 5 MB are supported. The response
contains the original file name and a structured analysis covering candidate
contact details, summary, skills, experience, education, projects,
certifications, strengths, improvement areas, and suggested roles.

The Groq key is used only by the backend and is never sent to the browser.