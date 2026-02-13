
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
    instagram?: string;
    facebook?: string;
    behance?: string;
    dribbble?: string;
  };
  photoUrl?: string;
  theme?: ThemeConfig;
}

// UK Resume Specific Types
export interface UKResumeData {
  fullName: string;
  contactInfo: string; // "Location | Phone | Email | LinkedIn"
  professionalProfile: string; // The "Summary" equivalent
  coreCompetencies: string[]; // Bullet points
  experience: {
    role: string;
    company: string;
    location: string;
    dates: string;
    responsibilities: string[]; // Bullet points
  }[];
  education: {
    degree: string;
    institution: string;
    dates: string;
    details?: string;
  }[];
  interests?: string; // Very common in UK CVs
  references: string; // Usually "Available upon request"
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
  type: 'portfolio' | 'resume';
  url?: string;
}

export interface QAFeedback {
  score: number;
  suggestions: string[];
  uxInsights: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  postedAt: string;
  description: string; // Short blurb
  applyLink: string;
  matchScore?: number; // Calculated by AI
  matchReason?: string; // AI explanation
}

export enum AppMode {
  LOGIN = 'LOGIN',
  HOME = 'HOME',
  PORTFOLIO = 'PORTFOLIO',
  UK_RESUME = 'UK_RESUME',
  JOB_HUNTER = 'JOB_HUNTER',
  RESUME_MOULDER = 'RESUME_MOULDER'
}

export enum AppStep {
  INPUT = 'INPUT',
  GENERATING = 'GENERATING',
  PREVIEW = 'PREVIEW',
  EDITING = 'EDITING', 
  DEPLOY_CONFIG = 'DEPLOY_CONFIG',
  DEPLOYING = 'DEPLOYING',
  SUCCESS = 'SUCCESS'
}