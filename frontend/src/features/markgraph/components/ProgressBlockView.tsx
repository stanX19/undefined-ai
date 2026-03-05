import { useMarkGraphStore } from "../store.ts";
import type { ProgressBlock } from "../types.ts";
import ReactMarkdown from "react-markdown";

// Helper to evaluate signal references
function evaluateProgress(node: ProgressBlock, idMap: Record<string, any>) {
  if (node.value_fixed !== null && node.value_fixed !== undefined) {
    return node.value_fixed;
  }
  
  if (!node.value_ids || node.value_ids.length === 0) return 0;

  // e.g. = my-quiz + my-checkbox
  let totalScore = 0;
  let maxScore = 0;

  for (const tid of node.value_ids) {
    const target = idMap[tid];
    if (!target) continue;

    if (target.type === "CheckboxBlock") {
      target.items.forEach(([checked]: [boolean, string]) => {
         maxScore += 1;
         if (checked) totalScore += 1;
      });
    } else if (target.type === "QuizBlock") {
      maxScore += 1;
      if (target.user_answer_idx !== null && target.user_answer_idx !== undefined) {
         const isCorrect = target.answers[target.user_answer_idx]?.[1];
         if (isCorrect) totalScore += 1;
      }
    } else if (target.type === "InputBlock") {
      maxScore += 1;
      if (target.user_text && target.user_text.trim().length > 0) {
         totalScore += 1;
      }
    }
  }

  if (maxScore === 0) return 0;
  return totalScore / maxScore; // 0.0 to 1.0
}

export function ProgressBlockView({ block }: { block: ProgressBlock }) {
  const { ast } = useMarkGraphStore();
  const idMap = ast?.id_map || {};

  const progress = evaluateProgress(block, idMap);
  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  // Find the highest threshold met
  let currentBodyNode = null;
  for (let i = block.thresholds.length - 1; i >= 0; i--) {
     if (progress >= block.thresholds[i].percent) {
        currentBodyNode = block.thresholds[i].body;
        break;
     }
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface rounded-md border border-border">
      {block.description && (
        <div className="text-sm font-semibold text-text-primary">{block.description}</div>
      )}
      
      <div className="w-full bg-bg rounded-full h-3 border border-border overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-500 ease-out" 
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-right text-xs text-text-muted font-medium">
        {percent}%
      </div>

      {currentBodyNode && (
        <div className="mt-2 text-sm text-text-secondary bg-primary/10 p-2 rounded prose prose-sm dark:prose-invert">
           {currentBodyNode.text && <ReactMarkdown>{currentBodyNode.text}</ReactMarkdown>}
           {currentBodyNode.include && (
             <span className="italic text-primary block mt-1">
               Included content: {currentBodyNode.include.target}
             </span>
           )}
        </div>
      )}
    </div>
  );
}
