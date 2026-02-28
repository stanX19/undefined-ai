import { useState, useCallback } from "react";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UIModal({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const entryChild = definition.entryPointChild as string | undefined;
  const contentChild = definition.contentChild as string | undefined;

  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <div onClick={() => setIsOpen(true)} className="inline-block cursor-pointer">
        {entryChild && (
          <A2UIRenderer
            componentId={entryChild}
            components={components}
            dataModel={dataModel}
            scopePrefix={scopePrefix}
          />
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-xl bg-[var(--color-surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {contentChild && (
              <A2UIRenderer
                componentId={contentChild}
                components={components}
                dataModel={dataModel}
                scopePrefix={scopePrefix}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
