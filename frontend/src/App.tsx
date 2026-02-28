import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { SurfaceRenderer } from "./features/a2ui/SurfaceRenderer.tsx";
import { useSurfaceStore } from "./features/a2ui/store.ts";
import { useSseStream } from "./features/a2ui/transport/useSseStream.ts";
import { ChatPanel } from "./features/chat/components/ChatPanel.tsx";
import { loadDemoSurface } from "./features/a2ui/mockDemo.ts";

const SSE_URL = "/api/stream";
const LOAD_DEMO = import.meta.env.DEV;

export function App() {
  const surfaceIds = useSurfaceStore(
    useShallow((s) => Array.from(s.surfaces.keys())),
  );
  useSseStream({ url: SSE_URL, enabled: false });

  useEffect(() => {
    if (LOAD_DEMO) {
      loadDemoSurface();
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <main className="flex flex-1 p-6">
        {surfaceIds.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight">undefined ai</h1>
            <p className="max-w-md text-(--color-text-muted)">
              Your AI-powered learning platform. Open the chat to start
              exploring any topic — the UI adapts to your needs.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {surfaceIds.map((id) => (
              <SurfaceRenderer key={id} surfaceId={id} />
            ))}
          </div>
        )}
      </main>

      <ChatPanel />
    </div>
  );
}
