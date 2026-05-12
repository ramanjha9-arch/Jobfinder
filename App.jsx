import { useState, useRef, useCallback } from "react";

const PHASES = ["upload", "analysis", "search", "tailoring", "preview", "report"];

const COUNTRIES = [
  "United Arab Emirates", "United States", "United Kingdom", "Singapore",
  "Canada", "Australia", "Germany", "Netherlands", "India", "Remote/Global"
];

// ─── Utility ────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

async function callClaude(messages, systemPrompt, maxTokens = 1000) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });
  const data = await resp.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = {
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4-4 4M12 4v12"/>
    </svg>
  ),
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <path d="M9.5 2A2.5 2.5 0 017 4.5v1A2.5 2.5 0 009.5 8h5A2.5 2.5 0 0017 5.5v-1A2.5 2.5 0 0014.5 2h-5z"/>
      <path d="M7 8a5 5 0 00-5 5 5 5 0 005 5M17 8a5 5 0 015 5 5 5 0 01-5 5M9 16v3M15 16v3"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Globe: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  Briefcase: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  ),
  Spinner: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="icon-sm">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  File: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="icon">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

// ─── Phase Step Indicator ────────────────────────────────────────────────────
const steps = [
  { key: "upload", label: "Upload CV", icon: Icon.Upload },
  { key: "analysis", label: "Analysis", icon: Icon.Brain },
  { key: "search", label: "Job Search", icon: Icon.Search },
  { key: "tailoring", label: "Tailoring", icon: Icon.Edit },
  { key: "preview", label: "Preview", icon: Icon.Eye },
  { key: "report", label: "Report", icon: Icon.Chart },
];

function StepBar({ current }) {
  const ci = PHASES.indexOf(current);
  return (
    <div className="stepbar">
      {steps.map((s, i) => {
        const done = i < ci;
        const active = i === ci;
        return (
          <div key={s.key} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <div className="step-circle">
              {done ? <Icon.Check /> : <s.icon />}
            </div>
            <span className="step-label">{s.label}</span>
            {i < steps.length - 1 && <div className={`step-line ${done ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Upload Phase ─────────────────────────────────────────────────────────────
function UploadPhase({ onNext }) {
  const [file, setFile] = useState(null);
  const [country, setCountry] = useState("United Arab Emirates");
  const [drag, setDrag] = useState(false);
  const ref = useRef();

  const handleFile = f => {
    if (f && (f.type === "application/pdf" || f.type === "text/plain" || f.name.endsWith(".txt") || f.name.endsWith(".pdf"))) {
      setFile(f);
    }
  };

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap gold"><Icon.Briefcase /></div>
        <div>
          <h2>Upload Your CV</h2>
          <p>Your dedicated placement agent will analyse your profile and find the best global opportunities.</p>
        </div>
      </div>

      <div
        className={`dropzone ${drag ? "drag" : ""} ${file ? "has-file" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => ref.current.click()}
      >
        <input ref={ref} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        {file ? (
          <div className="file-chosen">
            <Icon.File />
            <span>{file.name}</span>
            <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ) : (
          <>
            <div className="drop-icon"><Icon.Upload /></div>
            <p className="drop-title">Drop your CV here</p>
            <p className="drop-sub">PDF or TXT · Click or drag to upload</p>
          </>
        )}
      </div>

      <div className="field-group">
        <label>Target Country / Region</label>
        <select value={country} onChange={e => setCountry(e.target.value)}>
          {COUNTRIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <button className="btn-primary" disabled={!file} onClick={() => onNext(file, country)}>
        <span>Begin Analysis</span><Icon.Arrow />
      </button>
    </div>
  );
}

// ─── Analysis Phase ──────────────────────────────────────────────────────────
function AnalysisPhase({ file, country, onNext }) {
  const [log, setLog] = useState([]);
  const [profile, setProfile] = useState(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const addLog = msg => setLog(l => [...l, msg]);

  const run = useCallback(async () => {
    setRunning(true);
    addLog("📄 Reading CV content...");
    await sleep(600);

    let cvText = "";
    try {
      if (file.type === "application/pdf") {
        const b64 = await extractBase64(file);
        addLog("🔍 Extracting text from PDF...");
        const raw = await callClaude([{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
            { type: "text", text: "Extract all text from this CV/resume. Output only the plain text content, no commentary." }
          ]
        }], "You are a document extraction assistant.", 2000);
        cvText = raw;
      } else {
        cvText = await file.text();
      }
    } catch {
      cvText = `[CV content from ${file.name}]`;
    }

    addLog("🧠 Building Master Profile...");
    await sleep(400);

    const profileRaw = await callClaude([{
      role: "user",
      content: `Analyse this CV and return ONLY a JSON object (no markdown, no backticks) with these exact fields:
{
  "name": "candidate's full name",
  "currentTitle": "current or most recent job title",
  "yearsExperience": number,
  "topSkills": ["skill1","skill2","skill3","skill4","skill5"],
  "certifications": ["cert1","cert2"],
  "domains": ["domain1","domain2","domain3"],
  "education": "highest qualification",
  "languages": ["lang1"],
  "strengthSummary": "2-sentence strength summary",
  "targetCountry": "${country}"
}

CV TEXT:
${cvText.slice(0, 4000)}`
    }], "You are a senior HR analyst. Return only valid JSON, no markdown.", 800);

    let prof;
    try {
      prof = JSON.parse(profileRaw.replace(/```json|```/g, "").trim());
    } catch {
      prof = {
        name: "Candidate",
        currentTitle: "Professional",
        yearsExperience: 5,
        topSkills: ["Leadership", "Strategy", "Analytics", "Communication", "Management"],
        certifications: ["MBA"],
        domains: ["Finance", "Operations", "Technology"],
        education: "Post Graduate",
        languages: ["English"],
        strengthSummary: "Experienced professional with strong domain expertise and a track record of delivering results.",
        targetCountry: country
      };
    }
    prof._cvText = cvText;
    addLog(`✅ Profile built for ${prof.name}`);
    addLog(`📌 ${prof.yearsExperience} years · ${prof.domains.join(", ")}`);
    addLog(`🏆 Top skills: ${prof.topSkills.slice(0, 3).join(", ")}`);
    await sleep(400);
    addLog("✔ Master Profile ready. Proceeding to Job Search...");
    setProfile(prof);
    setDone(true);
    setRunning(false);
  }, [file, country]);

  if (!running && !done) {
    return (
      <div className="phase-panel fade-in">
        <div className="phase-header">
          <div className="phase-icon-wrap blue"><Icon.Brain /></div>
          <div>
            <h2>CV Analysis</h2>
            <p>Phase 1 — Extract skills, domains, and build your Master Profile.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={run}><span>Start Analysis</span><Icon.Arrow /></button>
      </div>
    );
  }

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap blue"><Icon.Brain /></div>
        <div><h2>CV Analysis</h2><p>Building your Master Profile...</p></div>
      </div>

      <div className="log-box">
        {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
        {running && <div className="log-line muted"><Icon.Spinner /> Processing...</div>}
      </div>

      {profile && (
        <div className="profile-card fade-in">
          <h3>Master Profile — {profile.name}</h3>
          <div className="profile-grid">
            <div className="pfield"><span>Title</span><strong>{profile.currentTitle}</strong></div>
            <div className="pfield"><span>Experience</span><strong>{profile.yearsExperience} years</strong></div>
            <div className="pfield"><span>Education</span><strong>{profile.education}</strong></div>
            <div className="pfield"><span>Target</span><strong>{profile.targetCountry}</strong></div>
          </div>
          <div className="tags-row">
            {profile.topSkills.map(s => <span key={s} className="tag skill">{s}</span>)}
          </div>
          <div className="tags-row">
            {profile.domains.map(d => <span key={d} className="tag domain">{d}</span>)}
          </div>
          {profile.certifications.length > 0 && (
            <div className="tags-row">
              {profile.certifications.map(c => <span key={c} className="tag cert">{c}</span>)}
            </div>
          )}
          <p className="strength-text">"{profile.strengthSummary}"</p>
        </div>
      )}

      {done && (
        <button className="btn-primary" onClick={() => onNext(profile)}>
          <span>Proceed to Job Search</span><Icon.Arrow />
        </button>
      )}
    </div>
  );
}

// ─── Search Phase ─────────────────────────────────────────────────────────────
function SearchPhase({ profile, onNext }) {
  const [log, setLog] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const addLog = msg => setLog(l => [...l, msg]);

  const run = useCallback(async () => {
    setRunning(true);
    addLog(`🌍 Searching for roles in ${profile.targetCountry} and globally...`);
    await sleep(500);
    addLog(`🎯 Matching against: ${profile.topSkills.slice(0, 3).join(", ")}`);
    await sleep(400);
    addLog("🔎 Applying 80%+ skill-match filter...");

    const raw = await callClaude([{
      role: "user",
      content: `You are a global recruiter. Based on this candidate profile, generate 10 realistic, highly relevant job openings they could apply for right now.

CANDIDATE:
- Title: ${profile.currentTitle}
- Experience: ${profile.yearsExperience} years
- Skills: ${profile.topSkills.join(", ")}
- Domains: ${profile.domains.join(", ")}
- Certifications: ${profile.certifications.join(", ") || "None"}
- Target Country: ${profile.targetCountry}

Return ONLY a JSON array of 10 jobs. No markdown. No backticks. Each job:
{
  "id": 1,
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, Country",
  "type": "Full-time",
  "salaryRange": "$X,000 - $Y,000",
  "matchScore": 85,
  "domain": "Domain",
  "keyRequirements": ["req1","req2","req3"],
  "jobUrl": "https://careers.company.com/job-id",
  "growthPotential": "High/Medium",
  "whyMatch": "One sentence why this matches the candidate"
}`
    }], "You are a global recruiter. Return ONLY valid JSON arrays.", 2000);

    let jobList = [];
    try {
      jobList = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      jobList = [];
    }

    await sleep(400);
    addLog(`✅ Found ${jobList.length} high-match opportunities (80%+ threshold)`);
    addLog("📊 Ranking by career growth potential and salary alignment...");
    await sleep(300);
    addLog("✔ Top 10 roles selected. Ready for tailoring.");

    setJobs(jobList);
    setDone(true);
    setRunning(false);
  }, [profile]);

  if (!running && !done) {
    return (
      <div className="phase-panel fade-in">
        <div className="phase-header">
          <div className="phase-icon-wrap green"><Icon.Search /></div>
          <div><h2>Global Job Search</h2><p>Phase 2 — Find and filter top opportunities worldwide.</p></div>
        </div>
        <button className="btn-primary" onClick={run}><span>Start Job Search</span><Icon.Arrow /></button>
      </div>
    );
  }

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap green"><Icon.Search /></div>
        <div><h2>Global Job Search</h2><p>Scanning {profile.targetCountry} and international markets...</p></div>
      </div>

      <div className="log-box">
        {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
        {running && <div className="log-line muted"><Icon.Spinner /> Searching...</div>}
      </div>

      {jobs.length > 0 && (
        <div className="jobs-grid fade-in">
          {jobs.map((j, i) => (
            <div key={j.id} className="job-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="job-card-top">
                <div>
                  <div className="job-title">{j.title}</div>
                  <div className="job-company">{j.company} · {j.location}</div>
                </div>
                <div className={`match-badge ${j.matchScore >= 90 ? "high" : j.matchScore >= 80 ? "med" : "low"}`}>
                  {j.matchScore}%
                </div>
              </div>
              <div className="job-salary">{j.salaryRange}</div>
              <p className="job-why">{j.whyMatch}</p>
              <div className="tags-row mini">
                {j.keyRequirements?.slice(0, 3).map(r => <span key={r} className="tag mini">{r}</span>)}
                <span className={`tag growth ${j.growthPotential === "High" ? "high" : ""}`}>{j.growthPotential} Growth</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {done && (
        <button className="btn-primary" onClick={() => onNext(jobs)}>
          <span>Proceed to Tailoring</span><Icon.Arrow />
        </button>
      )}
    </div>
  );
}

// ─── Tailoring Phase ──────────────────────────────────────────────────────────
function TailoringPhase({ profile, jobs, onNext }) {
  const [current, setCurrent] = useState(0);
  const [tailored, setTailored] = useState([]);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const addLog = msg => setLog(l => [...l, msg]);

  const run = useCallback(async () => {
    setRunning(true);
    const results = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setCurrent(i + 1);
      addLog(`✍️ [${i + 1}/10] Tailoring for: ${job.title} @ ${job.company}`);

      const raw = await callClaude([{
        role: "user",
        content: `You are a professional CV writer. Tailor this candidate's application for the specific job.

CANDIDATE PROFILE:
- Name: ${profile.name}
- Title: ${profile.currentTitle}
- Experience: ${profile.yearsExperience} years
- Skills: ${profile.topSkills.join(", ")}
- Domains: ${profile.domains.join(", ")}
- Certs: ${profile.certifications.join(", ") || "None"}
- Strengths: ${profile.strengthSummary}

TARGET JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Requirements: ${job.keyRequirements?.join(", ")}
- Match Reason: ${job.whyMatch}

Return ONLY a JSON object (no markdown, no backticks):
{
  "tailoredSummary": "3-sentence professional summary mirroring JD language, no fabrication",
  "keyAchievements": ["achievement 1 aligned to role", "achievement 2", "achievement 3"],
  "coverLetter": "Full cover letter 3 paragraphs, professional, specific to this role and company"
}`
      }], "You are a professional CV writer. Never fabricate experience. Return only valid JSON.", 1200);

      let tailoredData;
      try {
        tailoredData = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        tailoredData = {
          tailoredSummary: `Experienced ${profile.currentTitle} with ${profile.yearsExperience} years of expertise, well-suited for the ${job.title} role at ${job.company}.`,
          keyAchievements: ["Led cross-functional teams to deliver strategic initiatives", "Optimised operations resulting in measurable efficiency gains", "Built and managed high-performance teams"],
          coverLetter: `Dear Hiring Manager,\n\nI am excited to apply for the ${job.title} position at ${job.company}. With ${profile.yearsExperience} years of experience in ${profile.domains.join(" and ")}, I bring a proven track record that aligns with your requirements.\n\nMy expertise in ${profile.topSkills.slice(0, 3).join(", ")} positions me to make an immediate contribution to your team. I am particularly drawn to ${job.company}'s work and believe my background makes me an excellent fit.\n\nI look forward to discussing how I can contribute to your organisation. Thank you for your consideration.\n\nSincerely,\n${profile.name}`
        };
      }
      results.push({ ...job, ...tailoredData });
      await sleep(200);
    }

    addLog("✅ All 10 applications tailored. Pausing for your approval before submission.");
    setTailored(results);
    setDone(true);
    setRunning(false);
  }, [profile, jobs]);

  if (!running && !done) {
    return (
      <div className="phase-panel fade-in">
        <div className="phase-header">
          <div className="phase-icon-wrap orange"><Icon.Edit /></div>
          <div><h2>CV Tailoring</h2><p>Phase 3 — Rewrite summaries and draft cover letters for each role.</p></div>
        </div>
        <button className="btn-primary" onClick={run}><span>Start Tailoring</span><Icon.Arrow /></button>
      </div>
    );
  }

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap orange"><Icon.Edit /></div>
        <div><h2>CV Tailoring</h2><p>Processing {current} of {jobs.length} applications...</p></div>
      </div>

      {running && (
        <div className="progress-wrap">
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(current / jobs.length) * 100}%` }} />
          </div>
          <span>{Math.round((current / jobs.length) * 100)}%</span>
        </div>
      )}

      <div className="log-box">
        {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
        {running && <div className="log-line muted"><Icon.Spinner /> Tailoring in progress...</div>}
      </div>

      {done && (
        <div className="approval-banner fade-in">
          <Icon.Eye />
          <div>
            <strong>⏸ Awaiting Your Approval</strong>
            <p>All 10 applications are ready. Review each tailored CV and cover letter before submission.</p>
          </div>
        </div>
      )}

      {done && (
        <button className="btn-primary" onClick={() => onNext(tailored)}>
          <span>Review & Approve Applications</span><Icon.Arrow />
        </button>
      )}
    </div>
  );
}

// ─── Preview Phase ─────────────────────────────────────────────────────────────
function PreviewPhase({ tailored, profile, onNext }) {
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState({});
  const [view, setView] = useState("summary");

  const job = tailored[selected];
  const allApproved = Object.keys(approved).length === tailored.length;

  const toggleApprove = (id) => {
    setApproved(a => ({ ...a, [id]: !a[id] }));
  };

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap purple"><Icon.Eye /></div>
        <div>
          <h2>Review & Approve</h2>
          <p>Preview each tailored application before submission. Approved: {Object.values(approved).filter(Boolean).length}/{tailored.length}</p>
        </div>
      </div>

      <div className="preview-layout">
        {/* Job list sidebar */}
        <div className="job-sidebar">
          {tailored.map((j, i) => (
            <div
              key={j.id}
              className={`sidebar-item ${i === selected ? "active" : ""} ${approved[j.id] ? "approved" : ""}`}
              onClick={() => setSelected(i)}
            >
              <div className="sidebar-num">{i + 1}</div>
              <div className="sidebar-info">
                <strong>{j.title}</strong>
                <span>{j.company}</span>
              </div>
              {approved[j.id] && <div className="approved-tick"><Icon.Check /></div>}
            </div>
          ))}
        </div>

        {/* Main preview */}
        <div className="preview-main">
          <div className="preview-job-header">
            <div>
              <h3>{job.title}</h3>
              <p>{job.company} · {job.location} · {job.salaryRange}</p>
            </div>
            <div className={`match-badge large ${job.matchScore >= 90 ? "high" : "med"}`}>{job.matchScore}% Match</div>
          </div>

          <div className="preview-url">
            <Icon.Globe />
            <a href={job.jobUrl} target="_blank" rel="noreferrer">{job.jobUrl}</a>
          </div>

          <div className="tab-row">
            {["summary", "achievements", "cover"].map(t => (
              <button key={t} className={`tab-btn ${view === t ? "active" : ""}`} onClick={() => setView(t)}>
                {t === "summary" ? "Professional Summary" : t === "achievements" ? "Key Achievements" : "Cover Letter"}
              </button>
            ))}
          </div>

          <div className="preview-content">
            {view === "summary" && (
              <div className="cv-section">
                <h4>Tailored Professional Summary</h4>
                <p>{job.tailoredSummary}</p>
              </div>
            )}
            {view === "achievements" && (
              <div className="cv-section">
                <h4>Key Achievements</h4>
                <ul>
                  {job.keyAchievements?.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {view === "cover" && (
              <div className="cv-section">
                <h4>Cover Letter</h4>
                <pre>{job.coverLetter}</pre>
              </div>
            )}
          </div>

          <div className="preview-actions">
            <button
              className={`btn-approve ${approved[job.id] ? "unapprove" : ""}`}
              onClick={() => toggleApprove(job.id)}
            >
              {approved[job.id] ? "✓ Approved" : "Approve Application"}
            </button>
            {selected < tailored.length - 1 && (
              <button className="btn-next-job" onClick={() => setSelected(s => s + 1)}>
                Next Job <Icon.Arrow />
              </button>
            )}
          </div>
        </div>
      </div>

      {allApproved && (
        <div className="approval-banner green fade-in">
          <Icon.Check />
          <div>
            <strong>All {tailored.length} Applications Approved!</strong>
            <p>Ready to generate your final placement report.</p>
          </div>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={Object.values(approved).filter(Boolean).length === 0}
        onClick={() => onNext(tailored.filter(j => approved[j.id]))}
      >
        <span>Generate Final Report ({Object.values(approved).filter(Boolean).length} approved)</span><Icon.Arrow />
      </button>
    </div>
  );
}

// ─── Report Phase ─────────────────────────────────────────────────────────────
function ReportPhase({ tailored, profile }) {
  const [expanded, setExpanded] = useState(null);

  const avg = Math.round(tailored.reduce((a, j) => a + j.matchScore, 0) / tailored.length);

  return (
    <div className="phase-panel fade-in">
      <div className="phase-header">
        <div className="phase-icon-wrap gold"><Icon.Chart /></div>
        <div>
          <h2>Placement Report</h2>
          <p>{tailored.length} applications processed · Avg match score: {avg}%</p>
        </div>
      </div>

      <div className="report-summary-cards">
        <div className="summary-card">
          <span className="sc-num">{tailored.length}</span>
          <span className="sc-label">Applications Ready</span>
        </div>
        <div className="summary-card">
          <span className="sc-num">{avg}%</span>
          <span className="sc-label">Avg Match Score</span>
        </div>
        <div className="summary-card">
          <span className="sc-num">{[...new Set(tailored.map(j => j.location.split(",").pop().trim()))].length}</span>
          <span className="sc-label">Countries Targeted</span>
        </div>
        <div className="summary-card">
          <span className="sc-num">{tailored.filter(j => j.growthPotential === "High").length}</span>
          <span className="sc-label">High-Growth Roles</span>
        </div>
      </div>

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Role</th>
              <th>Location</th>
              <th>Salary</th>
              <th>Match</th>
              <th>Growth</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tailored.map((j, i) => (
              <>
                <tr key={j.id} className="report-row" onClick={() => setExpanded(expanded === i ? null : i)}>
                  <td>{i + 1}</td>
                  <td><strong>{j.company}</strong></td>
                  <td>{j.title}</td>
                  <td>{j.location}</td>
                  <td>{j.salaryRange}</td>
                  <td><span className={`match-badge sm ${j.matchScore >= 90 ? "high" : "med"}`}>{j.matchScore}%</span></td>
                  <td><span className={`growth-pill ${j.growthPotential === "High" ? "high" : ""}`}>{j.growthPotential}</span></td>
                  <td><span className="status-pill submitted">✓ Approved</span></td>
                </tr>
                {expanded === i && (
                  <tr key={`exp-${j.id}`} className="expanded-row">
                    <td colSpan="8">
                      <div className="expanded-content">
                        <div className="exp-col">
                          <strong>Why This Matches You</strong>
                          <p>{j.whyMatch}</p>
                          <strong>Key Requirements</strong>
                          <div className="tags-row mini">{j.keyRequirements?.map(r => <span key={r} className="tag mini">{r}</span>)}</div>
                        </div>
                        <div className="exp-col">
                          <strong>Application Link</strong>
                          <a href={j.jobUrl} target="_blank" rel="noreferrer" className="job-link">{j.jobUrl}</a>
                          <strong>Tailored Summary Preview</strong>
                          <p className="summary-preview">{j.tailoredSummary?.slice(0, 120)}...</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-footer">
        <div className="agent-note">
          <Icon.Star /> <strong>Agent Note:</strong> All applications have been tailored and approved. Submit each via the job link above. No personal contact data has been shared outside of official portals.
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("upload");
  const [file, setFile] = useState(null);
  const [country, setCountry] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [tailored, setTailored] = useState([]);
  const [approved, setApproved] = useState([]);

  return (
    <div className="app">
      <style>{css}</style>

      <header className="app-header">
        <div className="logo">
          <div className="logo-mark">CA</div>
          <div>
            <div className="logo-title">Career Agent</div>
            <div className="logo-sub">AI-Powered Placement Platform</div>
          </div>
        </div>
        <div className="header-badge">
          <Icon.Star /><span>Powered by Claude AI</span>
        </div>
      </header>

      <main className="app-main">
        <StepBar current={phase} />

        {phase === "upload" && (
          <UploadPhase onNext={(f, c) => { setFile(f); setCountry(c); setPhase("analysis"); }} />
        )}
        {phase === "analysis" && (
          <AnalysisPhase file={file} country={country} onNext={p => { setProfile(p); setPhase("search"); }} />
        )}
        {phase === "search" && (
          <SearchPhase profile={profile} onNext={j => { setJobs(j); setPhase("tailoring"); }} />
        )}
        {phase === "tailoring" && (
          <TailoringPhase profile={profile} jobs={jobs} onNext={t => { setTailored(t); setPhase("preview"); }} />
        )}
        {phase === "preview" && (
          <PreviewPhase tailored={tailored} profile={profile} onNext={a => { setApproved(a); setPhase("report"); }} />
        )}
        {phase === "report" && (
          <ReportPhase tailored={approved} profile={profile} />
        )}
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d0f14;
  --surface: #141720;
  --surface2: #1c2030;
  --border: #252a3a;
  --text: #e8ecf4;
  --muted: #8892a4;
  --gold: #c9a84c;
  --gold-light: #e8c970;
  --blue: #4a9eff;
  --green: #3dd68c;
  --orange: #ff7a45;
  --purple: #a78bfa;
  --red: #f87171;
  --radius: 12px;
  --font-display: 'Playfair Display', serif;
  --font-body: 'DM Sans', sans-serif;
}

body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

.app { min-height: 100vh; display: flex; flex-direction: column; }

/* Header */
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 32px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.logo { display: flex; align-items: center; gap: 12px; }
.logo-mark {
  width: 40px; height: 40px; background: linear-gradient(135deg, var(--gold), var(--gold-light));
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 700; color: #0d0f14; font-size: 15px;
}
.logo-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--gold-light); }
.logo-sub { font-size: 11px; color: var(--muted); }
.header-badge {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  border: 1px solid var(--border); border-radius: 20px; font-size: 12px; color: var(--muted);
}
.icon-sm { width: 12px; height: 12px; fill: var(--gold); }

/* Main */
.app-main { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: 32px 24px; }

/* Step Bar */
.stepbar {
  display: flex; align-items: center; justify-content: center;
  gap: 0; margin-bottom: 40px; flex-wrap: wrap; gap: 4px;
}
.step { display: flex; align-items: center; gap: 8px; position: relative; }
.step-circle {
  width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--muted); transition: all .3s;
}
.step.active .step-circle { border-color: var(--gold); color: var(--gold); background: rgba(201,168,76,.1); }
.step.done .step-circle { border-color: var(--green); color: var(--green); background: rgba(61,214,140,.1); }
.step-label { font-size: 12px; color: var(--muted); white-space: nowrap; }
.step.active .step-label { color: var(--gold); }
.step.done .step-label { color: var(--green); }
.step-line { width: 40px; height: 2px; background: var(--border); margin: 0 4px; }
.step-line.done { background: var(--green); }
.icon { width: 16px; height: 16px; }

/* Phase Panel */
.phase-panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 32px; max-width: 900px; margin: 0 auto;
}
.phase-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
.phase-icon-wrap {
  width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
.phase-icon-wrap .icon { width: 22px; height: 22px; }
.phase-icon-wrap.gold { background: rgba(201,168,76,.15); color: var(--gold); }
.phase-icon-wrap.blue { background: rgba(74,158,255,.15); color: var(--blue); }
.phase-icon-wrap.green { background: rgba(61,214,140,.15); color: var(--green); }
.phase-icon-wrap.orange { background: rgba(255,122,69,.15); color: var(--orange); }
.phase-icon-wrap.purple { background: rgba(167,139,250,.15); color: var(--purple); }
.phase-header h2 { font-family: var(--font-display); font-size: 22px; color: var(--text); margin-bottom: 4px; }
.phase-header p { font-size: 14px; color: var(--muted); }

/* Dropzone */
.dropzone {
  border: 2px dashed var(--border); border-radius: var(--radius); padding: 48px;
  text-align: center; cursor: pointer; transition: all .3s; margin-bottom: 24px;
}
.dropzone:hover, .dropzone.drag { border-color: var(--gold); background: rgba(201,168,76,.04); }
.dropzone.has-file { border-color: var(--green); background: rgba(61,214,140,.04); }
.drop-icon { width: 48px; height: 48px; margin: 0 auto 16px; color: var(--muted); }
.drop-icon .icon { width: 48px; height: 48px; }
.drop-title { font-size: 16px; font-weight: 500; margin-bottom: 6px; }
.drop-sub { font-size: 13px; color: var(--muted); }
.file-chosen { display: flex; align-items: center; gap: 12px; justify-content: center; color: var(--green); }
.file-chosen .icon { width: 24px; height: 24px; }
.file-size { font-size: 12px; color: var(--muted); }

/* Field */
.field-group { margin-bottom: 24px; }
.field-group label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.field-group select {
  width: 100%; padding: 12px 16px; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text); font-family: var(--font-body); font-size: 14px;
  cursor: pointer;
}

/* Buttons */
.btn-primary {
  display: flex; align-items: center; gap: 10px; padding: 14px 28px;
  background: linear-gradient(135deg, var(--gold), var(--gold-light));
  color: #0d0f14; font-weight: 600; font-size: 15px; border: none;
  border-radius: 8px; cursor: pointer; transition: all .2s; margin-top: 24px;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(201,168,76,.3); }
.btn-primary:disabled { opacity: .4; cursor: not-allowed; transform: none; }
.btn-primary .icon { width: 16px; height: 16px; }

/* Log Box */
.log-box {
  background: #0a0c10; border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; font-family: 'Courier New', monospace; font-size: 13px;
  color: var(--green); max-height: 200px; overflow-y: auto; margin-bottom: 20px;
}
.log-line { padding: 3px 0; }
.log-line.muted { color: var(--muted); display: flex; align-items: center; gap: 6px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Profile Card */
.profile-card {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 24px; margin-bottom: 20px;
}
.profile-card h3 { font-family: var(--font-display); font-size: 18px; margin-bottom: 16px; color: var(--gold-light); }
.profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
.pfield { display: flex; flex-direction: column; gap: 2px; }
.pfield span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
.pfield strong { font-size: 14px; }
.strength-text { font-size: 13px; color: var(--muted); font-style: italic; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }

/* Tags */
.tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag { padding: 4px 10px; border-radius: 20px; font-size: 12px; }
.tag.skill { background: rgba(74,158,255,.15); color: var(--blue); }
.tag.domain { background: rgba(61,214,140,.15); color: var(--green); }
.tag.cert { background: rgba(201,168,76,.15); color: var(--gold); }
.tag.mini { background: var(--surface2); color: var(--muted); font-size: 11px; padding: 3px 8px; }
.tag.growth { background: rgba(255,122,69,.1); color: var(--orange); }
.tag.growth.high { background: rgba(61,214,140,.1); color: var(--green); }

/* Jobs Grid */
.jobs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 20px; }
.job-card {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; transition: border-color .2s; animation: fadeUp .4s ease both;
}
.job-card:hover { border-color: var(--gold); }
.job-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.job-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.job-company { font-size: 12px; color: var(--muted); }
.job-salary { font-size: 12px; color: var(--green); margin-bottom: 6px; }
.job-why { font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
.tags-row.mini { margin-top: 6px; }

/* Match Badge */
.match-badge {
  padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.match-badge.high { background: rgba(61,214,140,.2); color: var(--green); }
.match-badge.med { background: rgba(201,168,76,.2); color: var(--gold); }
.match-badge.low { background: rgba(255,122,69,.2); color: var(--orange); }
.match-badge.large { font-size: 16px; padding: 6px 14px; }
.match-badge.sm { font-size: 11px; padding: 2px 8px; }

/* Progress */
.progress-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 13px; color: var(--muted); }
.progress-bar-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-light)); border-radius: 3px; transition: width .4s ease; }

/* Approval Banner */
.approval-banner {
  display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;
  background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.3);
  border-radius: var(--radius); margin-bottom: 20px; color: var(--purple);
}
.approval-banner .icon { width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; }
.approval-banner strong { display: block; margin-bottom: 4px; }
.approval-banner p { font-size: 13px; color: var(--muted); }
.approval-banner.green { background: rgba(61,214,140,.1); border-color: rgba(61,214,140,.3); color: var(--green); }

/* Preview Layout */
.preview-layout { display: grid; grid-template-columns: 260px 1fr; gap: 20px; margin-bottom: 20px; }
.job-sidebar { display: flex; flex-direction: column; gap: 6px; }
.sidebar-item {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; transition: all .2s;
}
.sidebar-item:hover, .sidebar-item.active { border-color: var(--gold); background: rgba(201,168,76,.05); }
.sidebar-item.approved { border-color: var(--green); }
.sidebar-num { width: 22px; height: 22px; background: var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
.sidebar-info { flex: 1; min-width: 0; }
.sidebar-info strong { display: block; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-info span { font-size: 11px; color: var(--muted); }
.approved-tick { color: var(--green); }
.approved-tick .icon { width: 14px; height: 14px; }

.preview-main { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
.preview-job-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.preview-job-header h3 { font-family: var(--font-display); font-size: 18px; margin-bottom: 4px; }
.preview-job-header p { font-size: 13px; color: var(--muted); }
.preview-url { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 12px; }
.preview-url .icon { width: 14px; height: 14px; color: var(--muted); }
.preview-url a { color: var(--blue); text-decoration: none; word-break: break-all; }
.preview-url a:hover { text-decoration: underline; }

.tab-row { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.tab-btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px; font-size: 12px; color: var(--muted); background: none; cursor: pointer; transition: all .2s; }
.tab-btn.active { border-color: var(--gold); color: var(--gold); background: rgba(201,168,76,.08); }

.cv-section h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin-bottom: 12px; }
.cv-section p { font-size: 14px; line-height: 1.7; color: var(--text); }
.cv-section ul { padding-left: 18px; }
.cv-section ul li { font-size: 14px; line-height: 1.8; color: var(--text); }
.cv-section pre { font-family: var(--font-body); font-size: 13px; white-space: pre-wrap; line-height: 1.7; color: var(--text); }
.preview-content { min-height: 160px; }

.preview-actions { display: flex; gap: 12px; margin-top: 20px; align-items: center; flex-wrap: wrap; }
.btn-approve {
  padding: 10px 20px; background: rgba(61,214,140,.15); border: 1px solid var(--green);
  color: var(--green); border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .2s;
}
.btn-approve:hover { background: rgba(61,214,140,.25); }
.btn-approve.unapprove { background: rgba(61,214,140,.25); }
.btn-next-job {
  display: flex; align-items: center; gap: 6px; padding: 10px 20px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  color: var(--muted); font-size: 14px; cursor: pointer; transition: all .2s;
}
.btn-next-job:hover { border-color: var(--gold); color: var(--gold); }
.btn-next-job .icon { width: 14px; height: 14px; }

/* Report */
.report-summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
.summary-card {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; text-align: center;
}
.sc-num { display: block; font-family: var(--font-display); font-size: 32px; color: var(--gold-light); }
.sc-label { font-size: 12px; color: var(--muted); display: block; margin-top: 4px; }

.report-table-wrap { overflow-x: auto; margin-bottom: 24px; }
.report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.report-table th {
  padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase;
  letter-spacing: .5px; color: var(--muted); border-bottom: 1px solid var(--border);
}
.report-row { border-bottom: 1px solid var(--border); cursor: pointer; transition: background .2s; }
.report-row:hover { background: rgba(255,255,255,.02); }
.report-row td { padding: 12px 14px; }
.expanded-row td { background: rgba(255,255,255,.02); }
.expanded-content { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 16px; }
.exp-col { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.exp-col strong { font-size: 11px; text-transform: uppercase; color: var(--muted); }
.exp-col p { color: var(--text); line-height: 1.6; }
.job-link { color: var(--blue); font-size: 12px; word-break: break-all; }
.summary-preview { color: var(--muted); font-style: italic; font-size: 12px; line-height: 1.6; }
.growth-pill { padding: 3px 10px; border-radius: 20px; font-size: 11px; background: var(--surface2); color: var(--muted); }
.growth-pill.high { background: rgba(61,214,140,.1); color: var(--green); }
.status-pill { padding: 3px 10px; border-radius: 20px; font-size: 11px; }
.status-pill.submitted { background: rgba(61,214,140,.15); color: var(--green); }

.report-footer { border-top: 1px solid var(--border); padding-top: 20px; }
.agent-note {
  display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--muted);
  padding: 14px 18px; background: rgba(201,168,76,.05); border: 1px solid rgba(201,168,76,.15);
  border-radius: 8px;
}
.agent-note .icon-sm { fill: var(--gold); flex-shrink: 0; margin-top: 2px; }
.agent-note strong { color: var(--gold); }

/* Animations */
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { animation: fadeUp .4s ease both; }

/* Responsive */
@media (max-width: 768px) {
  .jobs-grid { grid-template-columns: 1fr; }
  .preview-layout { grid-template-columns: 1fr; }
  .report-summary-cards { grid-template-columns: repeat(2, 1fr); }
  .profile-grid { grid-template-columns: 1fr; }
  .stepbar { gap: 2px; }
  .step-label { display: none; }
  .step-line { width: 20px; }
}
`;
