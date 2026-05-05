import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

export const Scene7CTAV2: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useStaggerIn(0);
  const b = useStaggerIn(15);
  const c = useStaggerIn(35);
  const d = useStaggerIn(55);
  const pulse = 1 + Math.sin(frame / 6) * 0.04;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.accent,
          fontSize: 30,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: a,
          marginBottom: 30,
        }}
      >
        Não fique de fora
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 130,
          textAlign: "center",
          lineHeight: 0.95,
          margin: "0 0 40px",
          opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`,
          letterSpacing: -3,
        }}
      >
        Transforme
        <br />
        <span
          style={{
            background: `linear-gradient(90deg, ${COLORS.primaryGlow}, ${COLORS.accent})`,
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          eleitores
        </span>
        <br />
        em fãs.
      </h2>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 34,
          color: COLORS.muted,
          textAlign: "center",
          opacity: c,
          maxWidth: 900,
          lineHeight: 1.4,
          marginBottom: 50,
        }}
      >
        Plataforma <span style={{ color: COLORS.white, fontWeight: 700 }}>apartidária</span>.
        <br />
        Ative em minutos. Resultado imediato.
      </div>

      <div
        style={{
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
          color: COLORS.white,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 34,
          padding: "28px 56px",
          borderRadius: 22,
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
          marginTop: 36,
          fontFamily: FONT_BODY,
          fontSize: 24,
          color: COLORS.muted,
          opacity: d,
          letterSpacing: 4,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Acesse agora • Cadastro rápido
      </div>
    </AbsoluteFill>
  );
};
