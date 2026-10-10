require('dotenv').config();

const cors = require('cors');
const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');

const app = express();
const port = Number(process.env.PORT) || 8000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    const allowedExtensions = ['.pdf', '.txt', '.md'];
    const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only PDF, TXT, and Markdown resume files are supported.'));
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

function parseModelJson(content) {
  const withoutFence = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const objectStart = withoutFence.indexOf('{');
  const objectEnd = withoutFence.lastIndexOf('}');

  if (objectStart === -1 || objectEnd <= objectStart) {
    throw new Error('Groq returned an invalid resume analysis.');
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

async function analyzeResume(resumeText) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'abcd') {
    throw new Error('GROQ_API_KEY is not configured. Add your Groq key to backend/.env.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a resume parser and career coach. Analyze only the resume text provided by the user.
Return valid JSON with exactly these keys:
{
  "candidate": { "name": string, "email": string, "phone": string, "location": string, "headline": string },
  "summary": string,
  "skills": [{ "name": string, "category": "technical" | "soft" | "tool" | "domain" }],
  "experience": [{ "company": string, "role": string, "duration": string, "achievements": string[] }],
  "education": [{ "institution": string, "degree": string, "duration": string }],
  "projects": [{ "name": string, "description": string, "technologies": string[] }],
  "certifications": string[],
  "strengths": string[],
  "improvements": string[],
  "suggestedRoles": string[]
}
Use empty strings or empty arrays when information is not present. Do not invent facts. Keep summary, strengths, improvements, and role suggestions concise.`,
        },
        { role: 'user', content: `Resume text:\n\n${resumeText}` },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty resume analysis.');
  }

  return parseModelJson(content);
}

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' });
});

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

    const analysis = await analyzeResume(resumeText.slice(0, 50000));
    response.json({ fileName: request.file.originalname, analysis });
  } catch (error) {
    console.error('Resume analysis failed:', error);
    response.status(502).json({ error: error.message || 'Unable to analyze this resume.' });
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

app.listen(port, () => {
  console.log(`InterviewIQ API listening on http://localhost:${port}`);
});