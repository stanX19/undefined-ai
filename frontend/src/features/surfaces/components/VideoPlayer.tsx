import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIVideoPlayer({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const url = resolveDynamic<string>(
    definition.url as string | { literalString: string } | { path: string },
    dataModel,
    scopePrefix,
  );

  if (!url) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-muted)]">
        No video source
      </div>
    );
  }

  return (
    <video
      src={url}
      controls
      className="w-full rounded-xl"
      preload="metadata"
    />
  );
}
