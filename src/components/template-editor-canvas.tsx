import { useEffect, useRef, useState } from "react";
import { CANVAS_SIZE, renderTemplate, type TemplateData } from "@/lib/template-renderer";

export type DraggableLayerKey = "background" | "base_circle" | "element" | "logo" | "photo_circle";

type Props = {
  template: TemplateData;
  selected: DraggableLayerKey;
  onChange: (key: DraggableLayerKey, next: { x: number; y: number }) => void;
  className?: string;
};

export function TemplateEditorCanvas({ template, selected, onChange, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (ref.current) renderTemplate(ref.current, template, null, { showPhotoGuide: true });
  }, [template]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = CANVAS_SIZE / rect.width;
    const sy = CANVAS_SIZE / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const currentPos = () => {
    if (selected === "photo_circle") return { x: template.photo_circle.x, y: template.photo_circle.y };
    const t = template[`${selected}_transform` as const] as { x: number; y: number };
    return { x: t.x, y: t.y };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const p = currentPos();
    start.current = { mx: x, my: y, ox: p.x, oy: p.y };
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !start.current) return;
    const { x, y } = getCanvasCoords(e);
    const dx = x - start.current.mx;
    const dy = y - start.current.my;
    onChange(selected, { x: Math.round(start.current.ox + dx), y: Math.round(start.current.oy + dy) });
  };

  const stop = () => { setDragging(false); start.current = null; };

  return (
    <canvas
      ref={ref}
      className={className ?? "w-full aspect-square rounded-lg border bg-card touch-none select-none"}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stop}
      onMouseLeave={stop}
    />
  );
}
