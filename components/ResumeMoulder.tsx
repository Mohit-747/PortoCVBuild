
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { UKResumeData } from '../types';
import { generateUKResume, tailorResumeToJob } from '../services/geminiService';

interface Props {
  onBack: () => void;
  resumeData: UKResumeData | null;
  setResumeData: (data: UKResumeData) => void;
}

export const ResumeMoulder: React.FC<Props> = ({ onBack, resumeData, setResumeData }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ score: number, analysis: string, success: boolean, data?: UKResumeData } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    try {
       let rawData: string | { data: string; mimeType: string } = '';
       if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
         const reader = new FileReader();
         const base64Promise = new Promise<string>((resolve) => {
           reader.onload = () => resolve((reader.result as string).split(',')[1]);
           reader.readAsDataURL(file);
         });
         rawData = { data: await base64Promise, mimeType: file.type };
       } else if (file.type.includes('wordprocessingml')) {
         const arrayBuffer = await file.arrayBuffer();
         const result = await mammoth.extractRawText({ arrayBuffer });
         rawData = result.value;
       } else {
         rawData = await file.text();
       }
       // Generate UK Resume structure to use for matching
       const generatedCV = await generateUKResume(rawData);
       setResumeData(generatedCV);
    } catch (err) {
       alert("Failed to parse resume.");
    } finally {
       setLoading(false);
    }
  };

  const handleMould = async () => {
    if (!resumeData || !jobDescription || !jobTitle) {
        alert("Please provide all details.");
        return;
    }
    setProcessing(true);
    setResult(null);
    try {
        const res = await tailorResumeToJob(resumeData, jobDescription, jobTitle);
        setResult({
            success: res.success,
            score: res.matchScore,
            analysis: res.analysis,
            data: res.data || undefined
        });
    } catch (e: any) {
        alert("Moulding failed: " + e.message);
    } finally {
        setProcessing(false);
    }
  };

  const downloadResult = () => {
      if(!result?.data) return;
      const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(result.data, null, 2))}`;
      const link = document.createElement("a");
      link.href = jsonString;
      link.download = `Tailored_${jobTitle.replace(/\s/g,'_')}_Resume.json`;
      link.click();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pt-28 px-6 pb-20">
       <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
             <div>
                <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 font-bold uppercase text-xs tracking-wider">
                   <i className="fas fa-arrow-left"></i> Return to Hub
                </button>
                <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500">Agent 04</span> Moulder
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Tailor your CV perfectly to any Job Description.</p>
             </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
              {/* LEFT: INPUTS */}
              <div className="space-y-6">
                  {/* Step 1: Resume */}
                  <div className="glass p-8 rounded-[40px] border border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-20 bg-purple-600/10 blur-[80px] rounded-full"></div>
                      <h3 className="text-xl font-bold uppercase text-white mb-6 relative z-10 flex items-center gap-3">
                         <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs">1</span>
                         Resume Source
                      </h3>
                      
                      {resumeData ? (
                          <div className="relative z-10">
                              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 mb-4">
                                  <i className="fas fa-check-circle text-emerald-400 text-2xl"></i>
                                  <div>
                                      <p className="font-bold text-white">{resumeData.fullName}</p>
                                      <p className="text-xs text-emerald-400 uppercase tracking-wider">Loaded Successfully</p>
                                  </div>
                              </div>
                              <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">
                                  Replace File
                              </button>
                          </div>
                      ) : (
                          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-3xl p-10 cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all text-center relative z-10">
                             {loading ? <i className="fas fa-spin fa-circle-notch text-2xl text-purple-500"></i> : <i className="fas fa-cloud-upload-alt text-3xl text-slate-500 mb-2"></i>}
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Upload CV (PDF/DOCX)</p>
                          </div>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleResumeUpload} accept=".pdf,.docx,.doc,.txt" />
                  </div>

                  {/* Step 2: Job Data */}
                  <div className="glass p-8 rounded-[40px] border border-white/5 relative overflow-hidden">
                      <h3 className="text-xl font-bold uppercase text-white mb-6 flex items-center gap-3">
                         <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs">2</span>
                         Target Job
                      </h3>
                      <div className="space-y-4">
                          <input 
                             type="text" 
                             placeholder="Job Title (e.g. Senior Product Manager)"
                             className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 outline-none focus:border-purple-500"
                             value={jobTitle}
                             onChange={(e) => setJobTitle(e.target.value)}
                          />
                          <textarea 
                             placeholder="Paste the full Job Description here..."
                             className="w-full h-40 bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 outline-none focus:border-purple-500 resize-none"
                             value={jobDescription}
                             onChange={(e) => setJobDescription(e.target.value)}
                          />
                      </div>
                  </div>

                  <button 
                     onClick={handleMould}
                     disabled={processing || !resumeData}
                     className="w-full py-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                     {processing ? (
                         <span className="flex items-center justify-center gap-3">
                             <i className="fas fa-magic fa-spin"></i> Moulding Reality...
                         </span>
                     ) : (
                         <span>Run Agent 4</span>
                     )}
                  </button>
              </div>

              {/* RIGHT: RESULTS */}
              <div className="glass p-8 rounded-[40px] border border-white/5 min-h-[500px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                   {!result ? (
                       <div className="opacity-30">
                           <i className="fas fa-cogs text-6xl mb-4"></i>
                           <p className="font-bold uppercase tracking-widest text-sm">Waiting for Input...</p>
                       </div>
                   ) : (
                       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full text-left">
                           <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                               <div className="flex items-center gap-4">
                                   <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black ${result.success ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white'}`}>
                                       {result.score}
                                   </div>
                                   <div>
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Match Score</span>
                                       <span className={`text-xl font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                           {result.success ? 'Optimization Successful' : 'Optimization Failed'}
                                       </span>
                                   </div>
                               </div>
                           </div>

                           <div className="mb-8 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                               <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Agent Analysis</h4>
                               <p className="text-slate-300 leading-relaxed italic">"{result.analysis}"</p>
                           </div>

                           {result.success && result.data && (
                               <div className="space-y-4">
                                   <div className="grid grid-cols-2 gap-4">
                                       <div className="p-4 bg-white/5 rounded-xl">
                                            <span className="block text-[10px] uppercase text-slate-500 mb-1">New Profile Snippet</span>
                                            <p className="text-xs text-slate-300 line-clamp-3">{result.data.professionalProfile}</p>
                                       </div>
                                       <div className="p-4 bg-white/5 rounded-xl">
                                            <span className="block text-[10px] uppercase text-slate-500 mb-1">Top Skills</span>
                                            <p className="text-xs text-slate-300">{result.data.coreCompetencies.slice(0, 5).join(', ')}...</p>
                                       </div>
                                   </div>
                                   <button onClick={downloadResult} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all">
                                       <i className="fas fa-download mr-2"></i> Download Tailored JSON
                                   </button>
                                   <p className="text-[10px] text-center text-slate-500">
                                       Import this JSON into <b>Agent 1 (Resume Architect)</b> to generate the final PDF.
                                   </p>
                               </div>
                           )}
                           
                           {!result.success && (
                               <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                   <p className="text-red-400 text-xs font-bold">Match score too low ({result.score}/100). Agent 4 requires at least 60% match to safely mould the resume without hallucinating skills.</p>
                               </div>
                           )}
                       </motion.div>
                   )}
              </div>
          </div>
       </div>
    </div>
  );
};
