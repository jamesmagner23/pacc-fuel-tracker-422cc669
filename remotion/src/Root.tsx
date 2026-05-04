import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// ~35s @ 30fps
export const RemotionRoot: React.FC = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={1050}
    fps={30}
    width={1920}
    height={1080}
  />
);