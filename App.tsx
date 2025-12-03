import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import MessageBubble from './components/MessageBubble';
import { IconPaperclip, IconSend, IconMenu, IconChevronDown, IconRobot, IconFile, IconImage, IconCamera, IconX } from './components/Icons';
import { Chat, Message, Settings, Attachment } from './types';
import { MODEL_OPTIONS, DEFAULT_SETTINGS, SUGGESTION_CARDS } from './constants';

// Simple UUID generator fallback if no library
const generateId = () => Math.random().toString(36).substring(2, 15);

// Validation Constants
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS_STRING = ".pdf,.md,.txt,.rtf,.doc,.docx,.xml,.json,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.bmp,.gif,.svg";
const ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS_STRING.split(',');
const ALLOWED_IMAGE_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.bmp,.gif,.svg";

// --- Encryption Helpers ---
const ENCRYPTION_KEY_STORAGE = 'prisma_encryption_key_v1';

async function getEncryptionKey(): Promise<CryptoKey> {
  const storedJson = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  if (storedJson) {
    const jwk = JSON.parse(storedJson);
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  } else {
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    localStorage.setItem(ENCRYPTION_KEY_STORAGE, JSON.stringify(jwk));
    return key;
  }
}

async function encryptData(plaintext: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoded
    );

    // Convert buffer to base64
    const ivArray = Array.from(iv);
    const encryptedArray = Array.from(new Uint8Array(encrypted));
    
    const ivBase64 = btoa(String.fromCharCode.apply(null, ivArray));
    const encryptedBase64 = btoa(String.fromCharCode.apply(null, encryptedArray));

    return `${ivBase64}:${encryptedBase64}`;
  } catch (e) {
    console.error("Encryption error", e);
    return plaintext; 
  }
}

async function decryptData(ciphertext: string): Promise<string> {
  try {
    // Check for legacy base64 vs new format
    if (!ciphertext.includes(':')) {
       return atob(ciphertext);
    }
    
    const [ivBase64, encryptedBase64] = ciphertext.split(':');
    const key = await getEncryptionKey();
    
    const ivString = atob(ivBase64);
    const iv = new Uint8Array(ivString.length);
    for (let i=0; i<ivString.length; i++) iv[i] = ivString.charCodeAt(i);
    
    const encryptedString = atob(encryptedBase64);
    const encrypted = new Uint8Array(encryptedString.length);
    for (let i=0; i<encryptedString.length; i++) encrypted[i] = encryptedString.charCodeAt(i);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.warn("Decryption error or legacy format mismatch", e);
    try { return atob(ciphertext); } catch { return ""; }
  }
}

// Unicode-safe Base64 encoder for Basic Auth
function toBase64(str: string) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error("Base64 encoding failed", e);
    return "";
  }
}

const App: React.FC = () => {
  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  const [selectedModelId, setSelectedModelId] = useState<string>('11'); // Default Auto
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Draft Attachments State
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Apply Theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Load data from localStorage on mount (Async for encryption)
  useEffect(() => {
    const initData = async () => {
      // Load Settings
      let loadedSettings = DEFAULT_SETTINGS;
      const savedSettings = localStorage.getItem('prisma_settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          // Decrypt password if it exists
          if (parsed.password) {
            parsed.password = await decryptData(parsed.password);
          }
          // Merge with default settings to ensure new fields (like theme) exist
          loadedSettings = { ...DEFAULT_SETTINGS, ...parsed };
          setSettings(loadedSettings);
        } catch (e) {
          console.error("Failed to parse settings", e);
        }
      }
      setSettingsLoaded(true);

      // Removed auto-open settings logic here

      // Load Chats
      const savedChats = localStorage.getItem('prisma_chats');
      if (savedChats) {
        try {
          setChats(JSON.parse(savedChats));
        } catch (e) {
          console.error("Failed to parse chats", e);
        }
      }
    };

    initData();
  }, []);

  // Save chats to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('prisma_chats', JSON.stringify(chats));
  }, [chats]);

  // Save settings to local storage with AES encryption for password
  useEffect(() => {
    if (!settingsLoaded) return; // Do not overwrite with defaults if not loaded yet

    const saveSettings = async () => {
      const settingsToSave = { ...settings };
      if (settingsToSave.password) {
        // Encrypt the password before saving to local storage
        settingsToSave.password = await encryptData(settingsToSave.password);
      }
      localStorage.setItem('prisma_settings', JSON.stringify(settingsToSave));
    };
    
    saveSettings();
  }, [settings, settingsLoaded]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, currentChatId, isLoading, draftAttachments]); 

  // Click outside model dropdown to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef, attachmentMenuRef]);

  // Auto-clear upload error
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => setUploadError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);


  // --- Logic ---

  const currentChat = chats.find(c => c.id === currentChatId);
  const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId) || MODEL_OPTIONS[0];

  const handleNewChat = () => {
    setCurrentChatId(null);
    setInputMessage('');
    setDraftAttachments([]);
    setUploadError(null);
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, title: newTitle } : chat
    ));
  };

  const getBasicAuthHeaders = () => {
     const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (settings.username && settings.password) {
        const authString = toBase64(`${settings.username}:${settings.password}`);
        headers['Authorization'] = `Basic ${authString}`;
      }
      return headers;
  };

  const getSanitizedWebhookUrl = () => {
    let url = settings.webhookUrl?.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  };

  const createChatIfNeeded = (initialMessage: string): string => {
     let chatToUpdateId = currentChatId;
     if (!chatToUpdateId) {
      // Create new chat
      const newChat: Chat = {
        id: generateId(),
        title: initialMessage.length > 30 ? initialMessage.substring(0, 30) + '...' : initialMessage,
        date: new Date(),
        messages: []
      };
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      chatToUpdateId = newChat.id;
    }
    return chatToUpdateId!;
  };

  const addMessageToChat = (chatId: string, message: Message) => {
     setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, message],
            date: new Date()
          };
        }
        return chat;
      }));
  };

  const processResponse = async (response: Response, chatToUpdateId: string) => {
     // Safely read the response as text first
      const textResponse = await response.text();
      let data: any = {};
      try {
        if (textResponse && textResponse.trim()) {
          data = JSON.parse(textResponse);
        }
      } catch (e) {
        console.warn("Response was not JSON, using raw text.");
        data = { output: textResponse };
      }
      
      const aiContent = 
        data.output || 
        data.message || 
        data.text || 
        (typeof data === 'string' ? data : (Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : "Empty response"));

      const aiMessage: Message = {
        id: generateId(),
        role: 'ai',
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      };

      addMessageToChat(chatToUpdateId, aiMessage);
  };

  // Helper for file size string
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 kB';
    if (bytes === 0) return '0 kB';
    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSendMessage = async (text: string = inputMessage) => {
    // Determine if we can send: needs text OR attachment
    const hasText = !!text.trim();
    const hasAttachments = draftAttachments.length > 0;

    if ((!hasText && !hasAttachments) || isLoading) return;

    const webhookUrl = getSanitizedWebhookUrl();
    if (!webhookUrl) {
      setIsSettingsOpen(true);
      return;
    }

    // Check if files are already uploading (defensive check)
    const isAlreadyUploading = draftAttachments.some(att => att.uploadStatus === 'uploading');
    if (isAlreadyUploading) {
        return;
    }

    // Use attachment name as chat title if no text
    const chatTitleSource = hasText ? text : (draftAttachments[0]?.name || 'File Upload');
    const chatToUpdateId = createChatIfNeeded(chatTitleSource);

    const newMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      attachments: draftAttachments.length > 0 ? [...draftAttachments] : undefined,
      // Backward compatibility for single attachment rendering if needed
      attachment: draftAttachments.length === 1 ? draftAttachments[0] : undefined
    };

    addMessageToChat(chatToUpdateId, newMessage);
    
    // Capture state for payload
    const attachmentsPayload = [...draftAttachments];

    // Clear Text Input immediately, but keep attachments visible to show progress
    setInputMessage('');
    setUploadError(null);
    setIsLoading(true);

    // Set status to uploading for all drafts
    if (attachmentsPayload.length > 0) {
      setDraftAttachments(prev => prev.map(a => ({ ...a, uploadStatus: 'uploading', uploadProgress: 0 })));
    }

    try {
      if (attachmentsPayload.length > 0) {
        // Use XHR for progress tracking and multipart upload
        await new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('model', selectedModelId);
            formData.append('message', text);
            formData.append('chat_id', chatToUpdateId);

            const filesMetadata = attachmentsPayload.map((att, index) => ({
                fileName: att.name,
                fileSize: formatFileSize(att.size),
                fileType: att.type,
                mimeType: att.mimeType,
                fileExtension: att.name.split('.').pop() || '',
                binaryKey: `data${index}`
            }));

            formData.append('files', JSON.stringify(filesMetadata));

            attachmentsPayload.forEach((att, index) => {
                if (att.file) {
                    formData.append(`data${index}`, att.file);
                }
            });

            const xhr = new XMLHttpRequest();
            xhr.open('POST', webhookUrl, true);
            
            // Add Headers
            const authHeaders = getBasicAuthHeaders() as any; 
            if (authHeaders['Authorization']) {
                xhr.setRequestHeader('Authorization', authHeaders['Authorization']);
            }

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    // Update progress in UI
                    setDraftAttachments(prev => prev.map(a => ({ ...a, uploadProgress: percentComplete })));
                }
            };

            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText });
                    await processResponse(response, chatToUpdateId);
                    // Clear drafts on success
                    setDraftAttachments([]);
                    resolve(null);
                } else {
                    // Set error status
                    setDraftAttachments(prev => prev.map(a => ({ ...a, uploadStatus: 'error' })));
                    reject(new Error(`Server returned ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                setDraftAttachments(prev => prev.map(a => ({ ...a, uploadStatus: 'error' })));
                reject(new Error('Network error or CORS issue'));
            };
            
            xhr.send(formData);
        });

      } else {
        // --- Standard JSON Logic ---
        const headers = getBasicAuthHeaders() as any; 
        const body = JSON.stringify({
          model: selectedModelId,
          message: text,
          chat_id: chatToUpdateId,
          files: []
        });

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: headers,
          body: body,
          mode: 'cors',
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }
        await processResponse(response, chatToUpdateId);
      }

    } catch (error) {
      handleError(error, chatToUpdateId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = (error: unknown, chatToUpdateId: string) => {
      console.error("Error sending message:", error);
      let errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      if (errorMsg === 'Failed to fetch') {
        errorMsg += ' (Проверьте CORS или URL вебхука)';
      }
      const errorMessage: Message = {
        id: generateId(),
        role: 'ai',
        content: `**Ошибка:** ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
      addMessageToChat(chatToUpdateId, errorMessage);
  };

  // --- File Upload Logic ---

  const handleAttachmentClick = () => {
    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
  };

  const handleMenuOptionClick = (type: 'file' | 'image' | 'camera') => {
    setIsAttachmentMenuOpen(false);
    if (type === 'file' && fileInputRef.current) fileInputRef.current.click();
    if (type === 'image' && imageInputRef.current) imageInputRef.current.click();
    if (type === 'camera' && cameraInputRef.current) cameraInputRef.current.click();
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const processSelectedFiles = async (files: File[], sourceOverride?: 'file' | 'image' | 'camera') => {
    if (files.length === 0) return;

    // Batch limit check
    if (files.length > 5) {
      setUploadError("Не более 5 файлов за раз.");
      return;
    }

    let validationError = false;
    const validFiles: File[] = [];

    for (const file of files) {
       // Size check
       if (file.size > MAX_FILE_SIZE) {
         validationError = true;
         continue;
       }
       // Extension check
       const ext = '.' + file.name.split('.').pop()?.toLowerCase();
       if (!ALLOWED_EXTENSIONS.includes(ext)) {
         validationError = true;
         continue;
       }
       validFiles.push(file);
    }

    if (validationError || validFiles.length < files.length) {
      setUploadError("Этот тип файла или размер не поддерживается. Пожалуйста, выберите другой файл.");
      if (validFiles.length === 0) return;
    } else {
      setUploadError(null);
    }

    try {
      const newAttachments = await Promise.all(validFiles.map(async (file) => {
         const base64Data = await convertFileToBase64(file);
         
         // Infer type
         let attachmentType: 'file' | 'image' = 'file';
         let finalSourceType = sourceOverride || 'file';

         if (file.type.startsWith('image/')) {
             attachmentType = 'image';
             if (!sourceOverride) finalSourceType = 'image';
         }
         
         if (sourceOverride === 'camera') attachmentType = 'image';

         return {
            type: attachmentType,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            data: base64Data,
            file: file, // Store raw file for binary upload
            sourceType: finalSourceType,
            uploadStatus: 'idle', // Changed from pending to idle
            uploadProgress: 0
         } as Attachment;
      }));
      
      setDraftAttachments(prev => [...prev, ...newAttachments]);

    } catch (error) {
       console.error("Error reading file", error);
       setUploadError("Ошибка при чтении файла.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image' | 'camera') => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
        // Reset input value to allow selecting same files again
        e.target.value = '';
        await processSelectedFiles(files, type);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we are leaving the main container, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep isDragging true while hovering
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    processSelectedFiles(files);
  };

  const handleRemoveDraft = (index: number) => {
    setDraftAttachments(prev => prev.filter((_, i) => i !== index));
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#212121] transition-colors duration-200">
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={setSettings}
      />

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept={ALLOWED_EXTENSIONS_STRING}
        multiple 
        onChange={(e) => handleFileChange(e, 'file')} 
      />
      <input 
        type="file" 
        ref={imageInputRef} 
        className="hidden" 
        accept={ALLOWED_IMAGE_EXTENSIONS}
        multiple 
        onChange={(e) => handleFileChange(e, 'image')} 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        className="hidden" 
        accept="image/*" 
        capture="environment"
        onChange={(e) => handleFileChange(e, 'camera')} 
      />


      {/* Sidebar */}
      <Sidebar 
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={(id) => { setCurrentChatId(id); setIsSidebarOpen(false); }}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRenameChat={handleRenameChat}
        userName={settings.telegramUsername || 'Пользователь'}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        
        {/* Onboarding Banner */}
        {!settings.webhookUrl && (
          <div className="bg-orange-50 border-b border-orange-100 p-3 text-center text-xs md:text-sm text-orange-800 absolute w-full top-12 z-20">
            Перед началом работы нажмите значок настроек и укажите Webhook и свои данные. Без этого бот не сможет отвечать.
          </div>
        )}

        {/* Top Header */}
        <div className="h-12 flex items-center justify-between px-4 sticky top-0 bg-white/80 dark:bg-[#212121]/80 backdrop-blur-md z-30 transition-colors">
          <div className="md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#3d3d3d] rounded-md">
              <IconMenu className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative mx-auto" ref={dropdownRef}>
            <button 
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3d3d3d] transition-colors text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              {selectedModel.label}
              <IconChevronDown className={`w-4 h-4 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white dark:bg-[#2d2d2d] rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto">
                <div>
                  {MODEL_OPTIONS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModelId(model.id); setIsModelDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#3d3d3d] transition-colors flex justify-between items-center
                        ${selectedModelId === model.id ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-[#3d3d3d]' : 'text-gray-600 dark:text-gray-400'}
                      `}
                    >
                      {model.label}
                      {selectedModelId === model.id && <span className="text-gray-900 dark:text-white">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-10 md:w-0"></div> {/* Spacer for centering */}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto relative scroll-smooth pb-32">
          {!currentChat ? (
            // Welcome Screen
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <IconRobot className="w-8 h-8 text-gray-800 dark:text-gray-200" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-12 text-center">Чем я могу вам помочь сегодня?</h1>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {SUGGESTION_CARDS.map((card, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendMessage(card.title)}
                    className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2d2d2d] transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">{card.title}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">{card.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Messages
            <div className="max-w-3xl mx-auto px-4 py-8">
              {currentChat.messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex w-full mb-6 animate-in fade-in duration-300">
                   <div className="w-8 h-8 flex-shrink-0 mr-4 mt-1 flex items-center justify-center">
                     <div className="w-full h-full rounded-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        <IconRobot className="w-4 h-4 text-gray-800 dark:text-gray-200" />
                     </div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">ChatGPT</span>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl px-4 py-3 border border-gray-100/50 dark:border-gray-700/50 w-fit">
                         <div className="flex items-center space-x-1 h-6">
                           <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                           <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                           <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                         </div>
                      </div>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-[#212121] p-4 transition-colors">
          <div className="max-w-3xl mx-auto relative">
            
            {/* Upload Error Message */}
            {uploadError && (
              <div className="absolute -top-12 left-0 right-0 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs px-4 py-2 rounded-lg border border-red-100 dark:border-red-800 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                {uploadError}
              </div>
            )}

            <div 
              className={`bg-white dark:bg-[#2F2F2F] border shadow-sm rounded-2xl transition-all focus-within:shadow-md relative ${uploadError ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-700 focus-within:border-gray-300 dark:focus-within:border-gray-600'} ${isDragging ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900 bg-blue-50 dark:bg-blue-900/20' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Drag Overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/90 dark:bg-[#2F2F2F]/90 backdrop-blur-sm rounded-2xl border-2 border-blue-500 border-dashed animate-in fade-in duration-200 pointer-events-none">
                  <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                    <IconFile className="w-5 h-5" />
                    <span>Отпустите файлы здесь</span>
                  </div>
                </div>
              )}
              
              {/* Draft Attachment Preview */}
              {draftAttachments.length > 0 && (
                <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center bg-gray-50/50 dark:bg-[#2d2d2d] rounded-t-2xl overflow-x-auto gap-3 scrollbar-hide">
                  {draftAttachments.map((att, index) => (
                     <div key={index} className="flex-shrink-0 relative group">
                        <div className="flex items-center gap-2 bg-white dark:bg-[#3d3d3d] border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-sm pr-8 relative overflow-hidden">
                          {/* Progress Bar Overlay */}
                          {att.uploadStatus === 'uploading' && (
                              <div 
                                className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" 
                                style={{ width: `${att.uploadProgress}%` }}
                              />
                          )}
                          
                          {att.type === 'image' && att.data ? (
                            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                               <img src={att.data} alt="preview" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                               <IconFile className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          <div className="max-w-[120px]">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate" title={att.name}>
                              {att.name}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">
                              {(att.size ? (att.size / 1024).toFixed(1) + ' KB' : '')}
                            </div>
                          </div>
                          
                          {/* Status Indicators */}
                          {att.uploadStatus === 'pending' && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                              </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleRemoveDraft(index)}
                          disabled={att.uploadStatus === 'uploading'}
                          className="absolute -top-1 -right-1 bg-white dark:bg-[#3d3d3d] border border-gray-200 dark:border-gray-600 rounded-full p-1 text-gray-400 hover:text-red-500 shadow-sm transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <IconX className="w-3 h-3" />
                        </button>
                     </div>
                  ))}
                </div>
              )}

              <div className="flex items-end px-3 py-3 w-full">
                {/* Attachment Button & Menu */}
                <div className="relative" ref={attachmentMenuRef}>
                  <button 
                    onClick={handleAttachmentClick}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-[#3d3d3d] mb-[2px]"
                  >
                    <IconPaperclip className="w-5 h-5" />
                  </button>
                  
                  {isAttachmentMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-[#2d2d2d] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-1 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                      <button 
                        onClick={() => handleMenuOptionClick('file')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0">
                          <IconFile className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        Добавить файл
                      </button>
                      <button 
                        onClick={() => handleMenuOptionClick('image')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0">
                          <IconImage className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        Добавить изображение
                      </button>
                      <button 
                        onClick={() => handleMenuOptionClick('camera')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left md:hidden"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0">
                          <IconCamera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        Сделать снимок
                      </button>
                      
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 px-3 pb-2">
                        <p className="text-[10px] text-gray-400 leading-tight">
                          Допустимые типы файлов: PDF, MD (Markdown), TXT, RTF, DOC, DOCX, XML, JSON, CSV, XLS, XLSX, JPG, JPEG, PNG, WEBP, BMP, GIF, SVG. <br/>
                          Максимальный размер каждого файла: 15 МБ. <br/>
                          Не более 5 файлов за раз.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isDragging ? "Отпустите файлы здесь" : "Спросите о чем угодно"}
                  className="flex-1 max-h-48 min-h-[24px] bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none py-2 px-2 text-sm md:text-base mx-1 outline-none"
                  rows={1}
                  style={{ height: 'auto', overflow: 'hidden' }}
                />

                <button 
                  onClick={() => handleSendMessage()}
                  disabled={(!inputMessage.trim() && draftAttachments.length === 0) || isLoading}
                  className={`p-2 rounded-lg transition-all duration-200 mb-[2px] ${
                    (inputMessage.trim() || draftAttachments.length > 0) && !isLoading
                      ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200' 
                      : 'bg-gray-100 dark:bg-[#3d3d3d] text-gray-300 dark:text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <IconSend className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-center mt-2">
              <p className="text-[10px] text-gray-400">Это разработка компании Призма AI. ИИ может делать ошибки. Пожалуйста, проверьте важную информацию.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;