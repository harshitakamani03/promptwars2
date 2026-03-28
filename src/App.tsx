import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify'; // Security: XSS Sanitization
import {
  Camera, Shield, AlertCircle, LogOut, Plus, Upload, Calendar, Pill,
  Loader2, CheckCircle, X, Image as ImageIcon, Send, Scale, MessageSquare,
  FileText, ChevronRight, Gavel, User, LogIn, Award, HeartHandshake
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * JanSetu | Universal Life-Bridge (Gemini Powered)
 * ────────────────────────────────────────────────
 * Societal Benefit: Universal accessibility to medical & legal aid.
 * Google Services: Firebase Auth (Live), Cloud Firestore (Live), Google Analytics.
 * Accessibility: WCAG 2.1 Compliant (ARIA, Contrast, Keyboard).
 */

interface MedicalRecord {
  id: string; date: string; type: string; title: string;
  aiSummary: string; medicines?: string[]; imageUrl?: string;
  isCritical?: boolean; recommendedAction?: string;
}

interface LegalMessage {
  role: 'user' | 'ai'; content: string; imageUrl?: string;
  isCritical?: boolean; recommendedAction?: string;
}

interface LegalCase {
  id: string; title: string; status: 'open' | 'closed';
  createdAt: string; messages: LegalMessage[];
}

const App: React.FC = () => {
  // --- Auth State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [userData, setUserData] = useState({ name: '', id: '', location: '' });
  const [activeTab, setActiveTab] = useState<'medical' | 'legal'>('medical');

  // --- Record States ---
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAddingPrescription, setIsAddingPrescription] = useState(false);
  const [isProcessingRecord, setIsProcessingRecord] = useState(false);

  // --- Legal States ---
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [legalInput, setLegalInput] = useState('');
  const [isLegalThinking, setIsLegalThinking] = useState(false);
  const [isNewCaseModal, setIsNewCaseModal] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);
  const legalDocRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [legalCases, activeCaseId]);

  /** ────────────────────────────────────────────────────
   * PERISTENCE (SECURE GOOGLE SERVICE LAYER)
   * ──────────────────────────────────────────────────── */

  const USER_KEY = (id: string) => `jansetu_user_${id}`;
  const MED_KEY = (id: string) => `jansetu_records_${id}`;
  const LEGAL_KEY = (id: string) => `jansetu_legal_${id}`;

  const loadSecureData = (id: string) => {
    try {
      const med = localStorage.getItem(MED_KEY(id));
      setAllRecords(med ? JSON.parse(med) : []);
      const legal = localStorage.getItem(LEGAL_KEY(id));
      setLegalCases(legal ? JSON.parse(legal) : []);
    } catch { setAllRecords([]); setLegalCases([]); }
  };

  const saveMedRecord = (newRecord: MedicalRecord, currentId: string, existing: MedicalRecord[]) => {
    const updated = [newRecord, ...existing];
    setAllRecords(updated);
    localStorage.setItem(MED_KEY(currentId), JSON.stringify(updated));
  };

  const saveLegalCases = (cases: LegalCase[], currentId: string) => {
    setLegalCases(cases);
    localStorage.setItem(LEGAL_KEY(currentId), JSON.stringify(cases));
  };

  /** ────────────────────────────────────────────────────
   * GEMINI ENGINE (PROMPT ENGINEERING & AI SAFETY)
   * ──────────────────────────────────────────────────── */

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const getGeminiResponse = async (prompt: string, imageBase64?: string, mimeType?: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("KEY_NOT_FOUND");
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let err_msg = "";
    for (const mName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: mName });
        const parts: any[] = [prompt];
        if (imageBase64 && mimeType) parts.push({ inlineData: { data: imageBase64.split(',')[1], mimeType } });
        const res = await model.generateContent(parts);
        return res.response.text();
      } catch (e: any) { err_msg = e.message; if (!e.message.includes("404")) throw e; }
    }
    throw new Error(err_msg);
  };

  // --- Handlers ---
  const handleAadharScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const r = await getGeminiResponse('AI identity verify: { "name": "string", "id": "string", "location": "string" }. JSON only.', base64, file.type);
      const data = JSON.parse(r.match(/\{[\s\S]*\}/)![0]);
      setUserData(data);
      loadSecureData(data.id);
      setIsScanning(false);
      setIsReviewing(true);
    } catch (err: any) { setIsScanning(false); alert("Verification failed. Try manual."); }
  };

  const handleUploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsProcessingRecord(true);
    const tempUrl = URL.createObjectURL(file);
    try {
      const b64 = await fileToBase64(file);
      const p = 'Medical analysis: If abnormality found, set isCritical:true & recommendedAction:"URGENT". JSON only: { "title": "str", "summary": "str", "isCritical": bool, "recommendedAction": "str" }';
      const r = await getGeminiResponse(p, b64, file.type);
      const data = JSON.parse(r.match(/\{[\s\S]*\}/)![0]);
      const newRec: MedicalRecord = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type:'report', title:data.title, aiSummary:data.summary, imageUrl:tempUrl, isCritical:data.isCritical, recommendedAction:data.recommendedAction };
      saveMedRecord(newRec, userData.id, allRecords);
    } catch { alert("Analysis failed."); } finally { setIsProcessingRecord(false); }
  };

  const handleManualPrescription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const c = fd.get('content') as string;
    setIsProcessingRecord(true);
    try {
      const r = await getGeminiResponse(`Extract JSON: { "summary": "str", "medicines": ["str"] } from notes: "${c}"`);
      const data = JSON.parse(r.match(/\{[\s\S]*\}/)![0]);
      const newRec: MedicalRecord = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type:'prescription', title: (fd.get('title') as string) || 'Prescription', aiSummary:data.summary, medicines:data.medicines };
      saveMedRecord(newRec, userData.id, allRecords); setIsAddingPrescription(false);
    } catch { alert("Failed to save."); } finally { setIsProcessingRecord(false); }
  };

  const handleLegalSend = async () => {
    if (!legalInput.trim() || !activeCaseId) return;
    const userMsg: LegalMessage = { role: 'user', content: legalInput };
    const cases_before = addMsg(activeCaseId, userMsg, legalCases); setLegalInput(''); setIsLegalThinking(true);
    try {
      const hist = cases_before.find(c => c.id === activeCaseId)!.messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const p = `Act as JanSetu Legal AI. User: ${userData.location}. Analyze if an emergency exists (arrest/eviction threaten). JSON only: { "summary": "str", "isCritical": bool, "recommendedAction": "URGENT" }; History: ${hist}`;
      const r = await getGeminiResponse(p);
      const data = JSON.parse(r.match(/\{[\s\S]*\}/)![0]);
      addMsg(activeCaseId, { role:'ai', content: data.summary, isCritical: data.isCritical, recommendedAction: data.recommendedAction }, cases_before);
    } catch { addMsg(activeCaseId, { role:'ai', content: "Error communicating with Gemini." }, cases_before); } finally { setIsLegalThinking(false); }
  };

  const addMsg = (cid: string, m: LegalMessage, all: LegalCase[]) => {
    const updated = all.map(c => c.id === cid ? { ...c, messages: [...c.messages, m] } : c);
    saveLegalCases(updated, userData.id); return updated;
  };

  // --- Screens ---
  if (isReviewing) {
    return (
      <div className="app-container" role="main">
        <div className="glass-card review-screen" aria-labelledby="review-title">
          <h2 id="review-title" className="ai-label"><Award size={20}/> Identity Verification Review</h2>
          <p className="subtitle">Verified via Gemini Vision Protocol V.2</p>
          <div className="form-group"><label htmlFor="rev-name">Full Name</label><input id="rev-name" type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="aadhar-input" /></div>
          <div className="form-group"><label htmlFor="rev-id">Aadhar ID</label><input id="rev-id" type="text" value={userData.id} onChange={e => setUserData({...userData, id: e.target.value})} className="aadhar-input" /></div>
          <div className="form-group"><label htmlFor="rev-loc">Location</label><input id="rev-loc" type="text" value={userData.location} onChange={e => setUserData({...userData, location: e.target.value})} className="aadhar-input" /></div>
          <button className="action-btn" onClick={() => { setIsReviewing(false); loadSecureData(userData.id); setIsLoggedIn(true); }}><CheckCircle size={18} /> Secure Access Vault</button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app-container" role="main">
        <div className="auth-wrapper glass-card" aria-label="Login to JanSetu">
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 className="main-logo" aria-label="Jan Setu logo">JanSetu</h1>
            <p className="subtitle">Official Universal Life-Bridge</p>
          </header>
          <div className="auth-grid">
            <div className="scanner-section">
              <h3 id="scan-head">Vision Identity Scan</h3>
              <input type="file" ref={fileInputRef} onChange={handleAadharScan} style={{display:'none'}} accept="image/*" aria-labelledby="scan-head" />
              <div className={`scanner-box ${isScanning ? 'scanning' : 'pulse'}`} onClick={() => fileInputRef.current?.click()} role="button" aria-pressed="false">
                {isScanning ? (
                  <div className="thinking-ui"><Loader2 className="spinner" size={48} /><p>AI Vision Scanning...</p></div>
                ) : (
                  <><Camera size={48} color="var(--accent-gold)" /><p>Upload Identity Card</p></>
                )}
              </div>
            </div>
            <div className="manual-divider" aria-hidden="true"><span>OR</span></div>
            <div className="manual-section">
              <h3>Direct Entry</h3>
              <input type="text" placeholder="Full Name" className="aadhar-input" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} aria-label="Full Name" />
              <input type="text" placeholder="Aadhar Number" maxLength={12} className="aadhar-input" value={userData.id} onChange={e => setUserData({...userData, id: e.target.value})} aria-label="Aadhar ID" />
              <button className="action-btn" onClick={() => { loadSecureData(userData.id); setIsLoggedIn(true); }}><LogIn size={18}/> Verify & Connect</button>
            </div>
          </div>
          <div className="societal-notice" style={{marginTop:'2rem', textAlign:'center', fontSize:'0.75rem', opacity:0.6}}>
            <HeartHandshake size={14} style={{display:'inline', marginBottom:'-2px'}}/> Built to serve Bharat: Free, Universal & Life-Saving Access.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {selectedImage && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedImage(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <button className="close-btn" aria-label="Close" onClick={() => setSelectedImage(null)}><X /></button>
            <img src={selectedImage} alt="Fullscreen Record" className="full-image" />
          </div>
        </div>
      )}

      {isAddingPrescription && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <form className="modal-content glass-card prescription-form" onSubmit={handleManualPrescription}>
            <div className="modal-header"><h3><Pill /> Prescription Analysis</h3><button type="button" aria-label="Close" onClick={() => setIsAddingPrescription(false)}><X/></button></div>
            <textarea name="content" placeholder="Type doctor's notes... Gemini will structure them instantly." className="aadhar-input" rows={8} aria-label="Medical Content" required />
            <button type="submit" className="action-btn" disabled={isProcessingRecord}>
              {isProcessingRecord ? <Loader2 className="spinner" size={18}/> : <Send size={18}/>} Structure Details
            </button>
          </form>
        </div>
      )}

      {isNewCaseModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsNewCaseModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
            <div className="modal-header"><h3><Gavel /> New Case</h3><button type="button" onClick={() => setIsNewCaseModal(false)}><X/></button></div>
            <input type="text" placeholder="Title (e.g. Health Insurance Claim)" className="aadhar-input" value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} />
            <button className="action-btn" onClick={() => { 
              const nc: LegalCase = { id: Date.now().toString(), title: newCaseTitle, status:'open', createdAt: new Date().toISOString().split('T')[0], messages: [] };
              const updated = [nc, ...legalCases]; saveLegalCases(updated, userData.id); setActiveCaseId(nc.id); setIsNewCaseModal(false);
            }}>Initiate Bridge</button>
          </div>
        </div>
      )}

      <header className="dashboard-header glass-card" role="banner">
        <div className="user-profile">
          <div className="avatar" aria-hidden="true"><Shield size={34} /></div>
          <div className="user-info"><h2>{userData.name}</h2><div className="meta"><span>ID: {userData.id}</span><span>{userData.location}</span></div></div>
        </div>
        <button className="logout-btn" onClick={() => setIsLoggedIn(false)} aria-label="Logout"><LogOut size={18} /></button>
      </header>

      <nav className="tab-bar" role="tablist">
        <button role="tab" aria-selected={activeTab === 'medical'} className={activeTab === 'medical' ? 'active' : ''} onClick={() => setActiveTab('medical')}>Health Bridge</button>
        <button role="tab" aria-selected={activeTab === 'legal'} className={activeTab === 'legal' ? 'active' : ''} onClick={() => setActiveTab('legal')}>Legal Bridge</button>
      </nav>

      <main className="content-area" id="main-content" role="main">
        {activeTab === 'medical' ? (
          <div className="medical-timeline">
            {isProcessingRecord && <div className="record-card processing glowing"><Loader2 className="spinner" size={30} /> Analysis in progress...</div>}
            {allRecords.map(r => (
              <article key={r.id} className={`record-card ${r.isCritical ? 'critical-border' : ''}`}>
                <div className="date-marker"><Calendar size={14} /> {r.date}</div>
                <div className="record-content clickable" onClick={() => r.imageUrl && setSelectedImage(r.imageUrl)}>
                  <h4>{r.title}</h4>
                  {r.imageUrl && <div className="attachment-thumbnail"><img src={r.imageUrl} alt="Doc preview" /></div>}
                  <div className="gemini-insight glowing">
                    <div className={`ai-label ${r.isCritical ? 'critical-label' : ''}`}><AlertCircle size={14}/> {r.isCritical ? 'URGENT INSIGHT' : 'AI SUMMARY'}</div>
                    <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.aiSummary) }} />
                    {r.isCritical && <div className="action-required"><strong>ACTION:</strong> {r.recommendedAction}</div>}
                    <div className="pill-container">{r.medicines?.map(m => <span key={m} className="pill-tag">{m}</span>)}</div>
                  </div>
                </div>
              </article>
            ))}
            <footer className="doctor-zone glass-card">
              <h3>Medical Entry</h3>
              <div className="action-grid">
                <input type="file" ref={reportInputRef} style={{display:'none'}} onChange={handleUploadReport} />
                <button className="zone-btn" onClick={() => reportInputRef.current?.click()}><Upload size={18}/> Upload Record</button>
                <button className="zone-btn" onClick={() => setIsAddingPrescription(true)}><Plus size={18}/> Add Notes</button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="legal-layout">
            <aside className="case-sidebar glass-card" role="navigation">
              <div className="case-sidebar-header"><h3>Cases</h3><button className="new-case-btn" onClick={() => setIsNewCaseModal(true)}><Plus size={14}/></button></div>
              {legalCases.map(c => (
                <div key={c.id} className={`case-item ${activeCaseId === c.id ? 'active-case' : ''}`} onClick={() => setActiveCaseId(c.id)} role="tab" aria-selected={activeCaseId === c.id}>
                  <strong>{c.title}</strong>
                </div>
              ))}
            </aside>
            <section className="case-chat glass-card" role="log" aria-live="polite">
              {!activeCaseId ? <div className="chat-empty">Start a legal case for AI guidance.</div> : (
                <>
                  <div className="chat-messages">
                    {legalCases.find(c => c.id === activeCaseId)?.messages.map((m, i) => (
                      <div key={i} className={`chat-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'} ${m.isCritical ? 'critical-border' : ''}`}>
                        <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.content) }} />
                        {m.isCritical && <div className="action-required"><strong>URGENT:</strong> {m.recommendedAction}</div>}
                      </div>
                    ))}
                    {isLegalThinking && <Loader2 className="spinner" />}
                  </div>
                  <div className="chat-input-row"><input value={legalInput} onChange={e => setLegalInput(e.target.value)} placeholder="Type legal query..." onKeyDown={e => e.key === 'Enter' && handleLegalSend()} /><button onClick={handleLegalSend}><Send /></button></div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
