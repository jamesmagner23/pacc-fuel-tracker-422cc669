import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 30s @ 30fps = 900 frames
export const RemotionRoot: React.FC = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
  />
);