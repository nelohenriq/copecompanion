"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, Edit, Copy, Download, AlertTriangle } from "lucide-react";

interface AiContentGeneratorProps {
  onContentGenerated?: (content: GeneratedContent) => void;
}

interface GeneratedContent {
  title: string;
  content: string;
  metadata: {
    topic: string;
    contentType: string;
    targetAudience: string[];
    category: string[];
    difficulty?: string;
    tone: string;
    disclaimerIncluded: boolean;
    generatedAt: string;
  };
}

const CONTENT_TYPES = [
  { value: "article", label: "Article" },
  { value: "exercise", label: "Exercise" },
  { value: "video", label: "Video Script" },
  { value: "audio", label: "Audio Script" },
  { value: "assessment", label: "Assessment" },
  { value: "resource", label: "Resource Guide" },
];

const CATEGORIES = [
  "Mental Health",
  "Anxiety",
  "Depression",
  "Stress Management",
  "Mindfulness",
  "Therapy",
  "Self-Care",
  "Relationships",
  "Workplace Wellness",
  "Crisis Support",
];

const TARGET_AUDIENCES = [
  { value: "general", label: "General Public" },
  { value: "professionals", label: "Mental Health Professionals" },
  { value: "patients", label: "Patients" },
  { value: "caregivers", label: "Caregivers" },
];

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const TONES = [
  { value: "supportive", label: "Supportive" },
  { value: "educational", label: "Educational" },
  { value: "encouraging", label: "Encouraging" },
  { value: "clinical", label: "Clinical" },
];

const LENGTH_OPTIONS = [
  { value: "short", label: "Short (300-500 words)" },
  { value: "medium", label: "Medium (600-1000 words)" },
  { value: "long", label: "Long (1200-1800 words)" },
];

export function AiContentGenerator({ onContentGenerated }: AiContentGeneratorProps) {
  const [formData, setFormData] = useState({
    topic: "",
    contentType: "",
    targetAudience: ["general"],
    category: [] as string[],
    difficulty: "",
    tone: "supportive",
    length: "medium",
    keyPoints: "",
  });

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      category: checked
        ? [...prev.category, category]
        : prev.category.filter(c => c !== category)
    }));
  };

  const handleAudienceChange = (audience: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      targetAudience: checked
        ? [...prev.targetAudience, audience]
        : prev.targetAudience.filter(a => a !== audience)
    }));
  };

  const handleGenerate = async () => {
    if (!formData.topic || !formData.contentType || formData.category.length === 0) {
      setError("Please fill in all required fields (topic, content type, and at least one category)");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const keyPoints = formData.keyPoints
        .split('\n')
        .map(point => point.trim())
        .filter(point => point.length > 0);

      const response = await fetch('/api/ai/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const content: GeneratedContent = {
          title: `${formData.topic} - ${CONTENT_TYPES.find(ct => ct.value === formData.contentType)?.label}`,
          content: result.data.content,
          metadata: result.data.metadata,
        };

        setGeneratedContent(content);
        onContentGenerated?.(content);
      } else {
        setError(result.error || 'Failed to generate content');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyContent = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.content);
    }
  };

  const handleUseContent = () => {
    if (generatedContent && onContentGenerated) {
      onContentGenerated(generatedContent);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Content Generator
          </CardTitle>
          <CardDescription>
            Generate high-quality mental health content with AI assistance. All content includes appropriate disclaimers and follows evidence-based practices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) => handleInputChange("topic", e.target.value)}
                placeholder="e.g., Managing Social Anxiety, Mindfulness for Depression"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contentType">Content Type *</Label>
                <Select value={formData.contentType} onValueChange={(value) => handleInputChange("contentType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={formData.difficulty} onValueChange={(value) => handleInputChange("difficulty", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tone">Tone</Label>
                <Select value={formData.tone} onValueChange={(value) => handleInputChange("tone", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="length">Content Length</Label>
                <Select value={formData.length} onValueChange={(value) => handleInputChange("length", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTH_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <Label>Categories *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={formData.category.includes(category)}
                    onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
                  />
                  <Label htmlFor={`category-${category}`} className="text-sm">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <Label>Target Audience</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {TARGET_AUDIENCES.map((audience) => (
                <div key={audience.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`audience-${audience.value}`}
                    checked={formData.targetAudience.includes(audience.value)}
                    onCheckedChange={(checked) => handleAudienceChange(audience.value, checked as boolean)}
                  />
                  <Label htmlFor={`audience-${audience.value}`} className="text-sm">
                    {audience.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Key Points */}
          <div>
            <Label htmlFor="keyPoints">Key Points to Cover (Optional)</Label>
            <textarea
              id="keyPoints"
              value={formData.keyPoints}
              onChange={(e) => handleInputChange("keyPoints", e.target.value)}
              placeholder="Enter key points, one per line (optional)"
              className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Content */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Generated Content</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyContent}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" onClick={handleUseContent}>
                  <Edit className="h-4 w-4 mr-2" />
                  Use This Content
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              AI-generated content with built-in mental health safety measures
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Metadata */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary">{generatedContent.metadata.contentType}</Badge>
              {generatedContent.metadata.category.map((cat) => (
                <Badge key={cat} variant="outline">{cat}</Badge>
              ))}
              {generatedContent.metadata.difficulty && (
                <Badge variant="outline">{generatedContent.metadata.difficulty}</Badge>
              )}
              <Badge variant="outline">{generatedContent.metadata.tone}</Badge>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                {generatedContent.content}
              </div>
            </div>

            {/* Disclaimer Notice */}
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This AI-generated content includes appropriate mental health disclaimers and follows evidence-based practices.
                All AI-generated content should be reviewed by qualified mental health professionals before publication.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}