import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SEGMENTS, FPS, TOTAL } from "./segments";
import { SCENE_MAP } from "./scenes/narrated/NarratedScenes";
import { COLORS } from "./scenes/_shared";

export const TOTAL_FRAMES_NARRATED = TOTAL;

function Backdrop() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const hue1 = interpolate(t, [0, 1], [220, 30]);
  const hue2 = interpolate(t, [0, 1], [10, 260]);
  const x = interpolate(Math.sin(frame / 80), [-1, 1], [25, 75]);
  const y = interpolate(Math.cos(frame / 100), [-1, 1], [25, 75]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 50% at ${x}% ${y}%, hsl(${hue1} 90% 32% / 0.55), transparent 60%), radial-gradient(50% 40% at ${100 - x}% ${100 - y}%, hsl(${hue2} 90% 40% / 0.4), transparent 60%), ${COLORS.bg}`,
      }}
    />
  );
}

function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.05,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        transform: `translate(${(frame * 7) % 30}px, ${(frame * 11) % 30}px)`,
        pointerEvents: "none",
      }}
    />
  );
}

function ProgressBar() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: "rgba(255,255,255,0.08)", zIndex: 50 }}>
      <div style={{ width: `${w}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})` }} />
    </div>
  );
}

export const MainVideoNarrated: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Backdrop />
      {SEGMENTS.map((seg, i) => {
        const Comp = SCENE_MAP[seg.scene];
        const from = Math.round(seg.start * FPS);
        const dur = Math.max(1, Math.round((seg.end - seg.start) * FPS));
        if (!Comp) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Comp caption={seg.text} />
          </Sequence>
        );
      })}
      <Grain />
      <ProgressBar />
      <Audio src={staticFile("narration.mp3")} />
    </AbsoluteFill>
  );
};
