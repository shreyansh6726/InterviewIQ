require('dotenv').config();

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');

const app = express();
const port = Number(process.env.PORT) || 8000;
const interviewSessions = new Map();
const MAX_INTERVIEW_QUESTIONS = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    const allowedExtensions = ['.pdf', '.txt', '.md'];
    const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    callback(
      allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension)
        ? null
        : new Error('Only PDF, TXT, and Markdown resume files are supported.'),
      allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension),
    );
  },
});

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('This frontend origin is not allowed by the API.'));
  },
}));
app.use(express.json({ limit: '1mb' }));

function parseModelJson(content) {
  const withoutFence = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const objectStart = withoutFence.indexOf('{');
  const objectEnd = withoutFence.lastIndexOf('}');
  if (objectStart === -1 || objectEnd <= objectStart) {
    throw new Error('LUMEN returned invalid JSON.');
  }
  return JSON.parse(withoutFence.slice(objectStart, objectEnd + 1));
}

async function extractResumeText(file) {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const parsedPdf = await parser.getText();
      return parsedPdf.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  return file.buffer.toString('utf8').trim();
}

async function lumenChat(messages, options = {}) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'abcd') {
    throw new Error('GROQ_API_KEY is not configured. Add your Groq key to backend/.env.');
  }

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: options.temperature ?? 0.1,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
  });

  if (!groqResponse.ok) {
    const errorBody = await groqResponse.text();
    throw new Error(`Groq request failed (${groqResponse.status}): ${errorBody.slice(0, 300)}`);
  }
  const payload = await groqResponse.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('LUMEN received an empty Groq response.');
  return content;
}

async function analyzeResume(resumeText, jobDescription) {
  const content = await lumenChat([
    {
      role: 'system',
      content: `You are LUMEN, InterviewIQ's resume intelligence and job-fit analyst. Analyze only the resume and job description provided.
Return valid JSON with exactly these keys:
{
  "candidate": { "name": string, "email": string, "phone": string, "location": string, "headline": string },
  "summary": string,
  "jobFit": { "score": number, "matchedRequirements": string[], "missingRequirements": string[], "explanation": string },
  "skills": [{ "name": string, "category": "technical" | "soft" | "tool" | "domain" }],
  "experience": [{ "company": string, "role": string, "duration": string, "achievements": string[] }],
  "education": [{ "institution": string, "degree": string, "duration": string }],
  "projects": [{ "name": string, "description": string, "technologies": string[] }],
  "certifications": string[],
  "strengths": string[],
  "improvements": string[],
  "suggestedRoles": string[]
}
Use empty strings or arrays when information is not present. Do not invent facts. Keep text concise.`,
    },
    {
      role: 'user',
      content: `Resume text:\n${resumeText}\n\nJob description:\n${jobDescription || 'No job description supplied.'}`,
    },
  ], { json: true });
  return parseModelJson(content);
}

async function createInterviewQuestion(session) {
  const content = await lumenChat([
    {
      role: 'system',
      content: `You are LUMEN, a warm but rigorous voice interview coach. Ask exactly one interview question at a time.
Personalize it to the candidate and job description. Mix behavioral, technical, and role-fit questions.
Do not repeat previous questions. Return JSON: {"question": string, "type": "behavioral" | "technical" | "role-fit"}.`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        candidate: session.analysis.candidate,
        skills: session.analysis.skills,
        experience: session.analysis.experience,
        jobDescription: session.jobDescription,
        previousQuestions: session.answers.map((item) => item.question),
      }),
    },
  ], { json: true, temperature: 0.4 });
  return parseModelJson(content);
}

async function scoreInterview(session) {
  const content = await lumenChat([
    {
      role: 'system',
      content: `You are LUMEN, an interview evaluator. Evaluate the full transcript against the job description and profile.
Return JSON exactly:
{"overallScore": number, "technicalScore": number, "communicationScore": number, "relevanceScore": number, "summary": string, "strengths": string[], "improvements": string[], "recommendation": string}
Scores must be integers from 0 to 100. Be evidence-based and concise.`,
    },
    { role: 'user', content: JSON.stringify({ jobDescription: session.jobDescription, transcript: session.answers }) },
  ], { json: true });
  return parseModelJson(content);
}

app.get('/api/health', (request, response) => response.json({ status: 'ok' }));

app.post('/api/resume/analyze', upload.single('resume'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'Please upload a PDF, TXT, or Markdown resume.' });
    return;
  }
  try {
    const resumeText = await extractResumeText(request.file);
    if (resumeText.length < 30) {
      response.status(422).json({ error: 'The uploaded resume does not contain enough readable text.' });
      return;
    }
    const analysis = await analyzeResume(
      resumeText.slice(0, 50000),
      String(request.body.jobDescription || '').slice(0, 20000),
    );
    response.json({ fileName: request.file.originalname, analysis });
  } catch (error) {
    console.error('Resume analysis failed:', error);
    response.status(502).json({ error: error.message || 'Unable to analyze this resume.' });
  }
});

app.post('/api/interview/start', async (request, response) => {
  const { analysis, jobDescription } = request.body;
  if (!analysis || typeof analysis !== 'object') {
    response.status(400).json({ error: 'Analyze a resume before starting the LUMEN interview.' });
    return;
  }
  try {
    const session = { analysis, jobDescription: String(jobDescription || '').slice(0, 20000), answers: [] };
    const interviewId = crypto.randomUUID();
    session.question = await createInterviewQuestion(session);
    interviewSessions.set(interviewId, session);
    response.json({ interviewId, question: session.question });
  } catch (error) {
    console.error('LUMEN interview start failed:', error);
    response.status(502).json({ error: error.message || 'Unable to start the LUMEN interview.' });
  }
});

app.post('/api/interview/:interviewId/answer', async (request, response) => {
  const session = interviewSessions.get(request.params.interviewId);
  const answer = typeof request.body.answer === 'string' ? request.body.answer.trim() : '';
  if (!session) {
    response.status(404).json({ error: 'This interview session has expired. Start a new one.' });
    return;
  }
  if (!answer) {
    response.status(400).json({ error: 'LUMEN could not hear an answer. Please try again.' });
    return;
  }
  session.answers.push({ question: session.question.question, type: session.question.type, answer });
  try {
    if (session.answers.length >= MAX_INTERVIEW_QUESTIONS) {
      const score = await scoreInterview(session);
      interviewSessions.delete(request.params.interviewId);
      response.json({ complete: true, score });
      return;
    }
    session.question = await createInterviewQuestion(session);
    response.json({ complete: false, question: session.question, progress: session.answers.length });
  } catch (error) {
    console.error('LUMEN interview answer failed:', error);
    response.status(502).json({ error: error.message || 'Unable to continue the LUMEN interview.' });
  }
});

app.use((error, request, response, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'Resume files must be 5 MB or smaller.' });
    return;
  }
  if (error) {
    response.status(400).json({ error: error.message || 'Invalid upload.' });
    return;
  }
  next();
});

app.listen(port, () => console.log(`InterviewIQ API listening on http://localhost:${port}`));
