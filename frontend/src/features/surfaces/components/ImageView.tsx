import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIImage({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const url = resolveDynamic<string>(
    definition.url as string | { literalString: string } | { path: string },
    dataModel,
    scopePrefix,
  );

  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      className="max-w-full rounded-lg"
      loading="lazy"
    />
  );
}
