
import { GoogleGenAI, Type } from "@google/genai";
import { PortfolioData, QAFeedback, UserPreferences, UKResumeData } from "../types";

// --- API KEY ROTATION & SANITIZATION LOGIC ---

// Helper to clean keys (remove whitespace, quotes added by some env managers)
const sanitizeKey = (key: string | undefined) => {
    if (!key) return '';
    return key.trim().replace(/^["']|["']$/g, '');
};

let manualKey = '';

export const setManualApiKey = (key: string) => {
    manualKey = sanitizeKey(key);
};

const getEnvKey = () => sanitizeKey(process.env.API_KEY);

const getCurrentApiKey = () => {
  // Prioritize manual key if set by user in UI
  if (manualKey && manualKey.length > 10) return manualKey;

  const envKey = getEnvKey();
  if (envKey && envKey.length > 10 && !envKey.startsWith("AIzaSy...Paste")) {
      return envKey;
  }
  
  throw new Error("API_KEY_MISSING: Please enter your Google Gemini API Key.");
};

// Safety Settings to prevent false positives on Resume content
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// Generic wrapper for all AI calls to handle failover
async function callWithRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    const apiKey = getCurrentApiKey();
    const ai = new GoogleGenAI({ apiKey });
    return await fn(ai);
  } catch (error: any) {
    // 1. Check for Quota Exceeded (429)
    const isQuotaError = error.status === 429 || 
                         (error.message && error.message.includes('429')) ||
                         (error.message && error.message.toLowerCase().includes('quota')) ||
                         (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

    if (isQuotaError) {
       throw new Error("429 Resource Exhausted: Your API Key quota is full.");
    }

    // 2. Check for Invalid Key (400)
    if (error.status === 400 || (error.message && error.message.includes('API key not valid'))) {
         throw new Error("400 Invalid API Key: Please check your API Key.");
    }
    
    // Check for missing key explicitly
    if (error.message && error.message.includes('API_KEY_MISSING')) {
        throw error;
    }

    // 3. Standard exponential backoff for server errors
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
        temperature: 1.0, // Increased temperature for uniqueness
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
