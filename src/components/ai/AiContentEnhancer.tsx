"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, Eye, CheckCircle, AlertTriangle } from "lucide-react";

interface AiContentEnhancerProps {
  initialContent?: {
    id?: string;
    title: string;
    content: string;
    contentType: string;
    targetAudience: string[];
    category: string[];
  };
  onContentEnhanced?: (enhancedContent: EnhancedContent) => void;
}

interface EnhancedContent {
  originalContent: string;
  enhancedContent: string;
  analysis: {
    overallScore: number;
    strengths: string;
    improvements: string;
    safetyAssessment: string;
    enhancementSuggestions: string;
  };
  metadata: {
    title: string;
    contentType: string;
    enhancementType: string;
    enhancedAt: string;
  };
}

const ENHANCEMENT_TYPES = [
  { value: "clarity", label: "Improve Clarity", description: "Enhance readability and logical flow" },
  { value: "engagement", label: "Boost Engagement", description: "Add compelling elements and examples" },
  { value: "accessibility", label: "Increase Accessibility", description: "Simplify language and improve comprehension" },
  { value: "comprehensiveness", label: "Add Depth", description: "Include additional relevant information" },
  { value: "safety", label: "Review Safety", description: "Ensure appropriate disclaimers and crisis resources" },
  { value: "full_review", label: "Full Enhancement", description: "Comprehensive improvement across all areas" },
];

export function AiContentEnhancer({ initialContent, onContentEnhanced }: AiContentEnhancerProps) {
  const [formData, setFormData] = useState({
    title: initialContent?.title || "",
    content: initialContent?.content || "",
    contentType: initialContent?.contentType || "",
    targetAudience: initialContent?.targetAudience || ["general"],
    category: initialContent?.category || [],
    enhancementType: "full_review",
  });

  const [enhancedContent, setEnhancedContent] = useState<EnhancedContent | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnhance = async () => {
    if (!formData.title || !formData.content || !formData.contentType) {
      setError("Please fill in all required fields (title, content, and content type)");
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/content/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        const enhanced: EnhancedContent = {
          originalContent: formData.content,
          enhancedContent: result.data.enhancedContent,
          analysis: result.data.analysis,
          metadata: {
            title: formData.title,
            contentType: formData.contentType,
            enhancementType: formData.enhancementType,
            enhancedAt: result.data.metadata.enhancedAt,
          },
        };

        setEnhancedContent(enhanced);
        onContentEnhanced?.(enhanced);
      } else {
        setError(result.error || 'Failed to enhance content');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const getEnhancementTypeInfo = (type: string) => {
    return ENHANCEMENT_TYPES.find(et => et.value === type);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Enhancement Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Content Enhancer
          </CardTitle>
          <CardDescription>
            Improve existing content with AI-powered analysis and enhancement suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Content Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter content title"
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
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="exercise">Exercise</SelectItem>
                    <SelectItem value="video">Video Script</SelectItem>
                    <SelectItem value="audio">Audio Script</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="resource">Resource Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="enhancementType">Enhancement Focus</Label>
                <Select value={formData.enhancementType} onValueChange={(value) => handleInputChange("enhancementType", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENHANCEMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Content Input */}
          <div>
            <Label htmlFor="content">Content to Enhance *</Label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange("content", e.target.value)}
              placeholder="Paste your content here for AI enhancement..."
              className="w-full min-h-[200px] px-3 py-2 text-sm rounded-md border border-input bg-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            />
          </div>

          {/* Enhancement Type Info */}
          {formData.enhancementType && (
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                <strong>{getEnhancementTypeInfo(formData.enhancementType)?.label}:</strong>{" "}
                {getEnhancementTypeInfo(formData.enhancementType)?.description}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Enhance Button */}
          <div className="flex justify-end">
            <Button onClick={handleEnhance} disabled={isEnhancing}>
              {isEnhancing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enhance Content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Content Results */}
      {enhancedContent && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Enhancement Analysis
              </CardTitle>
              <CardDescription>
                AI-powered analysis and improvement suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quality Score */}
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor(enhancedContent.analysis.overallScore)}`}>
                    {enhancedContent.analysis.overallScore}/10
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Quality Score</div>
                </div>

                {/* Enhancement Type */}
                <div className="text-center">
                  <Badge variant="secondary" className="text-sm">
                    {getEnhancementTypeInfo(enhancedContent.metadata.enhancementType)?.label}
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-1">Enhancement Focus</div>
                </div>
              </div>

              {/* Analysis Details */}
              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Strengths</h4>
                  <p className="text-sm text-muted-foreground">{enhancedContent.analysis.strengths}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Areas for Improvement</h4>
                  <p className="text-sm text-muted-foreground">{enhancedContent.analysis.improvements}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Safety Assessment</h4>
                  <p className="text-sm text-muted-foreground">{enhancedContent.analysis.safetyAssessment}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Enhancement Suggestions</h4>
                  <p className="text-sm text-muted-foreground">{enhancedContent.analysis.enhancementSuggestions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Content */}
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Content</CardTitle>
              <CardDescription>
                AI-improved version with applied enhancements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                  {enhancedContent.enhancedContent}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(enhancedContent.enhancedContent)}>
                  Copy Enhanced Content
                </Button>
                <Button onClick={() => onContentEnhanced?.(enhancedContent)}>
                  Use Enhanced Content
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}