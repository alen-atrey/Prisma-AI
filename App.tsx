import React, { useState, useEffect, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import MessageBubble from './components/MessageBubble';
import { IconPaperclip, IconSend, IconMenu, IconChevronDown, IconRobot, IconFile, IconImage, IconCamera, IconX, IconPlus, IconGlobe, IconSparkles } from './components/Icons';
import { Chat, Message, Settings, Attachment } from './types';
import { MODEL_OPTIONS, DEFAULT_SETTINGS, SUGGESTION_CARDS, SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

// --- Supabase Init ---
let supabase: SupabaseClient | null = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http')) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

// Simple UUID generator fallback
const generateId = () => Math.random().toString(36).substring(2, 15);

// Constants - Max size 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const ALLOWED_EXTENSIONS_STRING = ".pdf,.md,.txt,.rtf,.doc,.docx,.xml,.json,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.bmp,.gif,.svg";
const ALLOWED_IMAGE_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.bmp,.gif,.svg";
const ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS_STRING.split(',');

// Base64 encoder for Basic Auth headers
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
  const [activeTelegramId, setActiveTelegramId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  const [selectedModelId, setSelectedModelId] = useState<string>('11');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // New Mode State
  const [activeMode, setActiveMode] = useState<'websearch' | 'deepresearch' | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Theme Effect ---
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // --- Initialization ---
  
  // 1. Load Settings from LocalStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('prisma_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  // 2. Resolve Telegram ID & Fetch History
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 2;

    const resolveUserAndFetch = async () => {
      if (!settings.telegramUsername || !supabase) {
        setChats([]);
        setActiveTelegramId(null);
        return;
      }

      if (isOfflineMode) return; 

      const telegramId = settings.telegramUsername.trim();
      setActiveTelegramId(telegramId);

      const tryUpsert = async () => {
          try {
            // Upsert user into public.users table using Anon Key (relies on permissive RLS)
            const { error: upsertError } = await supabase
              .from('users')
              .upsert({ telegram_id: telegramId, first_name: settings.firstName || 'User' }, { onConflict: 'telegram_id' });

            if (upsertError) {
               if (upsertError.code === 'PGRST002' && retryCount < maxRetries) {
                   retryCount++;
                   setTimeout(tryUpsert, 1500);
                   return;
               }
               
               if (upsertError.code !== 'PGRST002') {
                   console.error("Supabase User Upsert Failed:", JSON.stringify(upsertError, null, 2));
               }
               // If upsert fails (e.g. network), go offline
               setIsOfflineMode(true);
            } else {
               fetchHistory(telegramId);
            }

          } catch (err: any) {
            console.warn("Supabase connection error:", err.message);
            setIsOfflineMode(true);
          }
      };
      
      tryUpsert();
    };

    resolveUserAndFetch();
  }, [settings.telegramUsername, settings.firstName, isOfflineMode]);

  // 3. Fetch History Logic
  const fetchHistory = async (telegramId: string) => {
    if (!supabase || isOfflineMode) return;
    try {
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('updated_at', { ascending: false });

      if (chatsError) throw chatsError;
      if (!chatsData || chatsData.length === 0) {
          setChats([]);
          return;
      }

      const { data: messagesData, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .in('chat_id', chatsData.map(c => c.id))
        .order('created_at', { ascending: true });

      if (msgsError) throw msgsError;

      const fullChats: Chat[] = chatsData.map((c: any) => ({
        id: c.id,
        title: c.title || 'New Chat',
        date: new Date(c.created_at),
        messages: messagesData
          ?.filter((m: any) => m.chat_id === c.id)
          .map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content || '',
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachments: m.attachments || []
          })) || []
      }));

      setChats(fullChats);
    } catch (e: any) {
      if (e.code !== 'PGRST002') {
          console.error("History sync failed:", e.message || JSON.stringify(e));
      }
      setIsOfflineMode(true);
    }
  };

  // 4. Realtime Subscription for Messages
  useEffect(() => {
    if (!supabase || !currentChatId || isOfflineMode) return;

    const channel = supabase
      .channel(`chat:${currentChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${currentChatId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          
          setChats(prev => prev.map(chat => {
            if (chat.id === currentChatId) {
               const exists = chat.messages.some(m => m.content === newMsg.content && m.role === newMsg.role); 
               if (!exists) {
                   return {
                       ...chat,
                       messages: [...chat.messages, {
                           id: newMsg.id,
                           role: newMsg.role,
                           content: newMsg.content || '',
                           timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                           attachments: newMsg.attachments || []
                       }]
                   };
               }
            }
            return chat;
          }));
        }
      )
      .subscribe((status) => {
         if (status === 'CHANNEL_ERROR') {
             // Silent fail for realtime
         }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [currentChatId, isOfflineMode]);


  // --- Scroll to bottom ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, currentChatId, isLoading, draftAttachments]); 

  // --- Outside Click Handlers ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef, attachmentMenuRef, plusMenuRef]);

  // --- Logic ---

  const currentChat = chats.find(c => c.id === currentChatId);
  const selectedModel = MODEL_OPTIONS.find(m => m.id === selectedModelId) || MODEL_OPTIONS[0];

  const handleNewChat = () => {
    setCurrentChatId(null);
    setInputMessage('');
    setDraftAttachments([]);
    setUploadError(null);
    setActiveMode(null);
  };

  const handleRenameChat = async (chatId: string, newTitle: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, title: newTitle } : chat
    ));
    // DB Update
    if (activeTelegramId && supabase && !isOfflineMode) {
      supabase.from('chats').update({ title: newTitle }).eq('id', chatId).then(({error}) => {
          if(error) console.warn("Rename failed:", error.message);
      });
    }
  };

  const createChatIfNeeded = async (initialMessage: string): Promise<string> => {
    let chatToUpdateId = currentChatId;
    
    if (!chatToUpdateId) {
      const title = initialMessage.length > 30 ? initialMessage.substring(0, 30) + '...' : initialMessage;
      
      if (activeTelegramId && supabase && !isOfflineMode) {
        // Ensure user exists (Safe Upsert with Anon Key)
        const { error: userError } = await supabase.from('users').upsert(
             { telegram_id: activeTelegramId, first_name: settings.firstName || 'User' }, 
             { onConflict: 'telegram_id' }
        );
        // Ignore userError here, let chat creation fail naturally if so

        // Attempt DB Create
        const { data, error } = await supabase
          .from('chats')
          .insert([{ telegram_id: activeTelegramId, title: title }])
          .select()
          .single();
          
        if (data && !error) {
          chatToUpdateId = data.id;
          const newChat: Chat = {
            id: data.id,
            title: data.title,
            date: new Date(),
            messages: []
          };
          setChats(prev => [newChat, ...prev]);
          setCurrentChatId(data.id);
        } else {
          // Fallback to local if DB fails
          if (error.code !== 'PGRST002' && error.code !== 'PGRST000') {
              console.error("DB Create Error", JSON.stringify(error, null, 2));
          }
          setIsOfflineMode(true);
          
          const tempId = generateId();
          setChats(prev => [{ id: tempId, title, date: new Date(), messages: [] }, ...prev]);
          setCurrentChatId(tempId);
          return tempId;
        }
      } else {
        // Offline Fallback
        const tempId = generateId();
        setChats(prev => [{ id: tempId, title, date: new Date(), messages: [] }, ...prev]);
        setCurrentChatId(tempId);
        return tempId;
      }
    }
    return chatToUpdateId!;
  };

  // --- Message Handling ---

  const handleSendMessage = async (text: string = inputMessage) => {
    const hasText = !!text.trim();
    const hasAttachments = draftAttachments.length > 0;

    if ((!hasText && !hasAttachments) || isLoading) return;

    let url = settings.webhookUrl?.trim();
    if (!url) { setIsSettingsOpen(true); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Mixed Content Check
    if (window.location.protocol === 'https:' && url.startsWith('http:')) {
      console.warn("WARNING: Attempting to fetch HTTP webhook from HTTPS page. This will likely fail.");
    }

    const chatTitleSource = hasText ? text : (draftAttachments[0]?.name || 'File Upload');
    
    // 1. Get Chat ID (Handles local fallback if DB down)
    const chatToUpdateId = await createChatIfNeeded(chatTitleSource);

    const userMsgId = generateId(); 
    const attachmentsData = [...draftAttachments];
    
    const newMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
    };

    // Optimistic UI
    setChats(prev => prev.map(c => 
      c.id === chatToUpdateId ? { ...c, messages: [...c.messages, newMessage] } : c
    ));

    // Save to DB (Non-blocking, if online)
    if (activeTelegramId && supabase && !isOfflineMode) {
      supabase.from('messages').insert({
        chat_id: chatToUpdateId,
        role: 'user',
        content: text,
        attachments: attachmentsData
      }).then(({ error }) => {
         if(error) {
             if (error.code !== 'PGRST002' && error.code !== 'PGRST000') {
                console.warn("Supabase msg save error:", error.message);
             }
             setIsOfflineMode(true);
         }
      });
    }

    setInputMessage('');
    setDraftAttachments([]);
    setUploadError(null);
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); 

    try {
      const headers: any = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' 
      };
      
      if (settings.username && settings.password) {
        headers['Authorization'] = `Basic ${toBase64(`${settings.username}:${settings.password}`)}`;
      }

      const bodyPayload: any = {
        model: selectedModelId,
        message: text,
        chat_id: chatToUpdateId,
        firstName: settings.firstName,
        telegramUsername: settings.telegramUsername,
      };

      // Add Mode Flags
      if (activeMode === 'websearch') {
        bodyPayload.Websearch = "active";
      } else if (activeMode === 'deepresearch') {
        bodyPayload.DeepResearch = "active";
      }

      if (attachmentsData.length > 0) {
        bodyPayload.files = attachmentsData.map(att => ({
          fileName: att.name,
          fileSize: `${(att.size || 0) / 1024} KB`,
          fileType: att.type,
          mimeType: att.mimeType,
          fileExtension: att.name.split('.').pop() || '',
          data: att.data ? att.data.split(',')[1] || att.data : ''
        }));
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyPayload),
        mode: 'cors',
        signal: controller.signal,
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const responseText = await response.text();
      let responseData: any = {};
      try {
        if (responseText.trim()) responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { output: responseText };
      }

      const aiContent = responseData.output || responseData.message || responseData.text || (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));

      const aiMessage: Message = {
        id: generateId(),
        role: 'ai',
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChats(prev => prev.map(c => 
        c.id === chatToUpdateId ? { ...c, messages: [...c.messages, aiMessage] } : c
      ));

      if (activeTelegramId && supabase && !isOfflineMode) {
        await supabase.from('messages').insert({
          chat_id: chatToUpdateId,
          role: 'ai',
          content: aiContent
        });
      }

    } catch (error: any) {
      console.error("Webhook error:", error);
      let errorContent = `**Error:** ${error.message || 'Failed to connect'}`;
      
      if (error.name === 'AbortError') {
         errorContent = "**Error:** Request timed out (120s). n8n took too long to reply.";
      } else if (error.message.includes('500')) {
          errorContent += "\n\n*Server Error 500: n8n crashed. Check your n8n execution logs.*";
      } else if (error.message.includes('403')) {
          errorContent += "\n\n*Server Error 403 (Forbidden):* Check Settings credentials.";
      } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          errorContent += "\n\n*Network/CORS Error:* The browser blocked the request. \n1. Is your n8n URL `https://`? (HTTP is blocked).\n2. Does your n8n server respond with `Access-Control-Allow-Origin: *`?\n3. Is your file size too large for your proxy?";
      }

      const errorMsg: Message = {
        id: generateId(),
        role: 'ai',
        content: errorContent,
        timestamp: new Date().toLocaleTimeString()
      };
      setChats(prev => prev.map(c => 
        c.id === chatToUpdateId ? { ...c, messages: [...c.messages, errorMsg] } : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // --- File Upload Handlers ---

  const checkModeAndAttach = () => {
      if (activeMode) {
          setUploadError('Чтобы прикрепить файл, сначала отключите режим “Веб-поиск” или “Глубокое исследование”, а затем повторите попытку.');
          return false;
      }
      return true;
  };

  const handleMenuOptionClick = (type: 'file' | 'image' | 'camera') => {
    if (!checkModeAndAttach()) return;
    
    setIsAttachmentMenuOpen(false);
    if (type === 'file' && fileInputRef.current) fileInputRef.current.click();
    if (type === 'image' && imageInputRef.current) imageInputRef.current.click();
    if (type === 'camera' && cameraInputRef.current) cameraInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image' | 'camera') => {
    if (!checkModeAndAttach()) {
        e.target.value = '';
        return;
    }

    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
        e.target.value = ''; 
        await processSelectedFiles(files, type);
    }
  };

  const processSelectedFiles = async (files: File[], sourceOverride?: 'file' | 'image' | 'camera') => {
    if (files.length === 0) return;
    if (files.length > 5) { setUploadError("Max 5 files"); return; }

    const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE && ALLOWED_EXTENSIONS.includes('.' + f.name.split('.').pop()?.toLowerCase()));
    
    if (validFiles.length < files.length) setUploadError("Some files were invalid (Check size < 10MB or type)");

    const newAttachments = await Promise.all(validFiles.map(async (file) => {
       const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
       });
       
       let attachmentType: 'file' | 'image' = file.type.startsWith('image/') ? 'image' : 'file';
       if (sourceOverride === 'camera') attachmentType = 'image';

       return {
          type: attachmentType,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          data: base64Data,
          sourceType: sourceOverride || 'file',
          uploadStatus: 'idle',
          uploadProgress: 100
       } as Attachment;
    }));
    
    setDraftAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!checkModeAndAttach()) return;

    processSelectedFiles(Array.from(e.dataTransfer.files));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#212121] transition-colors duration-200">
      <input type="file" ref={fileInputRef} className="hidden" accept={ALLOWED_EXTENSIONS_STRING} multiple onChange={(e) => handleFileChange(e, 'file')} />
      <input type="file" ref={imageInputRef} className="hidden" accept={ALLOWED_IMAGE_EXTENSIONS} multiple onChange={(e) => handleFileChange(e, 'image')} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'camera')} />

      <Sidebar 
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={(id) => { setCurrentChatId(id); setIsSidebarOpen(false); }}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRenameChat={handleRenameChat}
        userName={settings.telegramUsername || 'Гость'}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        {!settings.webhookUrl && (
          <div onClick={() => setIsSettingsOpen(true)} className="bg-orange-50 dark:bg-orange-900/30 border-b border-orange-100 dark:border-orange-800 p-2 text-center text-xs md:text-sm text-orange-800 dark:text-orange-200 cursor-pointer absolute w-full top-12 z-20">
            Нажмите настройки чтобы подключить Webhook.
          </div>
        )}
        
        {settings.webhookUrl && !activeTelegramId && (
           <div onClick={() => setIsSettingsOpen(true)} className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 p-2 text-center text-xs md:text-sm text-blue-800 dark:text-blue-200 cursor-pointer absolute w-full top-12 z-20">
             Введите <b>Telegram ID</b> в настройках для сохранения истории.
           </div>
        )}
        
        {/* Offline Mode Warning - Non-intrusive */}
        {isOfflineMode && (
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-1 text-center text-[10px] text-gray-400 absolute w-full top-12 z-10">
                Offline mode: History sync unavailable.
            </div>
        )}

        <div className="h-12 flex items-center justify-between px-4 sticky top-0 bg-white/80 dark:bg-[#212121]/80 backdrop-blur-md z-30 transition-colors">
          <div className="md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#3d3d3d] rounded-md"><IconMenu className="w-5 h-5" /></button>
          </div>
          <div className="relative mx-auto" ref={dropdownRef}>
            <button onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3d3d3d] transition-colors text-sm font-medium text-gray-600 dark:text-gray-300">
              {selectedModel.label} <IconChevronDown className={`w-4 h-4 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isModelDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white dark:bg-[#2d2d2d] rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto">
                <div>{MODEL_OPTIONS.map(model => (
                    <button key={model.id} onClick={() => { setSelectedModelId(model.id); setIsModelDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#3d3d3d] transition-colors flex justify-between items-center ${selectedModelId === model.id ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-[#3d3d3d]' : 'text-gray-600 dark:text-gray-400'}`}>{model.label}{selectedModelId === model.id && <span className="text-gray-900 dark:text-white">✓</span>}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-10 md:w-0"></div>
        </div>

        <div className="flex-1 overflow-y-auto relative scroll-smooth pb-32">
          {!currentChat ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center mb-6 shadow-sm"><IconRobot className="w-8 h-8 text-gray-800 dark:text-gray-200" /></div>
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-12 text-center">Чем я могу вам помочь сегодня?</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {SUGGESTION_CARDS.map((card, idx) => (
                  <button key={idx} onClick={() => handleSendMessage(card.title)} className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2d2d2d] transition-colors">
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">{card.title}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">{card.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8">
              {currentChat.messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
              {isLoading && (
                <div className="flex w-full mb-6 animate-in fade-in duration-300">
                   <div className="w-8 h-8 flex-shrink-0 mr-4 mt-1 flex items-center justify-center"><div className="w-full h-full rounded-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 flex items-center justify-center"><IconRobot className="w-4 h-4 text-gray-800 dark:text-gray-200" /></div></div>
                   <div className="flex-1 min-w-0"><div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl px-4 py-3 border border-gray-100/50 dark:border-gray-700/50 w-fit"><div className="flex items-center space-x-1 h-6"><div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div><div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div><div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div></div></div></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-[#212121] p-4 transition-colors">
          <div className="max-w-3xl mx-auto relative">
            {/* Upload Error Message */}
            {uploadError && (
              <div className="absolute -top-12 left-0 right-0 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs px-4 py-2 rounded-lg border border-red-100 dark:border-red-800 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                {uploadError}
              </div>
            )}

            {/* Main Input Container */}
            <div className="flex items-end gap-3">
                
                {/* Plus Button Wrapper */}
                <div className="relative flex-shrink-0" ref={plusMenuRef}>
                    {/* Floating Menu - Expanded width (w-80) */}
                    {isPlusMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-3 w-80 bg-white dark:bg-[#2d2d2d] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50 origin-bottom-left">
                            <button 
                                onClick={() => { setActiveMode(activeMode === 'websearch' ? null : 'websearch'); setIsPlusMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-3 text-sm rounded-xl transition-all ${activeMode === 'websearch' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d]'}`}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0">
                                    <IconGlobe className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-left">веб-поиск</span>
                            </button>
                            
                            <button 
                                onClick={() => { setActiveMode(activeMode === 'deepresearch' ? null : 'deepresearch'); setIsPlusMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-3 text-sm rounded-xl transition-all mt-1 ${activeMode === 'deepresearch' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d]'}`}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0">
                                    <IconSparkles className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-left">глубокое исследование</span>
                            </button>
                        </div>
                    )}

                    {/* Circular Plus Button */}
                    <button 
                        onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                        className={`w-10 h-10 rounded-full bg-white dark:bg-[#2F2F2F] border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:scale-105 active:scale-95 transition-all duration-200 ${isPlusMenuOpen ? 'ring-2 ring-gray-200 dark:ring-gray-600' : ''}`}
                    >
                        <IconPlus className={`w-5 h-5 transition-transform duration-200 ${isPlusMenuOpen ? 'rotate-45' : ''}`} />
                    </button>
                </div>

                {/* Input Box Container */}
                <div 
                    className={`flex-1 bg-white dark:bg-[#2F2F2F] border shadow-sm rounded-2xl transition-all focus-within:shadow-md relative flex flex-col ${uploadError ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-700 focus-within:border-gray-300 dark:focus-within:border-gray-600'} ${isDragging ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/90 dark:bg-[#2F2F2F]/90 backdrop-blur-sm rounded-2xl border-2 border-blue-500 border-dashed animate-in fade-in duration-200 pointer-events-none">
                        <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2"><IconFile className="w-5 h-5" /><span>Отпустите файлы здесь</span></div>
                        </div>
                    )}

                    {/* Mode Pill */}
                    {activeMode && (
                        <div className="px-3 pt-3 pb-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full text-xs font-medium border border-blue-100 dark:border-blue-800/50">
                                {activeMode === 'websearch' ? <IconGlobe className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
                                <span>{activeMode === 'websearch' ? 'веб-поиск' : 'глубокое исследование'}</span>
                                <button onClick={() => setActiveMode(null)} className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5 ml-1 transition-colors">
                                    <IconX className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
              
                    {/* Draft Attachments */}
                    {draftAttachments.length > 0 && (
                        <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center bg-gray-50/50 dark:bg-[#2d2d2d] rounded-t-2xl overflow-x-auto gap-3 scrollbar-hide">
                        {draftAttachments.map((att, index) => (
                            <div key={index} className="flex-shrink-0 relative group">
                                <div className="flex items-center gap-2 bg-white dark:bg-[#3d3d3d] border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-sm pr-8 relative overflow-hidden">
                                {att.type === 'image' && att.data ? <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0"><img src={att.data} alt="preview" className="w-full h-full object-cover" /></div> : <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0"><IconFile className="w-4 h-4 text-gray-500 dark:text-gray-400" /></div>}
                                <div className="max-w-[120px]"><div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate" title={att.name}>{att.name}</div><div className="text-[10px] text-gray-400 dark:text-gray-500">{(att.size ? (att.size / 1024).toFixed(1) + ' KB' : '')}</div></div>
                                </div>
                                <button onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== index))} className="absolute -top-1 -right-1 bg-white dark:bg-[#3d3d3d] border border-gray-200 dark:border-gray-600 rounded-full p-1 text-gray-400 hover:text-red-500 shadow-sm transition-colors z-10"><IconX className="w-3 h-3" /></button>
                            </div>
                        ))}
                        </div>
                    )}

                    <div className="flex items-end px-3 py-3 w-full">
                        {/* Attachment Button */}
                        <div className="relative" ref={attachmentMenuRef}>
                        <button onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)} className={`p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-[#3d3d3d] mb-[2px] ${activeMode ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!!activeMode}><IconPaperclip className="w-5 h-5" /></button>
                        {isAttachmentMenuOpen && !activeMode && (
                            <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-[#2d2d2d] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-1 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                            <button onClick={() => handleMenuOptionClick('file')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left"><div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0"><IconFile className="w-4 h-4 text-gray-600 dark:text-gray-400" /></div>Добавить файл</button>
                            <button onClick={() => handleMenuOptionClick('image')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left"><div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0"><IconImage className="w-4 h-4 text-gray-600 dark:text-gray-400" /></div>Добавить изображение</button>
                            <button onClick={() => handleMenuOptionClick('camera')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] rounded-lg transition-colors text-left md:hidden"><div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center flex-shrink-0"><IconCamera className="w-4 h-4 text-gray-600 dark:text-gray-400" /></div>Сделать снимок</button>
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 px-3 pb-2"><p className="text-[10px] text-gray-400 leading-tight">Допустимые типы файлов: PDF, MD, TXT, DOC, XLS, JPG, PNG, GIF. Max 10MB. 5 files max.</p></div>
                            </div>
                        )}
                        </div>
                        
                        <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder={isDragging ? "Отпустите файлы здесь" : "Спросите о чем угодно"} className="flex-1 max-h-48 min-h-[24px] bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none py-2 px-2 text-sm md:text-base mx-1 outline-none" rows={1} style={{ height: 'auto', overflow: 'hidden' }} />

                        <button onClick={() => handleSendMessage()} disabled={(!inputMessage.trim() && draftAttachments.length === 0) || isLoading} className={`p-2 rounded-lg transition-all duration-200 mb-[2px] ${(inputMessage.trim() || draftAttachments.length > 0) && !isLoading ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200' : 'bg-gray-100 dark:bg-[#3d3d3d] text-gray-300 dark:text-gray-500 cursor-not-allowed'}`}><IconSend className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
            <div className="text-center mt-2"><p className="text-[10px] text-gray-400">Это разработка компании Призма AI. ИИ может делать ошибки. Пожалуйста, проверьте важную информацию.</p></div>
          </div>
        </div>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentSettings={settings} onSave={setSettings} />
    </div>
  );
};

export default App;