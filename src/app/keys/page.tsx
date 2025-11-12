'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

interface APIKey {
  id: string;
  name: string;
  service: string;
  createdAt: Date;
  lastUsed?: Date;
  status: 'active' | 'inactive' | 'expired';
  permissions: string[];
}

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'OpenAI Integration',
      service: 'openai',
      createdAt: new Date('2024-01-15'),
      lastUsed: new Date('2024-12-10'),
      status: 'active',
      permissions: ['chat', 'completions']
    },
    {
      id: '2',
      name: 'Anthropic Claude',
      service: 'anthropic',
      createdAt: new Date('2024-02-01'),
      lastUsed: new Date('2024-12-09'),
      status: 'active',
      permissions: ['chat', 'analysis']
    }
  ]);

  const [showKey, setShowKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyService, setNewKeyService] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateKey = async () => {
    if (!newKeyName || !newKeyService) return;

    setIsCreating(true);
    try {
      // In a real app, this would call the API
      const newKey: APIKey = {
        id: Date.now().toString(),
        name: newKeyName,
        service: newKeyService,
        createdAt: new Date(),
        status: 'active',
        permissions: ['read']
      };

      setKeys(prev => [...prev, newKey]);
      setNewKeyName('');
      setNewKeyService('');
    } catch (error) {
      console.error('Failed to create key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    setKeys(prev => prev.filter(k => k.id !== keyId));
  };

  const handleCopyKey = (keyId: string) => {
    // In a real app, this would copy the actual key value
    navigator.clipboard.writeText(`sk-${keyId}-fake-key-for-demo`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Key className="h-8 w-8" />
              API Keys Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your API keys for external services</p>
          </div>
        </div>

        {/* Security Notice */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> API keys provide access to external services.
            Keep them secure and never share them publicly. Rotate keys regularly for security.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList>
            <TabsTrigger value="manage">Manage Keys</TabsTrigger>
            <TabsTrigger value="create">Create New Key</TabsTrigger>
            <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-6">
            <div className="grid gap-4">
              {keys.map((key) => (
                <Card key={key.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {key.name}
                          <Badge className={getStatusColor(key.status)}>
                            {key.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Service: {key.service} • Created: {key.createdAt.toLocaleDateString()}
                          {key.lastUsed && ` • Last used: ${key.lastUsed.toLocaleDateString()}`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                        >
                          {showKey === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyKey(key.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {showKey === key.id && (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <Label className="text-sm font-medium">API Key:</Label>
                          <div className="font-mono text-sm mt-1">
                            sk-{key.id}-fake-key-for-demo
                          </div>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm font-medium">Permissions:</Label>
                        <div className="flex gap-2 mt-1">
                          {key.permissions.map((permission) => (
                            <Badge key={permission} variant="secondary">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Status: <Badge className={getStatusColor(key.status)}>{key.status}</Badge></span>
                        <span>Created: {key.createdAt.toLocaleDateString()}</span>
                        {key.lastUsed && <span>Last used: {key.lastUsed.toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {keys.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys found</h3>
                    <p className="text-gray-600 mb-4">Create your first API key to get started</p>
                    <Button onClick={() => (document.querySelector('[value="create"]') as HTMLElement)?.click()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create API Key
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New API Key</CardTitle>
                <CardDescription>
                  Generate a new API key for external service integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., OpenAI Integration"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keyService">Service</Label>
                    <Input
                      id="keyService"
                      placeholder="e.g., openai, anthropic"
                      value={newKeyService}
                      onChange={(e) => setNewKeyService(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Available Services</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['openai', 'anthropic', 'google', 'azure', 'aws', 'custom'].map((service) => (
                      <Button
                        key={service}
                        variant={newKeyService === service ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewKeyService(service)}
                        className="capitalize"
                      >
                        {service}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleCreateKey}
                    disabled={!newKeyName || !newKeyService || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create API Key
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewKeyName('');
                      setNewKeyService('');
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Regular Rotation</h4>
                    <p className="text-sm text-gray-600">Rotate API keys every 90 days or immediately if compromised</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Minimal Permissions</h4>
                    <p className="text-sm text-gray-600">Grant only the minimum permissions required for each service</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Secure Storage</h4>
                    <p className="text-sm text-gray-600">Store keys in environment variables, never in code or version control</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Usage Statistics</CardTitle>
                  <CardDescription>API key usage over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {keys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-gray-600">{key.service}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">1,234</p>
                          <p className="text-sm text-gray-600">requests</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Alerts</CardTitle>
                  <CardDescription>Recent security events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        All API keys are up to date and secure
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}