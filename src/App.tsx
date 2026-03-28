import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Shield, AlertCircle, LogOut, Plus, Upload, Calendar, Pill,
  Loader2, CheckCircle, X, Image as ImageIcon, Send, Scale, MessageSquare,
  FileText, ChevronRight, Gavel
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [userData, setUserData] = useState({ name: '', id: '', location: '' });
  const [activeTab, setActiveTab] = useState<'medical' | 'legal'>('medical');

  // Medical
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAddingPrescription, setIsAddingPrescription] = useState(false);
  const [isProcessingRecord, setIsProcessingRecord] = useState(false);

  // Legal
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

  // --- Persistence ---
  const MED_KEY = (id: string) => `jansetu_records_${id}`;
  const LEGAL_KEY = (id: string) => `jansetu_legal_${id}`;

  const loadDataForUser = (id: string) => {
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
    try { localStorage.setItem(MED_KEY(currentId), JSON.stringify(updated)); } catch (e) { console.error(e); }
  };

  const saveLegalCases = (cases: LegalCase[], currentId: string) => {
    setLegalCases(cases);
    try { localStorage.setItem(LEGAL_KEY(currentId), JSON.stringify(cases)); } catch (e) { console.error(e); }
  };

  // --- Gemini ---
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const getGeminiResponse = async (prompt: string, imageBase64?: string, mimeType?: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("MISSING_API_KEY");
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let lastError: any;
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const parts: any[] = [prompt];
        if (imageBase64 && mimeType) parts.push({ inlineData: { data: imageBase64.split(',')[1], mimeType } });
        const result = await model.generateContent(parts);
        console.log(`Used model: ${modelName}`);
        return result.response.text();
      } catch (err: any) {
        console.warn(`Failed with ${modelName}:`, err.message);
        lastError = err;
        if (!err.message.includes("404")) throw err;
      }
    }
    throw new Error(`All models restricted. (${lastError.message})`);
  };

  // --- Medical handlers ---
  const handleAadharScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await getGeminiResponse(
        'Analyze this Aadhaar card image and extract JSON: { "name": "string", "id": "string", "location": "string" }. Return ONLY valid JSON, do not use markdown blocks.',
        base64, file.type
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const data = JSON.parse(jsonMatch[0]);
      setUserData({ name: data.name, id: data.id, location: data.location });
      loadDataForUser(data.id);
      setIsScanning(false);
      setIsReviewing(true);
    } catch (err: any) {
      setIsScanning(false);
      alert(`Aadhar Scan Failed: ${err.message}. Try manual entry.`);
    }
  };

  const handleUploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsProcessingRecord(true);
    const tempUrl = URL.createObjectURL(file);
    try {
      const base64 = await fileToBase64(file);
      const response = await getGeminiResponse(
        'Summarize this medical report briefly and suggest a title. CRITICAL: If you detect any emergency or highly abnormal value, set isCritical: true and provide a short recommendedAction string. Return ONLY valid JSON: { "title": "string", "summary": "string", "isCritical": boolean, "recommendedAction": "string" }. Do not wrap in markdown.',
        base64, file.type
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const data = JSON.parse(jsonMatch[0]);
      const newRecord: MedicalRecord = {
        id: Date.now().toString(), date: new Date().toISOString().split('T')[0],
        type: 'report', title: data.title, aiSummary: data.summary, imageUrl: tempUrl,
        isCritical: data.isCritical, recommendedAction: data.recommendedAction
      };
      saveMedRecord(newRecord, userData.id, allRecords);
    } catch (err: any) {
      alert(`Failed to analyze report: ${err.message}`);
    } finally { setIsProcessingRecord(false); }
  };

  const handleManualPrescription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;
    const title = formData.get('title') as string;
    setIsProcessingRecord(true);
    try {
      const response = await getGeminiResponse(
        `Take these doctor notes and provide a professional medical summary and extracted medicines list. Input: "${content}". Return ONLY valid JSON: { "summary": "string", "medicines": ["string"] }. Do not wrap in markdown.`
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const data = JSON.parse(jsonMatch[0]);
      const newRecord: MedicalRecord = {
        id: Date.now().toString(), date: new Date().toISOString().split('T')[0],
        type: 'prescription', title: title || 'New Prescription',
        aiSummary: data.summary, medicines: data.medicines, imageUrl: undefined
      };
      saveMedRecord(newRecord, userData.id, allRecords);
      setIsAddingPrescription(false);
    } catch (err: any) {
      alert(`Failed to generate summary: ${err.message}`);
    } finally { setIsProcessingRecord(false); }
  };

  // --- Legal handlers ---
  const createNewCase = () => {
    if (!newCaseTitle.trim()) return;
    const newCase: LegalCase = {
      id: Date.now().toString(), title: newCaseTitle.trim(),
      status: 'open', createdAt: new Date().toISOString().split('T')[0], messages: []
    };
    const updated = [newCase, ...legalCases];
    saveLegalCases(updated, userData.id);
    setActiveCaseId(newCase.id);
    setNewCaseTitle('');
    setIsNewCaseModal(false);
  };

  const activeCase = legalCases.find(c => c.id === activeCaseId);

  const addMessageToCase = (caseId: string, message: LegalMessage, allCases: LegalCase[]) => {
    const updated = allCases.map(c =>
      c.id === caseId ? { ...c, messages: [...c.messages, message] } : c
    );
    saveLegalCases(updated, userData.id);
    return updated;
  };

  const handleLegalSend = async () => {
    if (!legalInput.trim() || !activeCaseId) return;
    const userMsg: LegalMessage = { role: 'user', content: legalInput };
    const afterUser = addMessageToCase(activeCaseId, userMsg, legalCases);
    setLegalInput('');
    setIsLegalThinking(true);

    try {
      const caseHistory = afterUser.find(c => c.id === activeCaseId)!.messages
        .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
      const prompt = `You are a legal aid assistant in India helping citizens with legal problems and government schemes.
User location: ${userData.location || 'India'}.
Case: "${activeCase?.title}"
Conversation so far:
${caseHistory}

Provide:
1. A clear analysis of the legal situation
2. Step-by-step next actions the user can take
3. Relevant Indian government schemes they may be eligible for (e.g., PM-JAY, Legal Aid Services, NALSA, etc.)
Keep the response concise, empathetic, and actionable. Use simple language.`;

      const aiText = await getGeminiResponse(prompt);
      const aiMsg: LegalMessage = { role: 'ai', content: aiText };
      addMessageToCase(activeCaseId, aiMsg, afterUser);
    } catch (err: any) {
      const errMsg: LegalMessage = { role: 'ai', content: `Error: ${err.message}` };
      addMessageToCase(activeCaseId, errMsg, afterUser);
    } finally { setIsLegalThinking(false); }
  };

  const handleLegalDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !activeCaseId) return;
    const file = e.target.files[0];
    const tempUrl = URL.createObjectURL(file);
    const userMsg: LegalMessage = { role: 'user', content: `[Uploaded document: ${file.name}]`, imageUrl: tempUrl };
    const afterUser = addMessageToCase(activeCaseId, userMsg, legalCases);
    setIsLegalThinking(true);

    try {
      const base64 = await fileToBase64(file);
      const prompt = `You are a legal aid assistant in India. Analyze this legal document.
CRITICAL: If this document implies an urgent deadline (e.g. within 48 hours), a threat of arrest, or immediate eviction, set isCritical: true and provide a recommendedAction.
User location: ${userData.location || 'India'}.
Provide JSON: { "summary": "short analysis", "isCritical": boolean, "recommendedAction": "URGENT NEXT STEP", "nextSteps": ["action1", "action2"] }`;
      
      const response = await getGeminiResponse(prompt, base64, file.type);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: response };

      const aiMsg: LegalMessage = { 
        role: 'ai', 
        content: data.summary || response, 
        isCritical: data.isCritical, 
        recommendedAction: data.recommendedAction 
      };
      addMessageToCase(activeCaseId, aiMsg, afterUser);
    } catch (err: any) {
      const errMsg: LegalMessage = { role: 'ai', content: `Error analyzing document: ${err.message}` };
      addMessageToCase(activeCaseId, errMsg, afterUser);
    } finally {
      setIsLegalThinking(false);
      e.target.value = '';
    }
  };

  // --- Screens ---
  if (isReviewing) {
    return (
      <div className="app-container">
        <div className="glass-card review-screen">
          <div className="ai-label"><AlertCircle size={20}/> Gemini Vision Extraction Review</div>
          <p className="subtitle">Please verify the details extracted from your Aadhar Card.</p>
          <div className="form-group"><label>Name</label><input type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="aadhar-input" /></div>
          <div className="form-group"><label>Aadhar ID</label><input type="text" value={userData.id} onChange={e => setUserData({...userData, id: e.target.value})} className="aadhar-input" /></div>
          <div className="form-group"><label>Location</label><input type="text" value={userData.location} onChange={e => setUserData({...userData, location: e.target.value})} className="aadhar-input" /></div>
          <button className="action-btn" onClick={() => { setIsReviewing(false); loadDataForUser(userData.id); setIsLoggedIn(true); }}><CheckCircle size={18} /> Confirm details & Enter Vault</button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app-container">
        <div className="auth-wrapper glass-card">
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}><h1 className="main-logo">JanSetu</h1><p className="subtitle">Gemini-Powered Universal Bridge</p></header>
          <div className="auth-grid">
            <div className="scanner-section">
              <h3>Scan Your Aadhar Card</h3>
              <input type="file" ref={fileInputRef} onChange={handleAadharScan} style={{display:'none'}} accept="image/*" />
              <div className={`scanner-box ${isScanning ? 'scanning' : 'pulse'}`} onClick={() => fileInputRef.current?.click()}>
                {isScanning ? (
                  <div className="thinking-ui"><Loader2 className="spinner" size={48} /><p>Gemini Vision Analyzing...</p><span className="scan-line"></span></div>
                ) : (
                  <><Camera size={48} color="var(--accent-gold)" /><p>Click to Upload Photo</p></>
                )}
              </div>
            </div>
            <div className="manual-divider"><span>OR</span></div>
            <div className="manual-section">
              <h3>Manual Entry</h3>
              <input type="text" placeholder="Name" className="aadhar-input" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} />
              <input type="text" placeholder="12-digit Aadhar" maxLength={12} className="aadhar-input" value={userData.id} onChange={e => setUserData({...userData, id: e.target.value})} />
              <input type="text" placeholder="Location (City/State)" className="aadhar-input" value={userData.location} onChange={e => setUserData({...userData, location: e.target.value})} />
              <button className="action-btn" onClick={() => { loadDataForUser(userData.id); setIsLoggedIn(true); }}>Verify Identity</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="View medical document" onClick={() => setSelectedImage(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <button className="close-btn" aria-label="Close image viewer" onClick={() => setSelectedImage(null)}><X /></button>
            <img src={selectedImage} alt="Record" className="full-image" />
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {isAddingPrescription && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add new prescription">
          <form className="modal-content glass-card prescription-form" onSubmit={handleManualPrescription}>
            <div className="modal-header"><h3><Pill /> New Digital Prescription</h3><button type="button" aria-label="Close prescription form" onClick={() => setIsAddingPrescription(false)}><X/></button></div>
            <input name="title" placeholder="Consultation Title (e.g. Back Pain)" className="aadhar-input" aria-label="Consultation title" required />
            <textarea name="content" placeholder="Write prescription notes... Gemini will summarize them." className="aadhar-input" aria-label="Prescription notes" rows={6} required />
            <button type="submit" className="action-btn" disabled={isProcessingRecord}>
              {isProcessingRecord ? <><Loader2 className="spinner" size={18}/> Summarizing...</> : <><Send size={18}/> Generate & Save</>}
            </button>
          </form>
        </div>
      )}

      {/* New Case Modal */}
      {isNewCaseModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Create new legal case" onClick={() => setIsNewCaseModal(false)}>
          <div className="modal-content glass-card prescription-form" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><Gavel size={20}/> New Legal Case</h3><button type="button" onClick={() => setIsNewCaseModal(false)}><X/></button></div>
            <p className="subtitle" style={{marginBottom:'1rem'}}>Give your case a short descriptive title</p>
            <input
              type="text" placeholder="e.g. Land Dispute with Neighbour, Wrongful Termination..."
              className="aadhar-input" value={newCaseTitle}
              onChange={e => setNewCaseTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createNewCase()}
            />
            <button className="action-btn" onClick={createNewCase} disabled={!newCaseTitle.trim()}>
              <Plus size={18}/> Open Case
            </button>
          </div>
        </div>
      )}

      <header className="dashboard-header glass-card" role="banner">
        <div className="user-profile" aria-label="User profile">
          <div className="avatar" aria-hidden="true"><Shield size={30} /></div>
          <div className="user-info"><h2>{userData.name || 'Citizen'}</h2><div className="meta"><span>ID: {userData.id}</span><span>{userData.location}</span></div></div>
        </div>
        <button className="logout-btn" aria-label="Logout from JanSetu" onClick={() => { setIsLoggedIn(false); setUserData({name:'', id:'', location:''}); setAllRecords([]); setLegalCases([]); setActiveCaseId(null); }}><LogOut size={18} /> Logout</button>
      </header>

      <nav className="tab-bar" role="tablist" aria-label="Main sections">
        <button role="tab" aria-selected={activeTab === 'medical'} className={activeTab === 'medical' ? 'active' : ''} onClick={() => setActiveTab('medical')}>Medical Vault</button>
        <button role="tab" aria-selected={activeTab === 'legal'} className={activeTab === 'legal' ? 'active' : ''} onClick={() => setActiveTab('legal')}>Legal & Schemes</button>
      </nav>

      <main id="main-content" className="content-area" role="main">
        {activeTab === 'medical' ? (
          <div className="medical-timeline">
            {isProcessingRecord && (
              <div className="record-card processing glowing">
                <div className="thinking-ui"><Loader2 className="spinner" size={24}/><p>Gemini is analyzing your record...</p></div>
              </div>
            )}
            {allRecords.length === 0 && !isProcessingRecord && (
              <div className="record-card" style={{textAlign: 'center', opacity: 0.5}}>
                No records found. Upload a report or add a prescription to get started.
              </div>
            )}
            {allRecords.map(r => (
              <div key={r.id} className="timeline-group">
                <div className="date-marker"><Calendar size={16} /> {r.date}</div>
                <div className={`record-card clickable ${r.isCritical ? 'critical-border' : ''}`} onClick={() => r.imageUrl && setSelectedImage(r.imageUrl)}>
                  <div className="record-header"><h4>{r.title}</h4></div>
                  {r.imageUrl && (
                    <div className="attachment-thumbnail">
                      <img src={r.imageUrl} alt="Document Attachment" />
                    </div>
                  )}
                  <div className={`gemini-insight ${r.isCritical ? '' : 'glowing'}`}>
                    <div className={`ai-label ${r.isCritical ? 'critical-label' : ''}`}>
                      <AlertCircle size={14}/> {r.isCritical ? 'HIGH PRIORITY INSIGHT' : 'Gemini Summary'}
                    </div>
                    <p>{r.aiSummary}</p>
                    {r.isCritical && r.recommendedAction && (
                      <div className="action-required" role="alert" aria-live="assertive">
                        <strong>⚠️ RECOMMENDED ACTION:</strong>
                        {r.recommendedAction}
                      </div>
                    )}
                    {r.medicines && <div className="pill-container">{r.medicines.map(m => <span key={m} className="pill-tag">{m}</span>)}</div>}
                  </div>
                </div>
              </div>
            ))}
            <div className="doctor-zone glass-card">
              <h3>Doctor Portal</h3>
              <p className="subtitle" style={{marginBottom:'1rem'}}>Securely add health data using Gemini Vision</p>
              <div className="action-grid">
                <input type="file" ref={reportInputRef} style={{display:'none'}} onChange={handleUploadReport} accept="image/*" />
                <button className="zone-btn" aria-label="Upload medical report image" onClick={() => reportInputRef.current?.click()}><Upload size={18}/> Upload Report</button>
                <button className="zone-btn" aria-label="Add new digital prescription" onClick={() => setIsAddingPrescription(true)}><Plus size={18}/> New Prescription</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="legal-layout">
            {/* Case List Sidebar */}
            <div className="case-sidebar glass-card">
              <div className="case-sidebar-header">
                <h3><Scale size={18}/> My Cases</h3>
                <button className="new-case-btn" onClick={() => setIsNewCaseModal(true)}><Plus size={16}/> New</button>
              </div>
              {legalCases.length === 0 && (
                <div className="empty-cases">
                  <Gavel size={32} opacity={0.3}/>
                  <p>No cases yet. Start a new case to get legal help.</p>
                </div>
              )}
              {legalCases.map(c => (
                <div
                  key={c.id}
                  className={`case-item clickable ${activeCaseId === c.id ? 'active-case' : ''}`}
                  onClick={() => setActiveCaseId(c.id)}
                >
                  <div className="case-item-icon"><FileText size={16}/></div>
                  <div className="case-item-info">
                    <strong>{c.title}</strong>
                    <span>{c.createdAt} · {c.messages.length} messages</span>
                  </div>
                  <ChevronRight size={16} opacity={0.5}/>
                </div>
              ))}
            </div>

            {/* Case Chat Panel */}
            <div className="case-chat glass-card">
              {!activeCase ? (
                <div className="chat-empty">
                  <Scale size={48} opacity={0.2}/>
                  <h3>Select or create a case</h3>
                  <p>Upload legal documents or chat with Gemini to get AI-powered legal guidance and discover government schemes you're eligible for.</p>
                  <button className="action-btn" style={{marginTop:'1rem'}} onClick={() => setIsNewCaseModal(true)}><Plus size={18}/> Open New Case</button>
                </div>
              ) : (
                <>
                  <div className="chat-header">
                    <div>
                      <h3>{activeCase.title}</h3>
                      <span className="case-status">🟢 Open · {activeCase.createdAt}</span>
                    </div>
                    <input type="file" ref={legalDocRef} style={{display:'none'}} onChange={handleLegalDoc} accept="image/*,application/pdf,.doc,.docx" />
                    <button className="zone-btn" onClick={() => legalDocRef.current?.click()}><Upload size={16}/> Upload Doc</button>
                  </div>

                  <div className="chat-messages" role="log" aria-live="polite" aria-label="Case conversation">
                    {activeCase.messages.length === 0 && (
                      <div className="chat-starter">
                        <MessageSquare size={32} opacity={0.3}/>
                        <p>Describe your legal issue or upload a document. Gemini will analyze it and suggest next steps + eligible government schemes.</p>
                      </div>
                    )}
                    {activeCase.messages.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'} ${msg.isCritical ? 'critical-border' : ''}`}>
                        {msg.imageUrl && <img src={msg.imageUrl} alt="doc" className="chat-doc-thumb" onClick={() => setSelectedImage(msg.imageUrl!)} />}
                        <div className="bubble-text">{msg.content}</div>
                        {msg.isCritical && msg.recommendedAction && (
                          <div className="action-required" role="alert" aria-live="assertive">
                            <strong>⚠️ URGENT ACTION:</strong>
                            {msg.recommendedAction}
                          </div>
                        )}
                        {msg.role === 'ai' && <div className={`ai-label ${msg.isCritical ? 'critical-label' : ''}`} style={{marginTop:'8px'}}><Shield size={12}/> Gemini Legal AI</div>}
                      </div>
                    ))}
                    {isLegalThinking && (
                      <div className="chat-bubble bubble-ai">
                        <div className="thinking-ui" style={{flexDirection:'row', gap:'8px', justifyContent:'flex-start'}}>
                          <Loader2 className="spinner" size={18}/>
                          <span>Gemini is analyzing your case...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <div className="chat-input-row">
                    <input
                      placeholder="Describe your legal issue, and Gemini will help..."
                      value={legalInput}
                      onChange={e => setLegalInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLegalSend()}
                    />
                    <button className="action-btn" style={{margin:0, padding:'0', width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}} onClick={handleLegalSend} disabled={isLegalThinking || !legalInput.trim()}>
                      <Send size={18}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default App;
