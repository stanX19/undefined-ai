import { useMarkGraphStore } from "../store.ts";
import type { InputBlock } from "../types.ts";

export function InputBlockView({ block }: { block: InputBlock }) {
  const { updateSignal } = useMarkGraphStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (block.explicit_id) {
      updateSignal(block.explicit_id, e.target.value);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface rounded-md border border-border">
      <label className="font-semibold text-text-primary text-sm">
        {block.question}
      </label>
      <input
        type="text"
        placeholder={block.placeholder || "Your answer..."}
        value={block.user_text || ""}
        onChange={handleChange}
        className="px-3 py-2 bg-bg border border-border rounded-md text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  );
}
