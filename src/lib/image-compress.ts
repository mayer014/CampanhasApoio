// Compressão client-side de imagens.
// - Redimensiona mantendo proporção (lado maior <= maxDim)
// - Converte sempre para JPEG (mais leve que PNG para fotos)
// - Não sobe nada pro servidor; tudo acontece no navegador do eleitor.

export type CompressOptions = {
  maxDim?: number; // lado maior em pixels (default 2000 — suficiente p/ template 1080x1080)
  quality?: number; // 0..1 (default 0.85)
  mimeType?: "image/jpeg" | "image/webp"; // default jpeg
};

export async function compressImage(
  input: Blob | File,
  opts: CompressOptions = {},
): Promise<Blob> {
  const maxDim = opts.maxDim ?? 2000;
  const quality = opts.quality ?? 0.85;
  const mimeType = opts.mimeType ?? "image/jpeg";

  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("Falha ao ler arquivo"));
    r.readAsDataURL(input);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Imagem inválida"));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width <= maxDim && height <= maxDim) {
    // Já está pequena: ainda assim re-encoda como JPEG p/ garantir tamanho menor
    if (input.type === mimeType && input.size < 1_500_000) {
      return input;
    }
  }

  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height >= width && height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  // Fundo branco para JPEG (que não suporta transparência)
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir"))),
      mimeType,
      quality,
    );
  });
  return blob;
}
