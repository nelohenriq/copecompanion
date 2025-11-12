'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accessibility,
  CheckCircle,
  AlertTriangle,
  Eye,
  Volume2,
  MousePointer,
  Keyboard,
  Monitor,
  Smartphone,
  Palette,
  Type,
  Zap
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function AccessibilityPage() {
  const accessibilityFeatures = [
    {
      category: 'Visual',
      icon: Eye,
      features: [
        { name: 'High Contrast Mode', status: 'available', description: 'Enhanced contrast for better visibility' },
        { name: 'Font Size Adjustment', status: 'available', description: 'Scale text from 100% to 200%' },
        { name: 'Color Blind Support', status: 'available', description: 'Color schemes for different types of color blindness' },
        { name: 'Screen Reader Compatible', status: 'available', description: 'Full compatibility with NVDA, JAWS, VoiceOver' },
        { name: 'Focus Indicators', status: 'available', description: 'Clear visual focus indicators for keyboard navigation' }
      ]
    },
    {
      category: 'Motor',
      icon: MousePointer,
      features: [
        { name: 'Keyboard Navigation', status: 'available', description: 'Complete navigation without mouse' },
        { name: 'Voice Commands', status: 'planned', description: 'Voice-activated interface controls' },
        { name: 'Switch Control', status: 'planned', description: 'Single-switch accessibility' },
        { name: 'Touch Targets', status: 'available', description: 'Minimum 44px touch targets' },
        { name: 'Reduced Motion', status: 'available', description: 'Minimize animations and transitions' }
      ]
    },
    {
      category: 'Cognitive',
      icon: Monitor,
      features: [
        { name: 'Simplified Interface', status: 'available', description: 'Clean, uncluttered design' },
        { name: 'Clear Language', status: 'available', description: 'Simple, understandable text' },
        { name: 'Progress Indicators', status: 'available', description: 'Clear progress and status information' },
        { name: 'Error Prevention', status: 'available', description: 'Helpful validation and guidance' },
        { name: 'Consistent Navigation', status: 'available', description: 'Predictable interface patterns' }
      ]
    },
    {
      category: 'Auditory',
      icon: Volume2,
      features: [
        { name: 'Screen Reader Support', status: 'available', description: 'Complete screen reader compatibility' },
        { name: 'Audio Descriptions', status: 'planned', description: 'Descriptive audio for visual content' },
        { name: 'Caption Support', status: 'available', description: 'Captions for any audio/video content' },
        { name: 'Volume Controls', status: 'available', description: 'Independent volume controls' }
      ]
    }
  ];

  const wcagCompliance = [
    {
      level: 'WCAG 2.1 AA',
      status: 'compliant',
      criteria: [
        '1.1 Text Alternatives',
        '1.3 Adaptable',
        '1.4 Distinguishable',
        '2.1 Keyboard Accessible',
        '2.4 Navigable',
        '3.1 Readable',
        '3.3 Input Assistance',
        '4.1 Compatible'
      ]
    },
    {
      level: 'WCAG 2.1 AAA',
      status: 'partial',
      criteria: [
        '1.2 Time-based Media (partial)',
        '1.4 Distinguishable (enhanced)',
        '2.2 Enough Time (enhanced)',
        '2.3 Seizures (enhanced)',
        '2.5 Input Modalities (partial)',
        '3.1 Readable (enhanced)',
        '3.2 Predictable (enhanced)',
        '3.3 Input Assistance (enhanced)'
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
      case 'compliant':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'planned':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Accessibility className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Accessibility Center</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            CopeCompanion is committed to providing an accessible platform for everyone.
            Our accessibility features ensure that mental health support is available to all users,
            regardless of ability or disability.
          </p>
        </div>

        {/* Compliance Status */}
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>WCAG 2.1 AA Compliant:</strong> CopeCompanion meets all Web Content Accessibility Guidelines
            2.1 AA requirements, ensuring accessibility for users with disabilities.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="features" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accessibilityFeatures.map((category) => (
                <Card key={category.category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className="h-5 w-5" />
                      {category.category} Accessibility
                    </CardTitle>
                    <CardDescription>
                      Features designed to support users with {category.category.toLowerCase()} accessibility needs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          {getStatusIcon(feature.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{feature.name}</span>
                              <Badge className={getStatusColor(feature.status)}>
                                {feature.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {wcagCompliance.map((level) => (
                <Card key={level.level}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(level.status)}
                      {level.level}
                    </CardTitle>
                    <CardDescription>
                      Web Content Accessibility Guidelines compliance status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <Badge className={getStatusColor(level.status)}>
                          {level.status}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Covered Criteria:</h4>
                        <div className="grid grid-cols-1 gap-1">
                          {level.criteria.map((criterion, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              {criterion}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Accessibility Testing</CardTitle>
                <CardDescription>Our commitment to ongoing accessibility testing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">100%</div>
                    <div className="text-sm text-gray-600">Automated Testing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">50+</div>
                    <div className="text-sm text-gray-600">Manual Test Cases</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">5</div>
                    <div className="text-sm text-gray-600">Assistive Technologies</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Preferences</CardTitle>
                <CardDescription>Customize your accessibility experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Text & Display
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Font Size</span>
                        <select className="text-sm border rounded px-2 py-1">
                          <option>Normal (100%)</option>
                          <option>Large (125%)</option>
                          <option>Extra Large (150%)</option>
                          <option>Maximum (200%)</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">High Contrast</span>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Color Scheme</span>
                        <select className="text-sm border rounded px-2 py-1">
                          <option>Default</option>
                          <option>High Contrast</option>
                          <option>Color Blind Friendly</option>
                          <option>Dark Mode</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Keyboard className="h-4 w-4" />
                      Navigation & Input
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Keyboard Navigation</span>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Focus Indicators</span>
                        <Badge className="bg-green-100 text-green-800">Visible</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Reduced Motion</span>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto-complete</span>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Button>Save Preferences</Button>
                    <Button variant="outline">Reset to Defaults</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assistive Technology Support</CardTitle>
                <CardDescription>Compatible assistive technologies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    'NVDA (Windows)',
                    'JAWS (Windows)',
                    'VoiceOver (macOS/iOS)',
                    'TalkBack (Android)',
                    'ZoomText',
                    'Window-Eyes',
                    'ChromeVox',
                    'Orca (Linux)'
                  ].map((tech) => (
                    <div key={tech} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{tech}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Accessibility Issues</CardTitle>
                <CardDescription>Help us improve accessibility for everyone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found an accessibility issue? We want to hear about it so we can fix it.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Issue Type</label>
                    <select className="w-full border rounded px-3 py-2">
                      <option>Screen Reader Issue</option>
                      <option>Keyboard Navigation</option>
                      <option>Color Contrast</option>
                      <option>Font Size</option>
                      <option>Motor Accessibility</option>
                      <option>Cognitive Accessibility</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Severity</label>
                    <select className="w-full border rounded px-3 py-2">
                      <option>Critical - Blocks access</option>
                      <option>High - Major difficulty</option>
                      <option>Medium - Some difficulty</option>
                      <option>Low - Minor issue</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 h-32"
                    placeholder="Please describe the accessibility issue you encountered..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <Button>Submit Report</Button>
                  <Button variant="outline">Attach Screenshot</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Improvements</CardTitle>
                <CardDescription>Accessibility enhancements we've made</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      date: '2024-12-01',
                      improvement: 'Enhanced screen reader support for chat interface',
                      impact: 'Improved accessibility for visually impaired users'
                    },
                    {
                      date: '2024-11-15',
                      improvement: 'Added high contrast mode toggle',
                      impact: 'Better visibility for users with visual impairments'
                    },
                    {
                      date: '2024-11-01',
                      improvement: 'Implemented keyboard navigation shortcuts',
                      impact: 'Faster navigation for keyboard users'
                    },
                    {
                      date: '2024-10-15',
                      improvement: 'Added focus management for dialogs',
                      impact: 'Improved screen reader and keyboard navigation'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{item.improvement}</p>
                        <p className="text-sm text-gray-600">{item.impact}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}