import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Search,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Bookmark,
  Share2,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  FolderPlus,
  Compass,
  Tag,
  Plus,
  X,
} from 'lucide-react';
import { KnowledgeAnalysis, DriveDocFile, DriveFolderInfo } from '../types/knowledge';
import {
  getOrCreateRootKnowledgeFolder,
  getOrCreateCategoryFolder,
  createDocumentInDrive,
} from '../lib/driveApi';
import { populateGoogleDoc } from '../lib/docsApi';

interface IngestPanelProps {
  accessToken: string | null;
  onDocCreated: (doc: DriveDocFile) => void;
  rootFolder: DriveFolderInfo | null;
  setRootFolder: (folder: DriveFolderInfo) => void;
  onNavigateToArchive: () => void;
}

export const IngestPanel: React.FC<IngestPanelProps> = ({
  accessToken,
  onDocCreated,
  rootFolder,
  setRootFolder,
  onNavigateToArchive,
}) => {
  const [inputText, setInputText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<KnowledgeAnalysis | null>(null);

  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('');
  const [savedDoc, setSavedDoc] = useState<DriveDocFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom tags management
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [preAssignTagInput, setPreAssignTagInput] = useState('');

  const handleAddTag = (rawTag?: string) => {
    const textToClean = (rawTag !== undefined ? rawTag : newTagInput).trim();
    if (!textToClean) return;
    const cleanTag = textToClean.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
    if (cleanTag && !customTags.includes(cleanTag)) {
      const updated = [...customTags, cleanTag];
      setCustomTags(updated);
      if (analysisResult) {
        setAnalysisResult({ ...analysisResult, tags: updated });
      }
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = customTags.filter((t) => t !== tagToRemove);
    setCustomTags(updated);
    if (analysisResult) {
      setAnalysisResult({ ...analysisResult, tags: updated });
    }
  };

  const handleAddPreAssignTag = (rawTag?: string) => {
    const textToClean = (rawTag !== undefined ? rawTag : preAssignTagInput).trim();
    if (!textToClean) return;
    const cleanTag = textToClean.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
    if (cleanTag && !customTags.includes(cleanTag)) {
      setCustomTags([...customTags, cleanTag]);
    }
    setPreAssignTagInput('');
  };

  // Sample templates to jumpstart investigation
  const samplePresets = [
    {
      label: 'Quantum Computing Breakthrough',
      text: 'Researchers at an international consortium have demonstrated a 1,000-qubit fault-tolerant quantum error correction architecture with continuous logical qubit cycling. The fidelity reaches 99.98% using topological surface codes, potentially reducing the timeline to quantum advantage in molecular simulation by 5 years.',
      source: 'https://nature.com/articles/quantum-qec-2026',
    },
    {
      label: 'Autonomous Agent Safety & Alignment',
      text: 'Recent evaluations of multi-agent autonomous systems show emergent tool-use collaboration patterns. Without explicit containment protocols, multi-agent chains exhibit coordination drift and capability amplification. Robust verification sandboxes, formal intent verification, and strict credential isolation are recommended.',
      source: 'https://arxiv.org/abs/2603.multiagent-alignment',
    },
    {
      label: 'Solid-State Battery Industrialization',
      text: 'Automotive battery manufacturing has achieved a volumetric energy density exceeding 850 Wh/L with solid sulfide electrolyte cells, withstanding 1,200 fast-charge cycles at 80% capacity retention. Supply chain scale-up for dry electrode coating is reducing cell-level manufacturing cost below $65/kWh.',
      source: 'https://energy-storage.org/reports/solidstate-batteries-2026',
    },
  ];

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setErrorMessage('Please provide text, findings, or research notes to analyze.');
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    setSavedDoc(null);

    try {
      const response = await fetch('/api/analyze-and-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: inputText,
          sourceUrl: sourceUrl.trim() || undefined,
          contextNotes: contextNotes.trim() || undefined,
          searchWebFirst: useSearchGrounding,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze content.');
      }

      const returnedTags = data.data.tags || [];
      const mergedTags = Array.from(new Set([...customTags, ...returnedTags]));
      setCustomTags(mergedTags);

      setAnalysisResult({
        ...data.data,
        tags: mergedTags,
        originalText: inputText,
        sourceUrl: sourceUrl.trim() || undefined,
      });
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMessage(err.message || 'Error running intelligent analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToDriveAndDocs = async () => {
    if (!analysisResult) return;
    if (!accessToken) {
      setErrorMessage('Please connect your Google Account first to store in Drive and Docs.');
      return;
    }

    setIsSavingToDrive(true);
    setErrorMessage(null);

    try {
      const finalTags = customTags.length > 0 ? customTags : (analysisResult.tags || []);
      const updatedAnalysis: KnowledgeAnalysis = {
        ...analysisResult,
        tags: finalTags,
      };

      // Step 1: Ensure Root Folder
      setSyncStatusMessage('Locating/Creating CognitiveVault root folder in Google Drive...');
      let currentRoot = rootFolder;
      if (!currentRoot) {
        currentRoot = await getOrCreateRootKnowledgeFolder(accessToken);
        setRootFolder(currentRoot);
      }

      // Step 2: Ensure Category Subfolder
      setSyncStatusMessage(`Organizing subfolder for category: "${updatedAnalysis.category}"...`);
      const categoryFolder = await getOrCreateCategoryFolder(
        accessToken,
        currentRoot.id,
        updatedAnalysis.category
      );

      // Step 3: Create Google Doc inside Category Subfolder with custom tags
      setSyncStatusMessage('Creating Google Document in category folder...');
      const createdDoc = await createDocumentInDrive(
        accessToken,
        updatedAnalysis.title,
        categoryFolder.id,
        updatedAnalysis.executiveSummary.slice(0, 200) + '...',
        {
          category: updatedAnalysis.category,
          tags: finalTags.join(','),
        }
      );

      // Step 4: Populate structured content via Google Docs API
      setSyncStatusMessage('Compiling structured analysis, citations, and growth vectors into Google Doc...');
      await populateGoogleDoc(accessToken, createdDoc.id, updatedAnalysis);

      setSyncStatusMessage('Complete! Successfully logged and archived in Google Drive & Docs.');
      setSavedDoc({
        ...createdDoc,
        tags: finalTags,
        category: updatedAnalysis.category,
        folderName: categoryFolder.name,
      });
      onDocCreated({
        ...createdDoc,
        tags: finalTags,
        category: updatedAnalysis.category,
        folderName: categoryFolder.name,
      });
    } catch (err: any) {
      console.error('Save to Drive error:', err);
      setErrorMessage(`Drive/Docs Sync Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Ingest Guidance */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Smart Research Ingestion</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Ingest, Categorize & Archive Knowledge
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Feed raw information, findings, or research clippings. The system will categorize the material,
              generate structured summaries in Google Docs, and organize them into categorized folders in your Google Drive.
            </p>
          </div>
          {savedDoc && (
            <button
              onClick={onNavigateToArchive}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold transition"
            >
              <FileText className="w-4 h-4" />
              <span>View in Archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Ingest Form & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                <span>Source Information Input</span>
              </h3>
              <span className="text-xs text-slate-400">Step 1 of 2</span>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">Quick load benchmark topics:</p>
              <div className="flex flex-wrap gap-2">
                {samplePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(preset.text);
                      setSourceUrl(preset.source);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 hover:text-white transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Raw Text Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Research Findings / Raw Text Content <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste research excerpts, empirical data, claims, meeting intelligence, or topic details here..."
                rows={7}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 leading-relaxed resize-y outline-none transition"
              />
            </div>

            {/* Optional Source URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Source Reference URL <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/research-paper-or-article"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* Optional Context Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Investigative Context / Target Objectives{' '}
                <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                placeholder="e.g. Focus on commercial viability and patents"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* Custom Pre-assign Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Custom Tags to Pre-Assign</span>
                </label>
                <span className="text-[11px] text-slate-500">(Optional)</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={preAssignTagInput}
                  onChange={(e) => setPreAssignTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPreAssignTag();
                    }
                  }}
                  placeholder="e.g. quantum, benchmark, 2026"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => handleAddPreAssignTag()}
                  disabled={!preAssignTagInput.trim()}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold transition"
                  title="Add tag"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-400 p-0.5"
                        title="Remove tag"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Google Search Grounding Toggle */}
            <div className="pt-2">
              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                    <Search className="w-3.5 h-3.5 text-sky-400" />
                    <span>Enable Live Web Grounding</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enrich findings with live public search data and verified citations.
                  </p>
                </div>
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Submit Action */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !inputText.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing & Categorizing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-sky-300" />
                  <span>Analyze & Structure Information</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Structured Preview & Google Drive Sync */}
        <div className="lg:col-span-7 space-y-6">
          {analysisResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Document Header & Drive Sync Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {analysisResult.category}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {customTags.length} {customTags.length === 1 ? 'tag' : 'tags'} attached
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {analysisResult.title}
                  </h3>
                </div>

                {/* Google Drive / Docs Logging Action */}
                <div>
                  {!savedDoc ? (
                    <button
                      onClick={handleSaveToDriveAndDocs}
                      disabled={isSavingToDrive}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition whitespace-nowrap"
                    >
                      {isSavingToDrive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Filing in Drive...</span>
                        </>
                      ) : (
                        <>
                          <FolderPlus className="w-4 h-4 text-sky-200" />
                          <span>Log to Drive & Docs</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href={savedDoc.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Open Google Doc</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Interactive Tag & Taxonomy Assignment Box */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Document Tags & Taxonomy
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      Editable before saving
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Saved to Google Drive properties & Document metadata
                  </span>
                </div>

                {/* Tag Pills with Delete X */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  {customTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-950/50 text-indigo-300 border border-indigo-800/60 shadow-sm"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-400 p-0.5 rounded hover:bg-slate-800 transition"
                        title={`Remove tag #${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {customTags.length === 0 && (
                    <span className="text-xs text-slate-500 italic px-1">
                      No tags assigned. Type a custom tag below before filing to Drive.
                    </span>
                  )}
                </div>

                {/* Inline Add Tag Form & Suggested Quick Tags */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add custom tag (e.g. priority-1, verified, patent, roadmap)..."
                      className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      disabled={!newTagInput.trim()}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Tag</span>
                    </button>
                  </div>

                  {/* Suggested quick tags */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-slate-500 flex-shrink-0 text-[10px]">Quick:</span>
                    {['high-priority', 'verified', 'deep-dive', 'follow-up'].map((qTag) => (
                      <button
                        key={qTag}
                        type="button"
                        onClick={() => handleAddTag(qTag)}
                        disabled={customTags.includes(qTag)}
                        className={`px-2 py-0.5 rounded text-[10px] transition ${
                          customTags.includes(qTag)
                            ? 'bg-slate-800/40 text-slate-600 cursor-default'
                            : 'bg-slate-900 text-slate-300 hover:text-indigo-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        +{qTag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sync Status Banner */}
              {syncStatusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    savedDoc
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300'
                  }`}
                >
                  {savedDoc ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin text-indigo-400" />
                  )}
                  <span>{syncStatusMessage}</span>
                </div>
              )}

              {/* 1. Executive Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Executive Summary</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-300 leading-relaxed space-y-2">
                  {analysisResult.executiveSummary.split('\n\n').map((paragraph, pIdx) => (
                    <p key={pIdx}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* 2. Key Findings & Claims */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Key Findings & Claims</span>
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {analysisResult.keyFindings.map((finding, kfIdx) => (
                    <div
                      key={kfIdx}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-200">
                          {finding.claim}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                            finding.confidence === 'high'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : finding.confidence === 'moderate'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {finding.confidence}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        <span className="text-slate-500">Evidence:</span> {finding.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Thematic Analysis Sections */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <Share2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Thematic Analysis & Structure</span>
                </h4>
                <div className="space-y-3">
                  {analysisResult.structuredSections.map((sec, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs"
                    >
                      <h5 className="font-bold text-slate-200 text-sm">{sec.heading}</h5>
                      {sec.paragraphs.map((p, pIdx) => (
                        <p key={pIdx} className="text-slate-300 leading-relaxed">
                          {p}
                        </p>
                      ))}
                      {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-4 list-disc text-slate-300 marker:text-indigo-400">
                          {sec.bulletPoints.map((bp, bpIdx) => (
                            <li key={bpIdx}>{bp}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. References */}
              {analysisResult.references.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    References & Source Attribution
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.references.map((ref, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{ref.title}</p>
                          <p className="text-slate-400 text-[11px]">{ref.citationText}</p>
                        </div>
                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 text-[11px] underline flex-shrink-0"
                          >
                            <span>Visit Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Growth Vectors & Expansion Inquiries */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Knowledge Growth Vectors & Next Avenues</span>
                </h4>
                <div className="space-y-2.5">
                  {analysisResult.growthVectors.map((gv, gvIdx) => (
                    <div
                      key={gvIdx}
                      className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                          {gvIdx + 1}
                        </span>
                        <span className="font-semibold text-white">{gv.question}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] pl-7">
                        <span className="text-slate-500 font-medium">Rationale:</span> {gv.reason}
                      </p>
                      <p className="text-indigo-300 text-[11px] pl-7">
                        <span className="text-indigo-400 font-medium">Action:</span> {gv.suggestedAction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Awaiting Research Input
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                Enter your research findings, empirical claims, or intelligence notes on the left.
                CognitiveVault will synthesize the findings, extract verified claims, assign taxonomy categories,
                and format a complete Google Doc ready for filing directly into Google Drive.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
