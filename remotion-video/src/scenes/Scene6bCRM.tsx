import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY, useStaggerIn } from "./_shared";

// Scene 6b: CRM / Exportação de leads
export const Scene6bCRM: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useStaggerIn(0);
  const sub = useStaggerIn(10);
  const tableIn = useStaggerIn(20);
  const excelIn = useStaggerIn(60);
  const checkIn = useStaggerIn(80);

  const rows = [
    { name: "Carlos Silva", phone: "(67) 9 9999-1234", bairro: "Centro" },
    { name: "Ana Beatriz", phone: "(67) 9 8888-5678", bairro: "Jardim" },
    { name: "Roberto Lima", phone: "(67) 9 7777-4321", bairro: "Vila Nova" },
    { name: "Patrícia Souza", phone: "(67) 9 6666-9012", bairro: "Centro" },
    { name: "João Pereira", phone: "(67) 9 5555-3456", bairro: "Aeroporto" },
    { name: "Mariana Costa", phone: "(67) 9 4444-7890", bairro: "Coophavila" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "100px 60px" }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          color: COLORS.accent,
          fontSize: 26,
          letterSpacing: 5,
          textTransform: "uppercase",
          opacity: head,
        }}
      >
        Bônus exclusivo
      </div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          color: COLORS.white,
          fontSize: 80,
          textAlign: "center",
          margin: "16px 0 12px",
          lineHeight: 1.05,
          opacity: head,
        }}
      >
        Cada apoiador vira
        <br />
        <span style={{ color: COLORS.accent }}>um contato</span> seu.
      </h2>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 30,
          color: COLORS.muted,
          textAlign: "center",
          maxWidth: 880,
          lineHeight: 1.4,
          opacity: sub,
          marginBottom: 36,
        }}
      >
        CRM completo: nome, telefone e bairro de quem usou sua arte.
      </div>

      {/* Tabela CRM */}
      <div
        style={{
          width: 880,
          background: "#0F1422",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          opacity: tableIn,
          transform: `translateY(${(1 - tableIn) * 30}px)`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1.2fr 1fr",
            background: COLORS.panel,
            padding: "16px 24px",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 22,
            color: COLORS.white,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div>Nome</div>
          <div>Telefone</div>
          <div>Bairro</div>
        </div>
        {rows.map((r, i) => {
          const rowOp = useStaggerIn(25 + i * 6);
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr 1fr",
                padding: "18px 24px",
                fontFamily: FONT_BODY,
                fontSize: 22,
                color: COLORS.muted,
                borderBottom: `1px solid ${COLORS.border}`,
                opacity: rowOp,
                transform: `translateX(${(1 - rowOp) * -20}px)`,
              }}
            >
              <div style={{ color: COLORS.white }}>{r.name}</div>
              <div>{r.phone}</div>
              <div>{r.bairro}</div>
            </div>
          );
        })}
      </div>

      {/* Botão Exportar Excel */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: "linear-gradient(90deg, #1D6F42, #2E9457)",
          color: COLORS.white,
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 32,
          padding: "22px 44px",
          borderRadius: 18,
          opacity: excelIn,
          transform: `scale(${0.85 + excelIn * 0.15})`,
          boxShadow: "0 20px 50px rgba(29,111,66,0.5)",
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Baixar planilha Excel
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 32,
          fontFamily: FONT_BODY,
          fontSize: 22,
          color: COLORS.muted,
          opacity: checkIn,
        }}
      >
        <span>✓ WhatsApp em massa</span>
        <span>✓ Segmentar por bairro</span>
        <span>✓ Base eleitoral real</span>
      </div>
    </AbsoluteFill>
  );
};
