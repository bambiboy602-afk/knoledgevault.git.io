export interface KeyFinding {
  claim: string;
  evidence: string;
  confidence: 'high' | 'moderate' | 'unverified';
}

export interface StructuredSection {
  heading: string;
  paragraphs: string[];
  bulletPoints?: string[];
}

export interface ReferenceItem {
  title: string;
  url?: string;
  citationText: string;
}

export interface GrowthVector {
  question: string;
  reason: string;
  suggestedAction: string;
}

export interface KnowledgeAnalysis {
  title: string;
  category: string;
  tags: string[];
  executiveSummary: string;
  keyFindings: KeyFinding[];
  structuredSections: StructuredSection[];
  references: ReferenceItem[];
  growthVectors: GrowthVector[];
  originalText?: string;
  sourceUrl?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export interface DriveDocFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
  category?: string;
  tags: string[];
  executiveSummary?: string;
  folderId?: string;
  folderName?: string;
}

export interface ExpandedVectorResult {
  title: string;
  deepDiveSummary: string;
  breakthroughInsights: string[];
  verifiedSources: {
    title: string;
    url?: string;
    relevance: string;
  }[];
  nextInquiryAvenues: string[];
}
