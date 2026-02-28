import { memo, useState } from "react";
import type { UIQuiz } from "../../types.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";
import { generateEventHandlers } from "../../actionHandler.ts";
import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";

interface QuizElementProps {
    element: UIQuiz;
}

export const QuizElement = memo(function QuizElement({ element }: QuizElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const handlers = generateEventHandlers(element.events);

    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const isCorrect = selectedOption === element.answer;

    const handleSubmit = () => {
        if (!selectedOption) return;
        setIsSubmitted(true);
        // Trigger any onChange or onClick handlers defined in protocol
        if (handlers.onChange) handlers.onChange();
    };

    return (
        <div className={`w-full overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-sm ${className}`} style={style}>
            {/* Quiz Header */}
            <div className="border-b border-(--color-border) bg-(--a2ui-primary,var(--color-primary))/10 p-5">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-(--a2ui-primary,var(--color-primary))">Knowledge Check</span>
                    {element.difficulty !== undefined && (
                        <span className="text-xs font-medium text-(--color-text-muted)">Difficulty: {element.difficulty}</span>
                    )}
                </div>
                <h3 className="text-lg font-medium text-(--color-text-primary)">{element.question}</h3>
            </div>

            {/* Options */}
            <div className="p-5">
                <div className="flex flex-col gap-3">
                    {element.options.map((opt, idx) => {
                        const isSelected = selectedOption === opt;
                        const isAnswerCorrect = isSubmitted && opt === element.answer;
                        const isAnswerWrong = isSubmitted && isSelected && !isCorrect;

                        let optionClass = "border border-(--color-border) bg-transparent hover:border-(--a2ui-primary,var(--color-primary)) hover:bg-(--a2ui-primary,var(--color-primary))/5";

                        if (isSelected && !isSubmitted) {
                            optionClass = "border-(--a2ui-primary,var(--color-primary)) bg-(--a2ui-primary,var(--color-primary))/10 ring-1 ring-(--a2ui-primary,var(--color-primary))";
                        } else if (isSubmitted) {
                            if (isAnswerCorrect) {
                                optionClass = "border-green-500 bg-green-500/10 ring-1 ring-green-500 text-green-900 dark:text-green-100";
                            } else if (isAnswerWrong) {
                                optionClass = "border-red-500 bg-red-500/10 ring-1 ring-red-500 text-red-900 dark:text-red-100 opacity-80";
                            } else {
                                optionClass = "border-(--color-border) opacity-50";
                            }
                        }

                        return (
                            <button
                                key={idx}
                                disabled={isSubmitted || element.state === "disabled"}
                                onClick={() => setSelectedOption(opt)}
                                className={`flex w-full cursor-pointer items-center justify-between rounded-xl p-4 text-left transition-all ${optionClass} disabled:cursor-not-allowed`}
                            >
                                <span className="text-sm font-medium">{opt}</span>
                                {isSubmitted && isAnswerCorrect && <CheckCircle2 className="text-green-500" size={20} />}
                                {isSubmitted && isAnswerWrong && <XCircle className="text-red-500" size={20} />}
                            </button>
                        );
                    })}
                </div>

                {/* Submit Action */}
                {!isSubmitted && (
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedOption || element.state === "disabled"}
                        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-(--a2ui-primary,var(--color-primary)) py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Submit Answer <ChevronRight size={16} />
                    </button>
                )}

                {/* Feedback area */}
                {isSubmitted && (
                    <div className={`mt-6 rounded-xl p-4 ${isCorrect ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                        <p className={`font-semibold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {isCorrect ? 'Correct!' : 'Incorrect.'}
                        </p>
                        {element.explanation && (
                            <p className="mt-2 text-sm text-(--color-text-primary)">
                                {element.explanation}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
