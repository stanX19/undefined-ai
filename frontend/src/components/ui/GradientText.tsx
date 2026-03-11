import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: "horizontal" | "vertical" | "diagonal";
  pauseOnHover?: boolean;
  yoyo?: boolean;
}

export function GradientText({
  children,
  className = "",
  colors = ["#ea580c", "#f59e0b", "#fbbf24"],
  animationSpeed = 8,
  showBorder = false,
  direction = "horizontal",
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const animationDuration = animationSpeed * 1000;

  useEffect(() => {
    const animate = (time: number) => {
      if (isPaused) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      elapsedRef.current += deltaTime;

      if (yoyo) {
        const fullCycle = animationDuration * 2;
        const cycleTime = elapsedRef.current % fullCycle;

        if (cycleTime < animationDuration) {
          progress.set((cycleTime / animationDuration) * 100);
        } else {
          progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
        }
      } else {
        progress.set((elapsedRef.current / animationDuration) * 100);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animationSpeed, yoyo, isPaused, progress]);

  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, yoyo, progress]);

  const backgroundPosition = useTransform(progress, (p) => {
    if (direction === "horizontal") {
      return `${p}% 50%`;
    } else if (direction === "vertical") {
      return `50% ${p}%`;
    } else {
      return `${p}% 50%`;
    }
  });

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const gradientAngle =
    direction === "horizontal"
      ? "to right"
      : direction === "vertical"
        ? "to bottom"
        : "to bottom right";
  const gradientColors = [...colors, colors[0]].join(", ");

  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === "horizontal"
        ? "300% 100%"
        : direction === "vertical"
          ? "100% 300%"
          : "300% 300%",
    backgroundRepeat: "repeat" as const,
  };

  return (
    <motion.div
      className={`relative inline-flex flex-row items-center justify-center rounded-[1.25rem] font-medium backdrop-blur transition-shadow duration-500 overflow-hidden cursor-default ${showBorder ? "py-1 px-2" : ""} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBorder && (
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none rounded-[1.25rem]"
          style={{ ...gradientStyle, backgroundPosition }}
        >
          <div
            className="absolute bg-black rounded-[1.25rem] z-[-1]"
            style={{
              width: "calc(100% - 2px)",
              height: "calc(100% - 2px)",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </motion.div>
      )}
      <motion.div
        className="inline-block relative z-2 text-transparent"
        style={{
          ...gradientStyle,
          backgroundPosition,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
