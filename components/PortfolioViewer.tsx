
import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, Variants } from 'framer-motion';
import { PortfolioData } from '../types';

interface Props {
  data: PortfolioData;
}

export const PortfolioViewer: React.FC<Props> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [activeTab, setActiveTab] = useState('hero');
  const primaryColor = data?.theme?.primaryColor || '#6366f1';
  const accentColor = data?.theme?.accentColor || '#a855f7';
  const isLight = data?.theme?.mode === 'light';

  // Helper to convert Hex to RGB for Shadows
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '99, 102, 241';
  };
  const primaryRgb = hexToRgb(primaryColor);

  // Dynamic Theme Classes
  const textPrimary = isLight ? 'text-slate-900' : 'text-white';
  const textSecondary = isLight ? 'text-slate-600' : 'text-slate-400';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-500';
  
  // Custom Card Style with Colored Shadow
  // We set the initial state here. The hover state will be handled by Framer Motion variants.
  const cardStyle = {
    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.03)',
    borderColor: isLight ? `rgba(${primaryRgb}, 0.1)` : `rgba(${primaryRgb}, 0.2)`,
    boxShadow: `0 10px 40px -10px rgba(${primaryRgb}, ${isLight ? 0.15 : 0.2})`,
    backdropFilter: 'blur(10px)',
  };

  const navText = isLight ? 'text-slate-400 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-white';
  const navTextActive = isLight ? 'text-slate-900' : 'text-white';
  
  // Animation Logic
  const animStyle = data.theme?.animationStyle || 'fade';
  
  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };
  
  const slideIn: Variants = {
    hidden: { opacity: 0, x: -100 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, type: "spring", stiffness: 50 } }
  };
  
  const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "backOut" } }
  };

  const popIn: Variants = {
    hidden: { opacity: 0, scale: 0.5, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.5 } }
  };

  const getBaseVariant = () => {
    if (animStyle === 'slide') return slideIn;
    if (animStyle === 'scale') return scaleIn;
    if (animStyle === 'pop') return popIn;
    return fadeInUp;
  };

  // Merge base animation with the hover "Pop" effect
  // This ensures the box itself moves, carrying the text with it, without distorting the text.
  const getCardVariants = () : Variants => {
    const base = getBaseVariant();
    return {
      ...base,
      hover: {
        y: -12, // Lift up
        scale: 1.02, // Slight growth
        borderColor: `rgba(${primaryRgb}, 0.6)`, // Glow border
        boxShadow: `0 25px 60px -10px rgba(${primaryRgb}, ${isLight ? 0.4 : 0.5})`, // Intense colored shadow
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 25
        }
      }
    };
  };

  const cardVariants = getCardVariants();

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'about', 'skills', 'experience', 'projects', 'education', 'contact'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
            setActiveTab(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!data || !data.name) return null;

  const SectionTitle: React.FC<{ children: React.ReactNode; subtitle?: string; color?: string }> = ({ children, subtitle, color }) => (
    <div className="mb-20 text-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="flex flex-col items-center"
      >
        <div className="h-1 w-12 mb-6 rounded-full" style={{ backgroundColor: color || '#6366f1', boxShadow: `0 0 15px ${color}` }}></div>
        <h2 
          className={`text-5xl md:text-7xl font-bold font-heading mb-4 tracking-tight uppercase ${textPrimary}`}
          style={{ color: isLight ? undefined : '#fff' }}
        >
          {children}
        </h2>
        {subtitle && (
          <p className={`${textMuted} font-semibold uppercase tracking-[0.4em] text-[10px] md:text-xs`}>
            {subtitle}
          </p>
        )}
      </motion.div>
    </div>
  );

  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const nameParts = data.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const displaySkills = data.skills.slice(0, 10);

  // Helper for Social Links
  const SocialLink = ({ href, icon, label }: { href: string, icon: string, label: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all ${isLight ? 'bg-slate-900/5 border-slate-900/10 group-hover:bg-slate-900 group-hover:text-white' : 'bg-white/5 border-white/10 group-hover:bg-white group-hover:text-black'}`}
           style={{ borderColor: `rgba(${primaryRgb}, 0.2)` }}
      >
        <i className={`fab ${icon} text-2xl`}></i>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest group-hover:text-inherit ${textMuted}`}>{label}</span>
    </a>
  );

  return (
    <div ref={containerRef} className={`w-full relative ${textPrimary} selection:bg-indigo-500/30`} style={{ backgroundColor: 'transparent' }}>
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 z-[1000] origin-left" 
        style={{ scaleX, background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} 
      />

      <nav className="fixed right-10 top-1/2 -translate-y-1/2 z-[500] hidden xl:flex flex-col gap-6">
        {['hero', 'about', 'skills', 'experience', 'projects', 'education', 'contact'].map((id) => (
          <a key={id} href={`#${id}`} className="group flex items-center justify-end gap-4">
             <span className={`text-[9px] font-bold uppercase tracking-[0.3em] transition-all duration-300 ${activeTab === id ? `opacity-100 ${navTextActive}` : `opacity-0 ${navText}`}`}>
               {id}
             </span>
             <div className="w-1.5 h-1.5 rounded-full border transition-all duration-300" style={{ 
               backgroundColor: activeTab === id ? primaryColor : 'transparent',
               borderColor: activeTab === id ? primaryColor : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'),
               transform: activeTab === id ? 'scale(1.5)' : 'scale(1)',
               boxShadow: activeTab === id ? `0 0 10px ${primaryColor}` : 'none'
             }}></div>
          </a>
        ))}
      </nav>

      <div className="max-w-6xl mx-auto px-8 relative">
        
        {/* HERO SECTION */}
        <section id="hero" className="min-h-screen flex flex-col items-center justify-center pt-24 pb-20">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="text-center w-full z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="relative mb-12 inline-block"
            >
              <div className="absolute -inset-8 blur-[80px] rounded-full opacity-30" style={{ backgroundColor: primaryColor }}></div>
              <div className="relative p-1 bg-gradient-to-tr from-white/10 to-transparent rounded-full overflow-hidden w-64 h-64 md:w-80 md:h-80 border border-white/10 shadow-2xl">
                <img 
                  src={data.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`} 
                  className="w-full h-full object-cover rounded-full"
                  alt={data.name}
                />
              </div>
            </motion.div>

            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className={`inline-flex items-center gap-3 px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.4em] border ${isLight ? 'bg-slate-900/5 text-slate-500 border-slate-900/5' : 'bg-white/5 text-slate-400 border-white/5'}`}
              >
                {data.location || 'Global Professional'}
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="text-6xl md:text-9xl font-bold tracking-tight uppercase"
              >
                {firstName} <span style={{ color: primaryColor, textShadow: `0 0 40px rgba(${primaryRgb}, 0.3)` }}>{lastName}</span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                className={`text-xl md:text-3xl font-medium mt-8 max-w-3xl mx-auto leading-relaxed ${textSecondary}`}
              >
                {data.title}
              </motion.p>
              
              {data.quote && (
                <motion.div
                   initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                   className="mt-8 relative inline-block"
                >
                   <span className={`text-4xl absolute -top-4 -left-6 ${isLight ? 'text-slate-900/10' : 'text-white/10'}`}>"</span>
                   <p className={`text-sm md:text-base font-serif italic tracking-wide max-w-lg mx-auto ${textMuted}`}>
                     {data.quote}
                   </p>
                   <span className={`text-4xl absolute -bottom-4 -right-6 ${isLight ? 'text-slate-900/10' : 'text-white/10'}`}>"</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ABOUT ME */}
        <section id="about" className="py-32 scroll-mt-20">
          <SectionTitle subtitle="Overview" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>About</SectionTitle>
          <motion.div 
            variants={cardVariants}
            initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover="hover"
            className={`rounded-[40px] p-10 md:p-20 border relative overflow-hidden`}
            style={cardStyle}
          >
            <p className={`text-2xl md:text-4xl font-medium leading-snug tracking-tight ${textPrimary}`}>
              {data.summary}
            </p>
          </motion.div>
        </section>

        {/* TECHNICAL SKILLS */}
        <section id="skills" className="py-32 scroll-mt-20">
          <SectionTitle subtitle="Core Competencies" color={primaryColor}>Top Skills</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {displaySkills.map((skill, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover="hover" transition={{ delay: i * 0.05 }}
                className={`rounded-3xl border p-10 text-center transition-all cursor-default flex items-center justify-center`}
                style={cardStyle}
              >
                <span className={`text-sm md:text-lg font-bold uppercase tracking-widest ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{skill}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* PROFESSIONAL EXPERIENCE */}
        <section id="experience" className="py-32 scroll-mt-20">
          <SectionTitle subtitle="Career Path" color={primaryColor}>Professional Experience</SectionTitle>
          <div className="space-y-12">
            {data.experience.map((exp, i) => (
              <motion.div 
                key={i} 
                variants={cardVariants}
                initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover="hover"
                className={`p-10 md:p-14 rounded-[32px] border transition-all`}
                style={cardStyle}
              >
                <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
                  <div>
                    <h3 className={`text-3xl font-bold mb-2 ${textPrimary}`}>{exp.role}</h3>
                    <p className="text-xl font-bold uppercase tracking-widest" style={{ color: primaryColor }}>{exp.company}</p>
                  </div>
                  <div className={`${textMuted} font-bold text-sm uppercase tracking-widest pt-2`}>
                    {exp.period}
                  </div>
                </div>
                <p className={`${textSecondary} text-lg leading-relaxed whitespace-pre-line`}>
                  {exp.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FEATURED PROJECTS */}
        <section id="projects" className="py-32 scroll-mt-20">
          <SectionTitle subtitle="Impact" color={primaryColor}>Featured Projects</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {data.projects.map((proj, i) => (
              <motion.div 
                key={i} 
                variants={cardVariants}
                initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover="hover"
                className={`rounded-[32px] overflow-hidden border transition-all flex flex-col h-full`}
                style={cardStyle}
              >
                <div className="p-10 flex flex-col flex-1">
                  <h3 className={`text-3xl font-bold mb-6 ${textPrimary}`}>{proj.title}</h3>
                  <p className={`${textSecondary} text-lg leading-relaxed mb-8`}>
                    {proj.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {proj.tech.map((t, idx) => (
                      <span key={idx} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${isLight ? 'bg-slate-900/10 text-slate-600' : 'bg-white/10 text-slate-400'}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* EDUCATION */}
        <section id="education" className="py-32 scroll-mt-20">
          <SectionTitle subtitle="Academics" color={primaryColor}>Education</SectionTitle>
          <div className="max-w-4xl mx-auto space-y-6">
            {data.education.map((edu, i) => (
              <motion.div 
                key={i} 
                variants={cardVariants}
                initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover="hover"
                className={`p-8 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-6`}
                style={cardStyle}
              >
                <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="text-center md:text-left">
                    <h3 className={`text-xl font-bold ${textPrimary}`}>{edu.degree}</h3>
                    <p className={`${textMuted} font-semibold uppercase tracking-widest text-xs mt-1`}>{edu.institution}</p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest border ${isLight ? 'bg-slate-900/5 text-slate-500 border-slate-900/5' : 'bg-white/5 text-slate-400 border-white/5'}`}>
                    {edu.year}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* NETWORK SECTION */}
        <section id="contact" className="py-40 flex flex-col items-center justify-center scroll-mt-20">
          <SectionTitle subtitle="Get In Touch" color={primaryColor}>Network</SectionTitle>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="text-center space-y-16 w-full"
          >
            <a href={`mailto:${data.email}`} className={`text-3xl md:text-6xl font-bold hover:text-indigo-400 transition-colors lowercase tracking-tight block ${textPrimary}`} style={{ textShadow: `0 0 20px rgba(${primaryRgb}, 0.2)` }}>
              {data.email}
            </a>

            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              {data.socialLinks?.linkedin && <SocialLink href={data.socialLinks.linkedin} icon="fa-linkedin-in" label="LinkedIn" />}
              {data.socialLinks?.github && <SocialLink href={data.socialLinks.github} icon="fa-github" label="GitHub" />}
              {data.socialLinks?.twitter && <SocialLink href={data.socialLinks.twitter} icon="fa-twitter" label="X / Twitter" />}
              {data.socialLinks?.instagram && <SocialLink href={data.socialLinks.instagram} icon="fa-instagram" label="Instagram" />}
              {data.socialLinks?.facebook && <SocialLink href={data.socialLinks.facebook} icon="fa-facebook-f" label="Facebook" />}
              {data.socialLinks?.dribbble && <SocialLink href={data.socialLinks.dribbble} icon="fa-dribbble" label="Dribbble" />}
              {data.socialLinks?.behance && <SocialLink href={data.socialLinks.behance} icon="fa-behance" label="Behance" />}
              {data.socialLinks?.whatsapp && <SocialLink href={data.socialLinks.whatsapp} icon="fa-whatsapp" label="WhatsApp" />}
            </div>
          </motion.div>
        </section>
      </div>
      
      <footer className={`py-20 border-t bg-transparent ${isLight ? 'border-slate-900/5' : 'border-white/5'}`}>
        <div className="max-w-6xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40">
          <div className={`flex items-center gap-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'bg-slate-900/10' : 'bg-white/10'}`}>
                <i className="fas fa-microchip text-[10px]"></i>
             </div>
             <span className="font-bold tracking-tight uppercase text-sm">PortoCV Studio // 2025</span>
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
             Built with Agentic Intelligence v2.5
          </div>
        </div>
      </footer>
    </div>
  );
};
