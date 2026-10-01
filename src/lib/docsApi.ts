import { KnowledgeAnalysis } from '../types/knowledge';

/**
 * Builds a beautifully structured, publication-grade document text representation.
 */
export function buildDocumentBody(analysis: KnowledgeAnalysis): string {
  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const lines: string[] = [];

  // Title & Header
  lines.push(`${analysis.title.toUpperCase()}`);
  lines.push('='.repeat(analysis.title.length));
  lines.push('');
  lines.push(`Knowledge Management System: CognitiveVault Archive`);
  lines.push(`Logged Date: ${dateStr}`);
  lines.push(`Category: ${analysis.category}`);
  lines.push(`Taxonomy Tags: ${analysis.tags.join(', ')}`);
  if (analysis.sourceUrl) {
    lines.push(`Source URL: ${analysis.sourceUrl}`);
  }
  lines.push('');
  lines.push('------------------------------------------------------------');
  lines.push('');

  // 1. Executive Summary
  lines.push('1. EXECUTIVE SUMMARY');
  lines.push('-------------------');
  lines.push(analysis.executiveSummary);
  lines.push('');

  // 2. Key Findings & Claims
  lines.push('2. VERIFIED KEY FINDINGS');
  lines.push('-----------------------');
  analysis.keyFindings.forEach((kf, idx) => {
    lines.push(`[${idx + 1}] CLAIM: ${kf.claim}`);
    lines.push(`    EVIDENCE: ${kf.evidence}`);
    lines.push(`    CONFIDENCE: ${kf.confidence.toUpperCase()}`);
    lines.push('');
  });

  // 3. Structured Sections
  lines.push('3. DETAILED THEMATIC ANALYSIS');
  lines.push('----------------------------');
  analysis.structuredSections.forEach((sec, idx) => {
    lines.push(`3.${idx + 1} ${sec.heading}`);
    lines.push('');
    sec.paragraphs.forEach((p) => {
      lines.push(p);
      lines.push('');
    });
    if (sec.bulletPoints && sec.bulletPoints.length > 0) {
      lines.push('Key Highlights:');
      sec.bulletPoints.forEach((bp) => {
        lines.push(` • ${bp}`);
      });
      lines.push('');
    }
  });

  // 4. References & Citations
  lines.push('4. REFERENCES & SOURCE ATTRIBUTION');
  lines.push('---------------------------------');
  if (analysis.references.length > 0) {
    analysis.references.forEach((ref, idx) => {
      lines.push(`[Ref-${idx + 1}] ${ref.title}`);
      if (ref.url) lines.push(`     URL: ${ref.url}`);
      lines.push(`     Citation: ${ref.citationText}`);
      lines.push('');
    });
  } else {
    lines.push('No external references cited.');
    lines.push('');
  }

  // 5. Knowledge Growth Vectors
  lines.push('5. KNOWLEDGE EXPANSION & GROWTH VECTORS');
  lines.push('--------------------------------------');
  lines.push('Forward-looking inquiry avenues to broaden this research branch:');
  lines.push('');
  analysis.growthVectors.forEach((gv, idx) => {
    lines.push(`Vector #${idx + 1}: ${gv.question}`);
    lines.push(`  Rationale: ${gv.reason}`);
    lines.push(`  Next Action: ${gv.suggestedAction}`);
    lines.push('');
  });

  // 6. Raw Ingestion Record
  if (analysis.originalText) {
    lines.push('------------------------------------------------------------');
    lines.push('APPENDIX: RAW CAPTURE LOG');
    lines.push('------------------------------------------------------------');
    lines.push(analysis.originalText);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Writes the structured content into an existing Google Doc using batchUpdate.
 */
export async function populateGoogleDoc(
  accessToken: string,
  documentId: string,
  analysis: KnowledgeAnalysis
): Promise<void> {
  const fullText = buildDocumentBody(analysis);

  // In Google Docs API, index 1 is the start of the body
  const updatePayload = {
    requests: [
      {
        insertText: {
          location: {
            index: 1,
          },
          text: fullText + '\n',
        },
      },
    ],
  };

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to write structured content to Google Doc: ${errorText}`);
  }
}

/**
 * Appends follow-up growth notes or research expansions into an existing Google Doc.
 */
export async function appendToGoogleDoc(
  accessToken: string,
  documentId: string,
  expansionTitle: string,
  expansionContent: string
): Promise<void> {
  // First get current doc length to find end index
  const getRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!getRes.ok) {
    throw new Error('Failed to retrieve document for appending.');
  }

  const doc = await getRes.json();
  const endIndex = doc.body?.content?.slice(-1)?.[0]?.endIndex || 1;
  const insertIndex = Math.max(1, endIndex - 1);

  const timestamp = new Date().toLocaleString();
  const appendText = `\n\n------------------------------------------------------------\n` +
    `GROWTH VECTOR EXPANSION: ${expansionTitle.toUpperCase()}\n` +
    `Updated: ${timestamp}\n` +
    `------------------------------------------------------------\n` +
    `${expansionContent}\n`;

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: {
              index: insertIndex,
            },
            text: appendText,
          },
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Failed to append update to Google Doc: ${errText}`);
  }
}

/**
 * Fetches the raw content or structural text of a Google Doc.
 */
export async function getGoogleDocText(accessToken: string, documentId: string): Promise<string> {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to read Google Doc content.');
  }

  const data = await res.json();
  let text = '';
  if (data.body?.content) {
    for (const elem of data.body.content) {
      if (elem.paragraph?.elements) {
        for (const pe of elem.paragraph.elements) {
          if (pe.textRun?.content) {
            text += pe.textRun.content;
          }
        }
      }
    }
  }
  return text;
}
