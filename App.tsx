
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { AppStep, PortfolioData, QAFeedback, PortfolioHistoryItem, UserPreferences } from './types';
import { generatePortfolioData, getAgentFeedback } from './services/geminiService';
import { deployToGitHub } from './services/githubService';
import { ThreeBackground } from './components/ThreeBackground';
import { PortfolioViewer } from './components/PortfolioViewer';

const STORAGE_KEY = 'portocv_history_v7_final';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [resumeData, setResumeData] = useState<string | { data: string; mimeType: string } | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileExt, setFileExt] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [feedback, setFeedback] = useState<QAFeedback | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryItem[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [deployedUrl, setDeployedUrl] = useState('');
  
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
      console.warn("Failed to load history from localStorage", e);
    }
  }, []);

  const saveToHistory = (data: PortfolioData, url: string) => {
    const newItem: PortfolioHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      title: data.title,
      deployedAt: new Date().toLocaleDateString()
    };
    const updated = [newItem, ...history].slice(0, 8);
    setHistory(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
       // Ignore quota errors
    }
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
      setFileExt(file.name.split('.').pop()?.toLowerCase() || '');
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

  const handleGenerate = async () => {
    if (!resumeData) return;
    setStep(AppStep.GENERATING);
    setLoadingMsg("Agent 1: Analyzing preferences & architecture...");
    setMotivationalQuote("Designing your digital legacy...");
    try {
      const data = await generatePortfolioData(resumeData, prefs);
      data.photoUrl = photoUrl;
      setLoadingMsg("Agent 2: Running visual fidelity checks...");
      const qa = await getAgentFeedback(data);
      setPortfolio(data);
      setFeedback(qa);
      setTimeout(() => setStep(AppStep.PREVIEW), 500);
    } catch (error) {
      console.error("Generation error", error);
      alert("Neural generation failed. Please try a different resume or refresh.");
      setStep(AppStep.INPUT);
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
      // Trim input to avoid copy/paste errors
      const url = await deployToGitHub(githubToken.trim(), portfolio!);
      setDeployedUrl(url);
      saveToHistory(portfolio!, url);
      setStep(AppStep.SUCCESS);
    } catch (error: any) {
      console.error("Deployment error", error);
      alert("Deployment failed: " + error.message);
      setStep(AppStep.DEPLOY_CONFIG);
    }
  };

  return (
    <div className="min-h-screen relative text-slate-100 font-sans overflow-x-hidden" style={{ backgroundColor: portfolio?.theme?.backgroundColor || '#020617' }}>
      <ThreeBackground 
        primaryColor={portfolio?.theme?.primaryColor}
        accentColor={portfolio?.theme?.accentColor}
        backgroundColor={portfolio?.theme?.backgroundColor}
        variant={portfolio?.theme?.backgroundStyle}
      />
      
      <nav className="fixed top-0 left-0 right-0 h-20 glass z-[200] px-8 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-microchip text-white"></i>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase leading-none italic">PortoCV</h1>
            <p className="text-[8px] text-indigo-400 font-bold tracking-[0.4em] uppercase">GitHub Agent v2.5</p>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {step === AppStep.INPUT && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-7xl mx-auto pt-32 px-6 pb-20">
              <div className="grid lg:grid-cols-12 gap-16 items-start">
                
                {/* Header & Inputs */}
                <div className="lg:col-span-7 space-y-12">
                   <div className="space-y-6">
                      <motion.h1 
                        initial={{ x: -50, opacity: 0 }} 
                        animate={{ x: 0, opacity: 1 }} 
                        className="text-7xl md:text-8xl font-black text-gradient uppercase italic leading-none"
                      >
                        The Legacy <br/>Builder.
                      </motion.h1>
                      <p className="text-xl text-slate-400 font-light italic max-w-lg">
                        Agent 1 architects your story. Agent 2 ships it to the world.
                      </p>
                   </div>
                   
                   <div className="glass p-10 rounded-[40px] border-white/10 shadow-2xl relative">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Source Materials</h3>
                      <div className="grid grid-cols-2 gap-6 mb-8">
                         <div onClick={() => photoInputRef.current?.click()} className="aspect-square glass rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all overflow-hidden relative group">
                            {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : (
                              <>
                                <i className="fas fa-camera text-2xl opacity-30 mb-2 group-hover:scale-110 transition-transform"></i>
                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Upload Photo</span>
                              </>
                            )}
                            <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                         </div>
                         <div onClick={() => resumeInputRef.current?.click()} className="aspect-square glass rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all relative group">
                            {resumeData ? (
                              <div className="flex flex-col items-center px-4 text-center">
                                <i className="fas fa-file-check text-indigo-500 text-3xl mb-2"></i>
                                <span className="text-[8px] font-bold uppercase opacity-60 truncate w-full">{fileName}</span>
                              </div>
                            ) : (
                              <>
                                <i className="fas fa-file-upload text-2xl opacity-30 mb-2 group-hover:scale-110 transition-transform"></i>
                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Upload Resume</span>
                              </>
                            )}
                            <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleResumeUpload} />
                         </div>
                      </div>
                      <button onClick={handleGenerate} disabled={!resumeData} className="w-full py-5 bg-indigo-600 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
                        <span>Construct Build</span>
                        <i className="fas fa-arrow-right"></i>
                      </button>
                   </div>
                </div>

                {/* Personalization Studio */}
                <div className="lg:col-span-5">
                   <div className="glass p-8 rounded-[40px] border-white/10 sticky top-28">
                      <div className="flex items-center gap-3 mb-8">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                            <i className="fas fa-sliders text-xs text-indigo-400"></i>
                         </div>
                         <h3 className="text-sm font-black uppercase tracking-widest">Personalization Studio</h3>
                      </div>

                      <div className="space-y-8">
                         {/* Visual Style */}
                         <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visual Aesthetic</label>
                            <div className="grid grid-cols-2 gap-2">
                               {['auto', 'cyber', 'minimal', 'professional', 'creative'].map(opt => (
                                 <button
                                   key={opt}
                                   onClick={() => setPrefs({...prefs, themeStyle: opt as any})}
                                   className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.themeStyle === opt ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'}`}
                                 >
                                   {opt}
                                 </button>
                               ))}
                            </div>
                         </div>

                         {/* Color Preferences */}
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Color Mode</label>
                                <div className="flex flex-col gap-2">
                                  {['auto', 'dark', 'light'].map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => setPrefs({...prefs, colorMode: opt as any})}
                                      className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.colorMode === opt ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Primary Hue</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {['auto', 'blue', 'green', 'purple', 'red', 'orange', 'monochrome'].map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => setPrefs({...prefs, primaryHue: opt as any})}
                                      className={`py-2 px-2 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all truncate ${prefs.primaryHue === opt ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                            </div>
                         </div>

                         {/* Background FX */}
                         <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Background FX</label>
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
                                   className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.backgroundType === opt.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'}`}
                                 >
                                   {opt.label}
                                 </button>
                               ))}
                            </div>
                         </div>

                         {/* Animation Style */}
                         <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Animation Physics</label>
                            <div className="grid grid-cols-2 gap-2">
                               {[
                                 {id: 'auto', label: 'Auto'},
                                 {id: 'fade', label: 'Smooth Fade'},
                                 {id: 'slide', label: 'Dynamic Slide'},
                                 {id: 'scale', label: 'Impact Scale'}
                               ].map(opt => (
                                 <button
                                   key={opt.id}
                                   onClick={() => setPrefs({...prefs, animationType: opt.id as any})}
                                   className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${prefs.animationType === opt.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5'}`}
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

              {history.length > 0 && (
                <div className="mt-24 pt-12 border-t border-white/5">
                  <h3 className="text-xs font-black uppercase tracking-[0.5em] text-slate-500 mb-8">Previous Operations</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {history.map(item => (
                      <div key={item.id} className="glass p-6 rounded-2xl flex flex-col gap-2 border border-white/5 hover:border-white/10 transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.name}</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === AppStep.GENERATING && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen flex flex-col items-center justify-center px-6">
               <div className="relative w-24 h-24 mb-10">
                  <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-l-2 border-cyan-500 rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-microchip text-2xl text-indigo-400 animate-pulse"></i>
                  </div>
               </div>
               <div className="text-center space-y-4">
                 <p className="text-2xl font-black uppercase italic tracking-tighter text-gradient">{motivationalQuote}</p>
                 <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">{loadingMsg}</p>
               </div>
            </motion.div>
          )}

          {step === AppStep.PREVIEW && portfolio && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-32">
               <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] glass p-4 rounded-3xl flex gap-4 shadow-3xl border-white/10">
                  <button onClick={() => setStep(AppStep.INPUT)} className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700 rounded-2xl font-bold transition-all">Edit</button>
                  <button onClick={() => setStep(AppStep.DEPLOY_CONFIG)} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold shadow-2xl transition-all flex items-center gap-3">
                    <span>Deploy to GitHub</span>
                    <i className="fab fa-github"></i>
                  </button>
               </div>
               <PortfolioViewer data={portfolio} />
            </motion.div>
          )}

          {step === AppStep.DEPLOY_CONFIG && (
            <motion.div key="deploy" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen flex items-center justify-center px-6">
               <div className="glass p-12 rounded-[50px] max-w-xl w-full space-y-10 border-white/10 shadow-3xl text-center">
                  <div className="space-y-4">
                     <i className="fab fa-github text-7xl text-indigo-400 mb-4 block"></i>
                     <h2 className="text-4xl font-black uppercase italic tracking-tighter">Connect GitHub</h2>
                     <p className="text-slate-400 text-sm leading-relaxed">
                        To deploy, you need a <b>GitHub Personal Access Token (Classic)</b> with <b>'repo'</b> scope.
                     </p>
                  </div>
                  <input 
                    type="password" 
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-indigo-400 font-mono outline-none focus:border-indigo-500 transition-all text-center"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                  />
                  <div className="flex flex-col gap-4">
                     <button onClick={handleStartDeploy} className="w-full py-6 bg-indigo-600 rounded-2xl font-black uppercase hover:bg-indigo-500 hover:scale-[1.02] transition-all shadow-xl shadow-indigo-500/20">Agent 2: Execute Handshake</button>
                     <button onClick={() => setStep(AppStep.PREVIEW)} className="text-slate-500 text-xs font-bold uppercase hover:text-white transition-colors">Cancel</button>
                  </div>
               </div>
            </motion.div>
          )}

          {step === AppStep.DEPLOYING && (
            <motion.div key="deploying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center text-center px-6">
               <div className="relative w-32 h-32 mb-10">
                  <div className="absolute inset-0 border-r-2 border-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fab fa-github text-5xl opacity-40"></i></div>
               </div>
               <p className="text-2xl font-black uppercase italic tracking-tighter text-gradient mb-2">Syncing with Repository...</p>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Establishing secure pipeline</p>
            </motion.div>
          )}

          {step === AppStep.SUCCESS && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen flex flex-col items-center justify-center space-y-12 text-center px-6">
               <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(34,197,94,0.3)]">
                  <i className="fas fa-check text-6xl text-white"></i>
               </div>
               <div className="space-y-4">
                  <h2 className="text-7xl font-black uppercase italic tracking-tighter leading-none">Operation <br/>Success.</h2>
                  <p className="text-xl text-slate-400 max-w-lg mx-auto italic">Your professional artifact has been pushed to the edge network.</p>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl inline-block max-w-md">
                    <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide">
                       <i className="fas fa-exclamation-triangle mr-2"></i>
                       If you see a 404 Error, please wait 1-2 minutes for GitHub Pages to deploy.
                    </p>
                  </div>
               </div>
               <div className="flex flex-col gap-6">
                 <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="px-20 py-7 bg-indigo-600 rounded-2xl font-black uppercase hover:scale-105 transition-all shadow-2xl shadow-indigo-500/20">Access Production Build</a>
                 <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] hover:text-white transition-colors">New Operation</button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <style>{`
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
