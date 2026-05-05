import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

export const Scene2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useStaggerIn(0);
  const stats = [useStaggerIn(20), useStaggerIn(35), useStaggerIn(50)];

  const data = [
    { n: "147 mi", l: "Brasileiros no WhatsApp", c: COLORS.primary },
    { n: "2,3 bi", l: "Mensagens trocadas / dia", c: COLORS.accent },
    { n: "98%", l: "Aberta em até 5 minutos", c: COLORS.primaryGlow },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.muted,
          fontSize: 30,
          letterSpacing: 5,
          textTransform: "uppercase",
          opacity: head,
        }}
      >
        Onde sua campanha precisa estar
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 110,
          textAlign: "center",
          lineHeight: 1.05,
          margin: "30px 0 80px",
          opacity: head,
          transform: `translateY(${(1 - head) * 30}px)`,
        }}
      >
        Onde está
        <br />
        <span style={{ color: COLORS.accent }}>seu eleitor.</span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 36, width: "100%" }}>
        {data.map((d, i) => {
          const s = stats[i];
          const count = interpolate(Math.min(frame - (20 + i * 15), 30), [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `8px solid ${d.c}`,
                borderRadius: 28,
                padding: "36px 44px",
                opacity: s,
                transform: `translateX(${(1 - s) * -60}px)`,
                backdropFilter: "blur(20px)",
              }}
            >
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 96, color: d.c, lineHeight: 1, transform: `scale(${0.9 + count * 0.1})` }}>
                {d.n}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 30, color: COLORS.white, marginTop: 8, opacity: 0.85 }}>
                {d.l}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
