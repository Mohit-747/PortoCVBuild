
import { PortfolioData } from "../types";

export const deployToGitHub = async (rawToken: string, data: PortfolioData): Promise<string> => {
  const token = rawToken.trim();
  
  // Ensure strict uniqueness in repo name
  const safeName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const repoName = `portocv-${safeName}-${Math.floor(Math.random() * 10000)}`;
  
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  // 1. Get User Info
  const userResponse = await fetch('https://api.github.com/user', { headers });
  if (!userResponse.ok) throw new Error('Invalid GitHub Token. Ensure it is a Classic Token with "repo" scope.');
  const userData = await userResponse.json();
  const username = userData.login;

  // 2. Create Repository
  // We capture the response to find the default_branch (usually 'main', but could be 'master' based on user settings)
  const createRepoResponse = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: `Professional Portfolio for ${data.name} - Created via PortoCV`,
      auto_init: true, // This creates the initial commit and default branch
      homepage: `https://${username}.github.io/${repoName}`
    }),
  });
  
  if (!createRepoResponse.ok) {
     const err = await createRepoResponse.json();
     throw new Error(`Repo creation failed: ${err.message}`);
  }

  const repoData = await createRepoResponse.json();
  const defaultBranch = repoData.default_branch || 'main';

  // 3. Construct Index.html
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.name} | Portfolio</title>
    
    <!-- Dependencies -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;900&display=swap" rel="stylesheet">
    
    <!-- React & Motion -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js"></script>

    <style>
        body { 
            background-color: ${data.theme?.backgroundColor || '#020617'}; 
            color: ${data.theme?.mode === 'light' ? '#0f172a' : '#f8fafc'};
            font-family: 'Inter', sans-serif; 
            overflow-x: hidden; 
        }
        .font-heading { font-family: 'Outfit', sans-serif; }
        .glass {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${data.theme?.backgroundColor || '#020617'}; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useEffect, useRef } = React;
        const { motion, useScroll, useSpring, useTransform } = window.Motion;

        const PORTFOLIO_DATA = ${JSON.stringify(data)};

        // --- THREE BACKGROUND ---
        const ThreeBackground = ({ primaryColor, accentColor, backgroundColor, variant }) => {
            const canvasRef = useRef(null);

            const hexToRgb = (hex) => {
                const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 99, g: 102, b: 241 };
            };

            useEffect(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let animationFrameId;
                const rgbPrimary = hexToRgb(primaryColor || '#6366f1');
                const rgbAccent = hexToRgb(accentColor || '#06b6d4');
                
                let items = [];
                let time = 0;

                const init = () => {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    items = [];

                    if (variant === 'particles') {
                        const count = Math.min(100, Math.floor((canvas.width * canvas.height) / 10000));
                        items = Array.from({ length: count }, () => ({
                            x: Math.random() * canvas.width,
                            y: Math.random() * canvas.height,
                            z: Math.random() * 1000,
                            size: Math.random() * 2 + 0.5,
                            opacity: Math.random() * 0.5 + 0.1,
                            speedX: (Math.random() - 0.5) * 0.3,
                            speedY: (Math.random() - 0.5) * 0.3
                        }));
                    } else if (variant === 'bokeh') {
                        const count = 15;
                        items = Array.from({ length: count }, () => ({
                            x: Math.random() * canvas.width,
                            y: Math.random() * canvas.height,
                            radius: Math.random() * 100 + 50,
                            color: Math.random() > 0.5 ? rgbPrimary : rgbAccent,
                            opacity: Math.random() * 0.1 + 0.05,
                            vx: (Math.random() - 0.5) * 0.5,
                            vy: (Math.random() - 0.5) * 0.5
                        }));
                    }
                };

                const drawParticles = () => {
                    ctx.fillStyle = backgroundColor || '#020617';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    items.forEach(p => {
                        p.z -= 1.0;
                        p.x += p.speedX * (1000 / (p.z || 1));
                        p.y += p.speedY * (1000 / (p.z || 1));
                        if (p.z <= 0) { p.z = 1000; p.x = Math.random() * canvas.width; p.y = Math.random() * canvas.height; }
                        const scale = 500 / (500 + p.z);
                        const x = (p.x - cx) * scale + cx;
                        const y = (p.y - cy) * scale + cy;
                        const size = p.size * scale;
                        if (x > 0 && x < canvas.width && y > 0 && y < canvas.height) {
                            ctx.beginPath();
                            ctx.arc(x, y, size, 0, Math.PI * 2);
                            ctx.fillStyle = \`rgba(\${rgbPrimary.r}, \${rgbPrimary.g}, \${rgbPrimary.b}, \${p.opacity * (1 - p.z / 1000)})\`;
                            ctx.fill();
                        }
                    });
                };

                const drawGrid = () => {
                    ctx.fillStyle = backgroundColor || '#020617';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    const horizon = canvas.height * 0.4;
                    const gridSpacing = 40;
                    ctx.strokeStyle = \`rgba(\${rgbPrimary.r}, \${rgbPrimary.g}, \${rgbPrimary.b}, 0.2)\`;
                    ctx.lineWidth = 1;
                    const cx = canvas.width / 2;
                    for (let i = -20; i <= 20; i++) {
                        ctx.beginPath();
                        ctx.moveTo(cx + i * gridSpacing * 0.2, horizon);
                        ctx.lineTo(cx + i * gridSpacing * 5, canvas.height);
                        ctx.stroke();
                    }
                    const offset = (time * 20) % gridSpacing;
                    for (let y = horizon; y < canvas.height; y += gridSpacing * (1 + (y-horizon)/200)) {
                        const perspectiveY = y + offset * ((y-horizon)/200);
                        if(perspectiveY > canvas.height) continue;
                        ctx.beginPath();
                        ctx.moveTo(0, perspectiveY);
                        ctx.lineTo(canvas.width, perspectiveY);
                        ctx.stroke();
                    }
                    const grad = ctx.createLinearGradient(0, 0, 0, horizon);
                    grad.addColorStop(0, backgroundColor || '#020617');
                    grad.addColorStop(1, \`rgba(\${rgbAccent.r}, \${rgbAccent.g}, \${rgbAccent.b}, 0.1)\`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, canvas.width, horizon);
                };

                const drawBokeh = () => {
                    ctx.fillStyle = backgroundColor || '#020617';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'lighter';
                    items.forEach(b => {
                        b.x += b.vx; b.y += b.vy;
                        if (b.x < -b.radius) b.x = canvas.width + b.radius;
                        if (b.x > canvas.width + b.radius) b.x = -b.radius;
                        if (b.y < -b.radius) b.y = canvas.height + b.radius;
                        if (b.y > canvas.height + b.radius) b.y = -b.radius;
                        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
                        g.addColorStop(0, \`rgba(\${b.color.r}, \${b.color.g}, \${b.color.b}, \${b.opacity})\`);
                        g.addColorStop(1, \`rgba(\${b.color.r}, \${b.color.g}, \${b.color.b}, 0)\`);
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                        ctx.fill();
                    });
                    ctx.globalCompositeOperation = 'source-over';
                };

                const draw = () => {
                    time += 0.01;
                    if (variant === 'grid') drawGrid();
                    else if (variant === 'bokeh') drawBokeh();
                    else drawParticles();
                    animationFrameId = requestAnimationFrame(draw);
                };

                init();
                draw();
                window.addEventListener('resize', init);
                return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', init); };
            }, [primaryColor, accentColor, backgroundColor, variant]);

            return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 pointer-events-none" style={{ background: backgroundColor }} />;
        };

        const SectionTitle = ({ children, subtitle, color, isLight, textPrimary, textMuted }) => (
            <div className="mb-20 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="flex flex-col items-center"
                >
                    <div className="h-1 w-12 mb-6 rounded-full" style={{ backgroundColor: color || '#6366f1', boxShadow: \`0 0 15px \${color}\` }}></div>
                    <h2 className={\`text-4xl md:text-7xl font-bold font-heading mb-4 tracking-tight uppercase \${textPrimary}\`} style={{ color: isLight ? undefined : '#fff' }}>
                        {children}
                    </h2>
                    {subtitle && <p className={\`\${textMuted} font-semibold uppercase tracking-[0.4em] text-[10px] md:text-xs\`}>{subtitle}</p>}
                </motion.div>
            </div>
        );

        const PortfolioApp = () => {
            const data = PORTFOLIO_DATA;
            const containerRef = useRef(null);
            const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
            const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
            const [activeTab, setActiveTab] = useState('hero');
            
            const primaryColor = data?.theme?.primaryColor || '#6366f1';
            const accentColor = data?.theme?.accentColor || '#a855f7';
            const bg = data?.theme?.backgroundColor || '#020617';
            const animStyle = data?.theme?.animationStyle || 'fade';
            const isLight = data?.theme?.mode === 'light';

            const hexToRgb = (hex) => {
                const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? \`\${parseInt(result[1], 16)}, \${parseInt(result[2], 16)}, \${parseInt(result[3], 16)}\` : '99, 102, 241';
            };
            const primaryRgb = hexToRgb(primaryColor);

            // Dynamic Theme Classes
            const textPrimary = isLight ? 'text-slate-900' : 'text-white';
            const textSecondary = isLight ? 'text-slate-600' : 'text-slate-400';
            const textMuted = isLight ? 'text-slate-500' : 'text-slate-500';
            const navText = isLight ? 'text-slate-400 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-white';
            const navTextActive = isLight ? 'text-slate-900' : 'text-white';

            // Custom Card Style with Colored Shadow
            const cardStyle = {
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.03)',
                borderColor: isLight ? \`rgba(\${primaryRgb}, 0.1)\` : \`rgba(\${primaryRgb}, 0.2)\`,
                boxShadow: \`0 10px 40px -10px rgba(\${primaryRgb}, \${isLight ? 0.2 : 0.25})\`,
                backdropFilter: 'blur(10px)'
            };

            const fadeInUp = { hidden: { opacity: 0, y: 60 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
            const slideIn = { hidden: { opacity: 0, x: -100 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, type: "spring" } } };
            const scaleIn = { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } } };
            const popIn = { hidden: { opacity: 0, scale: 0.5, y: 50 }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.5 } } };

            const getVariant = () => {
                if (animStyle === 'slide') return slideIn;
                if (animStyle === 'scale') return scaleIn;
                if (animStyle === 'pop') return popIn;
                return fadeInUp;
            };
            const anim = getVariant();

            const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -100]);
            const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
            const displaySkills = data.skills.slice(0, 10);

            return (
                <div ref={containerRef} className={\`w-full relative min-h-screen \${textPrimary}\`}>
                    <ThreeBackground primaryColor={primaryColor} accentColor={accentColor} backgroundColor={bg} variant={data.theme?.backgroundStyle} />
                    
                    <motion.div className="fixed top-0 left-0 right-0 h-1 z-[1000] origin-left" style={{ scaleX, background: \`linear-gradient(90deg, \${primaryColor}, \${accentColor})\` }} />

                    <nav className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-[500] hidden xl:flex flex-col gap-6">
                        {['hero', 'about', 'skills', 'experience', 'projects', 'education', 'contact'].map((id) => (
                            <a key={id} href={\`#\${id}\`} className="group flex items-center justify-end gap-4 text-decoration-none">
                                <span className={\`text-[9px] font-bold uppercase tracking-[0.3em] transition-all duration-300 \${activeTab === id ? \`opacity-100 \${navTextActive}\` : \`opacity-0 \${navText}\`}\`}>{id}</span>
                                <div className="w-1.5 h-1.5 rounded-full border border-white/20 transition-all duration-300" style={{ 
                                    backgroundColor: activeTab === id ? primaryColor : 'transparent', 
                                    borderColor: activeTab === id ? primaryColor : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'), 
                                    transform: activeTab === id ? 'scale(1.5)' : 'scale(1)',
                                    boxShadow: activeTab === id ? \`0 0 10px \${primaryColor}\` : 'none'
                                }}></div>
                            </a>
                        ))}
                    </nav>

                    <div className="max-w-6xl mx-auto px-6 md:px-8 relative">
                        <section id="hero" className="min-h-screen flex flex-col items-center justify-center pt-20 pb-20">
                            <motion.div style={{ y: heroY, opacity: heroOpacity }} className="text-center w-full z-10">
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="relative mb-12 inline-block">
                                    <div className="absolute -inset-8 blur-[80px] rounded-full opacity-30" style={{ backgroundColor: primaryColor }}></div>
                                    <div className="relative p-1 bg-gradient-to-tr from-white/10 to-transparent rounded-full overflow-hidden w-48 h-48 md:w-80 md:h-80 border border-white/10 shadow-2xl">
                                        <img src={data.photoUrl || \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${data.name}\`} className="w-full h-full object-cover rounded-full" />
                                    </div>
                                </motion.div>
                                <div className="space-y-6">
                                    <motion.div initial="hidden" animate="visible" variants={anim} className={\`inline-flex items-center gap-3 px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.4em] border \${isLight ? 'bg-slate-900/5 text-slate-500 border-slate-900/5' : 'bg-white/5 text-slate-400 border-white/5'}\`}>
                                        {data.location || 'Global'}
                                    </motion.div>
                                    <motion.h1 initial="hidden" animate="visible" variants={anim} transition={{delay:0.2}} className="text-5xl md:text-8xl lg:text-9xl font-bold tracking-tight uppercase leading-none">
                                        {data.name.split(' ')[0]} <span style={{ color: primaryColor, textShadow: \`0 0 40px rgba(\${primaryRgb}, 0.3)\` }}>{data.name.split(' ').slice(1).join(' ')}</span>
                                    </motion.h1>
                                    <motion.p initial="hidden" animate="visible" variants={anim} transition={{delay:0.4}} className={\`text-xl md:text-3xl font-medium mt-8 max-w-3xl mx-auto leading-relaxed \${textSecondary}\`}>
                                        {data.title}
                                    </motion.p>
                                    {data.quote && (
                                        <motion.div initial="hidden" animate="visible" variants={anim} transition={{delay:0.6}} className="mt-8 relative inline-block px-8">
                                            <p className={\`text-sm md:text-base font-serif italic tracking-wide max-w-lg mx-auto \${textMuted}\`}>"{data.quote}"</p>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        </section>

                        <section id="about" className="py-24 md:py-32 scroll-mt-20">
                            <SectionTitle subtitle="Overview" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>About</SectionTitle>
                            <motion.div initial="hidden" whileInView="visible" viewport={{once:true}} variants={anim} className={\`rounded-[40px] p-8 md:p-20 border relative overflow-hidden\`} style={cardStyle}>
                                <p className={\`text-xl md:text-4xl font-medium leading-snug tracking-tight \${textPrimary}\`}>{data.summary}</p>
                            </motion.div>
                        </section>

                        <section id="skills" className="py-24 md:py-32 scroll-mt-20">
                            <SectionTitle subtitle="Competencies" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>Skills</SectionTitle>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                                {displaySkills.map((skill, i) => (
                                    <motion.div key={i} initial="hidden" whileInView="visible" viewport={{once:true}} variants={anim} transition={{delay: i*0.05}} className={\`rounded-2xl border p-6 text-center transition-all hover:scale-105\`} style={cardStyle}>
                                        <span className={\`text-[10px] md:text-[11px] font-bold uppercase tracking-widest \${isLight ? 'text-slate-600' : 'text-slate-300'}\`}>{skill}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <section id="experience" className="py-24 md:py-32 scroll-mt-20">
                            <SectionTitle subtitle="Trajectory" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>Experience</SectionTitle>
                            <div className="space-y-8 md:space-y-12">
                                {data.experience.map((exp, i) => (
                                    <motion.div key={i} initial="hidden" whileInView="visible" viewport={{once:true}} variants={anim} className={\`p-8 md:p-14 rounded-[32px] border transition-all\`} style={cardStyle}>
                                        <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
                                            <div><h3 className={\`text-2xl md:text-3xl font-bold mb-2 \${textPrimary}\`}>{exp.role}</h3><p className="text-sm md:text-lg font-bold uppercase tracking-widest" style={{ color: primaryColor }}>{exp.company}</p></div>
                                            <div className={\`\${textMuted} font-bold text-xs uppercase tracking-widest pt-2 whitespace-nowrap\`}>{exp.period}</div>
                                        </div>
                                        <p className={\`\${textSecondary} text-base md:text-lg leading-relaxed whitespace-pre-line\`}>{exp.description}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <section id="projects" className="py-24 md:py-32 scroll-mt-20">
                            <SectionTitle subtitle="Impact" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>Projects</SectionTitle>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                                {data.projects.map((proj, i) => (
                                    <motion.div key={i} initial="hidden" whileInView="visible" viewport={{once:true}} variants={anim} className={\`rounded-[32px] overflow-hidden border transition-all flex flex-col h-full\`} style={cardStyle}>
                                        <div className="p-8 md:p-10 flex flex-col flex-1">
                                            <h3 className={\`text-2xl md:text-3xl font-bold mb-6 \${textPrimary}\`}>{proj.title}</h3>
                                            <p className={\`\${textSecondary} text-base md:text-lg leading-relaxed mb-8\`}>{proj.description}</p>
                                            <div className="mt-auto flex flex-wrap gap-2">{proj.tech.map((t, idx) => <span key={idx} className={\`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest \${isLight ? 'bg-slate-900/10 text-slate-600' : 'bg-white/10 text-slate-400'}\`}>{t}</span>)}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <section id="education" className="py-24 md:py-32 scroll-mt-20">
                            <SectionTitle subtitle="Academics" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>Education</SectionTitle>
                            <div className="max-w-4xl mx-auto space-y-6">
                                {data.education.map((edu, i) => (
                                    <motion.div key={i} initial="hidden" whileInView="visible" viewport={{once:true}} variants={anim} className={\`p-8 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-6\`} style={cardStyle}>
                                        <div className="text-center md:text-left"><h3 className={\`text-lg md:text-xl font-bold \${textPrimary}\`}>{edu.degree}</h3><p className={\`\${textMuted} font-semibold uppercase tracking-widest text-xs mt-1\`}>{edu.institution}</p></div>
                                        <div className={\`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest border whitespace-nowrap \${isLight ? 'bg-slate-900/5 text-slate-500 border-slate-900/5' : 'bg-white/5 text-slate-400 border-white/5'}\`}>{edu.year}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <section id="contact" className="py-32 md:py-40 flex flex-col items-center justify-center scroll-mt-20">
                            <SectionTitle subtitle="Network" color={primaryColor} isLight={isLight} textPrimary={textPrimary} textMuted={textMuted}>Contact</SectionTitle>
                            <div className="text-center space-y-16 w-full">
                                <a href={\`mailto:\${data.email}\`} className={\`text-3xl md:text-6xl font-bold hover:text-indigo-400 transition-colors lowercase tracking-tight block break-all \${textPrimary}\`} style={{ textShadow: \`0 0 20px rgba(\${primaryRgb}, 0.2)\` }}>{data.email}</a>
                                <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                                    {data.socialLinks?.linkedin && <a href={data.socialLinks.linkedin} target="_blank" className="flex flex-col items-center gap-2 group opacity-60 hover:opacity-100 transition-opacity"><div style={{ borderColor: \`rgba(\${primaryRgb}, 0.2)\` }} className="w-12 h-12 rounded-full border flex items-center justify-center"><i className="fab fa-linkedin-in text-xl"></i></div><span className="text-[9px] uppercase tracking-widest">LinkedIn</span></a>}
                                    {data.socialLinks?.github && <a href={data.socialLinks.github} target="_blank" className="flex flex-col items-center gap-2 group opacity-60 hover:opacity-100 transition-opacity"><div style={{ borderColor: \`rgba(\${primaryRgb}, 0.2)\` }} className="w-12 h-12 rounded-full border flex items-center justify-center"><i className="fab fa-github text-xl"></i></div><span className="text-[9px] uppercase tracking-widest">GitHub</span></a>}
                                    {data.socialLinks?.twitter && <a href={data.socialLinks.twitter} target="_blank" className="flex flex-col items-center gap-2 group opacity-60 hover:opacity-100 transition-opacity"><div style={{ borderColor: \`rgba(\${primaryRgb}, 0.2)\` }} className="w-12 h-12 rounded-full border flex items-center justify-center"><i className="fab fa-twitter text-xl"></i></div><span className="text-[9px] uppercase tracking-widest">X / Twitter</span></a>}
                                </div>
                            </div>
                        </section>
                        
                         <footer className={\`py-20 border-t text-center opacity-40 \${isLight ? 'border-slate-900/5' : 'border-white/5'}\`}>
                            <span className="font-bold tracking-tight uppercase text-sm">PortoCV Studio // 2025</span>
                        </footer>
                    </div>
                </div>
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<PortfolioApp />);
    </script>
</body>
</html>`;

  // 4. Push Files to GitHub
  const pushFile = async (path: string, contentStr: string) => {
    let sha;
    try {
      const check = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${path}`, { headers });
      if (check.ok) {
        const json = await check.json();
        sha = json.sha;
      }
    } catch (e) {}

    const res = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            message: `Deploy ${path}`,
            content: btoa(unescape(encodeURIComponent(contentStr))),
            sha
        })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Failed to push ${path}: ${err.message}`);
    }
  };

  await pushFile('index.html', htmlContent);
  await pushFile('README.md', `# ${data.name} - Portfolio\n\nGenerated by AI Agent (PortoCV).`);
  await pushFile('portfolio.json', JSON.stringify(data, null, 2));

  // 5. Enable GitHub Pages
  // Use the default branch we found earlier to ensure we don't 404
  const pagesResp = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
    method: 'POST',
    headers: { ...headers, 'Accept': 'application/vnd.github.switcheroo-preview+json' },
    body: JSON.stringify({ source: { branch: defaultBranch, path: '/' } })
  });

  return `https://${username}.github.io/${repoName}`;
};
