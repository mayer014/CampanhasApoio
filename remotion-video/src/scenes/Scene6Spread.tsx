import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

// Scene 6: viralização — várias miniaturas de fotos espalhando-se
export const Scene6Spread: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useStaggerIn(0);

  const items = Array.from({ length: 14 }).map((_, i) => {
    const delay = 10 + i * 4;
    const s = useStaggerIn(delay, 14);
    const x = (i % 4) - 1.5; // -1.5..1.5
    const y = Math.floor(i / 4) - 1.5;
    return { s, x, y, i };
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 100,
          textAlign: "center",
          lineHeight: 1.02,
          margin: "0 0 60px",
          opacity: head,
          transform: `translateY(${(1 - head) * 30}px)`,
        }}
      >
        E aí... <span style={{ color: COLORS.accent }}>viraliza.</span>
      </h2>

      <div style={{ position: "relative", width: 900, height: 900 }}>
        {items.map(({ s, x, y, i }) => {
          const tx = x * 200 * s;
          const ty = y * 220 * s;
          const rot = ((i % 5) - 2) * 6 * s;
          const hue = (i * 47) % 360;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 180,
                height: 180,
                borderRadius: 24,
                background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 80% 55%))`,
                transform: `translate(-50%,-50%) translate(${tx}px,${ty}px) scale(${s}) rotate(${rot}deg)`,
                opacity: s,
                border: `4px solid ${COLORS.white}`,
                boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  background: COLORS.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 0 4px ${COLORS.accent}`,
                }}
              >
                <svg viewBox="0 0 24 24" width="60" height="60" fill="#475569">
                  <circle cx="12" cy="9" r="4" />
                  <ellipse cx="12" cy="20" rx="8" ry="6" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 60,
          fontFamily: FONT_BODY,
          fontSize: 36,
          color: COLORS.muted,
          opacity: useStaggerIn(70),
          textAlign: "center",
        }}
      >
        Cada apoiador alcança <span style={{ color: COLORS.accent, fontWeight: 700 }}>+200 contatos</span>.
      </div>
    </AbsoluteFill>
  );
};
