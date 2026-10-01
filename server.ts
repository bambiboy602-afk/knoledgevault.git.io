import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini AI instance on the server with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function generateWithRetry(params: any, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const is503 = err?.message?.includes('503') || err?.status === 503 || err?.code === 503;
      if (is503 && attempt < maxRetries) {
        console.warn(`Gemini 503 transient error, retrying attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate content after retries');
}

// API Route: Analyze, categorize, structure, and create growth vectors
app.post('/api/analyze-and-structure', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, sourceUrl, searchWebFirst, contextNotes } = req.body;

    if (!rawText && !contextNotes) {
      res.status(400).json({ error: 'Please provide text or notes to analyze and structure.' });
      return;
    }

    const prompt = `You are an elite Knowledge Management Engine and Research Synthesizer.
Analyze the following source material and provide a pristine, structured knowledge breakdown designed for filing into Google Drive and compiling into a comprehensive Google Doc.

User Source Material / Finding:
"""
${rawText || ''}
"""

Context / Source URL / Notes:
${sourceUrl ? `Source URL: ${sourceUrl}` : ''}
${contextNotes ? `User Context: ${contextNotes}` : ''}

Generate a comprehensive knowledge record with:
1. Title: Clear, descriptive, professional (under 75 characters).
2. Category: Exactly one fitting taxonomy category (e.g., "Technology & AI", "Market Intelligence", "Science & Discovery", "Policy & Strategy", "Engineering & Systems", "Operations & Methodology", or "Domain Research").
3. Tags: 3 to 6 lowercase keywords.
4. ExecutiveSummary: 2-3 substantive paragraphs synthesizing the core discoveries, context, and significance.
5. KeyFindings: Array of 3 to 6 specific factual findings/claims with evidence citations and confidence level ('high', 'moderate', or 'unverified').
6. StructuredSections: 2 to 4 detailed thematic sections with heading, paragraphs, and key takeaways/bullet points.
7. References: List of all explicit or inferred sources, URLs, authors, or background citations.
8. GrowthVectors: 3 to 5 forward-looking research avenues, unanswered questions, and actionable growth vectors to expand this knowledge branch further.
`;

    // Configure tools: if searchWebFirst is requested or helpful, enable googleSearch
    const tools = searchWebFirst ? [{ googleSearch: {} }] : undefined;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: tools,
        systemInstruction: 'You are an expert research librarian and intelligence analyst specializing in knowledge graph compilation and knowledge growth.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            executiveSummary: { type: Type.STRING },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  claim: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: ['claim', 'evidence', 'confidence'],
              },
            },
            structuredSections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  bulletPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['heading', 'paragraphs'],
              },
            },
            references: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  citationText: { type: Type.STRING },
                },
                required: ['title', 'citationText'],
              },
            },
            growthVectors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  suggestedAction: { type: Type.STRING },
                },
                required: ['question', 'reason', 'suggestedAction'],
              },
            },
          },
          required: [
            'title',
            'category',
            'tags',
            'executiveSummary',
            'keyFindings',
            'structuredSections',
            'references',
            'growthVectors',
          ],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const structuredData = JSON.parse(text);

    res.json({
      success: true,
      data: structuredData,
    });
  } catch (error: any) {
    console.error('Error analyzing knowledge:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process and structure knowledge',
    });
  }
});

// API Route: Expand a growth vector or follow-up inquiry with web search grounding
app.post('/api/expand-growth-vector', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, reason, baseTopic } = req.body;

    if (!question) {
      res.status(400).json({ error: 'Question is required for knowledge expansion.' });
      return;
    }

    const prompt = `Perform a deep inquiry on this knowledge growth question stemming from the base topic: "${baseTopic || 'Research Subject'}".
Question to investigate: "${question}"
Rationale / Context: "${reason || ''}"

Gather verified factual details, synthesized insights, corroborating sources, and actionable conclusions. Format your response into structured research notes suitable for appending to the knowledge archive.`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            deepDiveSummary: { type: Type.STRING },
            breakthroughInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            verifiedSources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  relevance: { type: Type.STRING },
                },
                required: ['title', 'relevance'],
              },
            },
            nextInquiryAvenues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'deepDiveSummary', 'breakthroughInsights', 'verifiedSources', 'nextInquiryAvenues'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Error expanding knowledge vector:', error);
    res.status(500).json({
      error: error?.message || 'Failed to expand knowledge vector',
    });
  }
});

// Mount Vite or static server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CognitiveVault server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
