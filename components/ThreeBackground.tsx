
import React, { useEffect, useRef } from 'react';

interface ThreeBackgroundProps {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  variant?: 'particles' | 'grid' | 'bokeh';
}

export const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ 
  primaryColor = '#6366f1', 
  accentColor = '#06b6d4',
  backgroundColor = '#020617',
  variant = 'particles'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
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
    if (!ctx) return;

    let animationFrameId: number;
    const rgbPrimary = hexToRgb(primaryColor);
    const rgbAccent = hexToRgb(accentColor);
    
    let items: any[] = [];
    let time = 0;

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      items = [];

      if (variant === 'particles') {
        const count = Math.min(150, Math.floor((canvas.width * canvas.height) / 9000));
        items = Array.from({ length: count }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * 1000,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.1,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2
        }));
      } else if (variant === 'bokeh') {
        const count = 20;
        items = Array.from({ length: count }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 100 + 50,
          color: Math.random() > 0.5 ? rgbPrimary : rgbAccent,
          opacity: Math.random() * 0.15 + 0.05,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5
        }));
      }
      // Grid handles its own geometry in draw
    };

    const drawParticles = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      items.forEach(p => {
        p.z -= 1.0; 
        p.x += p.speedX * (1000 / (p.z || 1));
        p.y += p.speedY * (1000 / (p.z || 1));
        if (p.z <= 0) {
           p.z = 1000;
           p.x = Math.random() * canvas.width;
           p.y = Math.random() * canvas.height;
        }
        const scale = 500 / (500 + p.z);
        const x = (p.x - cx) * scale + cx;
        const y = (p.y - cy) * scale + cy;
        const size = p.size * scale;
        if (x > 0 && x < canvas.width && y > 0 && y < canvas.height) {
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}, ${p.opacity * (1 - p.z / 1000)})`;
            ctx.fill();
        }
      });
    };

    const drawGrid = () => {
       ctx.fillStyle = backgroundColor;
       ctx.fillRect(0, 0, canvas.width, canvas.height);
       
       const horizon = canvas.height * 0.4;
       const gridSpacing = 40;
       
       ctx.strokeStyle = `rgba(${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}, 0.2)`;
       ctx.lineWidth = 1;

       // Vertical perspective lines
       const centerX = canvas.width / 2;
       for (let i = -20; i <= 20; i++) {
         ctx.beginPath();
         ctx.moveTo(centerX + i * gridSpacing * 0.2, horizon);
         ctx.lineTo(centerX + i * gridSpacing * 5, canvas.height);
         ctx.stroke();
       }

       // Horizontal moving lines
       const offset = (time * 20) % gridSpacing;
       for (let y = horizon; y < canvas.height; y += gridSpacing * (1 + (y-horizon)/200)) {
          const perspectiveY = y + offset * ((y-horizon)/200);
          if(perspectiveY > canvas.height) continue;
          
          ctx.beginPath();
          ctx.moveTo(0, perspectiveY);
          ctx.lineTo(canvas.width, perspectiveY);
          ctx.strokeStyle = `rgba(${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}, ${0.1 + (perspectiveY-horizon)/canvas.height * 0.3})`;
          ctx.stroke();
       }
       
       // Top gradient
       const grad = ctx.createLinearGradient(0, 0, 0, horizon);
       grad.addColorStop(0, backgroundColor);
       grad.addColorStop(1, `rgba(${rgbAccent.r}, ${rgbAccent.g}, ${rgbAccent.b}, 0.1)`);
       ctx.fillStyle = grad;
       ctx.fillRect(0, 0, canvas.width, horizon);
    };

    const drawBokeh = () => {
       ctx.fillStyle = backgroundColor;
       ctx.fillRect(0, 0, canvas.width, canvas.height);
       
       // Composite for glow
       ctx.globalCompositeOperation = 'lighter';
       
       items.forEach(b => {
         b.x += b.vx;
         b.y += b.vy;
         
         if (b.x < -b.radius) b.x = canvas.width + b.radius;
         if (b.x > canvas.width + b.radius) b.x = -b.radius;
         if (b.y < -b.radius) b.y = canvas.height + b.radius;
         if (b.y > canvas.height + b.radius) b.y = -b.radius;

         const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
         g.addColorStop(0, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, ${b.opacity})`);
         g.addColorStop(1, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, 0)`);
         
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
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', init);
    };
  }, [primaryColor, accentColor, backgroundColor, variant]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none transition-colors duration-1000"
      style={{ background: backgroundColor }}
    />
  );
};
