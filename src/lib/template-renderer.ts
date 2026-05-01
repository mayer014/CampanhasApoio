// Renders a template's 5 layers onto a 1080x1080 canvas.
// Layer order (bottom -> top): background, base_circle, voter photo (clipped to circle), element, logo

export type Transform = { x: number; y: number; scale: number };
export type PhotoCircle = { x: number; y: number; radius: number };

export type TemplateData = {
  background_url: string | null;
  base_circle_url: string | null;
  element_url: string | null;
  logo_url: string | null;
  background_transform: Transform;
  base_circle_transform: Transform;
  element_transform: Transform;
  logo_transform: Transform;
  photo_circle: PhotoCircle;
};

export type PhotoState = {
  src: string;
  x: number;
  y: number;
  scale: number;
};

export const CANVAS_SIZE = 1080;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: Transform,
) {
  const w = img.naturalWidth * t.scale;
  const h = img.naturalHeight * t.scale;
  ctx.drawImage(img, t.x - w / 2, t.y - h / 2, w, h);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: Transform,
) {
  const scale = t.scale || 1;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, t.x, t.y, w, h);
}

export async function renderTemplate(
  canvas: HTMLCanvasElement,
  template: TemplateData,
  photo: PhotoState | null,
  options?: { showPhotoGuide?: boolean },
): Promise<void> {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const tasks: Array<Promise<unknown>> = [];
  const loaded: Record<string, HTMLImageElement | null> = {
    bg: null, base: null, element: null, logo: null, photo: null,
  };

  if (template.background_url) tasks.push(loadImage(template.background_url).then((i) => (loaded.bg = i)).catch(() => null));
  if (template.base_circle_url) tasks.push(loadImage(template.base_circle_url).then((i) => (loaded.base = i)).catch(() => null));
  if (template.element_url) tasks.push(loadImage(template.element_url).then((i) => (loaded.element = i)).catch(() => null));
  if (template.logo_url) tasks.push(loadImage(template.logo_url).then((i) => (loaded.logo = i)).catch(() => null));
  if (photo?.src) tasks.push(loadImage(photo.src).then((i) => (loaded.photo = i)).catch(() => null));

  await Promise.all(tasks);

  if (loaded.bg) drawBackground(ctx, loaded.bg, template.background_transform);
  if (loaded.base) drawCentered(ctx, loaded.base, template.base_circle_transform);

  if (loaded.photo && photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(template.photo_circle.x, template.photo_circle.y, template.photo_circle.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const w = loaded.photo.naturalWidth * photo.scale;
    const h = loaded.photo.naturalHeight * photo.scale;
    ctx.drawImage(loaded.photo, photo.x - w / 2, photo.y - h / 2, w, h);
    ctx.restore();
  }

  if (loaded.element) drawCentered(ctx, loaded.element, template.element_transform);
  if (loaded.logo) drawCentered(ctx, loaded.logo, template.logo_transform);

  // Guia visual do círculo da foto do eleitor (apenas no editor)
  if (options?.showPhotoGuide && !loaded.photo) {
    const { x, y, radius } = template.photo_circle;
    ctx.save();
    // preenchimento semi-transparente
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // contorno tracejado
    ctx.strokeStyle = "rgba(59, 130, 246, 0.95)";
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    // marcador do centro
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(59, 130, 246, 1)";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    // rótulo
    ctx.fillStyle = "rgba(59, 130, 246, 1)";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Foto do eleitor", x, y + radius + 40);
    ctx.restore();
  }
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
