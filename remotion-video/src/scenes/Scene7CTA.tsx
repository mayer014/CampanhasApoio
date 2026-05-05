import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn, Logo } from "./_shared";

export const Scene7CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useStaggerIn(0);
  const b = useStaggerIn(15);
  const c = useStaggerIn(30);
  const d = useStaggerIn(45);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ transform: `scale(${a})`, marginBottom: 40 }}>
        <Logo size={150} />
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 130,
          textAlign: "center",
          lineHeight: 1.0,
          margin: "0 0 30px",
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
          letterSpacing: -2,
        }}
      >
        Comece
        <br />
        <span style={{ background: `linear-gradient(90deg, ${COLORS.primaryGlow}, ${COLORS.accent})`, WebkitBackgroundClip: "text", color: "transparent" }}>
          hoje.
        </span>
      </h2>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 38,
          color: COLORS.muted,
          textAlign: "center",
          opacity: c,
          maxWidth: 850,
          lineHeight: 1.4,
          marginBottom: 60,
        }}
      >
        Plataforma <span style={{ color: COLORS.white, fontWeight: 700 }}>apartidária</span>.
        <br />
        Para qualquer candidatura. Resultado imediato.
      </div>

      <div
        style={{
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
          color: COLORS.white,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 36,
          padding: "30px 60px",
          borderRadius: 24,
          letterSpacing: 1,
          opacity: d,
          transform: `scale(${d * pulse})`,
          boxShadow: `0 20px 60px ${COLORS.primary}90`,
          textAlign: "center",
        }}
      >
        fotodeapoiador.easychain.com.br
      </div>

      <div
        style={{
          marginTop: 40,
          fontFamily: FONT_BODY,
          fontSize: 26,
          color: COLORS.muted,
          opacity: d,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        Sua imagem em todo lugar.
      </div>
    </AbsoluteFill>
  );
};
