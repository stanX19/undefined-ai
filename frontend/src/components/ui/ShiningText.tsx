

interface ShiningTextProps {
    text: string
    className?: string
}

export function ShiningText({ text, className = "" }: ShiningTextProps) {
    return (
        <>
            <style>{`
                @keyframes shine {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .shining-text-anim {
                    background: linear-gradient(110deg, #404040, 35%, #ffffff, 50%, #404040, 75%, #404040);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    color: transparent;
                    animation: shine 2s linear infinite;
                    display: inline-block;
                    font-size: 14px;
                    font-weight: 400;
                }
            `}</style>
            <span className={`shining-text-anim ${className}`}>
                {text}
            </span>
        </>
    )
}
