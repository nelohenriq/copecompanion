import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-background" role="contentinfo">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground" aria-hidden="true">
                <span className="text-xs font-bold">CC</span>
              </div>
              <span className="font-bold">CopeCompanion</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your AI-powered mental health support platform
            </p>
          </div>

          <nav className="space-y-3" role="navigation" aria-label="Platform navigation">
            <h4 className="text-sm font-semibold">Platform</h4>
            <div className="space-y-2">
              <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Home
              </Link>
              <Link href="/dashboard" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Dashboard
              </Link>
              <Link href="/keys" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                API Keys
              </Link>
            </div>
          </nav>

          <nav className="space-y-3" role="navigation" aria-label="Support navigation">
            <h4 className="text-sm font-semibold">Support</h4>
            <div className="space-y-2">
              <Link href="/help" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Help Center
              </Link>
              <Link href="/contact" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Contact Us
              </Link>
              <Link href="/privacy" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Privacy Policy
              </Link>
            </div>
          </nav>

          <nav className="space-y-3" role="navigation" aria-label="Legal navigation">
            <h4 className="text-sm font-semibold">Legal</h4>
            <div className="space-y-2">
              <Link href="/terms" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Terms of Service
              </Link>
              <Link href="/accessibility" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Accessibility
              </Link>
              <Link href="/compliance" className="block text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1">
                Compliance
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © 2024 CopeCompanion. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground mt-2 sm:mt-0">
            Built with care for mental health support
          </p>
        </div>
      </div>
    </footer>
  )
}