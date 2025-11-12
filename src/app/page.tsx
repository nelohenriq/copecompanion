'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Heart,
  MessageCircle,
  Users,
  Shield,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Star,
  Clock,
  Award,
  Globe,
  Lock,
  Zap,
  AlertTriangle,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  const features = [
    {
      icon: MessageCircle,
      title: 'AI-Powered Conversations',
      description: '24/7 compassionate AI support for mental health conversations, coping strategies, and emotional guidance.',
      color: 'text-blue-600'
    },
    {
      icon: Users,
      title: 'Peer Support Community',
      description: 'Connect with others who understand. Safe, moderated spaces for sharing experiences and building connections.',
      color: 'text-green-600'
    },
    {
      icon: Heart,
      title: 'Progress Tracking',
      description: 'Monitor your mental health journey with personalized insights, goal setting, and achievement tracking.',
      color: 'text-purple-600'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'HIPAA-compliant, end-to-end encrypted. Your mental health data is protected with the highest security standards.',
      color: 'text-red-600'
    },
    {
      icon: Sparkles,
      title: 'Personalized Content',
      description: 'AI-curated mental health resources, coping tools, and educational content tailored to your needs.',
      color: 'text-yellow-600'
    },
    {
      icon: Award,
      title: 'Professional Integration',
      description: 'Seamless connection to licensed therapists and mental health professionals when needed.',
      color: 'text-indigo-600'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah M.',
      role: 'Anxiety Support User',
      content: 'CopeCompanion helped me through my toughest times. The AI conversations felt genuinely supportive, and connecting with others in similar situations made all the difference.',
      rating: 5
    },
    {
      name: 'Michael R.',
      role: 'Depression Recovery',
      content: 'The progress tracking features kept me motivated. Seeing my improvement over time was incredibly encouraging. The community support saved me.',
      rating: 5
    },
    {
      name: 'Dr. Emily Chen',
      role: 'Licensed Therapist',
      content: 'I recommend CopeCompanion to my patients. It provides excellent supplementary support between sessions and helps them build coping skills.',
      rating: 5
    }
  ];

  const stats = [
    { number: '500K+', label: 'Active Users' },
    { number: '95%', label: 'User Satisfaction' },
    { number: '24/7', label: 'AI Support Available' },
    { number: 'HIPAA', label: 'Compliant' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Heart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">CopeCompanion</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Dashboard
              </Link>
              <Link href="/keys" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                API Keys
              </Link>
              <Link href="/settings/personalization" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Settings
              </Link>
              <Link href="/accessibility" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Accessibility
              </Link>
              <Link href="/terms" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Terms
              </Link>
              <Link href="/policy" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Privacy
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link href="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200">
              🏆 #1 Mental Health Support Platform
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              You're Not Alone in
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                {' '}Your Journey
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Experience compassionate AI support, connect with understanding peers,
              and track your mental health progress in a safe, private environment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 py-3">
                  Start Your Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 py-3" onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Learn More
              </Button>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Comprehensive Mental Health Support
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need for your mental health journey, all in one compassionate platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl dark:text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base dark:text-gray-300">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Real stories from people who've found support and hope.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg dark:bg-gray-700 dark:border-gray-600">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands who have found hope, support, and healing through CopeCompanion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Get Started Free
                <Heart className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600" onClick={() => {
              // In a real app, this would open a demo scheduling modal or redirect to a contact form
              alert('Demo scheduling would open here. For now, visit the dashboard to explore features.');
            }}>
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-6 w-6 text-blue-400" />
                <span className="text-lg font-bold">CopeCompanion</span>
              </div>
              <p className="text-gray-400">
                Compassionate mental health support for everyone, everywhere.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <div className="space-y-2">
                <Link href="/dashboard" className="block text-gray-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
                <Link href="/keys" className="block text-gray-400 hover:text-white transition-colors">
                  API Keys
                </Link>
                <Link href="/settings/personalization" className="block text-gray-400 hover:text-white transition-colors">
                  Settings
                </Link>
                <Link href="/accessibility" className="block text-gray-400 hover:text-white transition-colors">
                  Accessibility
                </Link>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <div className="space-y-2">
                <Link href="/terms" className="block text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="/policy" className="block text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/contact" className="block text-gray-400 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <div className="space-y-2">
                <a href="mailto:support@copecompanion.com" className="block text-gray-400 hover:text-white transition-colors">
                  Email Support
                </a>
                <a href="tel:1-800-HELP-NOW" className="block text-gray-400 hover:text-white transition-colors">
                  1-800-HELP-NOW
                </a>
                <div className="text-gray-400">
                  24/7 Crisis Support
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CopeCompanion. All rights reserved. | HIPAA Compliant | WCAG 2.1 AA</p>
          </div>
        </div>
      </footer>

      {/* Emergency Notice */}
      <Alert className="fixed bottom-4 right-4 max-w-sm bg-red-50 border-red-200 z-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Crisis Support:</strong> If you're in crisis, call 988 (US) or your local emergency number immediately.
        </AlertDescription>
      </Alert>
    </div>
  );
}
