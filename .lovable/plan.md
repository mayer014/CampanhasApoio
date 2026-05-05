# Vídeo comercial sincronizado com narração

## O que você precisa fazer

Enviar o arquivo de áudio da narração (MP3, WAV ou M4A, até 20MB) na próxima mensagem. A partir dele eu monto todo o vídeo.

## Pipeline

1. **Receber e analisar o áudio**
   - Copiar o arquivo enviado para `/tmp/`
   - Rodar `ffprobe` para pegar duração exata
   - Transcrever via Lovable AI (Gemini) com timestamps por frase, para saber quando cada cena precisa entrar/sair

2. **Roteiro visual baseado na narração**
   - Quebrar a transcrição em blocos (1 bloco = 1 cena)
   - Cada cena recebe duração em frames calculada a partir do timestamp do áudio (`segundos * 30fps`)
   - Definir motion direction: Tech Product (sans geométrica, springs snappy, fundo escuro com glow azul/laranja — mantendo a identidade dos vídeos anteriores)

3. **Cenas Remotion novas (1080x1920, 30fps)**
   - Criadas em `remotion-video/src/scenes/audio/SceneAudio_1.tsx` ... `SceneAudio_N.tsx`
   - Cada cena reage ao texto narrado naquele momento (mockup do editor, tabela CRM, fluxo do apoiador, exportação Excel, domínio `fotodeapoiador.easychain.com.br`, etc.)
   - Tipografia animada palavra-por-palavra acompanhando o ritmo da narração
   - Transições variadas (slide, wipe, fade) entre blocos

4. **Composição com áudio + trilha**
   - Novo `MainVideoAudio.tsx` registrado em `Root.tsx` como composição `mainAudio`
   - `<Audio src={staticFile('narration.mp3')} />` para a narração (volume 1.0)
   - `<Audio src={staticFile('bg-music.mp3')} volume={0.12} />` para trilha suave de fundo
   - Trilha de fundo: vou usar uma faixa instrumental livre de direitos (lo-fi/corporate ambient) baixada para `remotion-video/public/`
   - Duração total = duração exata do áudio (em frames)

5. **Render**
   - Patch no `scripts/render-remotion.mjs`: remover `muted: true` para que o áudio seja embutido no MP4
   - Renderizar via `COMP_ID=mainAudio OUT_FILE=/mnt/documents/comercial-narrado.mp4 node scripts/render-remotion.mjs`
   - QA: extrair 3-4 frames-chave + checar duração final com `ffprobe`

6. **Entrega**
   - `<lov-artifact>` com o MP4 final em `/mnt/documents/comercial-narrado.mp4`

## Detalhes técnicos

- **Sincronização**: a transcrição via Gemini retorna `[{start, end, text}]`. Cada item vira uma `<TransitionSeries.Sequence durationInFrames={(end-start)*30}>`.
- **Codec de áudio no render**: o ffmpeg do sandbox suporta AAC nativo (`aac`), então áudio embutido funciona sem `libfdk_aac`. Removo apenas o `muted:true`.
- **Trilha de fundo**: baixada de fonte livre (ex.: Pixabay Music API ou arquivo CC0). Caso o download falhe, sigo só com a narração e aviso.
- **Fallback de transcrição**: se a transcrição automática falhar, peço para você colar o roteiro junto do áudio.

## O que NÃO muda

- Vídeos V1 e V2 anteriores ficam intactos
- Código do app web (rotas, templates) não é tocado
- Apenas adições dentro de `remotion-video/`

Quando aprovar, é só me mandar o áudio na sequência.