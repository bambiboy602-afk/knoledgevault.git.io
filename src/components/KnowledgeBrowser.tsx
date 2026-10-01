import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Trash2,
  Folder,
  FileText,
  Clock,
  Tag,
  Eye,
  RefreshCw,
  FolderOpen,
  Calendar,
  X,
} from 'lucide-react';
import { DriveDocFile, DriveFolderInfo } from '../types/knowledge';
import { ConfirmationModal } from './ConfirmationModal';
import { deleteDriveFile } from '../lib/driveApi';
import { getGoogleDocText } from '../lib/docsApi';

interface KnowledgeBrowserProps {
  documents: DriveDocFile[];
  accessToken: string | null;
  rootFolder: DriveFolderInfo | null;
  onRefresh: () => Promise<void>;
  onDeleteSuccess: (fileId: string) => void;
  onNavigateToIngest: () => void;
}

export const KnowledgeBrowser: React.FC<KnowledgeBrowserProps> = ({
  documents,
  accessToken,
  rootFolder,
  onRefresh,
  onDeleteSuccess,
  onNavigateToIngest,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<DriveDocFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Deletion modal state (strictly required user confirmation)
  const [docToDelete, setDocToDelete] = useState<DriveDocFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return ['All', ...Array.from(set)];
  }, [documents]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        (doc.executiveSummary && doc.executiveSummary.toLowerCase().includes(q)) ||
        (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(q)));
      return matchesCategory && matchesSearch;
    });
  }, [documents, selectedCategory, searchQuery]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenPreview = async (doc: DriveDocFile) => {
    setPreviewDoc(doc);
    setPreviewContent(null);
    if (!accessToken) return;

    setIsLoadingPreview(true);
    try {
      const text = await getGoogleDocText(accessToken, doc.id);
      setPreviewContent(text);
    } catch (err: any) {
      console.error('Failed to read doc:', err);
      setPreviewContent(
        doc.executiveSummary ||
          'Failed to load inline preview from Google Docs. You can still open it directly in Google Docs via the button above.'
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete || !accessToken) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteDriveFile(accessToken, docToDelete.id);
      onDeleteSuccess(docToDelete.id);
      if (previewDoc?.id === docToDelete.id) {
        setPreviewDoc(null);
      }
      setDocToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      setDeleteError(err.message || 'Failed to delete file from Google Drive');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header controls & stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Google Drive Knowledge Archive
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'Doc' : 'Docs'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse structured Google Docs organized into categorized folders within your Google Drive.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {rootFolder && (
            <a
              href={rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Open Drive Folder</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
            title="Refresh documents list from Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Drive'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title, tags, or concepts..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {deleteError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {deleteError}
        </div>
      )}

      {/* Document Grid / List */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group hover:shadow-indigo-500/5"
            >
              <div>
                {/* Category and Date Header */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 truncate">
                    {doc.category || 'General Research'}
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] text-slate-500 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {doc.modifiedTime
                        ? new Date(doc.modifiedTime).toLocaleDateString()
                        : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Doc Title */}
                <h3 className="font-bold text-sm text-slate-100 group-hover:text-sky-300 transition line-clamp-2 mb-2">
                  {doc.name}
                </h3>

                {/* Summary snippet */}
                {doc.executiveSummary && (
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">
                    {doc.executiveSummary}
                  </p>
                )}

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {doc.tags.slice(0, 3).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        #{tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[10px] text-slate-500 self-center">
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenPreview(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center space-x-1"
                    title="Quick Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-[11px] hidden sm:inline">Inspect</span>
                  </button>

                  <a
                    href={doc.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition text-xs flex items-center space-x-1"
                    title="Open directly in Google Docs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">Google Doc</span>
                  </a>
                </div>

                {/* Mandatory confirmation triggered on delete click */}
                <button
                  onClick={() => setDocToDelete(doc)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Delete from Google Drive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-8">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">
            {searchQuery || selectedCategory !== 'All'
              ? 'No matching knowledge documents found'
              : 'Knowledge Archive is Empty'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            {searchQuery || selectedCategory !== 'All'
              ? 'Try adjusting your search criteria or category filter.'
              : 'Start by capturing and structuring research into Google Drive and Google Docs.'}
          </p>
          <button
            onClick={onNavigateToIngest}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            Capture First Research Piece
          </button>
        </div>
      )}

      {/* Inline Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/90">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {previewDoc.category || 'Research'}
                </span>
                <h3 className="text-base font-bold text-white truncate mt-1">
                  {previewDoc.name}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewDoc.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  <span>Open in Google Docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <p>Streaming document contents from Google Docs API...</p>
                </div>
              ) : (
                previewContent || previewDoc.executiveSummary || 'No content found.'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Destructive Delete */}
      <ConfirmationModal
        isOpen={!!docToDelete}
        title="Delete Document from Google Drive?"
        message={`Are you sure you want to permanently delete "${docToDelete?.name}" from your Google Drive? This will remove the Google Doc from your CognitiveVault archive and cannot be undone.`}
        confirmLabel="Confirm Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
