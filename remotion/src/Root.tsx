import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// ~33s @ 30fps
export const RemotionRoot: React.FC = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={1020}
    fps={30}
    width={1920}
    height={1080}
  />
);