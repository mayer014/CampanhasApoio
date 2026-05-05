import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

export const Scene3Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useStaggerIn(0);
  const b = useStaggerIn(15);
  const c = useStaggerIn(30);
  const arrow = useStaggerIn(50);
  const arrowDx = interpolate(arrow, [0, 1], [-30, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 32,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: COLORS.primaryGlow,
          opacity: a,
        }}
      >
        A solução
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 120,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 1.02,
          margin: "30px 0 60px",
          opacity: a,
          transform: `translateY(${(1 - a) * 30}px)`,
        }}
      >
        Cada apoiador,
        <br />
        <span style={{ background: `linear-gradient(90deg, ${COLORS.primaryGlow}, ${COLORS.accent})`, WebkitBackgroundClip: "text", color: "transparent" }}>
          um outdoor
        </span>
        <br />
        ambulante.
      </h2>

      <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 40 }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: COLORS.panel,
            border: `3px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: b,
            transform: `scale(${b})`,
          }}
        >
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth="1.6">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        </div>

        <div style={{ fontSize: 80, color: COLORS.accent, opacity: arrow, transform: `translateX(${arrowDx}px)` }}>→</div>

        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: c,
            transform: `scale(${c}) rotate(${(1 - c) * 30}deg)`,
            boxShadow: `0 20px 60px -10px ${COLORS.primary}80`,
            border: `8px solid ${COLORS.white}`,
          }}
        >
          <svg width="110" height="110" viewBox="0 0 24 24" fill={COLORS.white}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        </div>
      </div>

      <div
        style={{
          marginTop: 60,
          fontFamily: FONT_BODY,
          fontSize: 36,
          color: COLORS.white,
          opacity: arrow,
          textAlign: "center",
          maxWidth: 800,
          lineHeight: 1.4,
        }}
      >
        Foto + frame da campanha = <span style={{ color: COLORS.accent, fontWeight: 700 }}>milhares de impressões</span>.
      </div>
    </AbsoluteFill>
  );
};
