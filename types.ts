
export interface Experience {
  role: string;
  company: string;
  period: string;
  description: string;
}

export interface Project {
  title: string;
  description: string;
  tech: string[];
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
}

export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontStyle: 'modern' | 'cyber' | 'minimal' | 'brutal';
  backgroundStyle: 'particles' | 'grid' | 'bokeh';
  animationStyle: 'fade' | 'slide' | 'scale' | 'pop';
  mode: 'dark' | 'light';
}

export interface PortfolioData {
  name: string;
  title: string;
  summary: string;
  email: string;
  location: string;
  quote: string;
  skills: string[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    whatsapp?: string;
  };
  photoUrl?: string;
  theme?: ThemeConfig;
}

export interface UserPreferences {
  themeStyle: 'auto' | 'cyber' | 'minimal' | 'professional' | 'creative';
  backgroundType: 'auto' | 'particles' | 'grid' | 'bokeh';
  animationType: 'auto' | 'fade' | 'slide' | 'scale';
  colorMode: 'auto' | 'dark' | 'light';
  primaryHue: 'auto' | 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'monochrome';
}

export interface PortfolioHistoryItem {
  id: string;
  name: string;
  title: string;
  photoUrl?: string;
  deployedAt: string;
}

export interface QAFeedback {
  score: number;
  suggestions: string[];
  uxInsights: string;
}

export enum AppStep {
  INPUT = 'INPUT',
  GENERATING = 'GENERATING',
  PREVIEW = 'PREVIEW',
  DEPLOY_CONFIG = 'DEPLOY_CONFIG',
  DEPLOYING = 'DEPLOYING',
  SUCCESS = 'SUCCESS'
}
