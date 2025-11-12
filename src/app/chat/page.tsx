'use client';

import { useState } from 'react';
import { ChatInterface, useChatMessages } from '@/components/chat/ChatInterface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Settings } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function ChatPage() {
  const [isConnected, setIsConnected] = useState(false);
  const { messages, addUserMessage, addAssistantMessage, updateMessage } = useChatMessages();

  const handleSendMessage = async (message: string) => {
    // Add user message immediately
    addUserMessage(message);

    try {
      // Call the chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          // conversationId will be handled by the API
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (data.success) {
        // Add assistant message
        addAssistantMessage(data.data.message);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      addAssistantMessage('Sorry, I encountered an error. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Chat Assistant</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl">
            Have a supportive conversation with our AI assistant. Your conversations are private and secure.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span>Conversation</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-500">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  disabled={!isConnected}
                  className="border-0 shadow-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Connection Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Service</span>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  <Button
                    onClick={() => setIsConnected(!isConnected)}
                    variant={isConnected ? 'destructive' : 'default'}
                    size="sm"
                    className="w-full"
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    New Conversation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Safety Notice */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Safety First</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600">
                  This AI is designed to provide supportive conversations. If you're experiencing a crisis,
                  please reach out to a mental health professional or call emergency services.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}