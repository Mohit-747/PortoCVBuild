
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { AppStep, PortfolioData, QAFeedback, PortfolioHistoryItem, UserPreferences, AppMode, UKResumeData } from './types';
import { generatePortfolioData, getAgentFeedback, modifyPortfolio } from './services/geminiService';
import { deployToGitHub } from './services/githubService';
import { ThreeBackground } from './components/ThreeBackground';
import { PortfolioViewer } from './components/PortfolioViewer';
import { UKResumeBuilder } from './components/UKResumeBuilder';
import { LoginGate } from './components/LoginGate';
import { JobHunter } from './components/JobHunter';
import { ResumeMoulder } from './components/ResumeMoulder';
import { GlobalNav } from './components/GlobalNav';

const STORAGE_KEY = 'portocv_history_v9_premium';
const SESSION_DURATION_MS = 10 * 60 * 1000; // 10 Minutes

const CreatorBadge = () => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }} 
    animate={{ opacity: 1, y: 0 }} 
    transition={{ delay: 1, duration: 0.8 }}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 group cursor-default"
  >
    <div className="glass px-6 py-3 rounded-full border border-white/10 flex items-center gap-4 shadow-2xl hover:scale-105 transition-transform bg-black/40 backdrop-blur-xl">
      <div className="flex flex-col text-left">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created by</span>
        <span className="text-xs font-bold text-white">Mohit Kumar <span className="text-slate-500">|</span> MBA (Leeds) '26</span>
      </div>
      <div className="h-8 w-[1px] bg-white/10"></div>
      <div className="flex gap-3">
        <a href="https://www.linkedin.com/in/mohit747/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400 transition-colors text-lg"><i className="fab fa-linkedin"></i></a>
        <a href="https://www.instagram.com/mohit.747/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-400 transition-colors text-lg"><i className="fab fa-instagram"></i></a>
      </div>
    </div>
  </motion.div>
);

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.LOGIN);
  const [currentUser, setCurrentUser] = useState<string>('');
  
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [resumeData, setResumeData] = useState<string | { data: string; mimeType: string } | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryItem[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [deployedUrl, setDeployedUrl] = useState('');
  
  // UK CV Data (Used for Job Matching)
  const [ukResumeData, setUkResumeData] = useState<UKResumeData | null>(null);

  // Editing State
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // User Preferences
  const [prefs, setPrefs] = useState<UserPreferences>({
    themeStyle: 'auto',
    backgroundType: 'auto',
    animationType: 'auto',
    colorMode: 'auto',
    primaryHue: 'auto'
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load history", e);
    }
  }, []);

  // SESSION TIMEOUT LOGIC
  useEffect(() => {
    let timer: any;
    if (mode !== AppMode.LOGIN) {
      // Start 10 minute timer when not in login screen
      timer = setTimeout(() => {
        setMode(AppMode.LOGIN);
        setCurrentUser('');
        alert("Session Expired: You have been logged out after 10 minutes to preserve server resources.");
      }, SESSION_DURATION_MS);
    }
    return () => clearTimeout(timer);
  }, [mode]);

  const handleLogin = (email: string) => {
    setCurrentUser(email);
    // Remove local storage persistence for security in this context
    // localStorage.setItem('portocv_user_email', email); 
    setMode(AppMode.HOME);
  };

  const saveToHistory = (data: PortfolioData, url: string) => {
    const newItem: PortfolioHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      title: data.title,
      deployedAt: new Date().toLocaleDateString(),
      type: 'portfolio',
      url: url
    };
    const updated = [newItem, ...history].slice(0, 8);
    setHistory(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) { }
  };

  const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({ data: base64String, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      try {
        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          setResumeData(base64);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setResumeData(result.value);
        } else {
          const text = await file.text();
          setResumeData(text);
        }
      } catch (err) {
        alert("Ingestion error.");
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setPhotoUrl(reader.result as string);
    }
  };

  const handleGeneratePortfolio = async () => {
    if (!resumeData) return;
    setStep(AppStep.GENERATING);
    setLoadingMsg("Agent 1: Analyzing preferences & architecture...");
    setMotivationalQuote("Designing your digital legacy...");
    try {
      const data = await generatePortfolioData(resumeData, prefs);
      if (data.name) setMotivationalQuote(`Building a masterpiece for ${data.name.split(' ')[0]}...`);
      data.photoUrl = photoUrl;
      
      setLoadingMsg("Agent 2: Finalizing 3D structures...");
      await new Promise(r => setTimeout(r, 1000));
      
      setPortfolio(data);
      setTimeout(() => setStep(AppStep.PREVIEW), 500);
    } catch (error: any) {
      console.error(error);
      // DISPLAY THE SPECIFIC ERROR FROM SERVICE
      alert(`Generation Failed: ${error.message || "Unknown neural error"}`);
      setStep(AppStep.INPUT);
    }
  };

  const handleEditPortfolio = async () => {
    if (!portfolio || !editPrompt.trim()) return;
    setIsEditing(true);
    try {
      const updatedData = await modifyPortfolio(portfolio, editPrompt);
      updatedData.photoUrl = updatedData.photoUrl || portfolio.photoUrl; 
      setPortfolio(updatedData);
      setEditPrompt('');
    } catch (e: any) {
      alert(`Edit failed: ${e.message}`);
    } finally {
      setIsEditing(false);
    }
  };

  const handleStartDeploy = async () => {
    if (!githubToken.trim()) {
      alert("GitHub Token Required.");
      return;
    }
    setStep(AppStep.DEPLOYING);
    setLoadingMsg("Agent 2: Deploying to GitHub...");
    try {
      const url = await deployToGitHub(githubToken.trim(), portfolio!);
      setDeployedUrl(url);
      saveToHistory(portfolio!, url);
      setStep(AppStep.SUCCESS);
    } catch (error: any) {
      alert("Deployment failed: " + error.message);
      setStep(AppStep.DEPLOY_CONFIG);
    }
  };

  // --- LOGIN VIEW ---
  if (mode === AppMode.LOGIN) {
    return <LoginGate onLogin={handleLogin} />;
  }

  // --- WRAPPER FOR LOGGED IN VIEWS ---
  return (
    <>
      <GlobalNav currentMode={mode} setMode={setMode} currentUser={currentUser} />
      
      {/* HOME VIEW */}
      {mode === AppMode.HOME && (
        <div className="min-h-screen relative text-slate-100 font-sans flex flex-col items-center justify-center overflow-hidden bg-[#020617] pt-20">
          <ThreeBackground variant="particles" primaryColor="#6366f1" accentColor="#06b6d4" backgroundColor="#020617" />
          
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_100%)] z-0 pointer-events-none"></div>

          <div className="z-10 text-center space-y-16 p-6 max-w-7xl mx-auto">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, ease: "easeOut" }} className="relative">
              <div className="absolute -inset-10 bg-indigo-500/20 blur-[100px] rounded-full"></div>
              <h1 className="text-8xl md:text-[10rem] font-black uppercase italic leading-none tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-white to-cyan-300 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                  PortoCV
              </h1>
              <p className="text-sm md:text-xl font-bold uppercase tracking-[0.6em] text-slate-400/80">The Agentic Design Studio</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full px-4 md:px-10">
              {/* CARD 1: UK RESUME */}
              <motion.div 
                whileHover={{ scale: 1.03, y: -10 }}
                onClick={() => setMode(AppMode.UK_RESUME)}
                className="glass p-8 rounded-[40px] border border-white/5 cursor-pointer group hover:border-emerald-400/30 transition-all text-left relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent hover:bg-emerald-900/10 shadow-2xl flex flex-col justify-between min-h-[300px]"
              >
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-widest mb-4">Agent 01</span>
                  <i className="fas fa-file-contract text-4xl text-emerald-400 mb-4 block opacity-80"></i>
                  <h2 className="text-2xl font-black uppercase italic mb-2 text-white group-hover:text-emerald-300 transition-colors">UK Resume</h2>
                  <p className="text-slate-400 text-[10px] leading-relaxed">Top 1% ATS-Compliant British CVs.</p>
                </div>
              </motion.div>

              {/* CARD 2: 3D PORTFOLIO */}
              <motion.div 
                whileHover={{ scale: 1.03, y: -10 }}
                onClick={() => { setMode(AppMode.PORTFOLIO); setStep(AppStep.INPUT); }}
                className="glass p-8 rounded-[40px] border border-white/5 cursor-pointer group hover:border-indigo-400/30 transition-all text-left relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent hover:bg-indigo-900/10 shadow-2xl flex flex-col justify-between min-h-[300px]"
              >
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-widest mb-4">Agent 02</span>
                  <i className="fas fa-cube text-4xl text-indigo-400 mb-4 block opacity-80"></i>
                  <h2 className="text-2xl font-black uppercase italic mb-2 text-white group-hover:text-indigo-300 transition-colors">3D Portfolio</h2>
                  <p className="text-slate-400 text-[10px] leading-relaxed">Deployed interactive 3D sites.</p>
                </div>
              </motion.div>

              {/* CARD 3: JOB HUNTER */}
              <motion.div 
                whileHover={{ scale: 1.03, y: -10 }}
                onClick={() => setMode(AppMode.JOB_HUNTER)}
                className="glass p-8 rounded-[40px] border border-white/5 cursor-pointer group hover:border-pink-400/30 transition-all text-left relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent hover:bg-pink-900/10 shadow-2xl flex flex-col justify-between min-h-[300px]"
              >
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[9px] font-bold uppercase tracking-widest mb-4">Agent 03</span>
                  <i className="fas fa-search-location text-4xl text-pink-400 mb-4 block opacity-80"></i>
                  <h2 className="text-2xl font-black uppercase italic mb-2 text-white group-hover:text-pink-300 transition-colors">Job Hunter</h2>
                  <p className="text-slate-400 text-[10px] leading-relaxed">Search & Auto-Apply Drafts.</p>
                </div>
              </motion.div>

              {/* CARD 4: RESUME MOULDER */}
              <motion.div 
                whileHover={{ scale: 1.03, y: -10 }}
                onClick={() => setMode(AppMode.RESUME_MOULDER)}
                className="glass p-8 rounded-[40px] border border-white/5 cursor-pointer group hover:border-purple-400/30 transition-all text-left relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent hover:bg-purple-900/10 shadow-2xl flex flex-col justify-between min-h-[300px]"
              >
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-bold uppercase tracking-widest mb-4">Agent 04</span>
                  <i className="fas fa-magic text-4xl text-purple-400 mb-4 block opacity-80"></i>
                  <h2 className="text-2xl font-black uppercase italic mb-2 text-white group-hover:text-purple-300 transition-colors">Moulder</h2>
                  <p className="text-slate-400 text-[10px] leading-relaxed">Tailor CV to Job Description.</p>
                </div>
              </motion.div>
            </div>

            {history.length > 0 && (
              <div className="pt-10 border-t border-white/5 w-full">
                  <h3 className="text-xs font-black uppercase tracking-[0.5em] text-slate-500 mb-8">Recent Deployments</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {history.map(item => (
                      <a href={item.url || '#'} target="_blank" rel="noreferrer" key={item.id} className="glass p-4 rounded-2xl flex flex-col gap-2 border border-white/5 hover:border-indigo-500/30 transition-all text-left group">
                          <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-indigo-400 transition-colors truncate">{item.name}</span>
                              <i className="fas fa-external-link-alt text-[10px] text-slate-600 group-hover:text-indigo-400"></i>
                          </div>
                          <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{item.title}</span>
                          <span className="text-[7px] text-slate-600 font-mono mt-1">{item.deployedAt}</span>
                      </a>
                    ))}
                  </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UK RESUME VIEW */}
      {mode === AppMode.UK_RESUME && (
        <div className="min-h-screen bg-[#0f172a] text-white">
          <ThreeBackground variant="grid" primaryColor="#10b981" accentColor="#34d399" backgroundColor="#0f172a" />
          <UKResumeBuilder 
             onBack={() => setMode(AppMode.HOME)} 
             onFindJobs={(data) => {
                 setUkResumeData(data);
                 setMode(AppMode.JOB_HUNTER);
             }}
          />
        </div>
      )}

      {/* JOB HUNTER VIEW */}
      {mode === AppMode.JOB_HUNTER && (
         <div className="min-h-screen bg-[#0f172a] text-white">
           <ThreeBackground variant="bokeh" primaryColor="#ec4899" accentColor="#f43f5e" backgroundColor="#0f172a" />
           <JobHunter 
             onBack={() => setMode(AppMode.HOME)} 
             resumeData={ukResumeData} 
             setResumeData={setUkResumeData}
           />
         </div>
      )}

      {/* RESUME MOULDER VIEW */}
      {mode === AppMode.RESUME_MOULDER && (
         <div className="min-h-screen bg-[#0f172a] text-white">
           <ThreeBackground variant="bokeh" primaryColor="#a855f7" accentColor="#d8b4fe" backgroundColor="#0f172a" />
           <ResumeMoulder 
             onBack={() => setMode(AppMode.HOME)} 
             resumeData={ukResumeData} 
             setResumeData={setUkResumeData}
           />
         </div>
      )}

      {/* PORTFOLIO VIEW */}
      {mode === AppMode.PORTFOLIO && (
        <div className="min-h-screen relative text-slate-100 font-sans overflow-x-hidden" style={{ backgroundColor: portfolio?.theme?.backgroundColor || '#020617' }}>
          <ThreeBackground 
            primaryColor={portfolio?.theme?.primaryColor}
            accentColor={portfolio?.theme?.accentColor}
            backgroundColor={portfolio?.theme?.backgroundColor}
            variant={portfolio?.theme?.backgroundStyle}
          />
          
          <main className="relative z-10">
            <AnimatePresence mode="wait">
              {step === AppStep.INPUT && (
                <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-[90rem] mx-auto pt-36 px-6 pb-20">
                  <div className="grid lg:grid-cols-12 gap-16 items-start">
                    
                    {/* Header & Inputs */}
                    <div className="lg:col-span-7 space-y-12">
                      <div className="space-y-6">
                          <motion.h1 
                            initial={{ x: -50, opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 uppercase italic leading-[0.9]"
                          >
                            Web <br/>Architect.
                          </motion.h1>
                          <p className="text-xl text-slate-400 font-light max-w-lg border-l-2 border-indigo-500 pl-6">
                            Deploy a high-fidelity 3D portfolio in minutes. <br/>
                            <span className="text-indigo-400 font-bold">Powered by Gemini 1.5 Pro</span>
                          </p>
                      </div>
                      
                      <div className="glass p-12 rounded-[50px] border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[80px] rounded-full"></div>
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8 relative z-10">Source Materials</h3>
                          <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
                            <div onClick={() => photoInputRef.current?.click()} className="aspect-square glass rounded-[30px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all overflow-hidden relative group">
                                {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : (
                                  <>
                                    <i className="fas fa-camera text-3xl opacity-30 mb-4 group-hover:scale-110 transition-transform group-hover:text-indigo-400 group-hover:opacity-100"></i>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 group-hover:opacity-100">Upload Photo</span>
                                  </>
                                )}
                                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                            </div>
                            <div onClick={() => resumeInputRef.current?.click()} className="aspect-square glass rounded-[30px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all relative group">
                                {resumeData ? (
                                  <div className="flex flex-col items-center px-6 text-center">
                                    <i className="fas fa-check-circle text-indigo-500 text-4xl mb-4"></i>
                                    <span className="text-[9px] font-bold uppercase opacity-80 truncate w-full tracking-widest">{fileName}</span>
                                  </div>
                                ) : (
                                  <>
                                    <i className="fas fa-file-upload text-3xl opacity-30 mb-4 group-hover:scale-110 transition-transform group-hover:text-indigo-400 group-hover:opacity-100"></i>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 group-hover:opacity-100">Upload Resume</span>
                                  </>
                                )}
                                <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleResumeUpload} />
                            </div>
                          </div>
                          <button onClick={handleGeneratePortfolio} disabled={!resumeData} className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 relative z-10">
                            <span>Construct Build</span>
                            <i className="fas fa-arrow-right"></i>
                          </button>
                      </div>
                    </div>

                    {/* Personalization Studio */}
                    <div className="lg:col-span-5">
                      <div className="glass p-10 rounded-[50px] border-white/10 sticky top-32 shadow-2xl">
                          <div className="flex items-center gap-4 mb-10">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                                <i className="fas fa-sliders text-sm text-indigo-400"></i>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Personalization Studio</h3>
                          </div>

                          <div className="space-y-10">
                            {/* Visual Style */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                  <i className="fas fa-palette"></i> Visual Aesthetic
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {['auto', 'cyber', 'minimal', 'professional', 'creative'].map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => setPrefs({...prefs, themeStyle: opt as any})}
                                      className={`py-3 px-5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.themeStyle === opt ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                            </div>

                            {/* Color Preferences */}
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                      <i className="fas fa-sun"></i> Mode
                                    </label>
                                    <div className="flex gap-2">
                                      {['auto', 'dark', 'light'].map(opt => (
                                        <button
                                          key={opt}
                                          onClick={() => setPrefs({...prefs, colorMode: opt as any})}
                                          className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.colorMode === opt ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                      <i className="fas fa-eye-dropper"></i> Primary Hue
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                      {['auto', 'blue', 'green', 'purple', 'red', 'orange', 'monochrome'].map(opt => (
                                        <button
                                          key={opt}
                                          onClick={() => setPrefs({...prefs, primaryHue: opt as any})}
                                          className={`py-3 px-2 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all truncate ${prefs.primaryHue === opt ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                </div>
                            </div>

                            {/* FX */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <i className="fas fa-sparkles"></i> FX Engine
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    {id: 'auto', label: 'Auto Detect'},
                                    {id: 'particles', label: '3D Space'},
                                    {id: 'grid', label: 'Retro Grid'},
                                    {id: 'bokeh', label: 'Soft Orbs'}
                                  ].map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => setPrefs({...prefs, backgroundType: opt.id as any})}
                                      className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.backgroundType === opt.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                            </div>
                          </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {step === AppStep.GENERATING && (
                <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen flex flex-col items-center justify-center px-6">
                  <div className="relative w-32 h-32 mb-12">
                      <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-4 border-l-4 border-cyan-500 rounded-full animate-spin-slow"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <i className="fas fa-brain text-4xl text-indigo-400 animate-pulse"></i>
                      </div>
                  </div>
                  <div className="text-center space-y-4">
                    <p className="text-4xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300">{motivationalQuote}</p>
                    <div className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10">
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest animate-pulse flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {loadingMsg}
                        </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === AppStep.PREVIEW && portfolio && (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-32 relative">
                  
                  {/* EDITOR OVERLAY */}
                  <div className="fixed bottom-10 right-10 z-[300] flex flex-col gap-4 items-end">
                      <AnimatePresence>
                        {isEditing && (
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="glass p-6 rounded-[30px] border border-indigo-500/30 w-96 shadow-2xl mb-2 backdrop-blur-xl bg-black/60">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-robot text-indigo-400"></i>
                                  <span className="text-xs font-bold uppercase text-indigo-400 tracking-widest">AI Agent Editor</span>
                                </div>
                                <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                              </div>
                              <textarea 
                                className="w-full bg-slate-900/50 rounded-2xl p-4 text-xs text-white border border-white/10 outline-none focus:border-indigo-500 mb-4 h-32 resize-none leading-relaxed"
                                placeholder="E.g. Make the summary funnier, change the accent color to gold, or emphasize my React skills..."
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                              />
                              <button 
                                onClick={handleEditPortfolio} 
                                className="w-full py-3 bg-indigo-600 rounded-xl text-xs font-bold uppercase hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                              >
                                Run Changes
                              </button>
                            </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="glass p-2 rounded-2xl flex gap-2 shadow-2xl border-white/10 items-center bg-black/40 backdrop-blur-md">
                        <button onClick={() => setIsEditing(!isEditing)} className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${isEditing ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'}`} title="Edit with AI">
                          <i className="fas fa-magic text-xl"></i>
                        </button>
                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                        <button onClick={() => setStep(AppStep.INPUT)} className="px-6 py-4 bg-slate-800/80 hover:bg-slate-700 rounded-xl font-bold text-xs uppercase transition-all text-white">Back</button>
                        <button onClick={() => setStep(AppStep.DEPLOY_CONFIG)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs uppercase shadow-lg transition-all flex items-center gap-2 text-white">
                          <span>Deploy</span>
                          <i className="fab fa-github"></i>
                        </button>
                      </div>
                  </div>
                  
                  <PortfolioViewer data={portfolio} />
                </motion.div>
              )}

              {step === AppStep.DEPLOY_CONFIG && (
                <motion.div key="deploy" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen flex items-center justify-center px-6">
                  <div className="glass p-16 rounded-[50px] max-w-xl w-full space-y-12 border-white/10 shadow-[0_0_100px_rgba(99,102,241,0.2)] text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-cyan-500"></div>
                      <div className="space-y-6">
                        <i className="fab fa-github text-8xl text-indigo-400 mb-4 block drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]"></i>
                        <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white">Connect GitHub</h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
                            To deploy, you need a <b>GitHub Personal Access Token (Classic)</b> with <b>'repo'</b> scope.
                        </p>
                      </div>
                      <input 
                        type="password" 
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-6 text-indigo-400 font-mono outline-none focus:border-indigo-500 transition-all text-center placeholder-slate-700"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                      />
                      <div className="flex flex-col gap-4">
                        <button onClick={handleStartDeploy} className="w-full py-6 bg-indigo-600 rounded-2xl font-black uppercase hover:bg-indigo-500 hover:scale-[1.02] transition-all shadow-xl shadow-indigo-500/20 text-white">Agent 2: Execute Handshake</button>
                        <button onClick={() => setStep(AppStep.PREVIEW)} className="text-slate-500 text-xs font-bold uppercase hover:text-white transition-colors tracking-widest">Cancel</button>
                      </div>
                  </div>
                </motion.div>
              )}

              {step === AppStep.DEPLOYING && (
                <motion.div key="deploying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center text-center px-6">
                  <div className="relative w-32 h-32 mb-10">
                      <div className="absolute inset-0 border-r-4 border-indigo-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center"><i className="fab fa-github text-5xl opacity-40"></i></div>
                  </div>
                  <p className="text-3xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">Syncing with Repository...</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Establishing secure pipeline</p>
                </motion.div>
              )}

              {step === AppStep.SUCCESS && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen flex flex-col items-center justify-center space-y-12 text-center px-6">
                  <div className="w-48 h-48 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(34,197,94,0.4)] mb-8">
                      <i className="fas fa-check text-7xl text-white"></i>
                  </div>
                  <div className="space-y-6">
                      <h2 className="text-8xl font-black uppercase italic tracking-tighter leading-none text-white">Operation <br/>Success.</h2>
                      <p className="text-2xl text-slate-400 max-w-lg mx-auto italic font-light">Your professional artifact has been pushed to the edge network.</p>
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl inline-block max-w-md">
                        <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide">
                          <i className="fas fa-exclamation-triangle mr-2"></i>
                          If you see a 404 Error, please wait 1-2 minutes for GitHub Pages to deploy.
                        </p>
                      </div>
                  </div>
                  <div className="flex flex-col gap-6">
                    <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="px-24 py-8 bg-indigo-600 rounded-2xl font-black uppercase hover:scale-105 transition-all shadow-2xl shadow-indigo-500/20 text-white text-lg">Access Production Build</a>
                    <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500 text-xs font-black uppercase tracking-[0.5em] hover:text-white transition-colors">New Operation</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
          <CreatorBadge />
          
          <style>{`
            .animate-spin-slow { animation: spin 3s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      <CreatorBadge />
    </>
  );
};

export default App;
