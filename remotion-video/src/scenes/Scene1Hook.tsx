import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn, Logo } from "./_shared";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const logoIn = useStaggerIn(0);
  const t1 = useStaggerIn(10);
  const t2 = useStaggerIn(22);
  const pulse = 1 + Math.sin(frame / 8) * 0.04;
  const lineW = interpolate(useStaggerIn(35), [0, 1], [0, 280]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          transform: `scale(${logoIn * pulse}) translateY(${(1 - logoIn) * 40}px)`,
          marginBottom: 60,
        }}
      >
        <Logo size={180} />
      </div>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.accent,
          fontSize: 38,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: t1,
          transform: `translateY(${(1 - t1) * 30}px)`,
          marginBottom: 24,
        }}
      >
        Foto de Campanha
      </div>

      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 130,
          lineHeight: 1.02,
          textAlign: "center",
          margin: 0,
          opacity: t2,
          transform: `translateY(${(1 - t2) * 40}px)`,
          letterSpacing: -2,
        }}
      >
        Sua campanha,
        <br />
        <span style={{ background: `linear-gradient(90deg, ${COLORS.primaryGlow}, ${COLORS.accentGlow})`, WebkitBackgroundClip: "text", color: "transparent" }}>
          em todo
        </span>
        <br />
        WhatsApp.
      </h1>

      <div
        style={{
          marginTop: 40,
          height: 6,
          width: lineW,
          borderRadius: 6,
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
        }}
      />
    </AbsoluteFill>
  );
};
