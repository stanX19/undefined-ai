interface Props {
  className?: string;
}

/** Light-theme AI motion logo: soft pastel orbs, borderless, smooth animation */
export function AiMotionLogo({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width="100%"
      height="100%"
      className={className}
    >
      <defs>
        {/* Soft pastel gradients for light theme */}
        <radialGradient id="ai-cyan-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5f3fc" stopOpacity={0.9} />
          <stop offset="70%" stopColor="#67e8f9" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ai-pink-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbcfe8" stopOpacity={0.9} />
          <stop offset="70%" stopColor="#f9a8d4" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ai-purple-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity={0.9} />
          <stop offset="70%" stopColor="#d8b4fe" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
        </radialGradient>
        <filter id="ai-blur-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      {/* Transparent - borderless, blends with page background */}
      <rect width="500" height="500" fill="transparent" />
      <g filter="url(#ai-blur-soft)">
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 250 250"
            to="360 250 250"
            dur="14s"
            repeatCount="indefinite"
          />
          <circle cx="210" cy="210" r="110" fill="url(#ai-cyan-glow)">
            <animate attributeName="r" values="110; 135; 110" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1" keyTimes="0; 0.5; 1" />
          </circle>
        </g>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 250 250"
            to="0 250 250"
            dur="18s"
            repeatCount="indefinite"
          />
          <circle cx="290" cy="220" r="100" fill="url(#ai-pink-glow)">
            <animate attributeName="r" values="100; 125; 100" dur="7s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1" keyTimes="0; 0.5; 1" />
          </circle>
        </g>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 250 250"
            to="360 250 250"
            dur="22s"
            repeatCount="indefinite"
          />
          <circle cx="250" cy="290" r="120" fill="url(#ai-purple-glow)">
            <animate attributeName="r" values="100; 130; 100" dur="8s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1" keyTimes="0; 0.5; 1" />
          </circle>
        </g>
      </g>
    </svg>
  );
}
