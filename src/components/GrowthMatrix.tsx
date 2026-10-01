import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  TrendingUp,
  FileText,
  Search,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { DriveDocFile, ExpandedVectorResult, DriveFolderInfo } from '../types/knowledge';
import { appendToGoogleDoc } from '../lib/docsApi';
import { createDocumentInDrive, getOrCreateCategoryFolder } from '../lib/driveApi';
import { populateGoogleDoc } from '../lib/docsApi';

interface GrowthMatrixProps {
  documents: DriveDocFile[];
  accessToken: string | null;
  rootFolder: DriveFolderInfo | null;
  onDocCreated: (doc: DriveDocFile) => void;
  onNavigateToArchive: () => void;
}

export const GrowthMatrix: React.FC<GrowthMatrixProps> = ({
  documents,
  accessToken,
  rootFolder,
  onDocCreated,
  onNavigateToArchive,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [customInquiry, setCustomInquiry] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionResult, setExpansionResult] = useState<ExpandedVectorResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAppending, setIsAppending] = useState(false);

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  // Pre-configured questions from document tags or executive summary if available
  const sampleExpansionVectors = [
    {
      question: `What are the emergent commercial bottlenecks in ${selectedDoc?.category || 'this sector'} over the next 3 years?`,
      reason: 'Anticipate supply chain and cost curve inflections.',
    },
    {
      question: `What regulatory frameworks or compliance hurdles apply to ${selectedDoc?.name || 'this finding'}?`,
      reason: 'Ensure institutional viability and mitigate policy risk.',
    },
    {
      question: `What competing technological or methodological paradigms challenge ${selectedDoc?.name || 'this hypothesis'}?`,
      reason: 'Avoid cognitive lock-in and test assumptions against rival approaches.',
    },
  ];

  const handleRunInquiry = async (question: string, reason?: string) => {
    if (!question.trim()) return;

    setIsExpanding(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setExpansionResult(null);

    try {
      const res = await fetch('/api/expand-growth-vector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          reason,
          baseTopic: selectedDoc?.name || 'Investigative Domain',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to expand inquiry.');
      }

      setExpansionResult(data.data);
    } catch (err: any) {
      console.error('Expansion error:', err);
      setErrorMessage(err.message || 'Failed to complete research expansion.');
    } finally {
      setIsExpanding(false);
    }
  };

  const handleAppendToCurrentDoc = async () => {
    if (!selectedDoc || !expansionResult || !accessToken) return;

    setIsAppending(true);
    setStatusMessage('Appending growth notes to Google Doc...');
    setErrorMessage(null);

    try {
      const formattedContent = `${expansionResult.deepDiveSummary}\n\n` +
        `Breakthrough Insights:\n` +
        expansionResult.breakthroughInsights.map((b) => ` • ${b}`).join('\n') +
        `\n\nVerified Sources:\n` +
        expansionResult.verifiedSources
          .map((s) => ` • ${s.title}${s.url ? ` (${s.url})` : ''} - ${s.relevance}`)
          .join('\n');

      await appendToGoogleDoc(
        accessToken,
        selectedDoc.id,
        expansionResult.title,
        formattedContent
      );

      setStatusMessage('Growth notes successfully appended to the Google Doc in Google Drive!');
    } catch (err: any) {
      console.error('Failed to append:', err);
      setErrorMessage(`Error updating Google Doc: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAppending(false);
    }
  };

  const handleSpawnChildDoc = async () => {
    if (!selectedDoc || !expansionResult || !accessToken || !rootFolder) return;

    setIsAppending(true);
    setStatusMessage('Spawning linked branch Google Doc in Google Drive...');
    setErrorMessage(null);

    try {
      const category = selectedDoc.category || 'General Research';
      const categoryFolder = await getOrCreateCategoryFolder(
        accessToken,
        rootFolder.id,
        category
      );

      const title = `Expansion: ${expansionResult.title}`;
      const newDoc = await createDocumentInDrive(
        accessToken,
        title,
        categoryFolder.id,
        expansionResult.deepDiveSummary.slice(0, 200) + '...',
        {
          category,
          tags: `${selectedDoc.tags?.join(',') || 'expansion'},growth-vector`,
        }
      );

      await populateGoogleDoc(accessToken, newDoc.id, {
        title,
        category,
        tags: [...(selectedDoc.tags || []), 'expansion-vector'],
        executiveSummary: expansionResult.deepDiveSummary,
        keyFindings: expansionResult.breakthroughInsights.map((bi) => ({
          claim: bi,
          evidence: 'Identified via live Google Search grounding synthesis.',
          confidence: 'high',
        })),
        structuredSections: [
          {
            heading: 'Detailed Inquiry Breakthroughs',
            paragraphs: [expansionResult.deepDiveSummary],
            bulletPoints: expansionResult.breakthroughInsights,
          },
          {
            heading: 'Follow-up Horizons & Next Steps',
            paragraphs: ['Recommended inquiry horizons to pursue next:'],
            bulletPoints: expansionResult.nextInquiryAvenues,
          },
        ],
        references: expansionResult.verifiedSources.map((vs) => ({
          title: vs.title,
          url: vs.url,
          citationText: vs.relevance,
        })),
        growthVectors: expansionResult.nextInquiryAvenues.map((nia) => ({
          question: nia,
          reason: 'Derived from secondary growth iteration.',
          suggestedAction: 'Schedule deep investigation.',
        })),
      });

      onDocCreated(newDoc);
      setStatusMessage(`Spawned new Google Doc: "${title}" inside your Google Drive!`);
    } catch (err: any) {
      console.error('Spawn doc error:', err);
      setErrorMessage(`Failed to spawn new doc: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAppending(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>NotebookLM-Style Growth Studio</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Knowledge Growth Vectors & Continuous Inquiry
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Every research entry is an open gateway. Discover unanswered questions, initiate grounded follow-up inquiries,
              and continuously expand your Google Docs knowledge graph.
            </p>
          </div>
          {selectedDoc && (
            <a
              href={selectedDoc.webViewLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Current Source Doc</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {documents.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Select Base Document & Vectors */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Base Document from Google Drive
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.category || 'General'}] {d.name}
                  </option>
                ))}
              </select>

              {/* Rationale & Suggested Inquiry Vectors */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Suggested Growth Vectors</span>
                </h4>
                <div className="space-y-2">
                  {sampleExpansionVectors.map((vec, vIdx) => (
                    <div
                      key={vIdx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 transition space-y-1.5"
                    >
                      <p className="text-xs font-semibold text-slate-200 leading-snug">
                        {vec.question}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        <span className="text-slate-500">Rationale:</span> {vec.reason}
                      </p>
                      <button
                        onClick={() => handleRunInquiry(vec.question, vec.reason)}
                        disabled={isExpanding}
                        className="mt-1 flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        <Search className="w-3 h-3" />
                        <span>Investigate this Vector</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom inquiry prompt */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                  <span>Custom Investigation Inquiry</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInquiry}
                    onChange={(e) => setCustomInquiry(e.target.value)}
                    placeholder="Ask a deep follow-up question..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none"
                  />
                  <button
                    onClick={() => handleRunInquiry(customInquiry)}
                    disabled={isExpanding || !customInquiry.trim()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Inquire</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Grounded Expansion Dossier */}
          <div className="lg:col-span-7 space-y-6">
            {isExpanding ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-200">
                  Executing Grounded Investigation...
                </h4>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                  Synthesizing verified web search data, evaluating claims, and structuring new intelligence...
                </p>
              </div>
            ) : expansionResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                {/* Header & Write actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Grounded Growth Synthesis
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">
                      {expansionResult.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAppendToCurrentDoc}
                      disabled={isAppending}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                      title="Append this section directly into the currently selected Google Doc"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Append to Current Doc</span>
                    </button>
                    <button
                      onClick={handleSpawnChildDoc}
                      disabled={isAppending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                      title="Create a brand new Google Doc in Google Drive for this branch"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Spawn New Google Doc</span>
                    </button>
                  </div>
                </div>

                {/* Status Message */}
                {statusMessage && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {errorMessage}
                  </div>
                )}

                {/* Deep Dive Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Deep Dive Synthesis
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    {expansionResult.deepDiveSummary}
                  </div>
                </div>

                {/* Breakthrough Insights */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Breakthrough Findings</span>
                  </h4>
                  <div className="space-y-2">
                    {expansionResult.breakthroughInsights.map((insight, bIdx) => (
                      <div
                        key={bIdx}
                        className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-200 flex items-start space-x-2.5"
                      >
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="leading-relaxed">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verified Grounding Sources */}
                {expansionResult.verifiedSources.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Grounding Citations & Sources
                    </h4>
                    <div className="space-y-2">
                      {expansionResult.verifiedSources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-semibold text-slate-200">{src.title}</p>
                            <p className="text-slate-400 text-[11px]">{src.relevance}</p>
                          </div>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 text-[11px] inline-flex items-center space-x-1 flex-shrink-0 underline"
                            >
                              <span>Inspect Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                  <Compass className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-200">
                  Ready for Continuous Inquiry
                </h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                  Select a document on the left and choose a growth vector or submit a custom question.
                  The system will synthesize real-world verified data and seamlessly append the growth dossier to your Google Doc.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-8">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">
            No Google Drive Documents Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            Please capture and archive at least one research item in the Ingest tab first to begin mapping growth vectors.
          </p>
          <button
            onClick={onNavigateToArchive}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            Go to Capture Tab
          </button>
        </div>
      )}
    </div>
  );
};
