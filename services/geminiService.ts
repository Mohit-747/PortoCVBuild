
import { GoogleGenAI, Type } from "@google/genai";
import { PortfolioData, QAFeedback, UserPreferences, UKResumeData, AcademicTranslation, ViralPost } from "../types";

// --- API KEY MANAGEMENT & ROTATION LOGIC ---

class KeyManager {
    private keys: string[] = [];
    private currentIndex: number = 0;
    private manualKey: string = '';

    constructor() {
        this.loadKeys();
    }

    private loadKeys() {
        // 1. Load Manual Key if set
        if (this.manualKey) {
            this.keys.push(this.manualKey);
        }

        // 2. Load standard process.env.API_KEY
        if (process.env.API_KEY && !process.env.API_KEY.startsWith("AIzaSy...Paste")) {
            this.keys.push(this.sanitize(process.env.API_KEY));
        }

        // 3. Load VITE_ specific keys (Standard for Vercel/Vite)
        // Checks VITE_API_KEY, and VITE_API_KEY_1 through VITE_API_KEY_10
        // We accept both import.meta.env (Vite) and process.env (Polyfilled)
        const env = (import.meta as any).env || process.env || {};
        
        if (env.VITE_API_KEY) this.keys.push(this.sanitize(env.VITE_API_KEY));
        
        // Check for comma separated list
        if (env.VITE_API_KEYS) {
            const list = (env.VITE_API_KEYS as string).split(',');
            list.forEach(k => this.keys.push(this.sanitize(k)));
        }

        // Check for indexed keys (VITE_API_KEY_1, VITE_API_KEY_2...)
        for (let i = 1; i <= 10; i++) {
            const k = env[`VITE_API_KEY_${i}`];
            if (k) this.keys.push(this.sanitize(k as string));
        }

        // Deduplicate
        this.keys = [...new Set(this.keys)].filter(k => k && k.length > 10);
        console.log(`[GeminiService] Loaded ${this.keys.length} API Keys.`);
    }

    private sanitize(key: string | undefined): string {
        if (!key) return '';
        return key.trim().replace(/^["']|["']$/g, '');
    }

    public setManualKey(key: string) {
        this.manualKey = this.sanitize(key);
        // Add to front of queue
        this.keys.unshift(this.manualKey);
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

    // If Quota or Auth error, Rotate key and retry immediately
    if (isQuotaError || isAuthError) {
        if (keyManager.getActiveKeyCount() > 1) {
            console.warn("API Key Exhausted or Invalid. Rotating...");
            keyManager.rotateKey();
            // Retry with new key (decrement retries to avoid infinite loops if all keys are bad)
            if (retries > 0) {
                return callWithRetry(fn, retries - 1, 500); 
            }
        } else {
             throw new Error("429 Resource Exhausted: Your API Key quota is full and no backup keys are available.");
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
      { text: `You are a Senior UK Recruitment Consultant & Expert Ghostwriter. Convert the input resume into a HIGHLY OPTIMIZED UK-STYLE CV.

      CRITICAL: HUMANIZATION & AI DETECTION AVOIDANCE
      - Do not use typical AI buzzwords like "spearheaded", "fostering", "unwavering", "delved", or "tapestry".
      - Use **Burstiness**: Vary sentence structure and length. Mix short, punchy statements with detailed technical explanations.
      - Write in a natural, professional British tone (e.g., "Led the project" instead of "Orchestrated the implementation").
      - Use concrete metrics over flowery adjectives.

      STRICT RULES:
      1. LENGTH: Fit strictly into ${pages} Page(s).
      2. FORMAT: British English (e.g., 'Analysed', 'Organised').
      3. HEADER: Name, Location, Phone, Email, LinkedIn${portfolioUrl ? `, Portfolio: ${portfolioUrl}` : ''}.
      4. SECTIONS:
         - Professional Profile: 3-4 lines, human tone.
         - Core Competencies: 9-12 hard skills.
         - Experience: Reverse chronological. Bullet points must be action-oriented results.
         - Education.
         - Interests (Brief).

      OUTPUT: JSON format.` }
    ];

    if (typeof resumeInput === 'string') {
      parts.push({ text: `Resume Data: ${resumeInput.slice(0, 20000)}` });
    } else {
      parts.push({ inlineData: { data: resumeInput.data, mimeType: resumeInput.mimeType } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        temperature: 0.65,
        responseMimeType: "application/json",
        safetySettings: SAFETY_SETTINGS,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            contactInfo: { type: Type.STRING },
            professionalProfile: { type: Type.STRING },
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
                  responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } }
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
                  details: { type: Type.STRING }
                },
                required: ["degree", "institution", "dates"]
              }
            },
            interests: { type: Type.STRING },
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
    contextDate: string
): Promise<ViralPost[]> => {
    return callWithRetry(async (ai) => {
        let parts: any[] = [
            { text: `ACT AS AGENT 6: THE VIRAL LINKEDIN GHOSTWRITER.
            
            GOAL: Create 4 HIGH-ENGAGEMENT, LONG-FORM LinkedIn Posts.
            CONTEXT DATE: ${contextDate}
            TOPICS: ${topics || 'General Tech Trends'}
            
            INSTRUCTIONS:
            1. CONTENT DEPTH: Each post must be DETAILED and STORY-DRIVEN (approx 200-300 words). Do not write short snippets.
            2. FORMATTING: Use generous spacing (line breaks) for readability. Use bullet points where appropriate.
            3. STRUCTURE:
               - THE HOOK: A scroll-stopping first line.
               - THE STORY/INSIGHT: Deep dive into the "How", "Why", or "What happened".
               - THE TAKEAWAY: Actionable advice for the reader.
               - THE CALL TO ACTION: A question to drive comments.
            
            STYLES:
            1. Storytelling (The "Hero's Journey"): Personal struggle -> pivot -> success.
            2. Achievement/Insight (The "Value Bomb"): Dense, actionable advice or a "How I did X" breakdown.
            3. Contrarian (The "Pattern Interrupt"): "Unpopular opinion: X is dead."
            4. Trend/News (The "Newsjacker"): Relevant to current events in the field.

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
                            style: { type: Type.STRING, enum: ['Storytelling', 'Achievement', 'Insight', 'Contrarian', 'Trend'] },
                            hook: { type: Type.STRING },
                            body: { type: Type.STRING, description: "Long-form content, roughly 200 words." },
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
