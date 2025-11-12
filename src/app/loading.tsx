import { Loading } from "@/components/ui/loading"

export default function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loading size="lg" text="Loading CopeCompanion..." />
    </div>
  )
}