
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { JobListing, UKResumeData } from '../types';
import { GoogleGenAI } from "@google/genai";
import { generateUKResume, tailorResumeToJob } from '../services/geminiService';

interface Props {
  onBack: () => void;
  resumeData: UKResumeData | null;
  setResumeData: (data: UKResumeData) => void;
}

const MOCK_JOBS: JobListing[] = [
  {
    id: '1',
    title: 'Junior Frontend Developer',
    company: 'Sky (Leeds Tech Hub)',
    location: 'Leeds, UK',
    type: 'Full-time',
    postedAt: '2 days ago',
    description: 'Looking for a React enthusiast to join our streaming platform team. Experience with TypeScript and Tailwind is a plus.',
    applyLink: 'https://careers.sky.com'
  },
  {
    id: '2',
    title: 'Software Engineer Intern',
    company: 'Asda Digital',
    location: 'Leeds, UK',
    type: 'Internship',
    postedAt: '4 hours ago',
    description: 'Summer internship program. Work on real retail challenges. Python or Java required.',
    applyLink: 'https://asda.jobs'
  },
  {
    id: '3',
    title: 'React Developer (Contract)',
    company: 'NHS Digital',
    location: 'Leeds, UK',
    type: 'Contract',
    postedAt: '1 week ago',
    description: 'Helping build the next generation of patient care systems. Remote friendly.',
    applyLink: 'https://digital.nhs.uk/careers'
  },
  {
    id: '4',
    title: 'Graduate Tech Scheme',
    company: 'Jet2.com',
    location: 'Leeds, UK',
    type: 'Full-time',
    postedAt: '1 day ago',
    description: 'Rotate through different tech teams including Web, Mobile, and Data Science.',
    applyLink: 'https://jet2careers.com'
  }
];

export const JobHunter: React.FC<Props> = ({ onBack, resumeData, setResumeData }) => {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [filters, setFilters] = useState({ location: 'Leeds', type: 'All' });
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  
  // Agent 4 State
  const [moulding, setMoulding] = useState(false);
  const [mouldResult, setMouldResult] = useState<{ score: number, analysis: string, success: boolean, data?: UKResumeData } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch jobs if resume exists
  useEffect(() => {
    if (resumeData && jobs.length === 0 && !loading) {
       handleSearch();
    }
  }, [resumeData]);

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

  const handleSearch = async () => {
    setLoading(true);
    setJobs([]);
    setTimeout(() => {
        let results = MOCK_JOBS.filter(j => 
            j.location.includes(filters.location) && 
            (filters.type === 'All' || j.type === filters.type)
        );
        setJobs(results);
        setLoading(false);
        if (resumeData && results.length > 0) analyzeMatches(results);
    }, 1500);
  };

  const analyzeMatches = async (jobList: JobListing[]) => {
     setAnalyzing(true);
     try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
          ACT AS A RECRUITER. Compare this Candidate Summary against these Job Titles.
          CANDIDATE: ${JSON.stringify(resumeData?.professionalProfile)}
          SKILLS: ${JSON.stringify(resumeData?.coreCompetencies)}
          JOBS: ${JSON.stringify(jobList.map(j => ({ id: j.id, title: j.title, desc: j.description })))}
          OUTPUT JSON array: [{ "id": "job_id", "score": number (0-100), "reason": "1 short sentence why" }]
        `;
        const response = await ai.models.generateContent({
           model: "gemini-3-flash-preview",
           contents: prompt,
           config: { responseMimeType: "application/json" }
        });
        if (response.text) {
           const matches = JSON.parse(response.text);
           setJobs(prev => {
              // 1. Map scores to jobs
              const scoredJobs = prev.map(job => {
                  const match = matches.find((m: any) => m.id === job.id);
                  return match ? { ...job, matchScore: match.score, matchReason: match.reason } : job;
              });

              // 2. Filter out jobs with score < 60%
              // CHANGE: Using >= 60 to be inclusive of exactly 60%.
              const filteredJobs = scoredJobs.filter(job => (job.matchScore || 0) >= 60);

              // 3. Sort by score
              return filteredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
           });
        }
     } catch (e) { console.error(e); } finally { setAnalyzing(false); }
  };

  const generateApplication = async (job: JobListing) => {
    if (!resumeData) return;
    setCoverLetter("Agent 3 is drafting your application...");
    setMouldResult(null); // Reset moulding result for new job
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Write a short, punchy, professional Cover Letter email body.
        JOB: ${job.title} at ${job.company}
        CANDIDATE: ${resumeData.fullName}
        PROFILE: ${resumeData.professionalProfile}
        KEY SKILLS: ${resumeData.coreCompetencies.join(', ')}
        TONE: Enthusiastic, Professional, British English.`,
    });
    setCoverLetter(response.text || "Failed to generate.");
  };

  const handleMouldResume = async () => {
    if (!resumeData || !selectedJob) return;
    setMoulding(true);
    try {
        const result = await tailorResumeToJob(resumeData, selectedJob.description, selectedJob.title);
        setMouldResult({
            success: result.success,
            score: result.matchScore,
            analysis: result.analysis,
            data: result.data || undefined
        });
    } catch (e) {
        alert("Agent 4 encountered an issue.");
    } finally {
        setMoulding(false);
    }
  };

  const handleDownloadMoulded = () => {
      if(!mouldResult?.data) return;
      const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(mouldResult.data, null, 2))}`;
      const link = document.createElement("a");
      link.href = jsonString;
      link.download = `Tailored_Resume_${selectedJob?.company.replace(/\s/g,'_')}.json`;
      link.click();
      alert("JSON Downloaded! You can import this back into the UK Resume Architect to view/edit PDF.");
  };

  if (!resumeData && !loading) {
     return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 pt-24">
            <div className="glass p-12 rounded-[50px] border-pink-500/20 shadow-[0_0_100px_rgba(236,72,153,0.1)] text-center max-w-xl">
               <div className="w-24 h-24 bg-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                   <i className="fas fa-search-location text-4xl text-white"></i>
               </div>
               <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white mb-4">Job Hunter Access</h1>
               <p className="text-slate-400 mb-8">Agent 3 needs your resume data to perform matches and Agent 4 needs it to tailor your CV.</p>
               
               <div onClick={() => fileInputRef.current?.click()} className="p-10 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:border-pink-500 hover:bg-pink-500/5 transition-all group">
                   <i className="fas fa-cloud-upload-alt text-4xl text-slate-500 mb-4 group-hover:text-pink-400 transition-colors"></i>
                   <p className="font-bold uppercase tracking-widest text-xs text-slate-400">Upload Current Resume</p>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" onChange={handleResumeUpload} accept=".pdf,.docx,.doc,.txt" />
            </div>
        </div>
     )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pt-28 px-6 pb-20">
       <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
             <div>
                <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 font-bold uppercase text-xs tracking-wider">
                   <i className="fas fa-arrow-left"></i> Return to Hub
                </button>
                <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">Agent 03</span> Job Hunter
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Real-time matching & Auto-Drafting applications.</p>
             </div>
             
             {/* Filters */}
             <div className="glass p-4 rounded-2xl flex flex-wrap gap-4 items-center">
                 <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-xl border border-white/5">
                    <i className="fas fa-map-marker-alt text-pink-500"></i>
                    <select value={filters.location} onChange={(e) => setFilters({...filters, location: e.target.value})} className="bg-transparent outline-none text-xs font-bold uppercase tracking-wider text-white">
                       <option value="Leeds">Leeds</option>
                       <option value="Manchester">Manchester</option>
                       <option value="London">London</option>
                       <option value="Remote">Remote</option>
                    </select>
                 </div>
                 <button onClick={handleSearch} className="px-6 py-2 bg-pink-600 hover:bg-pink-500 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-pink-500/20 transition-all">
                    {loading ? <i className="fas fa-spin fa-spinner"></i> : 'Fetch Jobs'}
                 </button>
             </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
              {/* Job List */}
              <div className="lg:col-span-5 space-y-4">
                 {loading && <div className="text-center py-20 text-slate-500 animate-pulse font-bold uppercase tracking-widest">Scouring Job Boards...</div>}
                 
                 {!loading && jobs.length === 0 && (
                     <div className="p-8 glass rounded-3xl text-center border-2 border-dashed border-white/5">
                         <i className="fas fa-ghost text-4xl text-slate-600 mb-4"></i>
                         <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No jobs found matching &gt;= 60%</p>
                     </div>
                 )}

                 {!loading && jobs.map(job => (
                    <motion.div 
                       key={job.id} layoutId={job.id} onClick={() => { setSelectedJob(job); generateApplication(job); }}
                       className={`p-6 rounded-3xl border cursor-pointer transition-all group relative overflow-hidden ${selectedJob?.id === job.id ? 'bg-pink-600/10 border-pink-500/50' : 'glass border-white/5 hover:bg-white/5'}`}
                    >
                       {job.matchScore && (
                          <div className="absolute top-4 right-4 flex items-center gap-1">
                             <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{job.matchScore}% Match</div>
                             <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${job.matchScore}%` }}></div></div>
                          </div>
                       )}
                       <h3 className="text-lg font-bold text-white mb-1 group-hover:text-pink-400 transition-colors">{job.title}</h3>
                       <div className="flex gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide mb-3"><span>{job.company}</span> • <span>{job.type}</span></div>
                       <p className="text-xs text-slate-500 line-clamp-2">{job.description}</p>
                       {job.matchReason && <div className="mt-3 text-[10px] text-emerald-300/80 italic border-t border-white/5 pt-2"><i className="fas fa-robot mr-1"></i> "{job.matchReason}"</div>}
                    </motion.div>
                 ))}
              </div>

              {/* Action Panel */}
              <div className="lg:col-span-7">
                  {selectedJob ? (
                     <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass p-8 rounded-[40px] border border-white/10 sticky top-28 min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <h2 className="text-3xl font-black uppercase italic text-white mb-2">{selectedJob.title}</h2>
                              <p className="text-xl text-pink-400 font-bold">{selectedJob.company}</p>
                           </div>
                           <a href={selectedJob.applyLink} target="_blank" rel="noreferrer" className="px-6 py-3 bg-white text-black rounded-xl font-bold uppercase text-xs tracking-widest hover:scale-105 transition-transform">Apply Externally <i className="fas fa-external-link-alt ml-2"></i></a>
                        </div>

                        {/* AGENT 4 SECTION */}
                        <div className="mb-8 p-6 bg-slate-900/60 rounded-3xl border border-white/10 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                        <i className="fas fa-magic text-white text-xs"></i>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold uppercase text-white tracking-wide">Agent 4: Resume Moulder</h4>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Tailor CV to Job Description</p>
                                    </div>
                                </div>
                                {!mouldResult ? (
                                    <button 
                                        onClick={handleMouldResume} 
                                        disabled={moulding}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        {moulding ? <i className="fas fa-spin fa-circle-notch"></i> : 'Run Moulding'}
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${mouldResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            Score: {mouldResult.score}
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            {mouldResult && (
                                <div className="relative z-10">
                                    <p className="text-xs text-slate-300 italic mb-3">"{mouldResult.analysis}"</p>
                                    {mouldResult.success ? (
                                        <div className="flex gap-3">
                                            <button onClick={handleDownloadMoulded} className="flex-1 py-2 bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 rounded-lg text-xs font-bold uppercase hover:bg-emerald-600 hover:text-white transition-colors">
                                                <i className="fas fa-download mr-2"></i> Download Tailored JSON
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-wide">Score too low to auto-mould (Needs &gt;60%)</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Cover Letter Draft */}
                        <div className="flex-1 flex flex-col">
                           <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500"><i className="fas fa-pen-fancy mr-2"></i>Agent 3 Draft</label>
                              <button onClick={() => {navigator.clipboard.writeText(coverLetter); alert("Copied!");}} className="text-[10px] font-bold uppercase text-pink-400 hover:text-white">Copy Text</button>
                           </div>
                           <textarea className="flex-1 w-full bg-slate-950/50 rounded-2xl p-6 text-sm leading-relaxed text-slate-300 border border-white/10 outline-none focus:border-pink-500 transition-colors resize-none font-serif" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
                           <div className="mt-4 flex justify-end">
                              <a href={`mailto:hiring@${selectedJob.company.replace(/\s/g, '').toLowerCase()}.com?subject=Application for ${selectedJob.title}&body=${encodeURIComponent(coverLetter)}`} className="px-8 py-3 bg-pink-600 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20">Open Email Client <i className="fas fa-paper-plane ml-2"></i></a>
                           </div>
                        </div>
                     </motion.div>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 border-2 border-dashed border-white/5 rounded-[40px]">
                        <i className="fas fa-briefcase text-6xl opacity-20"></i>
                        <p className="font-bold uppercase tracking-widest text-xs">Select a job to activate Agent 3</p>
                     </div>
                  )}
              </div>
          </div>
       </div>
    </div>
  );
};
