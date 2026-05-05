import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene3Brand } from "./scenes/Scene3Brand";
import { Scene4Editor } from "./scenes/Scene4Editor";
import { Scene5Client } from "./scenes/Scene5Client";
import { Scene6Spread } from "./scenes/Scene6Spread";
import { Scene7CTA } from "./scenes/Scene7CTA";
import { Scene6bCRM } from "./scenes/Scene6bCRM";

const D = {
  s1: 75,
  s2: 90,
  s3: 90,
  s4: 165,
  s5: 180,
  s6: 120,
  s6b: 180,
  s7: 105,
};
const TR = 18;

export const TOTAL_FRAMES =
  D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 + D.s6b + D.s7 - TR * 7;

const BG = "#0B0F1A";

function AnimatedBackdrop() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const hue1 = interpolate(t, [0, 1], [220, 260]);
  const hue2 = interpolate(t, [0, 1], [340, 200]);
  const x = interpolate(Math.sin(frame / 60), [-1, 1], [30, 70]);
  const y = interpolate(Math.cos(frame / 80), [-1, 1], [30, 70]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 50% at ${x}% ${y}%, hsl(${hue1} 90% 30% / 0.55), transparent 60%), radial-gradient(50% 40% at ${100 - x}% ${100 - y}%, hsl(${hue2} 90% 40% / 0.4), transparent 60%), ${BG}`,
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

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AnimatedBackdrop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={D.s1}>
          <Scene1Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s2}>
          <Scene2Problem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s3}>
          <Scene3Brand />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s4}>
          <Scene4Editor />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s5}>
          <Scene5Client />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s6}>
          <Scene6Spread />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s6b}>
          <Scene6bCRM />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-top" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} />

        <TransitionSeries.Sequence durationInFrames={D.s7}>
          <Scene7CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Grain />
    </AbsoluteFill>
  );
};
