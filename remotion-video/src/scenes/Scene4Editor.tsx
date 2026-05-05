import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn, PhoneFrame } from "./_shared";

// Scene 4: Mostrando o EDITOR — montagem do template em camadas (1080x1080 canvas mock)
export const Scene4Editor: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useStaggerIn(0);

  const layerIn = (d: number) => useStaggerIn(d, 14);

  const lBg = layerIn(15);
  const lBase = layerIn(35);
  const lPhoto = layerIn(55);
  const lElement = layerIn(75);
  const lLogo = layerIn(95);

  const labelIdx = Math.min(4, Math.max(0, Math.floor((frame - 15) / 20)));
  const labels = [
    "1. Fundo",
    "2. Círculo base",
    "3. Foto do eleitor",
    "4. Elemento",
    "5. Logo",
  ];

  const canvas = 820;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "100px 60px" }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.primaryGlow,
          fontSize: 28,
          letterSpacing: 5,
          textTransform: "uppercase",
          opacity: head,
        }}
      >
        Para o candidato
      </div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 88,
          textAlign: "center",
          margin: "16px 0 40px",
          lineHeight: 1.05,
          opacity: head,
        }}
      >
        Monte seu <span style={{ color: COLORS.accent }}>template</span>
        <br /> em 5 camadas.
      </h2>

      {/* Canvas mock */}
      <div
        style={{
          width: canvas,
          height: canvas,
          borderRadius: 32,
          background: "#0F1422",
          border: `2px solid ${COLORS.border}`,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)",
        }}
      >
        {/* L1 Background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #1E3A8A 0%, #312E81 50%, ${COLORS.accent} 100%)`,
            opacity: lBg,
            transform: `scale(${0.8 + lBg * 0.2})`,
          }}
        />
        {/* L2 Base circle */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: canvas * 0.78,
            height: canvas * 0.78,
            borderRadius: "50%",
            background: COLORS.white,
            transform: `translate(-50%,-50%) scale(${lBase})`,
            opacity: lBase,
            boxShadow: `0 0 0 14px ${COLORS.accent}`,
          }}
        />
        {/* L3 Photo (eleitor) — silhouette */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: canvas * 0.7,
            height: canvas * 0.7,
            borderRadius: "50%",
            overflow: "hidden",
            transform: `translate(-50%,-50%) scale(${lPhoto})`,
            opacity: lPhoto,
            background: `linear-gradient(180deg, #94A3B8, #475569)`,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <svg width="80%" height="90%" viewBox="0 0 100 100">
            <circle cx="50" cy="35" r="20" fill="#E2E8F0" />
            <ellipse cx="50" cy="95" rx="38" ry="38" fill="#E2E8F0" />
          </svg>
        </div>
        {/* L4 Element (banner curved) */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: `translateX(-50%) translateY(${(1 - lElement) * 40}px) scale(${lElement})`,
            opacity: lElement,
            background: COLORS.accent,
            color: COLORS.white,
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: 56,
            padding: "18px 60px",
            borderRadius: 18,
            letterSpacing: 2,
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          }}
        >
          #EUAPOIO
        </div>
        {/* L5 Logo */}
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 40,
            opacity: lLogo,
            transform: `scale(${lLogo})`,
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryGlow})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_DISPLAY,
              fontWeight: 900,
              fontSize: 60,
              color: COLORS.white,
              boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
            }}
          >
            22
          </div>
        </div>

        {/* Layer label badge */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            background: "rgba(0,0,0,0.65)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            padding: "10px 22px",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            color: COLORS.white,
            fontSize: 28,
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ color: COLORS.accent, marginRight: 10 }}>●</span>
          {labels[labelIdx]}
        </div>
      </div>

      {/* Toolbar mock */}
      <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}>
        {labels.map((l, i) => {
          const active = i === labelIdx;
          return (
            <div
              key={l}
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 22,
                padding: "12px 22px",
                borderRadius: 12,
                background: active ? COLORS.accent : COLORS.panel,
                color: active ? COLORS.white : COLORS.muted,
                border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                transform: active ? "scale(1.06)" : "scale(1)",
              }}
            >
              {l}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
