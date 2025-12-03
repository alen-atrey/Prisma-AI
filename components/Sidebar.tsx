import React, { useMemo, useState } from 'react';
import { Chat } from '../types';
import { IconPlus, IconSettings, IconUser, IconPencil, IconSearch } from './Icons';

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onOpenSettings,
  onRenameChat,
  userName,
  isOpen,
  onClose
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const lowerQuery = searchQuery.toLowerCase();
    return chats.filter(chat =>
      chat.title.toLowerCase().includes(lowerQuery) ||
      chat.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    );
  }, [chats, searchQuery]);

  const groupedChats = useMemo<{ [key: string]: Chat[] }>(() => {
    const groups: { [key: string]: Chat[] } = {
      'Сегодня': [],
      'Вчера': [],
      'За 7 дней': [],
      'За месяц': [],
      'Ранее': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(today - 86400000).getTime();
    const lastWeek = new Date(today - 86400000 * 7).getTime();
    const lastMonth = new Date(today - 86400000 * 30).getTime();

    filteredChats.forEach(chat => {
      const chatTime = new Date(chat.date).getTime();
      if (chatTime >= today) groups['Сегодня'].push(chat);
      else if (chatTime >= yesterday) groups['Вчера'].push(chat);
      else if (chatTime >= lastWeek) groups['За 7 дней'].push(chat);
      else if (chatTime >= lastMonth) groups['За месяц'].push(chat);
      else groups['Ранее'].push(chat);
    });

    return groups;
  }, [filteredChats]);

  const startEditing = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const saveTitle = () => {
    if (editingChatId && editTitle.trim()) {
      onRenameChat(editingChatId, editTitle.trim());
    }
    setEditingChatId(null);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-[260px] bg-[#f9f9f9] dark:bg-[#171717] border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative
      `}>
        {/* Header area */}
        <div className="p-3 space-y-3">
          {/* Logo - Custom Font Text (Russian) */}
          <div className="h-10 px-2 flex items-center justify-start mb-2 pt-1">
            <span className="font-druzhok text-[2rem] text-[#231f20] dark:text-gray-200 leading-none">Prisma AI</span>
          </div>

          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#212121] hover:bg-gray-50 dark:hover:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors shadow-sm group"
          >
            <IconPlus className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
            <span>Новый чат</span>
          </button>

          <div className="relative">
             <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input
               type="text"
               placeholder="Поиск..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#212121] border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
             />
           </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {Object.entries(groupedChats).map(([label, groupChats]) => {
            const chats = groupChats as Chat[];
            return chats.length > 0 && (
              <div key={label}>
                <div className="px-3 text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">{label}</div>
                <div className="space-y-0.5">
                  {chats.map(chat => {
                    const isEditing = editingChatId === chat.id;
                    const isActive = currentChatId === chat.id;

                    if (isEditing) {
                      return (
                        <div key={chat.id} className="px-3 py-2">
                           <input
                               autoFocus
                               type="text"
                               value={editTitle}
                               onChange={(e) => setEditTitle(e.target.value)}
                               onBlur={saveTitle}
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter') saveTitle();
                                   if (e.key === 'Escape') setEditingChatId(null);
                               }}
                               className="w-full bg-white dark:bg-[#212121] border border-blue-500 rounded px-2 py-0.5 text-sm outline-none shadow-sm text-gray-800 dark:text-gray-200"
                           />
                        </div>
                      );
                    }

                    return (
                      <div key={chat.id} className="relative group">
                        <button
                          onClick={() => {
                            onSelectChat(chat.id);
                            if (window.innerWidth < 768) onClose();
                          }}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors pr-8
                            ${isActive ? 'bg-[#e5e5e5] dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-[#eaeaea] dark:hover:bg-[#212121]'}
                          `}
                        >
                          {chat.title}
                        </button>
                        {isActive && (
                           <button
                             onClick={(e) => startEditing(chat, e)}
                             className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-opacity"
                             title="Редактировать название"
                           >
                              <IconPencil className="w-3.5 h-3.5" />
                           </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {/* No results state */}
          {Object.values(groupedChats).every((group: Chat[]) => group.length === 0) && searchQuery && (
             <div className="px-3 text-center text-gray-400 text-sm py-4">
                Ничего не найдено
             </div>
          )}
        </div>

        {/* User Profile */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#212121] transition-colors cursor-pointer group" onClick={onOpenSettings}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                <IconUser className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{userName}</span>
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
               <IconSettings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;