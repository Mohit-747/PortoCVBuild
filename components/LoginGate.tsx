
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onLogin: (email: string) => void;
}

const ADMIN_PHONE = "+447899255443";
const ADMIN_EMAIL = "mohit.bvcoe747@gmail.com";

export const LoginGate: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Challenge State
  const [challengeToken, setChallengeToken] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState(300); // 5 Minutes in seconds
  const [isExpired, setIsExpired] = useState(false);

  // Generate token on mount
  useEffect(() => {
    generateNewToken();
  }, []);

  // Countdown Timer
  useEffect(() => {
    if (tokenExpiry > 0 && !isExpired) {
      const timer = setInterval(() => setTokenExpiry(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (tokenExpiry === 0) {
      setIsExpired(true);
    }
  }, [tokenExpiry, isExpired]);

  const generateNewToken = () => {
    // Generate random 4 digits (easier to read/calculate than 6)
    const token = Math.floor(1000 + Math.random() * 9000).toString();
    setChallengeToken(token);
    setOtpInput('');
    setError('');
    setTokenExpiry(300); // Reset to 5 mins
    setIsExpired(false);
  };

  const deriveExpectedOTP = (token: string) => {
    // CIPHER LOGIC: SHIFT + 1
    // 0 -> 1, 1 -> 2, ... 9 -> 0
    // Example: 1357 -> 2468
    return token.split('').map(char => (parseInt(char) + 1) % 10).join('');
  };

  const handleRequestSMS = () => {
     if (!email.includes('@')) {
         setError("Please enter your email address first.");
         return;
     }
     const body = `PortoCV Access Request.\nUser: ${email}\nSecurity Token: ${challengeToken}`;
     window.open(`sms:${ADMIN_PHONE}?&body=${encodeURIComponent(body)}`, '_self');
  };

  const handleRequestEmail = () => {
    if (!email.includes('@')) {
        setError("Please enter your email address first.");
        return;
    }
    const subject = `PortoCV Token: ${challengeToken}`;
    const body = `Hi Admin,\n\nI need an Access Code (OTP).\nUser: ${email}\nToken: ${challengeToken}\n\nPlease reply with the Shift+1 response.`;
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isExpired) {
        setError("Token expired. Please generate a new one.");
        setLoading(false);
        return;
    }

    setTimeout(() => {
      // 1. Email Validation
      if (!email.includes('@') || email.length < 5) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      const input = otpInput.trim();
      const expectedOTP = deriveExpectedOTP(challengeToken);

      // 2. Cipher Check
      if (input !== expectedOTP) {
        setError("Invalid Code. Access Denied.");
        setLoading(false);
        return;
      }
      
      // Success
      onLogin(email);
      setLoading(false);
    }, 800);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020617]">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[150px] rounded-full animate-pulse"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-md p-6"
      >
        <div className="glass p-10 rounded-[40px] border-t border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
           
           {/* Header */}
           <div className="mb-8 relative">
             <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.6)] mb-4">
                <i className="fas fa-fingerprint text-3xl text-white"></i>
             </div>
             <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Secure Gateway</h1>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
               PortoCV Studio v2.5
             </p>
           </div>

           {/* Form */}
           <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Email Input */}
              <div className="text-left space-y-2">
                 <label className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 ml-4">Identity</label>
                 <div className="relative">
                    <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:bg-slate-900 outline-none transition-all font-medium text-sm"
                    />
                 </div>
              </div>

              {/* Challenge Display */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 bg-white/5 blur-xl rounded-full"></div>
                 
                 {!isExpired ? (
                    <>
                         <div className="flex justify-between items-center relative z-10">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Security Token</span>
                            <span className="text-white font-mono font-bold text-xl tracking-[0.2em] select-all shadow-black drop-shadow-md">{challengeToken}</span>
                         </div>
                         
                         <div className="h-px w-full bg-white/5"></div>

                         <div className="flex justify-between items-center">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Send to Admin</span>
                            <span className={`text-[10px] font-mono font-bold ${tokenExpiry < 60 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                               Expires in {formatTime(tokenExpiry)}
                            </span>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2 relative z-10">
                            <button type="button" onClick={handleRequestSMS} className="py-2.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2">
                               <i className="fas fa-comment-sms"></i> SMS Code
                            </button>
                            <button type="button" onClick={handleRequestEmail} className="py-2.5 bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2">
                               <i className="fas fa-envelope"></i> Email Code
                            </button>
                         </div>
                    </>
                 ) : (
                    <div className="text-center py-4">
                        <i className="fas fa-clock text-red-400 text-2xl mb-2"></i>
                        <p className="text-xs text-red-400 font-bold uppercase">Token Expired</p>
                    </div>
                 )}
              </div>

              {/* OTP Input */}
              <div className="text-left space-y-2">
                 <label className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 ml-4">Enter Response OTP</label>
                 <div className="relative">
                    <i className="fas fa-key absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input 
                      type="password" 
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="______"
                      maxLength={4}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:border-indigo-500 focus:bg-slate-900 outline-none transition-all font-bold tracking-[0.5em] text-sm text-center"
                    />
                 </div>
              </div>

              <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                        {error}
                        </div>
                    </motion.div>
                )}
              </AnimatePresence>

              <button 
                 type="submit" 
                 disabled={loading || isExpired}
                 className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 relative overflow-hidden disabled:cursor-not-allowed"
              >
                 {loading ? (
                    <span className="flex items-center justify-center gap-2">
                       <i className="fas fa-circle-notch fa-spin"></i> Validating...
                    </span>
                 ) : (
                    <span>Authenticate</span>
                 )}
              </button>
           </form>
           
           <div className="mt-6 pt-6 border-t border-white/5 text-center">
             <button onClick={generateNewToken} className="text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:text-white transition-colors group">
               <i className="fas fa-sync-alt mr-1 group-hover:rotate-180 transition-transform"></i> Refresh Token
             </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
};
