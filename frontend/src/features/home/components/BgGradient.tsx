interface BgGradientProps {
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientSize?: string;
  gradientPosition?: string;
  gradientStop?: string;
}

/**
 * Gradient background: white at top, fading to green towards bottom.
 * Strong, obvious gradient for clear visibility.
 */
export function BgGradient({
  className = "",
  gradientFrom = "#fff",
  gradientTo = "#d5fba8",
  gradientSize = "90% 150%",
  gradientPosition = "50% 0%",
  gradientStop = "5%",
}: BgGradientProps) {
  // Strong greens so the gradient is unmistakable
  const midGreen = "#b8e88a";
  const bottomGreen = "#5aad4a";
  return (
    <div
      className={`absolute inset-0 h-full w-full -z-10 ${className}`}
      style={{
        background: `linear-gradient(to bottom, ${gradientFrom} 0%, #f0fce0 15%, ${midGreen} 40%, ${gradientTo} 65%, ${bottomGreen} 100%)`,
      }}
    />
  );
}
