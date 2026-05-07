"use client";

import { ChefHat } from "lucide-react";
import { motion } from "framer-motion";

type ModernLoaderProps = {
  label?: string;
  size?: number;
  className?: string;
  tone?: "light" | "dark";
};

export default function ModernLoader({
  label = "Loading...",
  size = 56,
  className = "",
  tone = "dark",
}: ModernLoaderProps) {
  const accent = tone === "light" ? "#ffffff" : "#5b2d17";
  const pulseBorder = tone === "light" ? "rgba(255,255,255,0.55)" : "rgba(184, 74, 43, 0.7)";
  const pulseBorderSoft = tone === "light" ? "rgba(255,255,255,0.28)" : "rgba(234, 220, 207, 0.45)";
  const dotColor = tone === "light" ? "#ffffff" : "#b84a2b";

  const box = Math.max(76, Math.round(size * 1.35));
  const iconPx = Math.max(26, Math.round(size * 0.5));
  const ringBase = Math.round(box * 0.58);

  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      <div
        className="relative flex flex-col items-center justify-center"
        style={{ width: box, height: box }}
      >
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-full border-2"
            style={{
              width: ringBase,
              height: ringBase,
              left: "50%",
              top: "50%",
              marginLeft: -ringBase / 2,
              marginTop: -ringBase / 2,
              borderColor: i === 0 ? pulseBorder : pulseBorderSoft,
            }}
            initial={false}
            animate={{ scale: [0.68, 1.12], opacity: [0.5, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: [0.22, 1, 0.36, 1],
              delay: i * 0.85,
            }}
          />
        ))}

        <motion.div
          className="relative z-[1] flex flex-col items-center"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
          style={{
            filter:
              tone === "light"
                ? "drop-shadow(0 8px 14px rgba(0,0,0,0.25))"
                : "drop-shadow(0 6px 12px rgba(47,28,18,0.14))",
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.03, 1], rotate: [-2, 2, -2] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "50% 85%" }}
          >
            <ChefHat size={iconPx} color={accent} strokeWidth={2} />
          </motion.div>

          <div className="mt-1 flex items-center justify-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: dotColor,
                  opacity: tone === "light" ? 0.92 : 1,
                }}
                animate={{
                  y: [0, -6, 0],
                  scale: [0.88, 1, 0.88],
                  opacity: tone === "light" ? [0.45, 1, 0.45] : [0.35, 1, 0.35],
                }}
                transition={{
                  duration: 0.95,
                  repeat: Infinity,
                  ease: [0.45, 0, 0.55, 1],
                  delay: i * 0.16,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
