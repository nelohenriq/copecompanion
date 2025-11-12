"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Trash2, Eye, Download, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface KnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  contentType: string;
  category: string[];
  status: 'uploading' | 'processing' | 'ready' | 'error';
  chunkCount?: number;
  uploadedAt: string;
  fileSize: number;
}

const KNOWLEDGE_CATEGORIES = [
  "Mental Health Guidelines",
  "Crisis Intervention",
  "Therapeutic Approaches",
  "Medication Information",
  "Research Evidence",
  "Clinical Protocols",
  "Patient Resources",
  "Professional Development",
  "Legal & Ethical Guidelines",
  "Assessment Tools",
];

const CONTENT_TYPES = [
  { value: "pdf", label: "PDF Document" },
  { value: "docx", label: "Word Document" },
  { value: "txt", label: "Text File" },
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML" },
];

export function KnowledgeBaseManager() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/admin/knowledge');
      const result = await response.json();

      if (response.ok) {
        const docs: KnowledgeDocument[] = result.documents.map((doc: any) => ({
          id: doc.id,
          title: doc.filename,
          filename: doc.filename,
          contentType: doc.contentType,
          category: doc.categories,
          status: doc.status,
          uploadedAt: doc.uploadedAt || new Date().toISOString(),
          fileSize: doc.fileSize,
          chunkCount: doc.chunkCount
        }));
        setDocuments(docs);
      }
    } catch (error) {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'text/html'];
      if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
        setError("Please select a valid file type (PDF, DOCX, TXT, MD, HTML)");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setUploadingFile(file);
      setError(null);
    }
  }, []);

  const handleUpload = async () => {
    if (!uploadingFile || selectedCategories.length === 0 || !contentType) {
      setError("Please fill in all required fields");
      return;
    }

    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', uploadingFile);
      formData.append('categories', JSON.stringify(selectedCategories));
      formData.append('contentType', contentType);

      const response = await fetch('/api/admin/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      // Reset form
      setUploadingFile(null);
      setSelectedCategories([]);
      setContentType("");
      setUploadProgress(0);

      // Reload documents to get updated list
      await loadDocuments();

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
      setUploadProgress(0);
    }
  };

  const pollDocumentStatus = async (documentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/knowledge/status/${documentId}`);
        const status = await response.json();

        setDocuments(prev => prev.map(doc =>
          doc.id === documentId
            ? { ...doc, status: status.status, chunkCount: status.chunkCount }
            : doc
        ));

        if (status.status === 'ready' || status.status === 'error') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to poll document status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/admin/knowledge/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload documents to get updated list
        await loadDocuments();
      } else {
        setError("Failed to delete document");
      }
    } catch (error) {
      setError("Failed to delete document");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Knowledge Document
          </CardTitle>
          <CardDescription>
            Upload documents to be processed and added to the AI knowledge base for contextual responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Selection */}
          <div>
            <Label htmlFor="file-upload">Select Document *</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.txt,.md,.html"
              onChange={handleFileSelect}
              className="mt-2"
            />
            {uploadingFile && (
              <div className="mt-2 text-sm text-muted-foreground">
                Selected: {uploadingFile.name} ({formatFileSize(uploadingFile.size)})
              </div>
            )}
          </div>

          {/* Content Type */}
          <div>
            <Label>Content Type *</Label>
            <Select value={contentType} onValueChange={setContentType}>
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

          {/* Categories */}
          <div>
            <Label>Categories *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories(prev => [...prev, category]);
                      } else {
                        setSelectedCategories(prev => prev.filter(c => c !== category));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`category-${category}`} className="text-sm">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={!uploadingFile || selectedCategories.length === 0 || !contentType}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload & Process
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Documents</CardTitle>
          <CardDescription>
            Manage uploaded documents and their processing status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(doc.status)}
                    <div>
                      <h4 className="font-medium">{doc.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span className={getStatusColor(doc.status)}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                        {doc.chunkCount && (
                          <>
                            <span>•</span>
                            <span>{doc.chunkCount} chunks</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {doc.category.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}