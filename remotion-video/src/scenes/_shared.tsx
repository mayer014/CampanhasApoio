import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/Sora";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";

const display = loadDisplay("normal", { weights: ["800", "900"] }).fontFamily;
const body = loadBody("normal", { weights: ["400", "600", "700"] }).fontFamily;

export const FONT_DISPLAY = display;
export const FONT_BODY = body;

export const COLORS = {
  bg: "#0B0F1A",
  primary: "#3B82F6",
  primaryGlow: "#60A5FA",
  accent: "#F97316",
  accentGlow: "#FB923C",
  white: "#FFFFFF",
  muted: "#94A3B8",
  panel: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
};

export function useStaggerIn(delay: number, damping = 18) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping, stiffness: 180 } });
  return s;
}

export function useFloat(speed = 60, amp = 8, phase = 0) {
  const frame = useCurrentFrame();
  return Math.sin(frame / speed + phase) * amp;
}

export function useExitFade(start: number, length = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + length], [1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

export function PhoneFrame({
  children,
  width = 760,
  height = 1380,
  style,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 80,
        background: "linear-gradient(160deg,#1A1F2E,#0B0F1A)",
        boxShadow: "0 60px 120px -20px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 12px #06090F",
        padding: 18,
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 64,
          overflow: "hidden",
          background: "#0F1422",
          position: "relative",
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          top: 38,
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 30,
          borderRadius: 30,
          background: "#000",
          zIndex: 5,
        }}
      />
    </div>
  );
}

export function Logo({ size = 90 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 20px 50px -10px ${COLORS.primary}80`,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </div>
  );
}
