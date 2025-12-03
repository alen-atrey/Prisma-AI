import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Attachment } from '../types';
import { IconCopy, IconUser, IconRobot, IconFile } from './Icons';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isAi = message.role === 'ai';
  const [copied, setCopied] = useState(false);

  // Normalize attachments to an array for unified rendering
  const attachments: Attachment[] = message.attachments || (message.attachment ? [message.attachment] : []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`flex w-full ${isAi ? 'mb-8' : 'mb-6'}`}>
      <div className="w-8 h-8 flex-shrink-0 mr-4 mt-1 flex items-center justify-center">
        {isAi ? (
          <div className="w-full h-full rounded-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 flex items-center justify-center">
             <IconRobot className="w-4 h-4 text-gray-800 dark:text-gray-200" />
          </div>
        ) : (
          <div className="w-full h-full rounded-full bg-gray-100 dark:bg-[#3d3d3d] flex items-center justify-center">
             <IconUser className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {isAi ? 'ChatGPT' : 'Вы'}
          </span>
          <span className="text-xs text-gray-400">
            {message.timestamp}
          </span>
        </div>

        <div className={`text-gray-800 dark:text-gray-200 leading-relaxed ${isAi ? 'bg-gray-50 dark:bg-[#2d2d2d] rounded-xl px-4 py-3 border border-gray-100/50 dark:border-gray-700/50' : ''}`}>
           {/* Attachment Rendering */}
           {attachments.length > 0 && (
             <div className="mb-3 flex flex-wrap gap-2">
               {attachments.map((att, index) => (
                 <div key={index} className="max-w-xs md:max-w-sm">
                    {att.type === 'image' && att.data ? (
                      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                        <img 
                          src={att.data} 
                          alt={att.name} 
                          className="w-full h-auto max-h-[300px] object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#3d3d3d] border border-gray-200 dark:border-gray-700 rounded-lg min-w-[200px]">
                        <div className="w-10 h-10 bg-white dark:bg-[#2d2d2d] rounded-lg flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-600 flex-shrink-0">
                          <IconFile className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={att.name}>
                            {att.name}
                          </div>
                          {att.size && (
                            <div className="text-xs text-gray-400">
                              {formatFileSize(att.size)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                 </div>
               ))}
             </div>
           )}

           <div className="prose prose-sm dark:prose-invert max-w-none">
             {/* Note: ReactMarkdown requires installation: npm install react-markdown remark-gfm */}
             <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({node, ...props}) => <pre className="overflow-auto w-full my-2 bg-gray-800 text-white rounded-md p-3" {...props} />,
                  code: ({node, ...props}) => <code className="bg-gray-200/50 dark:bg-gray-700/50 text-red-500 dark:text-red-400 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
                  table: ({node, ...props}) => <div className="overflow-x-auto my-4 border border-gray-200 dark:border-gray-700 rounded-lg"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props} /></div>,
                  th: ({node, ...props}) => <th className="bg-gray-50 dark:bg-[#3d3d3d] px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props} />,
                  td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                }}
             >
               {message.content}
             </ReactMarkdown>
           </div>
        </div>

        {isAi && (
          <div className="mt-2 flex items-center gap-2">
            <button 
              onClick={handleCopy}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#2d2d2d]"
              title="Копировать"
            >
              <IconCopy className="w-4 h-4" />
            </button>
            {copied && <span className="text-xs text-gray-500 animate-fade-in">Скопировано</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;