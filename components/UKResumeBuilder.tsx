
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { UKResumeData } from '../types';
import { generateUKResume } from '../services/geminiService';

interface Props {
  onBack: () => void;
  onFindJobs?: (data: UKResumeData) => void;
}

export const UKResumeBuilder: React.FC<Props> = ({ onBack, onFindJobs }) => {
  const [data, setData] = useState<UKResumeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [targetPages, setTargetPages] = useState<1 | 2>(1);
  const [isEditing, setIsEditing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
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

      // Pass the portfolio link and target pages to the agent
      const generatedCV = await generateUKResume(rawData, portfolioLink, targetPages);
      setData(generatedCV);
    } catch (err: any) {
      setError(err.message || 'Failed to process resume.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = resumeRef.current;
    if (!element) return;
    
    setIsEditing(false);

    // @ts-ignore
    if (window.html2pdf) {
        const opt = {
            margin: [0.3, 0.4], 
            filename: `${data?.fullName.replace(/\s+/g, '_')}_UK_CV.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        // @ts-ignore
        window.html2pdf().set(opt).from(element).save();
    } else {
        window.print();
    }
  };

  const handleDownloadDocx = () => {
      setIsEditing(false);
      
      const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
      const postHtml = "</body></html>";
      const html = preHtml + (resumeRef.current?.innerHTML || '') + postHtml;

      const blob = new Blob(['\ufeff', html], {
          type: 'application/msword'
      });
      
      const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
      
      const downloadLink = document.createElement("a");
      document.body.appendChild(downloadLink);
      
      if(navigator.userAgent.indexOf("Chrome") !== -1) {
          downloadLink.href = url;
          downloadLink.download = `${data?.fullName.replace(/\s+/g, '_')}_UK_CV.doc`;
          downloadLink.click();
      } else {
          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          downloadLink.download = `${data?.fullName.replace(/\s+/g, '_')}_UK_CV.doc`;
          downloadLink.click();
      }
      document.body.removeChild(downloadLink);
  };

  // Helper for inputs
  const EditableText = ({ 
    value, 
    onChange, 
    className, 
    multiline = false 
  }: { value: string, onChange: (v: string) => void, className?: string, multiline?: boolean }) => {
    if (!isEditing) return <span className={className}>{value}</span>;
    
    if (multiline) {
       return (
         <textarea 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className={`w-full bg-yellow-50/50 border-b border-dashed border-slate-300 outline-none resize-none focus:bg-white focus:border-emerald-500 transition-colors ${className}`}
            rows={Math.max(2, Math.ceil(value.length / 100))}
         />
       );
    }
    return (
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-yellow-50/50 border-b border-dashed border-slate-300 outline-none w-full focus:bg-white focus:border-emerald-500 transition-colors ${className}`}
      />
    );
  };

  const JobSearchButton = () => (
    <button 
      onClick={() => data && onFindJobs && onFindJobs(data)}
      className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-pink-500/20 transition-all flex items-center gap-2"
    >
      <i className="fas fa-search-location"></i> Find Perfect Jobs
    </button>
  );

  if (!data && !loading) {
    return (
      <div className="max-w-4xl mx-auto pt-24 px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass p-12 rounded-[50px] border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,0.1)] text-center space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 blur-[100px] rounded-full"></div>
          
          <div className="relative z-10">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <i className="fas fa-magic text-4xl text-emerald-400"></i>
              </div>
              <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter mb-4 text-white">UK Resume Architect</h2>
              <p className="text-slate-400 max-w-lg mx-auto text-lg">
                Transform your experience into a <b>Top 1% ATS-Compliant</b> British CV.
                <br/><span className="text-emerald-400 text-sm font-bold uppercase tracking-widest mt-2 block">Optimized for Human & Machine Impact</span>
              </p>
          </div>
          
          <div className="max-w-md mx-auto space-y-6 relative z-10">
             
             {/* CONFIGURATION */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2 text-left">
                     <label className="text-xs font-bold uppercase tracking-widest text-emerald-400 ml-2">Format Length</label>
                     <div className="flex bg-slate-900/50 rounded-xl p-1 border border-white/10">
                        <button 
                            onClick={() => setTargetPages(1)} 
                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${targetPages === 1 ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            1 Page
                        </button>
                        <button 
                            onClick={() => setTargetPages(2)} 
                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${targetPages === 2 ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            2 Pages
                        </button>
                     </div>
                 </div>
                 <div className="space-y-2 text-left">
                     <label className="text-xs font-bold uppercase tracking-widest text-emerald-400 ml-2">Portfolio Link</label>
                     <input 
                       type="text" 
                       value={portfolioLink}
                       onChange={(e) => setPortfolioLink(e.target.value)}
                       placeholder="Optional URL..."
                       className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all text-xs"
                    />
                 </div>
             </div>

             <div onClick={() => fileInputRef.current?.click()} className="p-10 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group relative overflow-hidden bg-slate-900/30">
                <div className="relative z-10 flex flex-col items-center">
                    <i className="fas fa-cloud-upload-alt text-4xl text-slate-500 mb-4 group-hover:text-emerald-400 transition-colors group-hover:scale-110 duration-300"></i>
                    <p className="font-bold uppercase tracking-widest text-xs text-slate-400 group-hover:text-emerald-300">Drop Current Resume (PDF/DOCX)</p>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.txt" />
             </div>
          </div>

          {error && <p className="text-red-400 font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</p>}
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-8 bg-[#0f172a]">
            <div className="relative">
               <div className="w-24 h-24 border-t-4 border-emerald-500 rounded-full animate-spin"></div>
               <div className="w-24 h-24 border-b-4 border-cyan-500 rounded-full animate-spin absolute top-0 left-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-file-signature text-3xl text-white"></i>
               </div>
            </div>
            <div className="text-center space-y-2">
                <p className="text-2xl font-black uppercase italic tracking-tighter text-white">Re-Architecting Career Data</p>
                <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs animate-pulse">Fitting to {targetPages} Page(s) • Analysing Impact</p>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest">Avoiding AI Patterns • Humanizing Tone</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 bg-slate-950">
       <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4 no-print">
          <div className="flex gap-4">
             <button onClick={() => setData(null)} className="text-slate-400 hover:text-white flex items-center gap-2 font-bold uppercase text-xs tracking-wider transition-colors">
                <i className="fas fa-arrow-left"></i> Architect New
             </button>
             {data && <JobSearchButton />}
          </div>
          
          <div className="flex gap-4 items-center">
             <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition-all flex items-center gap-2 border ${isEditing ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'}`}
             >
                <i className={`fas ${isEditing ? 'fa-check' : 'fa-pen'}`}></i> {isEditing ? 'Finish Editing' : 'Edit Mode'}
             </button>

             <button onClick={handleDownloadDocx} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition-all flex items-center gap-2 border border-white/10">
                <i className="fas fa-file-word text-blue-400"></i> DOCX
             </button>
             <button onClick={handleDownloadPDF} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                <i className="fas fa-file-pdf"></i> PDF
             </button>
          </div>
       </div>

       {/* CV PREVIEW - COMPACT A4 SIZE */}
       <div className="flex justify-center pb-20">
         <div ref={resumeRef} className="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-[15mm] shadow-[0_0_50px_rgba(0,0,0,0.5)] mx-auto relative" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>
            {data && (
                <>
                    {/* Header */}
                    <header className="text-center mb-4 border-b-2 border-slate-900 pb-2">
                        <div className="mb-1">
                          <EditableText 
                             value={data.fullName} 
                             onChange={(v) => setData({...data, fullName: v})} 
                             className="text-3xl font-bold uppercase tracking-wide text-slate-950 block w-full text-center"
                          />
                        </div>
                        <div>
                          <EditableText 
                             value={data.contactInfo} 
                             onChange={(v) => setData({...data, contactInfo: v})} 
                             className="text-sm text-slate-700 font-medium block w-full text-center"
                          />
                        </div>
                    </header>

                    {/* Profile */}
                    <section className="mb-3">
                        <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-1.5 text-slate-800 tracking-wider">Professional Profile</h2>
                        <EditableText 
                           value={data.professionalProfile} 
                           onChange={(v) => setData({...data, professionalProfile: v})} 
                           multiline
                           className="text-sm leading-snug text-slate-800 text-justify block"
                        />
                    </section>

                    {/* Competencies */}
                    <section className="mb-3">
                        <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-1.5 text-slate-800 tracking-wider">Core Competencies</h2>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {data.coreCompetencies?.map((skill, i) => (
                                <span key={i} className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                  • <EditableText 
                                      value={skill} 
                                      onChange={(v) => {
                                        const newSkills = [...data.coreCompetencies];
                                        newSkills[i] = v;
                                        setData({...data, coreCompetencies: newSkills});
                                      }}
                                    />
                                </span>
                            ))}
                        </div>
                    </section>

                    {/* Experience */}
                    <section className="mb-3">
                        <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-2 text-slate-800 tracking-wider">Professional Experience</h2>
                        <div className="space-y-2.5">
                            {data.experience?.map((exp, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <EditableText 
                                          value={exp.role} 
                                          onChange={(v) => {
                                            const newExp = [...data.experience];
                                            newExp[i].role = v;
                                            setData({...data, experience: newExp});
                                          }}
                                          className="font-bold text-sm text-slate-950"
                                        />
                                        <EditableText 
                                          value={exp.dates} 
                                          onChange={(v) => {
                                            const newExp = [...data.experience];
                                            newExp[i].dates = v;
                                            setData({...data, experience: newExp});
                                          }}
                                          className="text-xs font-bold text-slate-600 whitespace-nowrap text-right"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <EditableText 
                                          value={exp.company} 
                                          onChange={(v) => {
                                            const newExp = [...data.experience];
                                            newExp[i].company = v;
                                            setData({...data, experience: newExp});
                                          }}
                                          className="text-xs font-bold text-slate-700 italic uppercase"
                                        />
                                        <EditableText 
                                          value={exp.location} 
                                          onChange={(v) => {
                                            const newExp = [...data.experience];
                                            newExp[i].location = v;
                                            setData({...data, experience: newExp});
                                          }}
                                          className="text-xs text-slate-500 text-right"
                                        />
                                    </div>
                                    <ul className="list-disc list-outside ml-3 space-y-0.5">
                                        {exp.responsibilities?.map((resp, idx) => (
                                            <li key={idx} className="text-sm text-slate-800 leading-tight pl-1 marker:text-slate-400 text-justify">
                                               <EditableText 
                                                  value={resp} 
                                                  onChange={(v) => {
                                                    const newExp = [...data.experience];
                                                    newExp[i].responsibilities[idx] = v;
                                                    setData({...data, experience: newExp});
                                                  }}
                                                  multiline
                                               />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Education */}
                    <section className="mb-3">
                        <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-2 text-slate-800 tracking-wider">Education</h2>
                        <div className="space-y-2">
                            {data.education?.map((edu, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline">
                                        <EditableText 
                                          value={edu.degree} 
                                          onChange={(v) => {
                                            const newEdu = [...data.education];
                                            newEdu[i].degree = v;
                                            setData({...data, education: newEdu});
                                          }}
                                          className="font-bold text-sm text-slate-950"
                                        />
                                        <EditableText 
                                          value={edu.dates} 
                                          onChange={(v) => {
                                            const newEdu = [...data.education];
                                            newEdu[i].dates = v;
                                            setData({...data, education: newEdu});
                                          }}
                                          className="text-xs font-bold text-slate-600 whitespace-nowrap text-right"
                                        />
                                    </div>
                                    <EditableText 
                                      value={edu.institution} 
                                      onChange={(v) => {
                                        const newEdu = [...data.education];
                                        newEdu[i].institution = v;
                                        setData({...data, education: newEdu});
                                      }}
                                      className="text-xs font-semibold text-slate-700 italic block"
                                    />
                                    {edu.details && (
                                      <EditableText 
                                        value={edu.details} 
                                        onChange={(v) => {
                                            const newEdu = [...data.education];
                                            newEdu[i].details = v;
                                            setData({...data, education: newEdu});
                                        }}
                                        multiline
                                        className="text-xs text-slate-600 mt-0.5 text-justify block"
                                      />
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Interests & References */}
                    <div className="grid grid-cols-2 gap-6 mt-auto">
                         {data.interests !== undefined && (
                           <section>
                              <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-1.5 text-slate-800 tracking-wider">Interests</h2>
                              <EditableText 
                                 value={data.interests} 
                                 onChange={(v) => setData({...data, interests: v})} 
                                 multiline
                                 className="text-xs text-slate-700 leading-snug text-justify block"
                              />
                           </section>
                         )}
                         <section>
                            <h2 className="text-base font-bold uppercase border-b border-slate-300 mb-1.5 text-slate-800 tracking-wider">References</h2>
                            <EditableText 
                               value={data.references} 
                               onChange={(v) => setData({...data, references: v})} 
                               className="text-xs text-slate-700 block"
                            />
                         </section>
                    </div>
                </>
            )}
         </div>
       </div>

       {data && (
           <div className="fixed bottom-6 right-6 no-print">
               <JobSearchButton />
           </div>
       )}
    </div>
  );
};
