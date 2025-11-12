'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessageComponent, ChatMessage } from './ChatMessage';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  className?: string;
  onSendMessage?: (message: string) => Promise<void>;
  messages?: ChatMessage[];
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInterface({
  className,
  onSendMessage,
  messages: externalMessages = [],
  isLoading = false,
  disabled = false,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(externalMessages);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending || disabled) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      if (onSendMessage) {
        await onSendMessage(userMessage.content);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addAssistantMessage = (content: string, isStreaming = false) => {
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      content,
      role: 'assistant',
      timestamp: new Date(),
      isStreaming,
    };
    setMessages(prev => [...prev, assistantMessage]);
    return assistantMessage.id;
  };

  const updateMessage = (messageId: string, content: string, isStreaming = false) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content, isStreaming }
          : msg
      )
    );
  };

  return (
    <Card className={cn('flex flex-col h-full max-h-[600px]', className)}>
      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto max-h-96">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="text-lg mb-2">Welcome to your AI conversation!</p>
              <p className="text-sm">Start by typing a message below.</p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessageComponent key={message.id} message={message} />
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={disabled || isSending}
            className="flex-1"
            aria-label="Chat message input"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending || disabled}
            size="icon"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {disabled && (
          <p className="text-xs text-gray-500 mt-2">
            Chat is currently disabled. Please check your API key configuration.
          </p>
        )}
      </div>
    </Card>
  );
}

// Export utilities for external message management
export const useChatMessages = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addUserMessage = (content: string) => {
    const message: ChatMessage = {
      id: `user-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
    return message.id;
  };

  const addAssistantMessage = (content: string, isStreaming = false) => {
    const message: ChatMessage = {
      id: `assistant-${Date.now()}`,
      content,
      role: 'assistant',
      timestamp: new Date(),
      isStreaming,
    };
    setMessages(prev => [...prev, message]);
    return message.id;
  };

  const updateMessage = (messageId: string, content: string, isStreaming = false) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content, isStreaming }
          : msg
      )
    );
  };

  return {
    messages,
    addUserMessage,
    addAssistantMessage,
    updateMessage,
    setMessages,
  };
};