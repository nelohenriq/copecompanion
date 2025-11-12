'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Heart, Menu, X, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useTheme } from 'next-themes';

interface LayoutProps {
  children: ReactNode;
  showNavigation?: boolean;
  showFooter?: boolean;
}

export function Layout({ children, showNavigation = true, showFooter = true }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'API Keys', href: '/keys' },
    { name: 'Settings', href: '/settings/personalization' },
    { name: 'Accessibility', href: '/accessibility' },
    { name: 'Terms', href: '/terms' },
    { name: 'Privacy', href: '/policy' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      {showNavigation && (
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center gap-2">
                <Heart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">CopeCompanion</span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm font-medium"
                  >
                    {item.name}
                  </Link>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Get Started</Button>
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-gray-600 dark:text-gray-300"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
                <div className="px-2 pt-2 pb-3 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <div className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="w-full justify-start text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </Button>
                  </div>
                  <div className="px-3 py-2">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Get Started</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      {showFooter && (
        <footer className="bg-gray-900 dark:bg-gray-800 text-white py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <Heart className="h-6 w-6 text-blue-400" />
                  <span className="text-lg font-bold">CopeCompanion</span>
                </Link>
                <p className="text-gray-400 text-sm">
                  Compassionate mental health support for everyone, everywhere.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-sm">Platform</h3>
                <div className="space-y-2">
                  <Link href="/dashboard" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Dashboard
                  </Link>
                  <Link href="/keys" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    API Keys
                  </Link>
                  <Link href="/settings/personalization" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Settings
                  </Link>
                  <Link href="/accessibility" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Accessibility
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-sm">Legal</h3>
                <div className="space-y-2">
                  <Link href="/terms" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Terms of Service
                  </Link>
                  <Link href="/policy" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Privacy Policy
                  </Link>
                  <Link href="/accessibility" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Accessibility
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-sm">Support</h3>
                <div className="space-y-2">
                  <a href="mailto:support@copecompanion.com" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    Email Support
                  </a>
                  <a href="tel:1-800-HELP-NOW" className="block text-gray-400 hover:text-white transition-colors text-sm">
                    1-800-HELP-NOW
                  </a>
                  <div className="text-gray-400 text-sm">
                    24/7 Crisis Support
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 dark:border-gray-700 mt-8 pt-6 text-center text-gray-400 text-sm">
              <p>&copy; 2024 CopeCompanion. All rights reserved. | HIPAA Compliant | WCAG 2.1 AA</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}