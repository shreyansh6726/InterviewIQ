import { useEffect, useRef, useState } from 'react';
import './App.css';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function Section({ title, children }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}

function EmptyState({ text }) {
  return <p className="muted">{text || 'Not found in the resume.'}</p>;
}

function LumenInterview({ analysis, jobDescription, onBack }) {
  const [interviewId, setInterviewId] = useState('');
  const [question, setQuestion] = useState(null);
  const [score, setScore] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isStarting, setIsStarting] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setIsListening(false);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    let active = true;
    async function startInterview() {
      try {
        const response = await fetch(`${API_URL}/api/interview/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis, jobDescription }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not start the LUMEN interview.');
        if (active) {
          setInterviewId(body.interviewId);
          setQuestion(body.question);
          speak(body.question.question);
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setIsStarting(false);
      }
    }
    startInterview();
    return () => {
      active = false;
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, [analysis, jobDescription]);

  function listen() {
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    setError('');
    setTranscript('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => setTranscript(event.results[0][0].transcript);
    recognition.onerror = () => {
      setIsListening(false);
      setError('LUMEN could not hear you. Please try again.');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function submitAnswer() {
    if (!transcript || !interviewId || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/interview/${interviewId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: transcript }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'LUMEN could not process that answer.');
      setTranscript('');
      if (body.complete) {
        setScore(body.score);
        window.speechSynthesis.cancel();
        speak(`Your interview is complete. Your overall score is ${body.score.overallScore} out of 100.`);
      } else {
        setQuestion(body.question);
        speak(body.question.question);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (score) {
    return (
      <main className="app-shell interview-shell">
        <button className="text-button" onClick={onBack}>← Back to profile</button>
        <div className="lumen-mark"><span>✦</span> LUMEN</div>
        <div className="score-hero">
          <span className="eyebrow">INTERVIEW COMPLETE</span>
          <h1>{score.overallScore}<small>/100</small></h1>
          <p>{score.summary}</p>
        </div>
        <div className="score-grid">
          {[
            ['Technical', score.technicalScore],
            ['Communication', score.communicationScore],
            ['Job relevance', score.relevanceScore],
          ].map(([label, value]) => <div className="score-card" key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <div className="grid">
          <Section title="What went well"><ul>{score.strengths?.map((item) => <li key={item}>{item}</li>)}</ul></Section>
          <Section title="Keep improving"><ul>{score.improvements?.map((item) => <li key={item}>{item}</li>)}</ul></Section>
        </div>
        <Section title="LUMEN's recommendation"><p>{score.recommendation}</p></Section>
      </main>
    );
  }

  return (
    <main className="app-shell interview-shell">
      <button className="text-button" onClick={onBack}>← Back to profile</button>
      <div className="lumen-mark"><span>✦</span> LUMEN</div>
      <div className="voice-stage">
        <span className="eyebrow">VOICE INTERVIEW · {question ? 'QUESTION IN PROGRESS' : 'CONNECTING'}</span>
        <h1>{isStarting ? 'LUMEN is preparing your interview.' : question?.question}</h1>
        <p className="muted">Listen to the question, then answer using your voice. There is no text input.</p>
        {question && <span className="question-type">{question.type}</span>}
        <button className={`voice-button ${isListening ? 'listening' : ''}`} onClick={listen} disabled={isStarting || isSubmitting}>
          <span>{isListening ? '●' : '◉'}</span>
          {isListening ? 'Listening…' : 'Tap to answer'}
        </button>
        {transcript && <div className="spoken-answer"><span className="eyebrow">LUMEN HEARD</span><p>“{transcript}”</p><button onClick={submitAnswer} disabled={isSubmitting}>{isSubmitting ? 'LUMEN is evaluating…' : 'Send answer'}</button></div>}
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [showInterview, setShowInterview] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF, TXT, or Markdown resume first.');
      return;
    }
    setError('');
    setAnalysis(null);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);
    try {
      const response = await fetch(`${API_URL}/api/resume/analyze`, { method: 'POST', body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Resume analysis failed.');
      setAnalysis(body.analysis);
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the InterviewIQ backend.');
    } finally {
      setIsLoading(false);
    }
  }

  if (showInterview && analysis) {
    return <LumenInterview analysis={analysis} jobDescription={jobDescription} onBack={() => setShowInterview(false)} />;
  }

  return (
    <main className="app-shell">
      <div className="hero">
        <span className="eyebrow">INTERVIEWIQ · RESUME INTELLIGENCE</span>
        <h1>Meet LUMEN, your AI interview coach.</h1>
        <p>Give LUMEN your resume and the role you want. It will understand your fit, then interview you by voice.</p>
      </div>
      <form className="upload-card" onSubmit={handleSubmit}>
        <div><label htmlFor="resume">Your resume</label><p className="muted">PDF, TXT, or Markdown · up to 5 MB</p></div>
        <input id="resume" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(event) => setFile(event.target.files[0] || null)} />
        <label htmlFor="job-description">Paste the job description <span className="optional">(recommended)</span></label>
        <textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the job description here so LUMEN can measure your fit and personalize the interview…" rows="6" />
        <button type="submit" disabled={isLoading}>{isLoading ? 'LUMEN is analyzing…' : 'Analyze with LUMEN'}</button>
        {file && <span className="file-name">{file.name}</span>}
        {error && <p className="error">{error}</p>}
      </form>
      {analysis && (
        <div className="results">
          <div className="result-heading"><div><span className="eyebrow">YOUR PROFILE</span><h2>{analysis.candidate?.name || 'Resume profile'}</h2><p className="muted">{analysis.candidate?.headline || analysis.summary}</p></div><button onClick={() => setShowInterview(true)}>Start voice interview</button></div>
          {analysis.jobFit && <Section title="Job fit"><div className="fit-score">{analysis.jobFit.score}<small>/100</small></div><p>{analysis.jobFit.explanation}</p><div className="skill-list">{analysis.jobFit.matchedRequirements?.map((item) => <span className="pill" key={item}>✓ {item}</span>)}</div></Section>}
          <Section title="At a glance"><p>{analysis.summary || <EmptyState />}</p><div className="contact">{[analysis.candidate?.email, analysis.candidate?.phone, analysis.candidate?.location].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div></Section>
          <div className="grid"><Section title="Skills">{analysis.skills?.length ? <div className="skill-list">{analysis.skills.map((skill) => <span className="pill" key={`${skill.category}-${skill.name}`}>{skill.name}</span>)}</div> : <EmptyState />}</Section><Section title="Certifications">{analysis.certifications?.length ? <ul>{analysis.certifications.map((item) => <li key={item}>{item}</li>)}</ul> : <EmptyState />}</Section></div>
          <Section title="Experience">{analysis.experience?.length ? analysis.experience.map((item) => <article className="timeline-item" key={`${item.company}-${item.role}`}><div className="item-heading"><strong>{item.role}</strong><span>{item.duration}</span></div><p className="accent">{item.company}</p><ul>{item.achievements?.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul></article>) : <EmptyState />}</Section>
          <div className="grid"><Section title="Education">{analysis.education?.length ? analysis.education.map((item) => <div className="compact-item" key={`${item.institution}-${item.degree}`}><strong>{item.degree}</strong><span>{item.institution} · {item.duration}</span></div>) : <EmptyState />}</Section><Section title="Projects">{analysis.projects?.length ? analysis.projects.map((item) => <div className="compact-item" key={item.name}><strong>{item.name}</strong><span>{item.description}</span><small>{item.technologies?.join(' · ')}</small></div>) : <EmptyState />}</Section></div>
          <div className="grid"><Section title="Strengths"><ul>{analysis.strengths?.map((item) => <li key={item}>{item}</li>) || <EmptyState />}</ul></Section><Section title="Growth opportunities"><ul>{analysis.improvements?.map((item) => <li key={item}>{item}</li>) || <EmptyState />}</ul></Section></div>
        </div>
      )}
    </main>
  );
}

export default App;
