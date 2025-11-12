import { KnowledgeBaseManager } from "@/components/admin/KnowledgeBaseManager";

export default function AdminKnowledgePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Knowledge Base Management</h1>
        <p className="text-muted-foreground">
          Upload and manage curated knowledge documents for AI contextual responses.
          Documents are automatically chunked, embedded, and stored in the vector database.
        </p>
      </div>

      <KnowledgeBaseManager />
    </div>
  );
}