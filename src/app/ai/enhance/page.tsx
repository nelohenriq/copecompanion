import { AiContentEnhancer } from "@/components/ai/AiContentEnhancer";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AiEnhancePage() {
  const router = useRouter();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">AI Content Enhancer</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Improve existing content with AI-powered analysis and enhancement suggestions.
            Get detailed feedback on clarity, engagement, safety, and overall quality.
          </p>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="dark:text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push('/settings/personalization')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Personalization Settings
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push('/ai/generate')}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate New Content
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              <FileText className="mr-2 h-4 w-4" />
              View Dashboard
            </Button>
          </CardContent>
        </Card>

        <AiContentEnhancer />
      </div>
    </Layout>
  );
}