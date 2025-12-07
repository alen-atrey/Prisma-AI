import { ModelOption, Settings } from './types';

export const MODEL_OPTIONS: ModelOption[] = [
  { label: 'Auto', id: '11' },
  { label: 'GPT-5 Nano', id: '1' },
  { label: 'GPT-4 Mini', id: '2' },
  { label: 'GPT-5.1', id: '3' },
  { label: 'GPT-5 Pro', id: '4' },
  { label: 'Gemini 2.5 Flash Lite', id: '5' },
  { label: 'Gemini 2.5 Flash', id: '6' },
  { label: 'Gemini 3 Pro Preview', id: '7' },
  { label: 'Claude Haiku 4.5', id: '8' },
  { label: 'Claude Opus 4.5', id: '9' },
  { label: 'Claude Sonnet 4.5', id: '10' },
];

// Helper to safely access process.env in browser
const getEnv = (key: string) => {
  // @ts-ignore
  return (typeof window !== 'undefined' && window.process?.env?.[key]) || '';
};

export const DEFAULT_SETTINGS: Settings = {
  webhookUrl: getEnv('REACT_APP_WEBHOOK_URL'),
  username: getEnv('REACT_APP_USERNAME'),
  password: getEnv('REACT_APP_PASSWORD'),
  firstName: '',
  telegramUsername: '',
  theme: 'light',
};

export const SUGGESTION_CARDS = [
  {
    title: 'Что умеет этот ИИ',
    subtitle: 'Расскажите подробнее',
  },
  {
    title: 'Придумай идею для поста',
    subtitle: 'о запуске нового продукта',
  },
  {
    title: 'Помогите мне разобраться',
    subtitle: 'в техническом документе',
  },
  {
    title: 'Объясни квантовую физику',
    subtitle: 'простыми словами',
  },
];

// Supabase Configuration
export const SUPABASE_URL = "https://prismasupabase.com";
// Anonymous Key (Safe for frontend)
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0OTc5MjAwLCJleHAiOjE5MjI3NDU2MDB9.SWVZ_tgSyeCQkmbJE12svdtEHhCJgMrrZ4c_vi9FRiY";