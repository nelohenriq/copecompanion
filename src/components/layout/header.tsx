import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="banner">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2" aria-label="CopeCompanion home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
              <span className="text-sm font-bold">CC</span>
            </div>
            <span className="hidden font-bold sm:inline-block">
              CopeCompanion
            </span>
          </Link>
        </div>

        <nav id="navigation" className="hidden md:flex items-center space-x-6 text-sm font-medium" role="navigation" aria-label="Main navigation">
          <Link
            href="/"
            className="transition-colors hover:text-foreground/80 text-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1"
          >
            Home
          </Link>
          <Link
            href="/keys"
            className="transition-colors hover:text-foreground/80 text-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1"
          >
            API Keys
          </Link>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground/80 text-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2 py-1"
          >
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Sign In
          </Button>
        </div>
      </div>
    </header>
  )
}