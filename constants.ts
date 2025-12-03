import { ModelOption, Settings } from './types';

export const MODEL_OPTIONS: ModelOption[] = [
  { label: 'Auto', id: '11' },
  { label: 'GPT-5 Nano', id: '1' },
  { label: 'GPT-5 Mini', id: '2' },
  { label: 'GPT-5.1', id: '3' },
  { label: 'GPT-O4 mini deep research', id: '4' },
  { label: 'Gemini 2.5 Flash Lite', id: '5' },
  { label: 'Gemini 2.5 Flash', id: '6' },
  { label: 'Gemini 3 Pro Preview', id: '7' },
  { label: 'Claude Haiku 4.5', id: '8' },
  { label: 'Claude Opus 4.5', id: '9' },
  { label: 'Claude Sonnet 4.5', id: '10' },
];

export const DEFAULT_SETTINGS: Settings = {
  webhookUrl: '',
  username: '',
  password: '',
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