import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn, PhoneFrame, Logo } from "../_shared";

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 12], [20, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 60,
        right: 60,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 38,
        color: COLORS.white,
        textAlign: "center",
        lineHeight: 1.25,
        textShadow: "0 4px 20px rgba(0,0,0,0.8)",
        opacity: op,
        transform: `translateY(${y}px)`,
        background: "rgba(11,15,26,0.55)",
        padding: "22px 32px",
        borderRadius: 22,
        border: `1px solid ${COLORS.border}`,
        backdropFilter: "blur(8px)",
      }}
    >
      {text}
    </div>
  );
};

const BigWord: React.FC<{ word: string; sub?: string; color?: string }> = ({ word, sub, color = COLORS.accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 200,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 0.95,
          transform: `scale(${0.5 + s * 0.5})`,
          textShadow: `0 0 60px ${color}80`,
        }}
      >
        <span style={{ color }}>{word}</span>
      </div>
      {sub && (
        <div
          style={{
            marginTop: 30,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 44,
            color: COLORS.muted,
            textAlign: "center",
            opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const SceneTitle: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 12 } });
  const t1 = interpolate(frame, [10, 26], [60, 0], { extrapolateRight: "clamp" });
  const o1 = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ transform: `scale(${logoIn})` }}>
        <Logo size={220} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 110,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 1,
          opacity: o1,
          transform: `translateY(${t1}px)`,
        }}
      >
        Foto de
        <br />
        <span style={{ color: COLORS.accent }}>Apoiador</span>
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneProblem: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 280, opacity: op, filter: "drop-shadow(0 0 40px #ef4444)" }}>📉</div>
      <div
        style={{
          marginTop: 40,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 96,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 1,
          opacity: op,
        }}
      >
        Votos <span style={{ color: "#ef4444" }}>perdidos</span>
        <br />todo dia.
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneSpeed: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const num = Math.min(30, Math.floor(interpolate(frame, [0, 40], [0, 30])));
  const s = useStaggerIn(8, 14);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 360,
          color: COLORS.accent,
          lineHeight: 0.9,
          textShadow: `0 0 80px ${COLORS.accent}90`,
          transform: `scale(${0.7 + s * 0.3})`,
        }}
      >
        {num}s
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 70,
          color: COLORS.white,
          textAlign: "center",
          opacity: s,
        }}
      >
        do eleitor à<br />arte de campanha
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneMegaphone: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.06;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 360, transform: `scale(${pulse})`, filter: `drop-shadow(0 0 60px ${COLORS.primary})` }}>📣</div>
      <div
        style={{
          marginTop: 30,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 76,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        Megafone <span style={{ color: COLORS.primaryGlow }}>digital</span>
        <br />automático
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneStepIntro: React.FC<{ caption: string }> = ({ caption }) => (
  <>
    <BigWord word="01" sub="A mecânica é simples" color={COLORS.primaryGlow} />
    <Caption text={caption} />
  </>
);

export const SceneEditor: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const layers = [
    { name: "Fundo", color: "#1E3A8A" },
    { name: "Círculo", color: COLORS.white },
    { name: "Foto", color: "#94A3B8" },
    { name: "Elemento", color: COLORS.accent },
    { name: "Logo", color: COLORS.primary },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 24 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 80,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        Template em <span style={{ color: COLORS.accent }}>5 camadas</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
        {layers.map((l, i) => {
          const op = interpolate(frame, [i * 8, i * 8 + 14], [0, 1], { extrapolateRight: "clamp" });
          const x = interpolate(frame, [i * 8, i * 8 + 14], [-60, 0], { extrapolateRight: "clamp" });
          return (
            <div
              key={l.name}
              style={{
                opacity: op,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                padding: "20px 32px",
                width: 720,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: l.color,
                  boxShadow: `0 0 30px ${l.color}60`,
                }}
              />
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 36, color: COLORS.white }}>
                {i + 1}. {l.name}
              </div>
            </div>
          );
        })}
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneThreeTaps: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 480,
          color: COLORS.accent,
          lineHeight: 0.85,
          textShadow: `0 0 100px ${COLORS.accent}90`,
        }}
      >
        3
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 80,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        toques. Só isso.
      </div>
      <div style={{ display: "flex", gap: 30, marginTop: 40 }}>
        {[0, 1, 2].map((i) => {
          const tap = interpolate(frame % 30, [i * 8, i * 8 + 6], [1, 1.4], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                border: `4px solid ${COLORS.primaryGlow}`,
                transform: `scale(${tap})`,
                opacity: 0.8,
              }}
            />
          );
        })}
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const ScenePhoneFlow: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const stage = Math.min(2, Math.floor(frame / 25));
  const labels = ["Acessa link", "Envia foto", "Recebe arte ✨"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <PhoneFrame width={560} height={1100}>
        <div style={{ padding: 30, color: COLORS.white, fontFamily: FONT_BODY, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
          <div style={{ fontSize: 200 }}>{["🔗", "📸", "🖼️"][stage]}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 56, textAlign: "center" }}>
            {labels[stage]}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 60,
                  height: 12,
                  borderRadius: 6,
                  background: i <= stage ? COLORS.accent : COLORS.border,
                }}
              />
            ))}
          </div>
        </div>
      </PhoneFrame>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneYes: React.FC<{ caption: string }> = ({ caption }) => (
  <>
    <BigWord word="SIM!" sub="Funciona de verdade" color={COLORS.accent} />
    <Caption text={caption} />
  </>
);

export const SceneNoApp: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const cross = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 30 }}>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 280, opacity: 0.5 }}>📱</div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 320,
              height: 12,
              background: "#ef4444",
              transform: `rotate(-45deg) scaleX(${cross})`,
              transformOrigin: "left",
              boxShadow: "0 0 30px #ef4444",
            }}
          />
        </div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 90, color: COLORS.white, textAlign: "center", lineHeight: 1 }}>
        Sem baixar <span style={{ color: "#ef4444" }}>nada</span>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 50, color: COLORS.muted }}>
        Barreira = zero
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneViralIntro: React.FC<{ caption: string }> = ({ caption }) => (
  <>
    <BigWord word="02" sub="Viralização orgânica" color={COLORS.primaryGlow} />
    <Caption text={caption} />
  </>
);

export const SceneViral200: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const num = Math.min(200, Math.floor(interpolate(frame, [0, 35], [0, 200])));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 44, color: COLORS.muted, letterSpacing: 4, textTransform: "uppercase" }}>
        Cada apoiador
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 360,
          color: COLORS.accent,
          lineHeight: 0.9,
          textShadow: `0 0 80px ${COLORS.accent}90`,
        }}
      >
        +{num}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 64, color: COLORS.white, textAlign: "center" }}>
        contatos alcançados
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneFreeReach: React.FC<{ caption: string }> = ({ caption }) => {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 30 }}>
      <div style={{ fontSize: 280, filter: `drop-shadow(0 0 40px ${COLORS.accent})` }}>💸</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 96, color: COLORS.white, textAlign: "center", lineHeight: 1 }}>
        <span style={{ color: COLORS.accent }}>Zero</span> a mais
        <br />de custo.
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneGoldData: React.FC<{ caption: string }> = ({ caption }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 30 }}>
    <div style={{ fontSize: 320, filter: "drop-shadow(0 0 60px #FFD700)" }}>🏆</div>
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 80, color: COLORS.white, textAlign: "center" }}>
      O verdadeiro <span style={{ color: "#FFD700" }}>ouro</span>:
      <br />os dados.
    </div>
    <Caption text={caption} />
  </AbsoluteFill>
);

export const SceneCRM: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const rows = ["Carlos S.", "Ana B.", "Roberto L.", "Patrícia S.", "João P."];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 24 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 80, color: COLORS.white, textAlign: "center" }}>
        Apoiador → <span style={{ color: COLORS.accent }}>Contato</span>
      </div>
      <div style={{ width: 820, background: "#0F1422", border: `1px solid ${COLORS.border}`, borderRadius: 20, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "16px 24px", background: COLORS.panel, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 26, color: COLORS.white }}>
          <div>Nome</div>
          <div>Telefone</div>
          <div>Bairro</div>
        </div>
        {rows.map((r, i) => {
          const op = interpolate(frame, [i * 6, i * 6 + 12], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: FONT_BODY, fontSize: 26, color: COLORS.muted, opacity: op }}>
              <div style={{ color: COLORS.white }}>{r}</div>
              <div>(67) 9 ••••</div>
              <div>Centro</div>
            </div>
          );
        })}
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneExcel: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const dl = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 30 }}>
      <div style={{ fontSize: 240 }}>📊</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 70, color: COLORS.white, textAlign: "center", lineHeight: 1.05 }}>
        Planilha pronta
        <br />
        <span style={{ color: COLORS.accent }}>para WhatsApp</span>
      </div>
      <div
        style={{
          background: "linear-gradient(90deg, #1D6F42, #2E9457)",
          color: COLORS.white,
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 38,
          padding: "22px 44px",
          borderRadius: 18,
          opacity: dl,
          transform: `scale(${0.8 + dl * 0.2})`,
          boxShadow: "0 20px 50px rgba(29,111,66,0.6)",
        }}
      >
        ⬇  Baixar Excel
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneDomain: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60, gap: 30 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 38,
          color: COLORS.accent,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        100% apartidário
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 72,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        Ative em <span style={{ color: COLORS.accent }}>minutos</span>
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 44,
          color: COLORS.white,
          background: COLORS.panel,
          border: `2px solid ${COLORS.accent}`,
          padding: "26px 40px",
          borderRadius: 22,
          opacity: op,
          textAlign: "center",
        }}
      >
        fotodeapoiador
        <br />
        <span style={{ color: COLORS.accent }}>.easychain.com.br</span>
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SceneFinale: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const o1 = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const o2 = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(frame / 8) * 0.04;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60, gap: 30 }}>
      <div style={{ transform: `scale(${pulse})` }}>
        <Logo size={180} />
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 84,
          color: COLORS.white,
          textAlign: "center",
          lineHeight: 1.05,
          opacity: o1,
        }}
      >
        Likes invisíveis
        <br />viram <span style={{ color: COLORS.accent }}>banco de dados</span>.
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 40,
          color: COLORS.muted,
          textAlign: "center",
          opacity: o2,
        }}
      >
        Antes do dia da eleição.
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 38,
          color: COLORS.accent,
          opacity: o2,
        }}
      >
        fotodeapoiador.easychain.com.br
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

export const SCENE_MAP: Record<string, React.FC<{ caption: string }>> = {
  title: SceneTitle,
  problem: SceneProblem,
  speed: SceneSpeed,
  megaphone: SceneMegaphone,
  stepIntro: SceneStepIntro,
  editor: SceneEditor,
  threeTaps: SceneThreeTaps,
  phoneFlow: ScenePhoneFlow,
  yes: SceneYes,
  noApp: SceneNoApp,
  viralIntro: SceneViralIntro,
  viral200: SceneViral200,
  freeReach: SceneFreeReach,
  goldData: SceneGoldData,
  crm: SceneCRM,
  excel: SceneExcel,
  domain: SceneDomain,
  finale: SceneFinale,
};
