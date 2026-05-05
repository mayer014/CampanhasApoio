import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1HookV2 } from "./scenes/Scene1HookV2";
import { Scene2SolutionV2 } from "./scenes/Scene2SolutionV2";
import { Scene4Editor } from "./scenes/Scene4Editor";
import { Scene5Client } from "./scenes/Scene5Client";
import { Scene6Spread } from "./scenes/Scene6Spread";
import { Scene6bCRM } from "./scenes/Scene6bCRM";
import { Scene7CTAV2 } from "./scenes/Scene7CTAV2";

const D = {
  s1: 90,
  s2: 120,
  s3: 150,
  s4: 165,
  s5: 120,
  s6: 165,
  s7: 120,
};
const TR = 18;

export const TOTAL_FRAMES_V2 =
  D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 + D.s7 - TR * 6;

const BG = "#0B0F1A";

function AnimatedBackdrop() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const hue1 = interpolate(t, [0, 1], [10, 280]);
  const hue2 = interpolate(t, [0, 1], [220, 30]);
  const x = interpolate(Math.sin(frame / 50), [-1, 1], [25, 75]);
  const y = interpolate(Math.cos(frame / 70), [-1, 1], [25, 75]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 50% at ${x}% ${y}%, hsl(${hue1} 90% 35% / 0.55), transparent 60%), radial-gradient(50% 40% at ${100 - x}% ${100 - y}%, hsl(${hue2} 90% 40% / 0.4), transparent 60%), ${BG}`,
      }}
    />
  );
}

function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.06,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        transform: `translate(${(frame * 7) % 30}px, ${(frame * 11) % 30}px)`,
        pointerEvents: "none",
      }}
    />
  );
}

export const MainVideoV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AnimatedBackdrop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={D.s1}>
          <Scene1HookV2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s2}>
          <Scene2SolutionV2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s3}>
          <Scene4Editor />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s4}>
          <Scene5Client />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s5}>
          <Scene6Spread />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s6}>
          <Scene6bCRM />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-top" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s7}>
          <Scene7CTAV2 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Grain />
    </AbsoluteFill>
  );
};
