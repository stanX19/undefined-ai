import { useMarkGraphStore } from "../store.ts";
import type { QuizBlock } from "../types.ts";

export function QuizBlockView({ block }: { block: QuizBlock }) {
  const { updateSignal } = useMarkGraphStore();

  const handleSelect = (idx: number) => {
    if (block.explicit_id) {
      updateSignal(block.explicit_id, idx);
    }
  };

  const hasAnswered = block.user_answer_idx !== undefined && block.user_answer_idx !== null;

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface rounded-md border border-border">
      <h4 className="font-semibold text-text-primary text-sm">{block.question}</h4>
      <div className="flex flex-col gap-2">
        {block.answers.map(([text, isCorrect], idx) => {
          const isSelected = block.user_answer_idx === idx;
          let btnClass = "text-left px-3 py-2 text-sm rounded-md border transition-colors";
          
          if (hasAnswered) {
             if (isCorrect) {
                btnClass += " bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300";
             } else if (isSelected) {
                btnClass += " bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300";
             } else {
                btnClass += " bg-surface border-border opacity-50";
             }
          } else {
             btnClass += " bg-surface border-border hover:bg-bg hover:border-primary/50 cursor-pointer text-text-primary";
          }

          return (
            <button
              key={idx}
              disabled={hasAnswered}
              onClick={() => handleSelect(idx)}
              className={btnClass}
            >
              {text}
            </button>
          );
        })}
      </div>
      {hasAnswered && block.explanation && (
        <div className="mt-2 text-xs text-text-muted p-2 bg-bg rounded">
          {block.explanation}
        </div>
      )}
    </div>
  );
}
