
import React from 'react';
import { motion } from 'framer-motion';
import { ThreeBackground } from './ThreeBackground';

interface Props {
  onStart: () => void;
}

const AgentCard = ({ 
    number, 
    title, 
    desc, 
    icon, 
    color, 
    align = 'left' 
}: { number: string, title: string, desc: string, icon: string, color: string, align?: 'left' | 'right' }) => (
    <motion.div 
        initial={{ opacity: 0, x: align === 'left' ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className={`flex flex-col md:flex-row items-center gap-12 py-24 ${align === 'right' ? 'md:flex-row-reverse' : ''}`}
    >
        <div className="flex-1 space-y-6 text-center md:text-left">
            <span className={`inline-block px-4 py-2 rounded-full bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 text-xs font-bold uppercase tracking-widest`}>
                Agent {number}
            </span>
            <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white leading-none">
                {title}
            </h2>
            <p className="text-lg md:text-xl text-slate-400 max-w-lg leading-relaxed">
                {desc}
            </p>
        </div>
        <div className="flex-1 flex justify-center">
            <div className={`w-64 h-64 md:w-80 md:h-80 rounded-full border border-${color}-500/30 flex items-center justify-center relative bg-gradient-to-br from-${color}-500/10 to-transparent backdrop-blur-md`}>
                <div className={`absolute inset-0 bg-${color}-500/20 blur-[80px] rounded-full`}></div>
                <i className={`fas ${icon} text-8xl text-${color}-400 relative z-10`}></i>
            </div>
        </div>
    </motion.div>
);

export const LandingPage: React.FC<Props> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden relative">
      <ThreeBackground variant="particles" primaryColor="#6366f1" accentColor="#ec4899" backgroundColor="#020617" />
      
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="text-center space-y-8"
          >
              <h1 className="text-9xl md:text-[12rem] font-black uppercase italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-600">
                  Studex
              </h1>
              <p className="text-xl md:text-3xl font-bold uppercase tracking-[0.8em] text-indigo-400">
                  Empowering Students
              </p>
              <div className="pt-10">
                  <div className="animate-bounce">
                      <i className="fas fa-chevron-down text-4xl text-slate-600"></i>
                  </div>
              </div>
          </motion.div>
      </section>

      {/* Agents Stack */}
      <section className="max-w-7xl mx-auto px-6 pb-40">
          
          <AgentCard 
             number="01" 
             title="UK Resume Architect" 
             desc="Transform raw experience into Top 1% ATS-Compliant British CVs. Optimized for human readers and machine parsers."
             icon="fa-file-contract"
             color="emerald"
          />

          <AgentCard 
             number="02" 
             title="3D Portfolio Builder" 
             desc="Deploy a high-fidelity, interactive 3D website in minutes. Turn a flat PDF into a spatial experience."
             icon="fa-cube"
             color="indigo"
             align="right"
          />

          <AgentCard 
             number="03" 
             title="Job Hunter" 
             desc="Real-time matching against live job boards. Agent 03 scans your resume and finds roles where you have >60% match."
             icon="fa-search-location"
             color="pink"
          />

          <AgentCard 
             number="04" 
             title="Resume Moulder" 
             desc="The Chameleon. Tailors your CV keywords and phrasing to match a specific Job Description perfectly."
             icon="fa-magic"
             color="purple"
             align="right"
          />

          <AgentCard 
             number="05" 
             title="Academic Translator" 
             desc="Your Dissertation is gold, but hidden. We translate academic papers into commercial Case Studies."
             icon="fa-graduation-cap"
             color="amber"
          />

          <AgentCard 
             number="06" 
             title="Viral Post Creator" 
             desc="The Distribution Engine. Turns your career history into viral LinkedIn content to attract recruiters to you."
             icon="fa-share-nodes"
             color="blue"
             align="right"
          />

      </section>

      {/* Footer CTA */}
      <section className="py-40 text-center relative z-20">
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/50 to-transparent pointer-events-none"></div>
          <motion.div 
             initial={{ opacity: 0, y: 50 }}
             whileInView={{ opacity: 1, y: 0 }}
             className="relative z-10"
          >
              <h2 className="text-6xl font-black uppercase italic mb-10 text-white">Your Career. <br/>Architected.</h2>
              <button 
                 onClick={onStart}
                 className="px-20 py-8 bg-white text-black rounded-full font-black uppercase text-xl tracking-widest hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.3)]"
              >
                 Enter Studio
              </button>
          </motion.div>
      </section>

    </div>
  );
};
