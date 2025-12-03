export interface Attachment {
  type: 'file' | 'image';
  name: string;
  size?: number;
  mimeType?: string;
  data?: string; // Base64 data or URL
  file?: File;   // Original file object for binary upload
  sourceType?: 'file' | 'image' | 'camera';
  uploadStatus?: 'idle' | 'pending' | 'uploading' | 'completed' | 'error';
  uploadProgress?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  attachment?: Attachment; // Legacy single attachment
  attachments?: Attachment[]; // Multiple attachments
}

export interface Chat {
  id: string;
  title: string;
  date: Date;
  messages: Message[];
}

export interface Settings {
  webhookUrl: string;
  username: string;
  password: string;
  firstName: string;
  telegramUsername: string;
  theme: 'light' | 'dark';
}

export interface ModelOption {
  label: string;
  id: string; // The numeric ID required by the webhook
  group?: string;
}

export type GroupedChats = {
  [key: string]: Chat[];
};