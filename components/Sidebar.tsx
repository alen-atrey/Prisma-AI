import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Chat, Project } from '../types';
import { IconPlus, IconSettings, IconUser, IconPencil, IconSearch, IconFolder, IconDotsHorizontal, IconTrash, IconEdit, IconClear } from './Icons';

interface SidebarProps {
  chats: Chat[];
  projects: Project[];
  activeProjectId: string | null;
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onCreateProject: (name: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onClearProjectChats: (projectId: string) => void;
  onMoveChatToProject: (chatId: string, projectId: string | null) => void;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  projects,
  activeProjectId,
  currentChatId,
  onSelectChat,
  onNewChat,
  onOpenSettings,
  onRenameChat,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  onClearProjectChats,
  onMoveChatToProject,
  userName,
  isOpen,
  onClose
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Project State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');

  // Drag and Drop State
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);

  // Refs for click outside
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
              setOpenProjectMenuId(null);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);


  const filteredChats = useMemo(() => {
    let relevantChats = chats;
    if (activeProjectId) {
        relevantChats = chats.filter(c => c.project_id === activeProjectId);
    } else {
        // Default view: Show chats that are NOT in a project
        relevantChats = chats.filter(c => !c.project_id);
    }

    if (!searchQuery.trim()) return relevantChats;
    const lowerQuery = searchQuery.toLowerCase();
    return relevantChats.filter(chat =>
      chat.title.toLowerCase().includes(lowerQuery) ||
      chat.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    );
  }, [chats, searchQuery, activeProjectId]);

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

  // Project Handlers
  const handleProjectCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newProjectName.trim()) {
          onCreateProject(newProjectName.trim());
          setNewProjectName('');
          setIsCreatingProject(false);
      }
  };

  const handleProjectRenameSubmit = () => {
      if (editingProjectId && editProjectName.trim()) {
          onRenameProject(editingProjectId, editProjectName.trim());
          setEditingProjectId(null);
          setOpenProjectMenuId(null);
      }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, chatId: string) => {
      setDraggedChatId(chatId);
      e.dataTransfer.setData('text/plain', chatId);
      // Optional: Add drag image or style
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
  };

  const handleDropOnProject = (e: React.DragEvent, projectId: string | null) => {
      e.preventDefault();
      const chatId = draggedChatId || e.dataTransfer.getData('text/plain');
      if (chatId) {
          onMoveChatToProject(chatId, projectId);
      }
      setDraggedChatId(null);
  };

  // Find the currently open project for the menu
  const openProject = projects.find(p => p.id === openProjectMenuId);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}

      <div className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#f9f9f9] dark:bg-[#171717] border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative`}>
        {/* Header area */}
        <div className="p-3 space-y-3">
          <div className="h-10 px-2 flex items-center justify-start mb-2 pt-1">
             {!logoError ? (
              <img 
                src="/assets/logo.png" 
                alt="Prisma AI" 
                className="h-10 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="font-druzhok text-[2rem] text-[#231f20] dark:text-gray-200 leading-none">Prisma AI</span>
            )}
          </div>

          <button onClick={() => { onNewChat(); if (window.innerWidth < 768) onClose(); }} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#212121] hover:bg-gray-50 dark:hover:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg transition-colors shadow-sm group">
            <IconPlus className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
            <span>Новый чат</span>
          </button>

          <div className="relative">
             <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#212121] border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100" />
           </div>
        </div>

        {/* Projects Section */}
        <div className="px-3 pb-2 pt-0">
             <div className="flex items-center justify-between mb-1 px-2">
                 <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Проекты</h3>
             </div>
             
             <button onClick={() => setIsCreatingProject(true)} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d2d2d] rounded-lg transition-colors mb-2">
                 <IconPlus className="w-4 h-4" />
                 <span>Новый проект</span>
             </button>

             {isCreatingProject && (
                 <form onSubmit={handleProjectCreateSubmit} className="mb-2 px-1">
                     <input 
                        autoFocus
                        type="text" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onBlur={() => { if(!newProjectName) setIsCreatingProject(false); }}
                        placeholder="Название проекта..."
                        className="w-full bg-white dark:bg-[#212121] border border-blue-500 rounded px-2 py-1 text-sm outline-none shadow-sm text-gray-800 dark:text-gray-200"
                     />
                 </form>
             )}

             <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 scrollbar-hide relative">
                 <button
                    onClick={() => onSelectProject(null)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnProject(e, null)}
                    className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors text-left ${activeProjectId === null ? 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#212121]'}`}
                 >
                    <IconFolder className="w-4 h-4 opacity-50" />
                    <span className="truncate">Все чаты</span>
                 </button>

                 {projects.map(project => (
                     <div key={project.id} className="relative group" onDragOver={handleDragOver} onDrop={(e) => handleDropOnProject(e, project.id)}>
                         {editingProjectId === project.id ? (
                            <input 
                                autoFocus
                                type="text"
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                                onBlur={handleProjectRenameSubmit}
                                onKeyDown={(e) => { if(e.key === 'Enter') handleProjectRenameSubmit(); }}
                                className="w-full bg-white dark:bg-[#212121] border border-blue-500 rounded px-2 py-1.5 text-sm outline-none shadow-sm text-gray-800 dark:text-gray-200 mx-1"
                            />
                         ) : (
                            <button
                                onClick={() => onSelectProject(project.id)}
                                className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors text-left pr-8 ${activeProjectId === project.id ? 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#212121]'}`}
                            >
                                <IconFolder className={`w-4 h-4 ${activeProjectId === project.id ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`} />
                                <span className="truncate">{project.name}</span>
                            </button>
                         )}

                         {/* Context Menu Trigger */}
                         {!editingProjectId && (
                             <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition({ top: rect.bottom, left: rect.left - 120 });
                                    setOpenProjectMenuId(openProjectMenuId === project.id ? null : project.id); 
                                }}
                                className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-opacity ${openProjectMenuId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                             >
                                <IconDotsHorizontal className="w-4 h-4" />
                             </button>
                         )}
                     </div>
                 ))}
             </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {Object.values(groupedChats).every(g => g.length === 0) ? (
              <div className="px-3 text-center text-gray-400 text-xs py-8">
                  {activeProjectId ? 'В этом проекте нет чатов' : 'История чатов пуста'}
              </div>
          ) : (
             Object.entries(groupedChats).map(([label, groupChats]) => {
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
                        <div 
                            key={chat.id} 
                            className="relative group"
                            draggable
                            onDragStart={(e) => handleDragStart(e, chat.id)}
                        >
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
            })
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
        
        {/* Project Context Menu */}
        {openProjectMenuId && openProject && (
            <div 
                ref={projectMenuRef} 
                className="fixed w-40 bg-white dark:bg-[#2d2d2d] rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-[60] animate-in fade-in zoom-in-95 duration-100"
                style={{ top: menuPosition.top, left: menuPosition.left }}
            >
                 <button 
                    onClick={(e) => { e.stopPropagation(); setEditingProjectId(openProject.id); setEditProjectName(openProject.name); setOpenProjectMenuId(null); }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] flex items-center gap-2"
                 >
                     <IconEdit className="w-3 h-3" /> Переименовать
                 </button>
                 <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(openProject.id); setOpenProjectMenuId(null); }}
                    className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                 >
                     <IconTrash className="w-3 h-3" /> Удалить папку
                 </button>
             </div>
         )}
      </div>
    </>
  );
};

export default Sidebar;