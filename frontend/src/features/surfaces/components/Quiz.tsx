import { useState } from "react";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolvePointer } from "../../a2ui/resolver.ts";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export function A2UIQuiz({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const rawData = definition.data
    ? typeof definition.data === "object" &&
      definition.data !== null &&
      "path" in (definition.data as Record<string, unknown>)
      ? (resolvePointer(
          dataModel,
          (definition.data as { path: string }).path,
          scopePrefix,
        ) as QuizQuestion[])
      : (definition.data as QuizQuestion[])
    : undefined;

  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [score, setScore] = useState(0);

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">
        No quiz data
      </div>
    );
  }

  const q = rawData[currentQ];
  const isLast = currentQ === rawData.length - 1;
  const isFinished = currentQ >= rawData.length;

  if (isFinished) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-6 text-center">
        <h3 className="text-xl font-bold">Quiz Complete</h3>
        <p className="mt-2 text-lg">
          Score: {score}/{rawData.length}
        </p>
        <button
          className="mt-4 cursor-pointer rounded-lg bg-[var(--a2ui-primary,var(--color-primary))] px-4 py-2 text-sm font-medium text-white"
          onClick={() => {
            setCurrentQ(0);
            setSelected(null);
            setIsRevealed(false);
            setScore(0);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const handleSelect = (idx: number) => {
    if (isRevealed) return;
    setSelected(idx);
  };

  const handleReveal = () => {
    if (selected === null) return;
    setIsRevealed(true);
    if (selected === q.correctIndex) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setSelected(null);
    setIsRevealed(false);
    setCurrentQ((c) => c + 1);
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-5">
      <div className="mb-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>
          Question {currentQ + 1} of {rawData.length}
        </span>
        <span>Score: {score}</span>
      </div>

      <h4 className="mb-4 text-base font-semibold">{q.question}</h4>

      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          let optionStyle = "border-[var(--color-border)]";
          if (isRevealed && i === q.correctIndex) {
            optionStyle = "border-green-500 bg-green-50 dark:bg-green-950";
          } else if (isRevealed && i === selected && i !== q.correctIndex) {
            optionStyle = "border-red-500 bg-red-50 dark:bg-red-950";
          } else if (i === selected) {
            optionStyle =
              "border-[var(--a2ui-primary,var(--color-primary))] bg-[var(--color-surface-alt)]";
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`cursor-pointer rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${optionStyle}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {isRevealed && q.explanation && (
        <p className="mt-3 rounded-lg bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-muted)]">
          {q.explanation}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {!isRevealed ? (
          <button
            onClick={handleReveal}
            disabled={selected === null}
            className="cursor-pointer rounded-lg bg-[var(--a2ui-primary,var(--color-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="cursor-pointer rounded-lg bg-[var(--a2ui-primary,var(--color-primary))] px-4 py-2 text-sm font-medium text-white"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
