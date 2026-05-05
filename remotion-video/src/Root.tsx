import { Composition } from "remotion";
import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { MainVideoV2, TOTAL_FRAMES_V2 } from "./MainVideoV2";

export const RemotionRoot = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="mainV2"
      component={MainVideoV2}
      durationInFrames={TOTAL_FRAMES_V2}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
