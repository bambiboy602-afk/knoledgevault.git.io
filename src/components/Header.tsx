import React from 'react';
import { User } from 'firebase/auth';
import { Database, FolderGit2, LogOut, Sparkles, Folder, ExternalLink } from 'lucide-react';
import { DriveFolderInfo } from '../types/knowledge';

interface HeaderProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  activeTab: 'ingest' | 'archive' | 'growth';
  onTabChange: (tab: 'ingest' | 'archive' | 'growth') => void;
  rootFolder: DriveFolderInfo | null;
  documentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  needsAuth,
  isLoggingIn,
  onLogin,
  onLogout,
  activeTab,
  onTabChange,
  rootFolder,
  documentCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Database className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-sky-300 bg-clip-text text-transparent">
                  CognitiveVault
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Drive & Docs
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Knowledge Organization & Synthesis Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {user && !needsAuth && (
            <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => onTabChange('ingest')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'ingest'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Capture & Ingest</span>
              </button>
              <button
                onClick={() => onTabChange('archive')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'archive'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Knowledge Archive</span>
                {documentCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px]">
                    {documentCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => onTabChange('growth')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'growth'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Growth Vectors</span>
              </button>
            </nav>
          )}

          {/* User & Google Connection */}
          <div className="flex items-center space-x-3">
            {rootFolder && user && (
              <a
                href={rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition"
                title="Open CognitiveVault root folder in Google Drive"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[120px]">Vault in Drive</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
                <div className="flex items-center space-x-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium text-slate-200 leading-tight">
                      {user.displayName || 'Researcher'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Official Styled Sign in with Google Button */
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center space-x-2.5 px-4 py-2 bg-white text-slate-800 hover:bg-slate-100 rounded-xl font-medium text-xs shadow-md transition disabled:opacity-50"
              >
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-4 h-4"
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
                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {user && !needsAuth && (
          <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800">
            <button
              onClick={() => onTabChange('ingest')}
              className={`text-xs font-semibold py-1 px-2 rounded ${
                activeTab === 'ingest' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
              }`}
            >
              Capture
            </button>
            <button
              onClick={() => onTabChange('archive')}
              className={`text-xs font-semibold py-1 px-2 rounded ${
                activeTab === 'archive' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
              }`}
            >
              Archive ({documentCount})
            </button>
            <button
              onClick={() => onTabChange('growth')}
              className={`text-xs font-semibold py-1 px-2 rounded ${
                activeTab === 'growth' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
              }`}
            >
              Growth Vectors
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
