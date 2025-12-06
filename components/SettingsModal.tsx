import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import { IconX, IconSun, IconMoon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: Settings;
  onSave: (settings: Settings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave
}) => {
  const [formData, setFormData] = useState<Settings>(currentSettings);

  useEffect(() => {
    if (isOpen) {
      setFormData(currentSettings);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTheme = () => {
    setFormData(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Настройки</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Тема оформления</label>
            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-[#2d2d2d] rounded-lg w-fit">
              <button
                onClick={() => setFormData(prev => ({ ...prev, theme: 'light' }))}
                className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm ${
                  formData.theme !== 'dark' 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <IconSun className="w-4 h-4" />
                <span>Светлая</span>
              </button>
              <button
                onClick={() => setFormData(prev => ({ ...prev, theme: 'dark' }))}
                className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm ${
                  formData.theme === 'dark' 
                    ? 'bg-[#3d3d3d] shadow-sm text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <IconMoon className="w-4 h-4" />
                <span>Темная</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">webhook</label>
            <input
              type="text"
              name="webhookUrl"
              value={formData.webhookUrl}
              onChange={handleChange}
              placeholder="https://prismaar.store/webhook/..."
              className="w-full px-3 py-2.5 bg-[#F3F4F6] dark:bg-[#2d2d2d] border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-[#3d3d3d] focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none transition-all placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Пожалуйста, введите адрес вашего вебхука.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Имя пользователя</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-[#F3F4F6] dark:bg-[#2d2d2d] border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-[#3d3d3d] focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Пароль</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-[#F3F4F6] dark:bg-[#2d2d2d] border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-[#3d3d3d] focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Имя</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-[#F3F4F6] dark:bg-[#2d2d2d] border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-[#3d3d3d] focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Имя пользователя в Telegram</label>
            <input
              type="text"
              name="telegramUsername"
              value={formData.telegramUsername}
              onChange={handleChange}
              placeholder="Пользователь"
              className="w-full px-3 py-2.5 bg-[#F3F4F6] dark:bg-[#2d2d2d] border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-[#3d3d3d] focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none transition-all"
            />
          </div>

        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-white dark:bg-[#1e1e1e]">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;