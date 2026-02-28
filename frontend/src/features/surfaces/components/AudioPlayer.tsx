import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIAudioPlayer({
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
      <div className="rounded-lg bg-[var(--color-surface-alt)] p-4 text-sm text-[var(--color-text-muted)]">
        No audio source
      </div>
    );
  }

  return (
    <audio src={url} controls className="w-full" preload="metadata" />
  );
}
