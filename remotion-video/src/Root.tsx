import { Composition } from "remotion";
import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { MainVideoV2, TOTAL_FRAMES_V2 } from "./MainVideoV2";
import { MainVideoNarrated, TOTAL_FRAMES_NARRATED } from "./MainVideoNarrated";
import { MetaReviewDemo, META_DEMO_TOTAL_FRAMES, META_DEMO_FPS } from "./MetaReviewDemo";
import { EventsReviewDemo, EVENTS_DEMO_TOTAL_FRAMES, EVENTS_DEMO_FPS } from "./EventsReviewDemo";
import { PagesShowListDemo, PAGES_DEMO_TOTAL_FRAMES, PAGES_DEMO_FPS } from "./PagesShowListDemo";

export const RemotionRoot = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="mainV2" component={MainVideoV2} durationInFrames={TOTAL_FRAMES_V2} fps={30} width={1080} height={1920} />
    <Composition id="mainNarrated" component={MainVideoNarrated} durationInFrames={TOTAL_FRAMES_NARRATED} fps={30} width={1080} height={1920} />
    <Composition id="metaReview" component={MetaReviewDemo} durationInFrames={META_DEMO_TOTAL_FRAMES} fps={META_DEMO_FPS} width={1920} height={1080} />
    <Composition id="eventsReview" component={EventsReviewDemo} durationInFrames={EVENTS_DEMO_TOTAL_FRAMES} fps={EVENTS_DEMO_FPS} width={1920} height={1080} />
  </>
);
