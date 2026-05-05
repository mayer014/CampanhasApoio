import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

// V2: Hook focado em urgência / pergunta direta
export const Scene1HookV2: React.FC = () => {
  const frame = useCurrentFrame();
  const t1 = useStaggerIn(0);
  const t2 = useStaggerIn(15);
  const t3 = useStaggerIn(35);
  const flash = (Math.sin(frame / 4) + 1) / 2;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.accent,
          fontSize: 36,
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: t1,
          transform: `translateY(${(1 - t1) * 30}px)`,
          marginBottom: 40,
          textShadow: `0 0 ${20 + flash * 20}px ${COLORS.accent}80`,
        }}
      >
        ⚠ Atenção candidato
      </div>

      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 140,
          lineHeight: 0.95,
          textAlign: "center",
          margin: 0,
          opacity: t2,
          transform: `translateY(${(1 - t2) * 50}px) scale(${0.9 + t2 * 0.1})`,
          letterSpacing: -3,
        }}
      >
        Você está
        <br />
        <span
          style={{
            background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentGlow})`,
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          perdendo
        </span>
        <br />
        votos.
      </h1>

      <div
        style={{
          marginTop: 60,
          fontFamily: FONT_BODY,
          fontSize: 36,
          color: COLORS.muted,
          textAlign: "center",
          maxWidth: 880,
          lineHeight: 1.3,
          opacity: t3,
          transform: `translateY(${(1 - t3) * 20}px)`,
        }}
      >
        Seus apoiadores não têm como mostrar
        <br />
        publicamente que apoiam você.
      </div>
    </AbsoluteFill>
  );
};
