
import { GoogleGenAI, Type } from "@google/genai";
import { PortfolioData, QAFeedback, UserPreferences, UKResumeData, AcademicTranslation, ViralPost } from "../types";

// --- RATE LIMITER (THROTTLE) ---
// Google Gemini Free Tier allows ~15 Requests Per Minute (1 req every 4 seconds).
// We add a client-side delay to prevent accidental bursts from crashing the app.
const MIN_REQUEST_INTERVAL_MS = 3500; // 3.5 seconds
let lastRequestTime = 0;

const enforceRateLimit = async () => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
        const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
        console.log(`[GeminiService] Throttling request for ${waitTime}ms to respect API quota...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
};

// --- API KEY MANAGEMENT & ROTATION LOGIC ---

class KeyManager {
    private keys: string[] = [];
    private currentIndex: number = 0;
    private manualKey: string = '';

    constructor() {
        this.loadKeys();
    }

    private loadKeys() {
        const env = (import.meta as any).env || process.env || {};
        const candidates: string[] = [];

        // Helper to add keys (handling commas for multiple keys in one var)
        const add = (val: any) => {
            if (typeof val === 'string' && val.length > 10 && !val.startsWith("AIzaSy...Paste")) {
                if (val.includes(',')) {
                    val.split(',').forEach((k: string) => candidates.push(this.sanitize(k)));
                } else {
                    candidates.push(this.sanitize(val));
                }
            }
        };

        // 1. Load Manual Key if set
        if (this.manualKey) candidates.push(this.manualKey);

        // 2. Load standard env vars
        add(process.env.API_KEY);
        add(env.VITE_API_KEY);
        add(env.VITE_API_KEYS);
        add(env.API_KEYS);

        // 3. Load Indexed Keys (VITE_API_KEY_1 to 20)
        for (let i = 1; i <= 20; i++) {
            add(env[`VITE_API_KEY_${i}`]);
            add(process.env[`API_KEY_${i}`]);
        }

        // Deduplicate and filter empty
        this.keys = [...new Set(candidates)].filter(k => k && k.length > 20);
        console.log(`[GeminiService] Loaded ${this.keys.length} Unique API Keys.`);
    }

    private sanitize(key: string | undefined): string {
        if (!key) return '';
        return key.trim().replace(/^["']|["']$/g, '');
    }

    public setManualKey(key: string) {
        this.manualKey = this.sanitize(key);
        // Reload to prioritize manual key
        this.keys = [];
        this.loadKeys();
        this.currentIndex = 0;
    }

    public getCurrentKey(): string {
        if (this.keys.length === 0) {
             throw new Error("API_KEY_MISSING: No valid API Keys found. Please add VITE_API_KEY in Vercel settings or enter manually.");
        }
        return this.keys[this.currentIndex];
    }

    public rotateKey() {
        if (this.keys.length > 1) {
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            console.warn(`[GeminiService] Rotating to Key Index: ${this.currentIndex}`);
        }
    }

    public getActiveKeyCount(): number {
        return this.keys.length;
    }
}

const keyManager = new KeyManager();

export const setManualApiKey = (key: string) => {
    keyManager.setManualKey(key);
};

// Safety Settings - Cast to any to avoid TS2322 Enum mismatches during build
const SAFETY_SETTINGS: any[] = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// Generic wrapper for all AI calls to handle failover
async function callWithRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  // Enforce Rate Limit before making a call
  await enforceRateLimit();

  try {
    const apiKey = keyManager.getCurrentKey();
    const ai = new GoogleGenAI({ apiKey });
    return await fn(ai);
  } catch (error: any) {
    const isQuotaError = error.status === 429 || 
                         (error.message && error.message.includes('429')) ||
                         (error.message && error.message.toLowerCase().includes('quota')) ||
                         (error.message && error.message.includes('RESOURCE_EXHAUSTED'));
    
    const isAuthError = error.status === 400 || (error.message && error.message.includes('API key not valid'));

    // Handle Quota/Auth Errors
    if (isQuotaError || isAuthError) {
        if (keyManager.getActiveKeyCount() > 1) {
            console.warn("API Key Exhausted or Invalid. Rotating...");
            keyManager.rotateKey();
            // Retry immediately with next key
            if (retries > 0) return callWithRetry(fn, retries - 1, 500);
        } else {
             // SINGLE KEY FALLBACK STRATEGY
             // If we only have 1 key, it might just be a momentary RPM limit. Wait 5s and try again.
             if (isQuotaError && retries > 0) {
                 console.warn(`[GeminiService] 429 Quota Hit (Single Key). Waiting 5s before retry... (${retries} left)`);
                 await new Promise(r => setTimeout(r, 5000));
                 return callWithRetry(fn, retries - 1, 5000);
             }
             
             // If retries exhausted, throw specific error to trigger UI Modal
             throw new Error("API_KEY_EXHAUSTED: Your API Key quota is full (429). Please enter a new key.");
        }
    }

    // Standard exponential backoff for server errors (500, 503)
    if (retries > 0 && (error.status === 500 || error.message?.includes('500') || error.message?.includes('fetch failed'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

// --- PORTFOLIO AGENTS ---

export const generatePortfolioData = async (
  resumeInput: string | { data: string; mimeType: string },
  prefs: UserPreferences
): Promise<PortfolioData> => {
  return callWithRetry(async (ai) => {
    let styleGuidance = "";
    if (prefs.themeStyle !== 'auto') styleGuidance += `VISUAL STYLE: Strictly use a '${prefs.themeStyle}' aesthetic (colors, fonts). `;
    if (prefs.backgroundType !== 'auto') styleGuidance += `BACKGROUND: Strictly use '${prefs.backgroundType}' mode. `;
    if (prefs.animationType !== 'auto') styleGuidance += `ANIMATION: Strictly use '${prefs.animationType}' animations. `;
    
    if (prefs.colorMode === 'light') {
       styleGuidance += `COLOR SCHEME: LIGHT MODE. `;
    } else if (prefs.colorMode === 'dark') {
       styleGuidance += `COLOR SCHEME: DARK MODE. `;
    }

    if (prefs.primaryHue !== 'auto') {
       styleGuidance += `PRIMARY COLOR: Dominant color must be shades of ${prefs.primaryHue.toUpperCase()}. `;
    }
    
    if (styleGuidance === "") {
      styleGuidance = "CREATIVE FREEDOM: Create a COMPLETELY UNIQUE visual identity. Randomize colors, moods, and layouts. Do not default to blue/dark. USE BRIGHT, VIBRANT, NEON, OR PASTEL SCHEMES. Ensure high contrast. Mix primary and accent colors boldly.";
    }

    let parts: any[] = [
      { text: `Act as an Award-Winning Digital Art Director. Transform raw resume data into a high-end web portfolio.

MANDATORY DIRECTIVES:
1. ${styleGuidance}
2. COLOR PALETTE: If 'auto', generate a unique, harmonic palette using BRIGHT and DISTINCT colors (e.g., Cyberpunk Pink, Electric Blue, Emerald Green, Sunset Orange). Avoid generic corporate blues.
3. SKILLS: Extract exactly top 10 skills.
4. SOCIALS: Extract ALL available social links.
5. QUOTE: A powerful, short professional manifesto.
6. UNIQUE_SEED: ${Date.now()}-${Math.random()} (Ensure output is unique based on this timestamp).

OUTPUT: Strict JSON only.` }
    ];

    if (typeof resumeInput === 'string') {
      parts.push({ text: `Resume Data Content: ${resumeInput.slice(0, 15000)}` });
    } else {
      parts.push({
        inlineData: {
          data: resumeInput.data,
          mimeType: resumeInput.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        temperature: 1.0, 
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            email: { type: Type.STRING },
            location: { type: Type.STRING },
            quote: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            theme: {
              type: Type.OBJECT,
              properties: {
                primaryColor: { type: Type.STRING, description: "Hex color" },
                accentColor: { type: Type.STRING, description: "Hex color" },
                backgroundColor: { type: Type.STRING, description: "Hex color (Dark or Light based on mode)" },
                fontStyle: { type: Type.STRING, enum: ['modern', 'cyber', 'minimal', 'brutal'] },
                backgroundStyle: { type: Type.STRING, enum: ['particles', 'grid', 'bokeh'] },
                animationStyle: { type: Type.STRING, enum: ['fade', 'slide', 'scale', 'pop'] },
                mode: { type: Type.STRING, enum: ['dark', 'light'] }
              },
              required: ["primaryColor", "accentColor", "backgroundColor", "fontStyle", "backgroundStyle", "animationStyle", "mode"]
            },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  period: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["role", "company", "period", "description"]
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tech: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["title", "description", "tech"]
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ["degree", "institution", "year"]
              }
            },
            socialLinks: {
              type: Type.OBJECT,
              properties: {
                github: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                twitter: { type: Type.STRING },
                whatsapp: { type: Type.STRING },
                instagram: { type: Type.STRING },
                facebook: { type: Type.STRING },
                behance: { type: Type.STRING },
                dribbble: { type: Type.STRING }
              }
            }
          },
          required: ["name", "title", "summary", "skills", "experience", "projects", "education", "theme", "quote"]
        }
      }
    });

    if (!response.text) throw new Error("Agent 1 failed to construct blueprint (Empty Response).");
    return JSON.parse(response.text) as PortfolioData;
  });
};

export const modifyPortfolio = async (
  currentData: PortfolioData, 
  userPrompt: string
): Promise<PortfolioData> => {
  return callWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are an editing agent. Update the following Portfolio JSON based on the User Request. 
      Keep the structure identical. Only modify the fields requested.
      
      Current Data: ${JSON.stringify(currentData)}
      
      User Request: ${userPrompt}
      `,
      config: {
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
      }
    });

    if (!response.text) throw new Error("Modification failed.");
    const newData = JSON.parse(response.text);
    return { ...currentData, ...newData, theme: { ...currentData.theme, ...newData.theme } };
  });
};

export const getAgentFeedback = async (data: PortfolioData): Promise<QAFeedback> => {
  return callWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Critique this portfolio build. Data: ${JSON.stringify(data).slice(0, 4000)}`,
      config: {
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            uxInsights: { type: Type.STRING }
          },
          required: ["score", "suggestions", "uxInsights"]
        }
      }
    });
    return JSON.parse(response.text || "{}") as QAFeedback;
  });
};

// --- UK RESUME AGENT (AGENT 1) ---

export const generateUKResume = async (
  resumeInput: string | { data: string; mimeType: string },
  portfolioUrl?: string,
  pages: number = 1
): Promise<UKResumeData> => {
  return callWithRetry(async (ai) => {
    let parts: any[] = [
      { text: `You are a Senior UK Recruitment Consultant & Expert Ghostwriter. Convert the input resume into a HIGHLY DENSE, CONTENT-RICH UK-STYLE CV.

      OBJECTIVE: Create a resume that physically fills ${pages} A4 Page(s) with high-value content. Minimize vertical whitespace usage in text.

      CRITICAL RULES FOR CONTENT DENSITY:
      1. **EXPAND WITH PRECISION.** If the input says "Worked on API", you must extrapolate: "Architected and deployed high-performance RESTful APIs using Node.js, increasing data throughput by 40% and reducing latency."
      2. **PROFESSIONAL PROFILE (The Narrative):** A captivating 4-5 line narrative pitch. Focus on career trajectory, leadership, and soft skills. Keep it dense.
      3. **EXPERIENCE BULLETS:**
         - **STRICT LIMIT: 4-6 bullet points per role.** Do not exceed 6.
         - Use the **STAR Method** (Situation, Task, Action, Result) for EVERY bullet.
         - Ensure bullets are dense and full-width but not multi-paragraph.
      4. **CORE COMPETENCIES:** List 12-16 hard and soft skills.
      5. **INTERESTS:** Concise but descriptive sentences (1-2 lines max).

      FORMATTING:
      - British English (e.g., 'Analysed', 'Organised').
      - HEADER: Name, Location, Phone, Email, LinkedIn${portfolioUrl ? `, Portfolio: ${portfolioUrl}` : ''}.

      OUTPUT: JSON format.` }
    ];

    if (typeof resumeInput === 'string') {
      parts.push({ text: `Resume Data: ${resumeInput.slice(0, 30000)}` });
    } else {
      parts.push({ inlineData: { data: resumeInput.data, mimeType: resumeInput.mimeType } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        temperature: 0.6, // Reduced slightly to adhere more strictly to length constraints
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            contactInfo: { type: Type.STRING },
            professionalProfile: { type: Type.STRING, description: "4-5 lines max, dense narrative." },
            coreCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  responsibilities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Max 6 detailed STAR method bullets per role." }
                },
                required: ["role", "company", "dates", "responsibilities"]
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  details: { type: Type.STRING, description: "Relevant modules, dissertation title, or key achievements." }
                },
                required: ["degree", "institution", "dates"]
              }
            },
            interests: { type: Type.STRING, description: "Concise sentences." },
            references: { type: Type.STRING }
          },
          required: ["fullName", "contactInfo", "professionalProfile", "coreCompetencies", "experience", "education", "references"]
        }
      }
    });

    if (!response.text) throw new Error("UK Resume Agent failed.");
    return JSON.parse(response.text) as UKResumeData;
  });
};

// --- RESUME MOULDER (AGENT 4) ---

export const tailorResumeToJob = async (
  currentResume: UKResumeData,
  jobDescription: string,
  jobTitle: string
): Promise<{ success: boolean; data: UKResumeData | null; matchScore: number; analysis: string }> => {
  return callWithRetry(async (ai) => {
    const prompt = `
      ACT AS AGENT 4: THE RESUME MOULDER.
      
      TASK: Compare the Candidate Resume against the Job Description.
      
      CANDIDATE: ${JSON.stringify(currentResume).slice(0, 10000)}
      JOB: ${jobTitle} - ${jobDescription.slice(0, 5000)}

      LOGIC:
      1. Calculate a "Match Score" (0-100) based on skills and experience alignment.
      2. IF Score >= 60: 
         - REWRITE the 'professionalProfile' to target this job keywords.
         - REORDER or EMPHASIZE specific 'coreCompetencies'.
         - REPHRASE top 3 'experience' bullet points to highlight relevance.
         - Return the MODIFIED resume JSON.
      3. IF Score < 60:
         - Return the ORIGINAL resume JSON.
         - Provide a reason why it wasn't moulded (gap in skills).

      OUTPUT JSON:
      {
        "matchScore": number,
        "analysis": "Short analysis of fit",
        "mouldedResume": { ...Standard UKResumeData structure... }
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
      }
    });

    if (!response.text) throw new Error("Agent 4 failed.");
    
    const result = JSON.parse(response.text);
    
    return {
      success: result.matchScore >= 60,
      matchScore: result.matchScore,
      analysis: result.analysis,
      data: result.mouldedResume
    };
  });
};

// --- ACADEMIC TRANSLATOR (AGENT 5) ---

export const transformAcademicToBlog = async (
  paperInput: string | { data: string; mimeType: string }
): Promise<AcademicTranslation> => {
    return callWithRetry(async (ai) => {
        const parts: any[] = [
            { text: `ACT AS AGENT 5: THE ACADEMIC TRANSLATOR.
            
            YOUR GOAL: Take a dense Academic Dissertation, Essay, or Research Paper and transform it into a HIGH-IMPACT LinkedIn Post and a Technical Blog Article (Case Study).
            
            AUDIENCE: Recruiters, Tech Leads, and Industry Professionals. They do not want academic jargon. They want results, methodologies, and commercial viability.
            
            INSTRUCTIONS:
            1. Extract the Core Thesis.
            2. Simplify the Language: Remove "academic fluff". Use active voice.
            3. Structure:
               - Catchy Title (Clickbait but professional)
               - Hook (2 sentences)
               - Simplified Content (The "Case Study" body - max 300 words)
               - Key Takeaways (Bullet points)
               - Viral LinkedIn Post (Ready to copy-paste with hashtags)

            OUTPUT JSON:
            {
               "title": "...",
               "hook": "...",
               "simplifiedContent": "...",
               "keyTakeaways": ["...", "..."],
               "linkedInPost": "..."
            }
            `}
        ];

        if (typeof paperInput === 'string') {
            parts.push({ text: `ACADEMIC TEXT: ${paperInput.slice(0, 25000)}` });
        } else {
            parts.push({ inlineData: { data: paperInput.data, mimeType: paperInput.mimeType } });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                safetySettings: SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        hook: { type: Type.STRING },
                        simplifiedContent: { type: Type.STRING },
                        keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                        linkedInPost: { type: Type.STRING }
                    },
                    required: ["title", "hook", "simplifiedContent", "keyTakeaways", "linkedInPost"]
                }
            }
        });

        if(!response.text) throw new Error("Agent 5 failed to translate academic text.");
        return JSON.parse(response.text) as AcademicTranslation;
    });
};

// --- AGENT 6: VIRAL LINKEDIN GHOSTWRITER ---

export const generateViralPosts = async (
    sourceInput: string | { data: string; mimeType: string } | null,
    topics: string,
    contextDate: string,
    preferences: { length: string, style: string }
): Promise<ViralPost[]> => {
    return callWithRetry(async (ai) => {
        let parts: any[] = [
            { text: `ACT AS AGENT 6: THE VIRAL LINKEDIN GHOSTWRITER.
            
            GOAL: Create 4 HIGH-ENGAGEMENT, LinkedIn Posts.
            CONTEXT DATE: ${contextDate}
            TOPICS: ${topics || 'General Tech Trends'}
            
            USER PREFERENCES:
            - Length: ${preferences.length}
            - Style/Tone: ${preferences.style}
            
            INSTRUCTIONS:
            1. CONTENT DEPTH: Create posts matching the requested length ('Short' ~100-150 words, 'Medium' ~200-300 words, 'Long' ~500+ words).
            2. TONE: Adhere strictly to the '${preferences.style}' tone (e.g. if 'Controversial', use bold pattern interrupts. If 'Storytelling', use the Hero's Journey).
            3. FORMATTING: Use generous spacing (double line breaks) for readability. Use bullet points where appropriate.
            4. STRUCTURE:
               - THE HOOK: A scroll-stopping first line.
               - THE BODY: The main value proposition.
               - THE CALL TO ACTION: A question to drive comments.
            
            OUTPUT: JSON Array of 4 objects.
            `}
        ];

        if (sourceInput) {
            if (typeof sourceInput === 'string') {
                parts.push({ text: `SOURCE TEXT: ${sourceInput.slice(0, 20000)}` });
            } else {
                parts.push({ inlineData: { data: sourceInput.data, mimeType: sourceInput.mimeType } });
            }
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                safetySettings: SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            style: { type: Type.STRING },
                            hook: { type: Type.STRING },
                            body: { type: Type.STRING },
                            hashtags: { type: Type.STRING },
                            estimatedViralityScore: { type: Type.NUMBER }
                        },
                        required: ["style", "hook", "body", "hashtags", "estimatedViralityScore"]
                    }
                }
            }
        });

        if (!response.text) throw new Error("Agent 6 failed to generate posts.");
        return JSON.parse(response.text) as ViralPost[];
    });
};
