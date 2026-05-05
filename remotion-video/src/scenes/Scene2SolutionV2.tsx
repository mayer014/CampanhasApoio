import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

export const Scene2SolutionV2: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useStaggerIn(0);
  const b = useStaggerIn(15);
  const c = useStaggerIn(35);

  const steps = [
    { n: "1", t: "Apoiador acessa o link" },
    { n: "2", t: "Envia a foto pelo celular" },
    { n: "3", t: "Recebe arte pronta com sua marca" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.primaryGlow,
          fontSize: 28,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: a,
          marginBottom: 24,
        }}
      >
        A solução
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 96,
          textAlign: "center",
          margin: "0 0 60px",
          lineHeight: 1.0,
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
        }}
      >
        Em <span style={{ color: COLORS.accent }}>30 segundos</span>,
        <br />
        cada apoiador
        <br />
        vira marketing.
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 820 }}>
        {steps.map((s, i) => {
          const o = useStaggerIn(40 + i * 12);
          return (
            <div
              key={s.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 22,
                padding: "26px 32px",
                opacity: o,
                transform: `translateX(${(1 - o) * -40}px)`,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: 44,
                  color: COLORS.white,
                  flexShrink: 0,
                }}
              >
                {s.n}
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 36,
                  color: COLORS.white,
                }}
              >
                {s.t}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
