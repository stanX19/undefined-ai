import { useMarkGraphStore } from "../store.ts";
import type { CheckboxBlock } from "../types.ts";

export function CheckboxBlockView({ block: initialBlock }: { block: CheckboxBlock }) {
  const { updateSignal, ast } = useMarkGraphStore();
  const block = initialBlock.explicit_id && ast?.id_map?.[initialBlock.explicit_id]
      ? (ast.id_map[initialBlock.explicit_id] as CheckboxBlock)
      : initialBlock;

  const handleCheck = (idx: number, checked: boolean) => {
    if (block.explicit_id) {
      updateSignal(block.explicit_id, { idx, checked });
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface rounded-md border border-border">
      {block.items.map(([checked, text], idx) => (
        <label key={idx} className="flex items-center gap-2 cursor-pointer text-sm text-text-primary hover:text-primary transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => handleCheck(idx, e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
          />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}
