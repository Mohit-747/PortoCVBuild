
import { GoogleGenAI, Type } from "@google/genai";
import { PortfolioData, QAFeedback, UserPreferences } from "../types";

async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 500 || error.message?.includes('500') || error.message?.includes('xhr'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const generatePortfolioData = async (
  resumeInput: string | { data: string; mimeType: string },
  prefs: UserPreferences
): Promise<PortfolioData> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Construct the guidance prompt based on user preferences
    let styleGuidance = "";
    if (prefs.themeStyle !== 'auto') styleGuidance += `VISUAL STYLE: Strictly use a '${prefs.themeStyle}' aesthetic (colors, fonts). `;
    if (prefs.backgroundType !== 'auto') styleGuidance += `BACKGROUND: Strictly use '${prefs.backgroundType}' mode. `;
    if (prefs.animationType !== 'auto') styleGuidance += `ANIMATION: Strictly use '${prefs.animationType}' animations. `;
    
    // Color Guidance
    if (prefs.colorMode === 'light') {
       styleGuidance += `COLOR SCHEME: LIGHT MODE (White/Light Gray background). Ensure high contrast text. `;
    } else if (prefs.colorMode === 'dark') {
       styleGuidance += `COLOR SCHEME: DARK MODE (Black/Dark Navy background). `;
    }

    if (prefs.primaryHue !== 'auto') {
       styleGuidance += `PRIMARY COLOR: Dominant color must be shades of ${prefs.primaryHue.toUpperCase()}. `;
    }
    
    if (styleGuidance === "") {
      styleGuidance = "CREATIVE FREEDOM: Create a COMPLETELY UNIQUE visual identity. Randomize colors, moods, and layouts. Do not default to blue/dark.";
    }

    let parts: any[] = [
      { text: `Act as an Award-Winning Digital Art Director. Transform raw resume data into a high-end web portfolio.

MANDATORY DIRECTIVES:
1. ${styleGuidance}
2. COLOR PALETTE: If 'auto', generate a unique, harmonic palette. Avoid generic defaults. If Light Mode is requested, use light background codes (e.g., #f8fafc, #f1f5f9) and darker primary colors.
3. BACKGROUND: 'particles' (Space/Data), 'grid' (Cyber/Retro), 'bokeh' (Modern/Soft).
4. ANIMATION: 'fade' (Classic), 'slide' (Dynamic), 'scale' (Impact), 'pop' (Bouncy).
5. SKILLS: Extract exactly top 10 skills.
6. QUOTE: A powerful, short professional manifesto.

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
        temperature: 0.95, // High creativity
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
                whatsapp: { type: Type.STRING }
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

export const getAgentFeedback = async (data: PortfolioData): Promise<QAFeedback> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
