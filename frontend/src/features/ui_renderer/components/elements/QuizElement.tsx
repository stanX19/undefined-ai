import { memo, useState, useCallback } from "react";
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

    // Robust matching logic to handle different LLM answer formats (text, index, or label)
    const isOptionCorrect = useCallback((opt: string, idx: number) => {
        if (!element.answer) return false;
        const normOpt = opt.toLowerCase().trim();
        const normAns = element.answer.toString().toLowerCase().trim();

        // 1. Direct text match
        if (normOpt === normAns) return true;

        // 2. Index match ("0", "1", "2"...)
        if (normAns === idx.toString()) return true;

        // 3. Label match ("a", "b", "c" or "A", "B", "C" or "A)", "1."...)
        const label = String.fromCharCode(65 + idx).toLowerCase();
        const numericLabel = (idx + 1).toString();

        if (normAns === label || normAns.startsWith(`${label})`) || normAns.startsWith(`${label}.`)) return true;
        if (normAns === numericLabel || normAns.startsWith(`${numericLabel})`) || normAns.startsWith(`${numericLabel}.`)) return true;

        // 4. Reverse strip: if answer is "A. Software" but option is "Software"
        const strippedAns = normAns.replace(/^[a-z0-9][\).\s-]+/, '').trim();
        if (normOpt === strippedAns && strippedAns.length > 0) return true;

        return false;
    }, [element.answer]);

    // Calculate current submission status
    const selectedIdx = element.options.findIndex(opt => opt === selectedOption);
    const isCorrect = isSubmitted && selectedOption !== null && isOptionCorrect(selectedOption, selectedIdx);

    const handleSubmit = () => {
        if (!selectedOption) return;
        setIsSubmitted(true);
        if (handlers.onChange) handlers.onChange();
    };

    return (
        <div className={`w-full overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100/70 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all ${className}`} style={style}>
            {/* Minimalist Header */}
            <div className="p-8 pb-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Knowledge Check</span>
                    </div>
                    {element.difficulty !== undefined && (
                        <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
                            <span className="text-[10px] font-semibold text-slate-500">Lv.{element.difficulty}</span>
                        </div>
                    )}
                </div>
                <h3 className="text-[18px] font-bold tracking-tight text-slate-800 leading-snug">{element.question}</h3>
            </div>

            {/* Modern Options Container */}
            <div className="px-8 pb-8">
                <div className="flex flex-col gap-2.5">
                    {element.options.map((opt, idx) => {
                        const isSelected = selectedOption === opt;
                        const isThisCorrect = isOptionCorrect(opt, idx);
                        const isAnswerCorrect = isSubmitted && isThisCorrect;
                        const isAnswerWrong = isSubmitted && isSelected && !isThisCorrect;

                        let styleClasses = "border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm";

                        if (isSelected && !isSubmitted) {
                            styleClasses = "border-slate-900 bg-slate-900 text-white shadow-md";
                        } else if (isSubmitted) {
                            if (isAnswerCorrect) {
                                styleClasses = "border-emerald-100 bg-emerald-50 text-emerald-900";
                            } else if (isAnswerWrong) {
                                styleClasses = "border-rose-100 bg-rose-50 text-rose-900";
                            } else {
                                styleClasses = "border-slate-50 bg-slate-50/50 text-slate-500 opacity-70";
                            }
                        }

                        return (
                            <button
                                key={idx}
                                disabled={isSubmitted || element.state === "disabled"}
                                onClick={() => setSelectedOption(opt)}
                                className={`group flex w-full cursor-pointer items-center justify-between rounded-2xl border px-6 py-4 text-left transition-all duration-300 ${styleClasses} disabled:cursor-not-allowed`}
                            >
                                <span className="text-[14px] font-semibold tracking-tight transition-colors">{opt}</span>
                                <div className="flex items-center gap-2">
                                    {isSubmitted && isAnswerCorrect && <CheckCircle2 className="text-emerald-500" size={18} />}
                                    {isSubmitted && isAnswerWrong && <XCircle className="text-rose-500" size={18} />}
                                    {!isSubmitted && (
                                        <div className={`h-2 w-2 rounded-full border transition-all ${isSelected ? 'border-white bg-white scale-125' : 'border-slate-200 group-hover:border-slate-400'}`} />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Integrated Action & Feedback */}
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedOption || element.state === "disabled"}
                        className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-[13px] font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                    >
                        Submit Answer <ChevronRight size={14} className="opacity-50" />
                    </button>
                ) : (
                    <div className={`mt-8 animate-in slide-in-from-top-2 duration-500 rounded-2xl p-6 border ${isCorrect ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {isCorrect ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-600" />}
                            <span className={`text-[13px] font-extrabold uppercase tracking-widest ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isCorrect ? 'Excellence' : 'Analysis'}
                            </span>
                        </div>
                        {element.explanation && (
                            <p className={`text-[14px] font-medium leading-relaxed italic ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                                "{element.explanation}"
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
