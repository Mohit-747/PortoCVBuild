
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
// @ts-ignore
import mammoth from 'mammoth';
import { ViralPost } from '../types';
import { generateViralPosts } from '../services/geminiService';

interface Props {
  onBack: () => void;
}

export const LinkedInViralGenerator: React.FC<Props> = ({ onBack }) => {
  const [posts, setPosts] = useState<ViralPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setFile(e.target.files[0]);
      }
  };

  const handleGenerate = async () => {
    if (!topics && !file) {
        alert("Please provide at least a Topic or a Source File.");
        return;
    }

    setLoading(true);
    setPosts([]);

    try {
      let rawData: string | { data: string; mimeType: string } | null = null;
      
      if (file) {
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
      }

      const results = await generateViralPosts(rawData, topics, date);
      setPosts(results);
    } catch (err: any) {
      alert("Generation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPost = (post: ViralPost) => {
      // Robust replace for clipboard
      const cleanBody = post.body.replace(/\\n/g, '\n');
      const fullText = `${post.hook}\n\n${cleanBody}\n\n${post.hashtags}`;
      navigator.clipboard.writeText(fullText);
      alert("Post copied to clipboard!");
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">
              <div className="relative w-32 h-32 mb-8">
                  <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-4 border-cyan-400 rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fab fa-linkedin-in text-4xl text-white"></i></div>
              </div>
              <h2 className="text-3xl font-black uppercase italic text-white mb-2">Agent 06 Working...</h2>
              <p className="text-blue-400 font-bold uppercase tracking-widest text-xs animate-pulse">Analyzing Trends & Sources</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pt-28 px-6 pb-20">
       <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
             <div>
                <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 font-bold uppercase text-xs tracking-wider">
                   <i className="fas fa-arrow-left"></i> Return to Hub
                </button>
                <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">Agent 06</span> Viral Post Creator
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Generate high-engagement LinkedIn content from any source or topic.</p>
             </div>
          </div>

          {posts.length === 0 ? (
             <div className="grid lg:grid-cols-12 gap-12 items-start">
                 <div className="lg:col-span-5 space-y-6">
                     <div className="glass p-8 rounded-[40px] border border-white/10 relative overflow-hidden">
                         <h3 className="text-2xl font-bold uppercase text-white mb-4">The Content Engine</h3>
                         <p className="text-slate-400 leading-relaxed mb-6">
                             Don't just post your CV. Post your <b>ideas</b>. 
                         </p>
                         <div className="space-y-4">
                             <div className="flex gap-4">
                                 <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><i className="fas fa-newspaper"></i></div>
                                 <div>
                                     <h4 className="font-bold text-white text-sm">Repurpose Content</h4>
                                     <p className="text-xs text-slate-500">Upload a Paper, Article, or Essay to extract viral insights.</p>
                                 </div>
                             </div>
                             <div className="flex gap-4">
                                 <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400"><i className="fas fa-lightbulb"></i></div>
                                 <div>
                                     <h4 className="font-bold text-white text-sm">Thought Leadership</h4>
                                     <p className="text-xs text-slate-500">Enter a topic and let Agent 06 write a trend-jacking post.</p>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 <div className="lg:col-span-7 space-y-6">
                     <div className="glass p-8 rounded-[40px] border border-white/10 space-y-6">
                         
                         {/* TOPICS INPUT */}
                         <div className="space-y-2">
                             <label className="text-xs font-bold uppercase tracking-widest text-blue-400 block">
                                <i className="fas fa-hashtag mr-2"></i> Topics & Interests
                             </label>
                             <textarea 
                                placeholder="e.g. Generative AI, Sustainable Fashion, The Future of Remote Work, React.js Performance..." 
                                value={topics}
                                onChange={(e) => setTopics(e.target.value)}
                                className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500 placeholder-slate-600 resize-none transition-all focus:bg-slate-900"
                             />
                         </div>

                         <div className="grid md:grid-cols-2 gap-6">
                             {/* DATE INPUT */}
                             <div className="space-y-2">
                                 <label className="text-xs font-bold uppercase tracking-widest text-blue-400 block">
                                    <i className="fas fa-calendar-alt mr-2"></i> Context Date
                                 </label>
                                 <input 
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                 />
                             </div>

                             {/* FILE INPUT */}
                             <div className="space-y-2">
                                 <label className="text-xs font-bold uppercase tracking-widest text-blue-400 block">
                                    <i className="fas fa-file-upload mr-2"></i> Source File (Optional)
                                 </label>
                                 <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full border border-dashed rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between ${file ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-900/50 border-white/10 hover:border-blue-500/50'}`}
                                 >
                                     <span className={`text-xs truncate ${file ? 'text-white font-bold' : 'text-slate-500'}`}>
                                         {file ? file.name : 'Upload Article/Paper/Resume'}
                                     </span>
                                     <i className={`fas ${file ? 'fa-check text-blue-400' : 'fa-plus text-slate-500'}`}></i>
                                 </div>
                                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.docx,.doc,.txt" />
                                 {file && <button onClick={(e) => { e.stopPropagation(); setFile(null); fileInputRef.current!.value = ''; }} className="text-[10px] text-red-400 uppercase font-bold hover:text-white block text-right">Remove File</button>}
                             </div>
                         </div>

                         <button 
                            onClick={handleGenerate}
                            className="w-full py-6 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                         >
                            Generate Content
                         </button>
                     </div>
                 </div>
             </div>
          ) : (
             <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
                 {posts.map((post, index) => (
                     <motion.div 
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass p-6 rounded-[30px] border border-white/10 flex flex-col h-full hover:border-blue-500/50 transition-all group"
                     >
                         <div className="flex justify-between items-start mb-4">
                             <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">{post.style}</span>
                             <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                 <i className="fas fa-fire text-orange-500"></i> {post.estimatedViralityScore}/100
                             </span>
                         </div>
                         
                         <h3 className="text-sm font-bold text-white mb-4 italic">"{post.hook}"</h3>
                         
                         <div className="flex-1 bg-white/5 p-4 rounded-xl mb-6 overflow-y-auto max-h-[300px] scrollbar-thin">
                             <div className="text-xs text-slate-300 leading-relaxed font-sans">
                                {post.body.split(/\\n|\n/).map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        <br className="mb-2" />
                                    </React.Fragment>
                                ))}
                             </div>
                             <p className="text-xs text-blue-400 mt-4 font-bold">{post.hashtags}</p>
                         </div>

                         <button onClick={() => copyPost(post)} className="w-full py-3 bg-slate-800 hover:bg-blue-600 rounded-xl font-bold uppercase text-xs tracking-widest text-white transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                             <i className="far fa-copy"></i> Copy Text
                         </button>
                     </motion.div>
                 ))}
                 
                 <div className="flex flex-col justify-center gap-4">
                     <button onClick={() => setPosts([])} className="py-6 rounded-3xl border-2 border-dashed border-white/10 text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all font-bold uppercase text-sm tracking-widest">
                         <i className="fas fa-redo mb-2 block text-2xl"></i>
                         Create New Batch
                     </button>
                 </div>
             </div>
          )}
       </div>
    </div>
  );
};
