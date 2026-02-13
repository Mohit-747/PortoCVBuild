
import { GoogleGenAI, Type } from "@google/genai";
import { PortfolioData, QAFeedback, UserPreferences, UKResumeData } from "../types";

// --- API KEY ROTATION LOGIC ---

// 1. ADD YOUR BACKUP KEYS HERE
// The system will try them in order. If Key 1 fails (Quota Limit), it switches to Key 2, etc.
const API_KEY_POOL = [
  process.env.API_KEY, // Primary Key from Environment
  // "AIzaSy...PasteYourSecondKeyHere",
  // "AIzaSy...PasteYourThirdKeyHere",
].filter((k): k is string => !!k && k !== 'undefined' && k.length > 10 && !k.startsWith("AIzaSy...Paste"));

let currentKeyIndex = 0;

const getCurrentApiKey = () => {
  if (API_KEY_POOL.length === 0) {
    throw new Error("No valid API Keys found. Please check services/geminiService.ts");
  }
  if (currentKeyIndex >= API_KEY_POOL.length) {
    throw new Error("ALL_KEYS_EXHAUSTED");
  }
  return API_KEY_POOL[currentKeyIndex];
};

const rotateKey = () => {
  currentKeyIndex++;
  if (currentKeyIndex < API_KEY_POOL.length) {
    console.warn(`[System] Quota exceeded. Rotating to API Key #${currentKeyIndex + 1}`);
    return true; // Rotation successful
  }
  console.error("[System] All API Keys have been exhausted.");
  return false; // No more keys
};

// Generic wrapper for all AI calls to handle failover
async function callWithRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    // Always instantiate with the CURRENT active key
    const ai = new GoogleGenAI({ apiKey: getCurrentApiKey() });
    return await fn(ai);
  } catch (error: any) {
    // Check for Quota Exceeded (429)
    const isQuotaError = error.status === 429 || 
                         (error.message && error.message.includes('429')) ||
                         (error.message && error.message.toLowerCase().includes('quota')) ||
                         (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

    if (isQuotaError) {
      if (rotateKey()) {
        // Retry immediately with new key (no delay needed for rotation)
        return callWithRetry(fn, retries, 0);
      } else {
        throw new Error("⚠️ All API Keys are exhausted. Please try again tomorrow or add more keys.");
      }
    }

    // Standard exponential backoff for other transient errors (500, 503)
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
    // Construct the guidance prompt based on user preferences
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
      styleGuidance = "CREATIVE FREEDOM: Create a COMPLETELY UNIQUE visual identity. Randomize colors, moods, and layouts. Do not default to blue/dark. USE BRIGHT, VIBRANT, NEON, OR PASTEL SCHEMES. Ensure high contrast.";
    }

    let parts: any[] = [
      { text: `Act as an Award-Winning Digital Art Director. Transform raw resume data into a high-end web portfolio.

MANDATORY DIRECTIVES:
1. ${styleGuidance}
2. COLOR PALETTE: If 'auto', generate a unique, harmonic palette. Use bright and distinct colors if possible.
3. SKILLS: Extract exactly top 10 skills.
4. SOCIALS: Extract ALL available social links.
5. QUOTE: A powerful, short professional manifesto.
6. UNIQUE_SEED: ${Date.now()} (Ensure output is unique based on this timestamp).

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
        temperature: 0.95,
        responseMimeType: "application/json",
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

    if (!response.text) throw new Error("Agent 1 failed to construct blueprint.");
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
    // Step 1: Analyze and rewrite if match > 60%
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