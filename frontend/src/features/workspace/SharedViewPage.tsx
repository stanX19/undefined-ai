import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMarkGraphStore } from "../markgraph/store.ts";
import { MarkGraphRoot } from "../markgraph/components/MarkGraphRoot.tsx";
import { Share2, ArrowLeft, Bot } from "lucide-react";

export function SharedViewPage() {
  const { token } = useParams<{ token: string }>();
  const { fetchPublicUI, isLoading, error, ast } = useMarkGraphStore();

  useEffect(() => {
    if (token) {
      fetchPublicUI(token);
    }
  }, [token, fetchPublicUI]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#F7F5F3] font-sans">
      {/* Premium Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E0DEDB] bg-[#FAF9F8] px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-all"
          >
            <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
            <span className="hidden sm:inline">Undefined AI</span>
          </Link>
          <div className="h-4 w-px bg-[#E0DEDB]" />
          <div className="flex items-center gap-2 text-sm font-semibold text-[#49423D]">
            <Share2 size={16} className="text-[#605A57]" />
            <span>Shared Revision</span>
          </div>
        </div>

        <Link
          to="/register"
          className="rounded-full bg-[#37322F] px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-[#49423D] transition-all transform hover:scale-105 active:scale-95"
        >
          Create Your Own
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 workspace-scrollbar">
        <div className="mx-auto max-w-5xl bg-white rounded-2xl shadow-xl border border-[#E0DEDB] min-h-[80vh] flex flex-col overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#37322F] border-t-transparent"></div>
                <p className="text-sm font-medium text-[#605A57]">Loading visualizer...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
              <div className="rounded-full bg-red-50 p-6">
                <Share2 size={48} className="text-red-400 opacity-50" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-[#37322F]">Link expired or invalid</h2>
                <p className="text-[#605A57] max-w-xs">The shared UI revision you are looking for could not be found.</p>
              </div>
              <Link
                to="/home"
                className="flex items-center gap-2 text-sm font-medium text-[#37322F] hover:underline"
              >
                <ArrowLeft size={16} />
                Return to Home
              </Link>
            </div>
          )}

          {!isLoading && !error && ast && (
            <div className="flex-1 p-6 sm:p-10">
              <MarkGraphRoot />
            </div>
          )}

          {!isLoading && !error && !ast && !token && (
            <div className="flex flex-1 items-center justify-center p-12 text-[#605A57] italic">
              No content found.
            </div>
          )}
        </div>
        
        {/* Footer branding */}
        <footer className="mt-8 mb-12 text-center">
          <p className="text-xs text-[#908A87]">
            Interative UI generated with <span className="font-semibold text-[#605A57]">MarkGraph</span> &bull; Premium AI Workspaces
          </p>
        </footer>
      </main>
    </div>
  );
}
