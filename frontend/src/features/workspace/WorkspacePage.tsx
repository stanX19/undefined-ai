import { useShallow } from "zustand/react/shallow";
import { SurfaceRenderer } from "../a2ui/SurfaceRenderer.tsx";
import { useSurfaceStore } from "../a2ui/store.ts";
import { ChatPanel } from "../chat/components/ChatPanel.tsx";
import { TopicsSidebar } from "./components/TopicsSidebar.tsx";

export function WorkspacePage() {
  const surfaceIds = useSurfaceStore(
    useShallow((s) => Array.from(s.surfaces.keys())),
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-(--color-bg)">
      {/* Left — Topics sidebar */}
      <TopicsSidebar />

      {/* Center — Main UI Panel */}
      <main className="flex flex-1 flex-col overflow-y-auto p-6">
        {surfaceIds.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-text-primary">
              Workspace
            </h2>
            <p className="max-w-md text-text-muted">
              Start a conversation in the chat panel to generate a custom UI.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-20">
            {surfaceIds.map((id) => (
              <SurfaceRenderer key={id} surfaceId={id} />
            ))}
          </div>
        )}
      </main>

      {/* Right — Chat Panel */}
      <div className="w-[400px] shrink-0 border-l border-border bg-surface">
        <ChatPanel inline={true} />
      </div>
    </div>
  );
}
