import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { AiService } from '@/services/ai/AiService';

// Search result interface
interface SearchResult {
  content: any;
  relevanceScore: number;
  matchType: 'exact' | 'partial' | 'semantic' | 'category' | 'tag';
  highlights?: string[];
}

// Search analytics interface
interface SearchAnalytics {
  query: string;
  resultsCount: number;
  searchTime: number;
  filters: Record<string, any>;
  userId?: string;
  timestamp: Date;
}

// GET /api/content/search - Advanced content search
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    const { searchParams } = new URL(request.url);

    // Extract search parameters
    const query = searchParams.get('q') || '';
    const contentType = searchParams.get('contentType');
    const category = searchParams.get('category');
    const tags = searchParams.getAll('tag');
    const difficulty = searchParams.get('difficulty');
    const author = searchParams.get('author');
    const language = searchParams.get('language') || 'en';
    const minScore = parseFloat(searchParams.get('minScore') || '0.1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'relevance'; // relevance, date, popularity
    const useSemantic = searchParams.get('semantic') === 'true';

    // Build base where clause
    const where: any = {
      status: 'published', // Only search published content
    };

    // Add access control
    if (!user) {
      where.accessLevel = 'public';
      where.requiresAuth = false;
    } else {
      where.OR = [
        { accessLevel: 'public' },
        { accessLevel: 'authenticated' },
        // TODO: Add professional content access based on user roles
      ];
    }

    // Add filters
    if (contentType) where.contentType = contentType;
    if (category) where.category = { has: category };
    if (tags.length > 0) where.tags = { hasSome: tags };
    if (difficulty) where.difficulty = difficulty;
    if (author) where.createdBy = author;
    if (language) where.language = language;

    let results: SearchResult[] = [];
    let totalResults = 0;

    if (query.trim()) {
      // Perform text-based search
      const textResults = await performTextSearch(query, where, limit * 2); // Get more for ranking
      results.push(...textResults);

      // Perform semantic search if requested and we have AI service
      if (useSemantic && textResults.length < limit) {
        try {
          const semanticResults = await performSemanticSearch(query, where, limit - textResults.length);
          results.push(...semanticResults);
        } catch (error) {
          logger.warn({
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Semantic search failed, falling back to text search');
        }
      }
    } else {
      // No query - return filtered results sorted by date/popularity
      const filteredResults = await (prisma as any).content.findMany({
        where,
        orderBy: sortBy === 'date' ? { publishedAt: 'desc' } :
                 sortBy === 'popularity' ? { createdAt: 'asc' } : // TODO: Add popularity scoring
                 { publishedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      });

      results = filteredResults.map((content: any) => ({
        content,
        relevanceScore: 1.0,
        matchType: 'category' as const,
      }));

      totalResults = await (prisma as any).content.count({ where });
    }

    // Rank and filter results
    results = rankResults(results, query, sortBy)
      .filter(result => result.relevanceScore >= minScore)
      .slice(offset, offset + limit);

    // Calculate total results for pagination
    if (query.trim()) {
      // Estimate total for search results (simplified)
      totalResults = Math.max(results.length, await estimateTotalResults(query, where));
    }

    // Log search analytics
    const searchTime = Date.now() - startTime;
    await logSearchAnalytics({
      query,
      resultsCount: results.length,
      searchTime,
      filters: {
        contentType,
        category,
        tags,
        difficulty,
        author,
        language,
        useSemantic,
      },
      userId: user?.id,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: results.map(r => ({
          ...r.content,
          relevanceScore: r.relevanceScore,
          matchType: r.matchType,
          highlights: r.highlights,
        })),
        pagination: {
          total: totalResults,
          limit,
          offset,
          hasMore: offset + limit < totalResults,
        },
        searchTime,
        filters: {
          contentType,
          category,
          tags,
          difficulty,
          author,
          language,
          useSemantic,
        },
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Search failed');

    return NextResponse.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Helper function to perform text-based search
async function performTextSearch(query: string, whereClause: any, limit: number): Promise<SearchResult[]> {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);

  if (searchTerms.length === 0) return [];

  // Build search conditions
  const searchConditions = searchTerms.map(term => ({
    OR: [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { content: { contains: term, mode: 'insensitive' } },
      { tags: { has: term } },
      { category: { has: term } },
    ],
  }));

  const contents = await (prisma as any).content.findMany({
    where: {
      ...whereClause,
      AND: searchConditions,
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
    take: limit,
  });

  return contents.map((content: any) => {
    const score = calculateTextRelevanceScore(content, searchTerms);
    const highlights = generateHighlights(content, searchTerms);

    return {
      content,
      relevanceScore: score,
      matchType: score > 0.8 ? 'exact' : 'partial',
      highlights,
    };
  });
}

// Helper function to perform semantic search using AI
async function performSemanticSearch(query: string, whereClause: any, limit: number): Promise<SearchResult[]> {
  try {
    // Get AI service (simplified - in production, get from cache)
    const aiService = new AiService({
      userId: 'system',
      cacheEnabled: true,
      cacheTtl: 3600,
    });

    // Generate semantic search query
    const semanticPrompt = `
Analyze this search query and extract key concepts, synonyms, and related terms for mental health content search.
Return a JSON array of search terms that would be semantically related to the query.

Query: "${query}"

Return format: ["term1", "term2", "term3", ...]
`;

    const semanticResponse = await aiService.generateText({
      prompt: semanticPrompt,
      temperature: 0.1,
    });

    let semanticTerms: string[] = [];
    try {
      semanticTerms = JSON.parse(semanticResponse.text);
    } catch {
      // Fallback to original query terms
      semanticTerms = query.toLowerCase().split(' ');
    }

    // Search using semantic terms
    const semanticResults = await performTextSearch(
      semanticTerms.join(' '),
      whereClause,
      limit
    );

    // Mark as semantic results
    return semanticResults.map(result => ({
      ...result,
      matchType: 'semantic' as const,
      relevanceScore: result.relevanceScore * 0.9, // Slightly lower weight for semantic matches
    }));

  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Semantic search failed');
    return [];
  }
}

// Helper function to calculate text relevance score
function calculateTextRelevanceScore(content: any, searchTerms: string[]): number {
  let score = 0;
  const title = content.title.toLowerCase();
  const description = content.description?.toLowerCase() || '';
  const contentText = content.content?.toLowerCase() || '';

  for (const term of searchTerms) {
    // Title matches have highest weight
    if (title.includes(term)) score += 0.4;
    // Description matches have medium weight
    if (description.includes(term)) score += 0.3;
    // Content matches have lower weight
    if (contentText.includes(term)) score += 0.2;
    // Tag matches have high weight
    if (content.tags.some((tag: string) => tag.toLowerCase().includes(term))) score += 0.3;
    // Category matches have medium weight
    if (content.category.some((cat: string) => cat.toLowerCase().includes(term))) score += 0.2;
  }

  // Boost for exact matches
  const exactTitleMatch = searchTerms.some(term => title === term || title.includes(` ${term} `));
  if (exactTitleMatch) score += 0.2;

  return Math.min(score, 1.0);
}

// Helper function to generate search result highlights
function generateHighlights(content: any, searchTerms: string[]): string[] {
  const highlights: string[] = [];
  const maxHighlights = 3;

  // Highlight matching sections from title, description, and content
  const sources = [
    { text: content.title, label: 'Title' },
    { text: content.description, label: 'Description' },
    { text: content.content?.substring(0, 500), label: 'Content' },
  ];

  for (const source of sources) {
    if (!source.text || highlights.length >= maxHighlights) continue;

    for (const term of searchTerms) {
      if (source.text.toLowerCase().includes(term)) {
        // Find context around the term
        const index = source.text.toLowerCase().indexOf(term);
        const start = Math.max(0, index - 50);
        const end = Math.min(source.text.length, index + term.length + 50);
        const highlight = source.text.substring(start, end);

        highlights.push(`${source.label}: ...${highlight}...`);
        break; // Only one highlight per source
      }
    }
  }

  return highlights.slice(0, maxHighlights);
}

// Helper function to rank search results
function rankResults(results: SearchResult[], query: string, sortBy: string): SearchResult[] {
  return results.sort((a, b) => {
    // Primary sort by relevance score
    if (sortBy === 'relevance') {
      if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.01) {
        return b.relevanceScore - a.relevanceScore;
      }
    }

    // Secondary sorts
    if (sortBy === 'date') {
      const aDate = new Date(a.content.publishedAt || a.content.createdAt).getTime();
      const bDate = new Date(b.content.publishedAt || b.content.createdAt).getTime();
      return bDate - aDate;
    }

    // Default: sort by relevance, then by date
    if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.01) {
      return b.relevanceScore - a.relevanceScore;
    }

    const aDate = new Date(a.content.publishedAt || a.content.createdAt).getTime();
    const bDate = new Date(b.content.publishedAt || b.content.createdAt).getTime();
    return bDate - aDate;
  });
}

// Helper function to estimate total results
async function estimateTotalResults(query: string, whereClause: any): Promise<number> {
  // Simplified estimation - in production, use more sophisticated counting
  try {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    if (searchTerms.length === 0) return 0;

    const searchConditions = searchTerms.map(term => ({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { tags: { has: term } },
      ],
    }));

    const count = await (prisma as any).content.count({
      where: {
        ...whereClause,
        AND: searchConditions,
      },
    });

    return count;
  } catch {
    return 0;
  }
}

// Helper function to log search analytics
async function logSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
  try {
    // In production, store in a dedicated analytics table
    // For now, just log to console/file
    logger.info(analytics, 'Search analytics');
  } catch (error) {
    // Don't fail the search if analytics logging fails
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to log search analytics');
  }
}