import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId?: string;
  isConnected: boolean;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  onSendMessage,
  currentUserId,
  isConnected,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && isConnected) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="apple-card flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-[17px] text-gray-900">
          Chat
          <span className="ml-2 text-sm font-normal text-gray-500">
            {messages.length} messages
          </span>
        </h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white rounded-2xl rounded-tr-sm'
                      : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm'
                  } px-4 py-2`}
                >
                  {!isOwnMessage && (
                    <p className="text-xs font-medium mb-1 text-gray-600">
                      {msg.username}
                    </p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            className="apple-input flex-1"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="apple-button-primary w-10 h-10 rounded-full flex items-center justify-center p-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};