
import React from 'react';
import { AppMode } from '../types';

interface Props {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  currentUser: string;
}

export const GlobalNav: React.FC<Props> = ({ currentMode, setMode, currentUser }) => {
  const navItems = [
    { id: AppMode.HOME, label: 'Hub', icon: 'fa-home' },
    { id: AppMode.UK_RESUME, label: 'Resume', icon: 'fa-file-contract' },
    { id: AppMode.PORTFOLIO, label: '3D Site', icon: 'fa-cube' },
    { id: AppMode.JOB_HUNTER, label: 'Jobs', icon: 'fa-search-location' },
    { id: AppMode.RESUME_MOULDER, label: 'Moulder', icon: 'fa-magic' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-20 glass z-[1000] px-6 md:px-10 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-slate-950/80">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setMode(AppMode.HOME)}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform">
            <i className="fas fa-layer-group text-white text-sm"></i>
          </div>
          <div className="hidden md:block">
            <h1 className="text-xl font-black uppercase leading-none italic tracking-tight text-white">PortoCV</h1>
            <p className="text-[9px] text-indigo-400 font-bold tracking-[0.4em] uppercase mt-0.5">Studio v2.5</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${currentMode === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                    <i className={`fas ${item.icon} text-sm`}></i>
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block">{item.label}</span>
                </button>
            ))}
        </div>

        <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Logged In</span>
                <span className="text-xs font-bold text-white truncate max-w-[150px]">{currentUser}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border border-white/20"></div>
        </div>
    </nav>
  );
};
