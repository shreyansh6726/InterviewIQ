import { useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Section({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }) {
  return <p className="muted">{text || 'Not found in the resume.'}</p>;
}

function App() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
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

    try {
      const response = await fetch(`${API_URL}/api/resume/analyze`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Resume analysis failed.');
      }
      setAnalysis(body.analysis);
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the InterviewIQ backend.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="hero">
        <span className="eyebrow">INTERVIEWIQ · RESUME INTELLIGENCE</span>
        <h1>Turn your resume into your interview advantage.</h1>
        <p>Upload your resume and get a clear view of your experience, skills, strengths, and next-best roles.</p>
      </div>

      <form className="upload-card" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="resume">Your resume</label>
          <p className="muted">PDF, TXT, or Markdown · up to 5 MB</p>
        </div>
        <input
          id="resume"
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={(event) => setFile(event.target.files[0] || null)}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Analyzing resume…' : 'Analyze resume'}
        </button>
        {file && <span className="file-name">{file.name}</span>}
        {error && <p className="error">{error}</p>}
      </form>

      {analysis && (
        <div className="results">
          <div className="result-heading">
            <div>
              <span className="eyebrow">YOUR PROFILE</span>
              <h2>{analysis.candidate?.name || 'Resume profile'}</h2>
              <p className="muted">{analysis.candidate?.headline || analysis.summary}</p>
            </div>
            <div className="role-list">
              {(analysis.suggestedRoles || []).map((role) => <span className="pill" key={role}>{role}</span>)}
            </div>
          </div>

          <Section title="At a glance">
            <p>{analysis.summary || <EmptyState />}</p>
            <div className="contact">
              {[analysis.candidate?.email, analysis.candidate?.phone, analysis.candidate?.location]
                .filter(Boolean)
                .map((item) => <span key={item}>{item}</span>)}
            </div>
          </Section>

          <div className="grid">
            <Section title="Skills">
              {analysis.skills?.length ? (
                <div className="skill-list">{analysis.skills.map((skill) => <span className="pill" key={`${skill.category}-${skill.name}`}>{skill.name}</span>)}</div>
              ) : <EmptyState />}
            </Section>
            <Section title="Certifications">
              {analysis.certifications?.length ? <ul>{analysis.certifications.map((item) => <li key={item}>{item}</li>)}</ul> : <EmptyState />}
            </Section>
          </div>

          <Section title="Experience">
            {analysis.experience?.length ? analysis.experience.map((item) => (
              <article className="timeline-item" key={`${item.company}-${item.role}`}>
                <div className="item-heading"><strong>{item.role}</strong><span>{item.duration}</span></div>
                <p className="accent">{item.company}</p>
                <ul>{item.achievements?.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul>
              </article>
            )) : <EmptyState />}
          </Section>

          <div className="grid">
            <Section title="Education">
              {analysis.education?.length ? analysis.education.map((item) => <div className="compact-item" key={`${item.institution}-${item.degree}`}><strong>{item.degree}</strong><span>{item.institution} · {item.duration}</span></div>) : <EmptyState />}
            </Section>
            <Section title="Projects">
              {analysis.projects?.length ? analysis.projects.map((item) => <div className="compact-item" key={item.name}><strong>{item.name}</strong><span>{item.description}</span><small>{item.technologies?.join(' · ')}</small></div>) : <EmptyState />}
            </Section>
          </div>

          <div className="grid">
            <Section title="Strengths"><ul>{analysis.strengths?.map((item) => <li key={item}>{item}</li>) || <EmptyState />}</ul></Section>
            <Section title="Growth opportunities"><ul>{analysis.improvements?.map((item) => <li key={item}>{item}</li>) || <EmptyState />}</ul></Section>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
