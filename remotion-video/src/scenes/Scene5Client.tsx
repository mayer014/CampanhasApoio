import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn, PhoneFrame } from "./_shared";

// Scene 5: Cliente/eleitor usando — abre o link, envia foto, vê o template pronto, baixa
export const Scene5Client: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useStaggerIn(0);

  // Etapas: 0 link / 1 upload / 2 ajustando / 3 pronto + download
  const stage = frame < 40 ? 0 : frame < 85 ? 1 : frame < 130 ? 2 : 3;

  const phoneIn = useStaggerIn(8, 16);

  // Progress upload
  const uploadProgress = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Foto reveal
  const photoReveal = interpolate(frame, [85, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Download bounce
  const dl = interpolate(frame, [135, 155], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "80px 60px" }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.accent,
          fontSize: 28,
          letterSpacing: 5,
          textTransform: "uppercase",
          opacity: head,
        }}
      >
        Para o eleitor
      </div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 88,
          textAlign: "center",
          margin: "16px 0 30px",
          lineHeight: 1.05,
          opacity: head,
        }}
      >
        Em <span style={{ color: COLORS.primaryGlow }}>3 toques</span>,
        <br />
        sua foto pronta.
      </h2>

      <div style={{ transform: `scale(${0.9 * phoneIn}) translateY(${(1 - phoneIn) * 60}px)`, opacity: phoneIn }}>
        <PhoneFrame width={620} height={1080}>
          {/* Status bar */}
          <div style={{ height: 80 }} />
          {/* Header */}
          <div
            style={{
              padding: "20px 30px",
              borderBottom: `1px solid ${COLORS.border}`,
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              color: COLORS.white,
              fontSize: 28,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})` }} />
            Maria 22
          </div>

          <div style={{ padding: 30, display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Stage 0: link */}
            {stage === 0 && (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: COLORS.muted }}>fotodecampanha.app/maria22</div>
                <div
                  style={{
                    marginTop: 40,
                    background: COLORS.panel,
                    border: `2px dashed ${COLORS.border}`,
                    borderRadius: 24,
                    padding: 60,
                    color: COLORS.muted,
                    fontFamily: FONT_BODY,
                    fontSize: 26,
                  }}
                >
                  📷
                  <div style={{ marginTop: 16 }}>Toque para enviar sua foto</div>
                </div>
              </div>
            )}

            {/* Stage 1: upload */}
            {stage === 1 && (
              <div style={{ paddingTop: 80, textAlign: "center" }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 28, color: COLORS.white, marginBottom: 30 }}>
                  Enviando foto...
                </div>
                <div style={{ height: 18, background: COLORS.panel, borderRadius: 9, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${uploadProgress * 100}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                    }}
                  />
                </div>
                <div style={{ marginTop: 16, fontFamily: FONT_BODY, fontSize: 24, color: COLORS.muted }}>
                  {Math.round(uploadProgress * 100)}%
                </div>
              </div>
            )}

            {/* Stage 2 & 3: preview pronto */}
            {stage >= 2 && (
              <div>
                <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 24, overflow: "hidden", background: "#0F1422", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                  {/* fundo */}
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, #1E3A8A, ${COLORS.accent})` }} />
                  {/* círculo branco */}
                  <div style={{ position: "absolute", top: "50%", left: "50%", width: "82%", height: "82%", borderRadius: "50%", background: COLORS.white, transform: "translate(-50%,-50%)", boxShadow: `0 0 0 10px ${COLORS.accent}` }} />
                  {/* foto */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: "76%",
                      height: "76%",
                      borderRadius: "50%",
                      transform: `translate(-50%,-50%) scale(${photoReveal})`,
                      opacity: photoReveal,
                      background: `radial-gradient(circle at 50% 35%, #FCD7B6 0%, #E5A878 40%, #B07650 100%)`,
                      overflow: "hidden",
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      <circle cx="50" cy="40" r="18" fill="#3D2817" />
                      <ellipse cx="50" cy="100" rx="35" ry="35" fill="#1F2937" />
                    </svg>
                  </div>
                  {/* logo */}
                  <div style={{ position: "absolute", top: 18, right: 18, width: 70, height: 70, borderRadius: 14, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryGlow})`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 32 }}>22</div>
                  {/* hashtag */}
                  <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", background: COLORS.accent, color: COLORS.white, fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 26, padding: "8px 24px", borderRadius: 10 }}>
                    #EUAPOIO
                  </div>
                </div>

                {stage === 3 && (
                  <div
                    style={{
                      marginTop: 28,
                      background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                      color: COLORS.white,
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 800,
                      fontSize: 28,
                      padding: "22px 0",
                      borderRadius: 18,
                      textAlign: "center",
                      transform: `scale(${0.9 + dl * 0.1})`,
                      boxShadow: `0 10px 40px ${COLORS.primary}80`,
                    }}
                  >
                    ⬇  Baixar minha foto
                  </div>
                )}
              </div>
            )}
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
