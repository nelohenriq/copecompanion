'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Eye, EyeOff, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';

interface UserPreferences {
  tone?: string;
  communicationStyle?: string;
  preferredTopics: string[];
  avoidedTopics: string[];
  personalizationEnabled: boolean;
  dataSharingConsent: boolean;
}

interface ConversationPatterns {
  commonTopics: string[];
  emotionalTone: string;
  responseLength: string;
  communicationStyle: string;
}

interface PersonalizationData {
  preferences: UserPreferences;
  patterns: ConversationPatterns;
  recommendations: any[];
}

export default function PersonalizationSettingsPage() {
  const [data, setData] = useState<PersonalizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newAvoidedTopic, setNewAvoidedTopic] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadPersonalizationData();
  }, []);

  const loadPersonalizationData = async () => {
    try {
      const response = await fetch('/api/personalization');
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to load personalization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/personalization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Reload data to reflect changes
        await loadPersonalizationData();
      } else {
        console.error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const addPreferredTopic = () => {
    if (newTopic.trim() && data) {
      const updatedTopics = [...data.preferences.preferredTopics, newTopic.trim()];
      updatePreferences({ preferredTopics: updatedTopics });
      setNewTopic('');
    }
  };

  const removePreferredTopic = (topic: string) => {
    if (data) {
      const updatedTopics = data.preferences.preferredTopics.filter(t => t !== topic);
      updatePreferences({ preferredTopics: updatedTopics });
    }
  };

  const addAvoidedTopic = () => {
    if (newAvoidedTopic.trim() && data) {
      const updatedTopics = [...data.preferences.avoidedTopics, newAvoidedTopic.trim()];
      updatePreferences({ avoidedTopics: updatedTopics });
      setNewAvoidedTopic('');
    }
  };

  const removeAvoidedTopic = (topic: string) => {
    if (data) {
      const updatedTopics = data.preferences.avoidedTopics.filter(t => t !== topic);
      updatePreferences({ avoidedTopics: updatedTopics });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">Failed to load personalization settings</p>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Personalization Settings</h1>
          </div>
          <p className="text-gray-600">
            Customize how the AI assistant interacts with you. Your preferences help create a more personalized and supportive experience.
          </p>
        </div>

        <div className="space-y-6">
          {/* Privacy Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your personalization data is stored securely and never shared without your explicit consent.
              You can disable personalization at any time.
            </AlertDescription>
          </Alert>

          {/* Personalization Toggle */}
          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="personalization-enabled" className="text-base font-medium">
                    Enable Personalization
                  </Label>
                  <p className="text-sm text-gray-600">
                    Allow the AI to adapt responses based on your conversation patterns and preferences
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="personalization-enabled"
                  checked={data.preferences.personalizationEnabled}
                  onChange={(e) => updatePreferences({ personalizationEnabled: e.target.checked })}
                  disabled={saving}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="data-sharing" className="text-base font-medium">
                    Data Sharing Consent
                  </Label>
                  <p className="text-sm text-gray-600">
                    Allow anonymized data to improve AI responses (optional)
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="data-sharing"
                  checked={data.preferences.dataSharingConsent}
                  onChange={(e) => updatePreferences({ dataSharingConsent: e.target.checked })}
                  disabled={saving}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Communication Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Communication Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tone" className="text-base font-medium">
                  Preferred Tone
                </Label>
                <select
                  id="tone"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={data.preferences.tone || ''}
                  onChange={(e) => updatePreferences({ tone: e.target.value || undefined })}
                  disabled={saving || !data.preferences.personalizationEnabled}
                >
                  <option value="">Default</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="supportive">Supportive</option>
                  <option value="direct">Direct</option>
                </select>
              </div>

              <div>
                <Label htmlFor="style" className="text-base font-medium">
                  Communication Style
                </Label>
                <select
                  id="style"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={data.preferences.communicationStyle || ''}
                  onChange={(e) => updatePreferences({ communicationStyle: e.target.value || undefined })}
                  disabled={saving || !data.preferences.personalizationEnabled}
                >
                  <option value="">Default</option>
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                  <option value="empathetic">Empathetic</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Topic Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Topic Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preferred Topics */}
              <div>
                <Label className="text-base font-medium">Preferred Topics</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Topics you'd like the AI to focus on in conversations
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add a preferred topic..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPreferredTopic()}
                    disabled={saving || !data.preferences.personalizationEnabled}
                  />
                  <Button
                    onClick={addPreferredTopic}
                    disabled={!newTopic.trim() || saving || !data.preferences.personalizationEnabled}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.preferences.preferredTopics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="flex items-center gap-1">
                      {topic}
                      <button
                        onClick={() => removePreferredTopic(topic)}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                        disabled={saving}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Avoided Topics */}
              <div>
                <Label className="text-base font-medium">Topics to Avoid</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Topics you'd prefer not to discuss
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add a topic to avoid..."
                    value={newAvoidedTopic}
                    onChange={(e) => setNewAvoidedTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAvoidedTopic()}
                    disabled={saving || !data.preferences.personalizationEnabled}
                  />
                  <Button
                    onClick={addAvoidedTopic}
                    disabled={!newAvoidedTopic.trim() || saving || !data.preferences.personalizationEnabled}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.preferences.avoidedTopics.map((topic) => (
                    <Badge key={topic} variant="outline" className="flex items-center gap-1">
                      {topic}
                      <button
                        onClick={() => removeAvoidedTopic(topic)}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                        disabled={saving}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversation Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Your Conversation Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Common Topics</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.patterns.commonTopics.map((topic) => (
                      <Badge key={topic} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Emotional Tone</Label>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{data.patterns.emotionalTone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Response Length</Label>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{data.patterns.responseLength}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Communication Style</Label>
                  <p className="text-sm text-sm text-gray-600 mt-1 capitalize">{data.patterns.communicationStyle}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => router.push('/chat')}
              variant="outline"
            >
              Back to Chat
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}