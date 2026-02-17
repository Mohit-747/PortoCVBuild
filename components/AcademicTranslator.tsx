
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { AcademicTranslation } from '../types';
import { transformAcademicToBlog } from '../services/geminiService';

interface Props {
  onBack: () => void;
}

export const AcademicTranslator: React.FC<Props> = ({ onBack }) => {
  const [translation, setTranslation] = useState<AcademicTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileType, setFileType] = useState<'paper' | 'thesis'>('paper');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setTranslation(null);

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

      const result = await transformAcademicToBlog(rawData);
      setTranslation(result);
    } catch (err: any) {
      alert("Translation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
      // Normalize line breaks for clipboard
      const normalizedText = text.split(/\\n|\n/).join('\n');
      navigator.clipboard.writeText(normalizedText);
      alert("Copied to clipboard!");
  };

  const formatText = (text: string) => {
      if (!text) return "";
      return text.split(/\\n|\n/).join('\n');
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">
              <div className="relative w-32 h-32 mb-8">
                  <div className="absolute inset-0 border-t-4 border-amber-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-4 border-orange-400 rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-book-open text-4xl text-white"></i></div>
              </div>
              <h2 className="text-3xl font-black uppercase italic text-white mb-2">Agent 05 Working...</h2>
              <p className="text-amber-500 font-bold uppercase tracking-widest text-xs animate-pulse">Translating Academia to Commercial Value</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pt-28 px-6 pb-20">
       <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
             <div>
                <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 font-bold uppercase text-xs tracking-wider">
                   <i className="fas fa-arrow-left"></i> Return to Hub
                </button>
                <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">Agent 05</span> Translator
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Turn Dissertations into viral Case Studies & Blog Posts.</p>
             </div>
          </div>

          {!translation ? (
             <div className="grid lg:grid-cols-2 gap-12 items-center">
                 <div className="space-y-6">
                     <div className="glass p-8 rounded-[40px] border border-white/10 relative overflow-hidden">
                         <h3 className="text-2xl font-bold uppercase text-white mb-4">The Student Problem</h3>
                         <p className="text-slate-400 leading-relaxed mb-6">
                             You write 10,000 words. Recruiters read 0 words. <br/>
                             Your academic achievements are hidden in PDFs that nobody opens.
                         </p>
                         <h3 className="text-2xl font-bold uppercase text-amber-500 mb-4">The Agent 05 Solution</h3>
                         <p className="text-slate-300 leading-relaxed">
                             We use AI to read your Thesis/Essay and extract the <b>Commercial Value</b>. 
                             It generates a punchy LinkedIn post and a Medium-style article you can add to your portfolio immediately.
                         </p>
                     </div>
                 </div>
                 
                 <div onClick={() => fileInputRef.current?.click()} className="glass p-16 rounded-[50px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-500/5 transition-all group min-h-[400px]">
                     <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-2xl">
                         <i className="fas fa-file-pdf text-4xl text-amber-500"></i>
                     </div>
                     <h3 className="text-xl font-bold uppercase text-white mb-2">Upload Paper</h3>
                     <p className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-amber-400">PDF / DOCX Supported</p>
                     <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.txt" />
                 </div>
             </div>
          ) : (
             <div className="grid lg:grid-cols-12 gap-8">
                 {/* LEFT: LinkedIn Post */}
                 <div className="lg:col-span-4 space-y-6">
                     <div className="glass p-6 rounded-[30px] border border-blue-500/30 shadow-lg shadow-blue-500/10">
                         <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2 text-blue-400">
                                 <i className="fab fa-linkedin text-2xl"></i>
                                 <span className="font-bold text-sm uppercase tracking-wide">Viral Post</span>
                             </div>
                             <button onClick={() => copyToClipboard(translation.linkedInPost)} className="text-xs font-bold uppercase hover:text-white text-slate-400">Copy</button>
                         </div>
                         <div className="bg-white text-black p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-sans">
                             {formatText(translation.linkedInPost)}
                         </div>
                     </div>
                     
                     <div className="glass p-6 rounded-[30px] border border-amber-500/30">
                         <h3 className="text-amber-500 font-bold uppercase text-sm mb-4 tracking-widest">Key Takeaways</h3>
                         <ul className="space-y-3">
                             {translation.keyTakeaways.map((point, i) => (
                                 <li key={i} className="flex gap-3 text-sm text-slate-300">
                                     <i className="fas fa-check-circle text-amber-500 mt-1"></i>
                                     {point}
                                 </li>
                             ))}
                         </ul>
                     </div>
                 </div>

                 {/* RIGHT: Blog Post */}
                 <div className="lg:col-span-8">
                     <div className="glass p-10 rounded-[40px] border border-white/10 relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-amber-500 to-orange-600"></div>
                         
                         <div className="mb-8">
                            <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4">Case Study Generated</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{translation.title}</h2>
                            <p className="text-lg text-slate-300 italic border-l-4 border-amber-500 pl-4">{translation.hook}</p>
                         </div>

                         <div className="prose prose-invert max-w-none text-slate-300">
                             <div className="whitespace-pre-wrap leading-loose text-base md:text-lg">
                                 {formatText(translation.simplifiedContent)}
                             </div>
                         </div>
                         
                         <div className="mt-10 pt-10 border-t border-white/5 flex gap-4">
                             <button onClick={() => copyToClipboard(`# ${translation.title}\n\n${translation.simplifiedContent}`)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold uppercase text-xs tracking-widest text-white transition-all flex items-center gap-2">
                                 <i className="fab fa-markdown"></i> Copy Markdown
                             </button>
                             <button onClick={() => {}} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold uppercase text-xs tracking-widest text-white transition-all shadow-lg shadow-amber-500/20">
                                 <i className="fas fa-plus-circle"></i> Add to Portfolio (Coming Soon)
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
          )}
       </div>
    </div>
  );
};
