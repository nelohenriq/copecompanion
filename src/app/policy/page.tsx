'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Eye,
  Lock,
  Database,
  Users,
  AlertTriangle,
  CheckCircle,
  Download,
  Mail,
  Globe,
  Cookie,
  Server
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function PrivacyPolicyPage() {
  const lastUpdated = 'December 12, 2024';

  const dataCategories = [
    {
      category: 'Personal Information',
      description: 'Name, email address, phone number, date of birth',
      purpose: 'Account creation, communication, age verification',
      retention: 'Until account deletion or as required by law'
    },
    {
      category: 'Health Information',
      description: 'Mental health conditions, therapy notes, crisis history',
      purpose: 'Providing personalized mental health support',
      retention: '7 years (HIPAA requirement) or until account deletion'
    },
    {
      category: 'Usage Data',
      description: 'App usage patterns, feature interactions, session logs',
      purpose: 'Improving service quality and user experience',
      retention: '2 years for analytics, 7 years for security logs'
    },
    {
      category: 'Communication Data',
      description: 'Chat messages, community posts, support tickets',
      purpose: 'Providing mental health support and community features',
      retention: 'Until account deletion or as required for safety'
    },
    {
      category: 'Device Information',
      description: 'IP address, device type, browser information',
      purpose: 'Security, fraud prevention, service optimization',
      retention: '90 days for active sessions, 2 years for security'
    }
  ];

  const privacyRights = [
    {
      right: 'Access',
      description: 'Request a copy of your personal data',
      icon: Eye
    },
    {
      right: 'Rectification',
      description: 'Correct inaccurate or incomplete data',
      icon: CheckCircle
    },
    {
      right: 'Erasure',
      description: 'Request deletion of your personal data',
      icon: Database
    },
    {
      right: 'Portability',
      description: 'Receive your data in a structured format',
      icon: Download
    },
    {
      right: 'Restriction',
      description: 'Limit how we process your data',
      icon: Lock
    },
    {
      right: 'Objection',
      description: 'Object to data processing for certain purposes',
      icon: AlertTriangle
    }
  ];

  const securityMeasures = [
    'End-to-end encryption for all communications',
    'Multi-factor authentication for accounts',
    'Regular security audits and penetration testing',
    'Data encryption at rest and in transit',
    'Access controls and role-based permissions',
    'Regular backup and disaster recovery procedures',
    'Employee background checks and training',
    'Incident response and breach notification procedures'
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Your privacy is our top priority. This policy explains how we collect, use, and protect your personal information.
          </p>
          <Badge className="mt-2 bg-green-100 text-green-800">GDPR & HIPAA Compliant</Badge>
        </div>

        {/* Important Notice */}
        <Alert className="bg-blue-50 border-blue-200">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>TL;DR:</strong> We collect minimal data necessary for mental health support,
            never sell your data, and give you full control over your privacy settings.
            Last updated: {lastUpdated}
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Your Data</TabsTrigger>
            <TabsTrigger value="rights">Your Rights</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What We Collect and Why</CardTitle>
                <CardDescription>
                  We only collect data necessary to provide mental health support services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">5</div>
                    <div className="text-sm text-gray-600">Data Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-600">Data Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">HIPAA</div>
                    <div className="text-sm text-gray-600">Compliant</div>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Privacy by Design:</strong> We build privacy into every feature from the ground up.
                    Your mental health data is protected with the highest security standards.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    International Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">GDPR (European Union)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">CCPA (California)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">HIPAA (Healthcare)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">PIPEDA (Canada)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cookie className="h-5 w-5" />
                    Cookie Policy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Essential Cookies</span>
                      <Badge className="bg-green-100 text-green-800">Always Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Analytics Cookies</span>
                      <Badge className="bg-blue-100 text-blue-800">Optional</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Marketing Cookies</span>
                      <Badge className="bg-red-100 text-red-800">Never Used</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data We Collect</CardTitle>
                <CardDescription>
                  Detailed breakdown of data categories and retention periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dataCategories.map((category, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{category.category}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">What:</span>
                          <p className="mt-1">{category.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Why:</span>
                          <p className="mt-1">{category.purpose}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Retention:</span>
                          <p className="mt-1">{category.retention}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Sharing</CardTitle>
                <CardDescription>When and how we share your information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>We never sell your data.</strong> Your personal information is never shared
                      with third parties for marketing purposes.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <h4 className="font-medium">We may share data with:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Licensed mental health professionals (with your consent)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Emergency services in crisis situations</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Legal authorities when required by law</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Service providers (anonymized and aggregated)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Privacy Rights</CardTitle>
                <CardDescription>
                  You have control over your personal data and how it's used
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {privacyRights.map((right, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <right.icon className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium">{right.right}</h4>
                      </div>
                      <p className="text-sm text-gray-600">{right.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How to Exercise Your Rights</CardTitle>
                <CardDescription>Steps to manage your privacy settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">1</div>
                    <div>
                      <h4 className="font-medium">Access Your Data</h4>
                      <p className="text-sm text-gray-600">Go to Settings → Privacy → Download My Data</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">2</div>
                    <div>
                      <h4 className="font-medium">Manage Preferences</h4>
                      <p className="text-sm text-gray-600">Settings → Privacy → Data Sharing Preferences</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">3</div>
                    <div>
                      <h4 className="font-medium">Contact Privacy Team</h4>
                      <p className="text-sm text-gray-600">Email privacy@copecompanion.com or use in-app support</p>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Response Time:</strong> We respond to all privacy requests within 30 days
                    as required by law. Some requests may take longer for complex cases.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Measures</CardTitle>
                <CardDescription>
                  How we protect your personal and health information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {securityMeasures.map((measure, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <span className="text-sm">{measure}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Data Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Encryption</span>
                      <Badge className="bg-green-100 text-green-800">AES-256</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Location</span>
                      <Badge className="bg-blue-100 text-blue-800">US SOC 2</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Backups</span>
                      <Badge className="bg-purple-100 text-purple-800">Encrypted</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Access</span>
                      <Badge className="bg-green-100 text-green-800">Role-based</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Incident Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">24/7 monitoring and response</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">72-hour breach notification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Regular security audits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Penetration testing</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Our Privacy Team</CardTitle>
                <CardDescription>
                  Get help with privacy questions or exercise your rights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Privacy Inquiries
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Email:</strong> privacy@copecompanion.com</p>
                      <p><strong>Phone:</strong> 1-800-PRIVACY (774-8229)</p>
                      <p><strong>Response Time:</strong> Within 30 days</p>
                      <p><strong>Business Hours:</strong> Mon-Fri 9AM-6PM EST</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Data Protection Officer
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Name:</strong> Dr. Sarah Chen</p>
                      <p><strong>Title:</strong> Chief Privacy Officer</p>
                      <p><strong>Email:</strong> dpo@copecompanion.com</p>
                      <p><strong>Certifications:</strong> CIPP/E, CIPP/US</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                    <Download className="h-6 w-6" />
                    <span className="text-sm">Download Privacy Policy</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                    <Shield className="h-6 w-6" />
                    <span className="text-sm">Privacy Settings</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Data Subject Request</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Emergency Situations:</strong> If you're experiencing a mental health crisis,
                please contact emergency services immediately at 911 (US) or your local emergency number.
                Do not use this contact form for crisis situations.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Last updated: {lastUpdated}</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="/terms" className="hover:text-blue-600">Terms of Service</a>
            <span>•</span>
            <a href="/accessibility" className="hover:text-blue-600">Accessibility</a>
            <span>•</span>
            <a href="/contact" className="hover:text-blue-600">Contact Us</a>
          </div>
        </div>
      </div>
    </Layout>
  );
}