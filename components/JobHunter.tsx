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
    // Normalize newlines
    const rawText = response.text || "Failed to generate.";
    setCoverLetter(rawText.split(/\\n|\n/).join('\n'));
  };

  const handleMouldResume = async () => {
    if (!resumeData || !selectedJob) return;
    setMoulding(true);
    try {
      const res = await tailorResumeToJob(resumeData, selectedJob.description, selectedJob.title);
      setMouldResult({
        score: res.matchScore,
        analysis: res.analysis,
        success: res.success,
        data: res.data || undefined
      });
    } catch (e: any) {
      alert("Moulding failed: " + e.message);
    } finally {
      setMoulding(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 px-6 pb-20">
        <div className="max-w-7xl mx-auto h-full">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 font-bold uppercase text-xs tracking-wider">
                        <i className="fas fa-arrow-left"></i> Return to Hub
                    </button>
                    <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">Agent 03</span> Job Hunter
                    </h1>
                </div>
                {!resumeData && (
                     <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl border border-white/10 flex items-center gap-3 transition-all">
                        <i className="fas fa-upload text-pink-500"></i>
                        <span className="text-xs font-bold uppercase text-white">Upload Resume to Start</span>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleResumeUpload} accept=".pdf,.docx,.doc,.txt" />
                     </div>
                )}
            </div>

            <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-250px)]">
                {/* LEFT: LIST */}
                <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                    <div className="glass p-4 rounded-2xl flex gap-4 items-center">
                        <i className="fas fa-search text-slate-500 ml-2"></i>
                        <input 
                           type="text" 
                           placeholder="Location (e.g. Leeds)..." 
                           className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-slate-600"
                           value={filters.location}
                           onChange={(e) => setFilters({...filters, location: e.target.value})}
                           onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button onClick={handleSearch} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-[10px] font-bold uppercase transition-all text-white">
                           Search
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                        {loading ? (
                            <div className="text-center py-10 opacity-50">
                                <i className="fas fa-circle-notch fa-spin text-2xl text-pink-500 mb-2"></i>
                                <p className="text-xs uppercase font-bold">Scanning Job Boards...</p>
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-xs uppercase font-bold">No jobs found.</p>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <motion.div 
                                   key={job.id}
                                   layoutId={job.id}
                                   onClick={() => setSelectedJob(job)}
                                   className={`p-6 rounded-2xl border cursor-pointer transition-all ${selectedJob?.id === job.id ? 'bg-pink-500/10 border-pink-500' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800'}`}
                                >
                                    <h3 className="font-bold text-white text-lg leading-tight mb-1">{job.title}</h3>
                                    <p className="text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">{job.company}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded">{job.type}</span>
                                        {job.matchScore && (
                                            <span className={`text-xs font-bold ${job.matchScore >= 80 ? 'text-emerald-400' : job.matchScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {job.matchScore}% Match
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: DETAILS */}
                <div className="lg:col-span-8 h-full flex flex-col">
                    {selectedJob ? (
                        <div className="glass rounded-[40px] border border-white/10 h-full flex flex-col relative overflow-hidden">
                             {/* Job Content */}
                             <div className="p-8 md:p-12 overflow-y-auto flex-1 scrollbar-thin">
                                 <span className="inline-block px-3 py-1 bg-pink-500/20 text-pink-400 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-6">Selected Role</span>
                                 <h2 className="text-4xl font-black uppercase italic text-white mb-2">{selectedJob.title}</h2>
                                 <div className="flex gap-6 text-sm text-slate-400 mb-8 border-b border-white/5 pb-8">
                                     <span><i className="fas fa-building mr-2"></i>{selectedJob.company}</span>
                                     <span><i className="fas fa-map-marker-alt mr-2"></i>{selectedJob.location}</span>
                                     <span><i className="far fa-clock mr-2"></i>{selectedJob.postedAt}</span>
                                 </div>

                                 {/* Match Analysis */}
                                 {selectedJob.matchReason && (
                                     <div className="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                                         <h4 className="text-xs font-bold uppercase text-pink-400 mb-2">Agent Analysis</h4>
                                         <p className="text-slate-300 text-sm italic">"{selectedJob.matchReason}"</p>
                                     </div>
                                 )}

                                 <div className="prose prose-invert max-w-none mb-12">
                                     <p className="text-slate-300 leading-relaxed">{selectedJob.description}</p>
                                 </div>
                                 
                                 {/* ACTIONS */}
                                 <div className="grid grid-cols-2 gap-6">
                                     <button 
                                        onClick={() => generateApplication(selectedJob)}
                                        className="p-6 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/10 text-left group transition-all"
                                     >
                                         <i className="fas fa-envelope-open-text text-2xl text-pink-400 mb-4 group-hover:scale-110 transition-transform"></i>
                                         <h3 className="font-bold text-white text-sm uppercase">Draft Cover Letter</h3>
                                         <p className="text-[10px] text-slate-500 mt-1">Agent 3 writes a custom email</p>
                                     </button>

                                     <button 
                                        onClick={handleMouldResume}
                                        disabled={moulding}
                                        className="p-6 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/10 text-left group transition-all"
                                     >
                                         <i className={`fas fa-magic text-2xl text-purple-400 mb-4 ${moulding ? 'fa-spin' : 'group-hover:scale-110'} transition-transform`}></i>
                                         <h3 className="font-bold text-white text-sm uppercase">Mould Resume</h3>
                                         <p className="text-[10px] text-slate-500 mt-1">Agent 4 tailors your CV to this job</p>
                                     </button>
                                 </div>

                                 {/* RESULTS DISPLAY */}
                                 {coverLetter && (
                                     <div className="mt-8 pt-8 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4">
                                         <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex justify-between">
                                             <span>Generated Application</span>
                                             <button onClick={() => navigator.clipboard.writeText(coverLetter)} className="hover:text-white">Copy</button>
                                         </h4>
                                         <textarea 
                                             readOnly 
                                             value={coverLetter}
                                             className="w-full h-64 bg-slate-950/50 border border-white/10 rounded-xl p-6 text-sm text-slate-300 leading-relaxed outline-none resize-none"
                                         />
                                     </div>
                                 )}
                                 
                                 {mouldResult && (
                                     <div className="mt-8 pt-8 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4">
                                         <h4 className="text-xs font-bold uppercase text-purple-400 mb-4">Resume Moulding Result</h4>
                                         <div className={`p-4 rounded-xl border ${mouldResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                             <div className="flex justify-between items-center mb-2">
                                                 <span className={`font-bold ${mouldResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                                     {mouldResult.success ? 'Optimization Complete' : 'Optimization Failed'}
                                                 </span>
                                                 <span className="text-xs font-bold bg-black/20 px-2 py-1 rounded text-white">{mouldResult.score}% Match</span>
                                             </div>
                                             <p className="text-xs text-slate-300 italic mb-4">{mouldResult.analysis}</p>
                                             {mouldResult.success && mouldResult.data && (
                                                 <button 
                                                    onClick={() => setResumeData(mouldResult.data!)}
                                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold uppercase text-white shadow-lg"
                                                 >
                                                     Use this Tailored Resume
                                                 </button>
                                             )}
                                         </div>
                                     </div>
                                 )}
                             </div>
                             
                             <div className="p-6 bg-slate-900/80 border-t border-white/5 flex justify-between items-center backdrop-blur-md">
                                 <span className="text-xs font-bold text-slate-500">Apply directly on company site</span>
                                 <a href={selectedJob.applyLink} target="_blank" rel="noreferrer" className="px-8 py-3 bg-pink-600 hover:bg-pink-500 rounded-xl text-xs font-bold uppercase text-white shadow-lg shadow-pink-500/20 transition-all">
                                     Apply Now <i className="fas fa-external-link-alt ml-2"></i>
                                 </a>
                             </div>
                        </div>
                    ) : (
                        <div className="glass rounded-[40px] border border-white/10 h-full flex flex-col items-center justify-center text-center opacity-50 p-12">
                             <i className="fas fa-mouse-pointer text-4xl mb-4 text-slate-600"></i>
                             <p className="font-bold uppercase tracking-widest text-sm text-slate-500">Select a job to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
