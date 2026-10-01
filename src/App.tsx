import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from './lib/firebase';
import {
  getOrCreateRootKnowledgeFolder,
  listKnowledgeDocuments,
} from './lib/driveApi';
import { DriveDocFile, DriveFolderInfo } from './types/knowledge';
import { Header } from './components/Header';
import { IngestPanel } from './components/IngestPanel';
import { KnowledgeBrowser } from './components/KnowledgeBrowser';
import { GrowthMatrix } from './components/GrowthMatrix';
import {
  Database,
  FolderGit2,
  Sparkles,
  Shield,
  FileCheck2,
  TrendingUp,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';

const LOCAL_STORAGE_DOCS_KEY = 'cognitive_vault_docs_cache';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'ingest' | 'archive' | 'growth'>('ingest');
  const [rootFolder, setRootFolder] = useState<DriveFolderInfo | null>(null);
  const [documents, setDocuments] = useState<DriveDocFile[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Sync documents to localStorage cache whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(documents));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [documents]);

  // Load Google Drive files and folder info
  const refreshDriveData = useCallback(async (accessTokenOverride?: string) => {
    const activeToken = accessTokenOverride || token || (await getAccessToken());
    if (!activeToken) return;

    try {
      // 1. Locate or create root vault folder
      const root = await getOrCreateRootKnowledgeFolder(activeToken);
      setRootFolder(root);

      // 2. List knowledge documents
      const docs = await listKnowledgeDocuments(activeToken, root.id);

      setDocuments((prev) => {
        // Merge without losing locally appended data
        const map = new Map<string, DriveDocFile>();
        docs.forEach((d) => map.set(d.id, d));
        prev.forEach((d) => {
          if (!map.has(d.id)) {
            map.set(d.id, d);
          }
        });
        return Array.from(map.values());
      });
    } catch (err) {
      console.error('Failed to sync Drive data:', err);
    }
  }, [token]);

  // Firebase auth state initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        refreshDriveData(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );

    return () => unsubscribe();
  }, [refreshDriveData]);

  // Interactive Google Sign-In
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        await refreshDriveData(result.accessToken);
      }
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setRootFolder(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleDocCreated = (newDoc: DriveDocFile) => {
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
  };

  const handleDeleteSuccess = (fileId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== fileId));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {/* Global Navigation Header */}
      <Header
        user={user}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rootFolder={rootFolder}
        documentCount={documents.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user && !needsAuth ? (
          <div>
            {activeTab === 'ingest' && (
              <IngestPanel
                accessToken={token}
                onDocCreated={handleDocCreated}
                rootFolder={rootFolder}
                setRootFolder={setRootFolder}
                onNavigateToArchive={() => setActiveTab('archive')}
              />
            )}

            {activeTab === 'archive' && (
              <KnowledgeBrowser
                documents={documents}
                accessToken={token}
                rootFolder={rootFolder}
                onRefresh={() => refreshDriveData()}
                onDeleteSuccess={handleDeleteSuccess}
                onNavigateToIngest={() => setActiveTab('ingest')}
              />
            )}

            {activeTab === 'growth' && (
              <GrowthMatrix
                documents={documents}
                accessToken={token}
                rootFolder={rootFolder}
                onDocCreated={handleDocCreated}
                onNavigateToArchive={() => setActiveTab('archive')}
              />
            )}
          </div>
        ) : (
          /* Unauthenticated Landing & Connect Experience */
          <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-10 animate-fade-in">
            {/* Hero Visual Pill */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Google Drive & Docs Intelligence Architecture</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Autonomous Knowledge Capture, Filing & Synthesis
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Connect your Google Account to automatically file research into organized Google Drive folders,
                generate structured reference documents in Google Docs, and power continuous knowledge expansion.
              </p>
            </div>

            {/* Official Google Sign-In Action */}
            <div className="pt-2 flex flex-col items-center justify-center space-y-4">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center space-x-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/20 transition transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-5 h-5"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>
              <p className="text-xs text-slate-400">
                Grants permission to create and organize knowledge folders and documents in your Drive.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 text-left">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-100 text-sm">Automated Drive Categorization</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Creates dedicated taxonomy folders in Google Drive, systematically organizing empirical claims and research notes by domain.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-100 text-sm">Structured Google Docs</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Synthesizes publication-grade Google Docs with executive summaries, verified empirical claims, and full bibliography attribution.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-100 text-sm">Continuous Knowledge Growth</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Uncovers forward growth vectors and unanswered questions, using live web grounding to continuously expand your knowledge tree.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>CognitiveVault — Enterprise Knowledge System with Google Drive & Docs</p>
          <p className="text-slate-400">
            Powered by Google Cloud, Firebase Auth & Google Workspace APIs
          </p>
        </div>
      </footer>
    </div>
  );
}
