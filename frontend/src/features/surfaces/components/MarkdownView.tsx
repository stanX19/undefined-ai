import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIMarkdownView({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const content = resolveDynamic<string>(
    definition.text as string | { literalString: string } | { path: string } | undefined ??
    definition.content as string | { literalString: string } | { path: string } | undefined,
    dataModel,
    scopePrefix,
  ) ?? "";

  if (!content) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">
        No content
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
