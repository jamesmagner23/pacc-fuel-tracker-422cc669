import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Inter";

import { Background } from "./components/Background";
import { IntroScene } from "./scenes/IntroScene";
import { PortalScene } from "./scenes/PortalScene";
import { OutroScene } from "./scenes/OutroScene";
import { FtcScene } from "./scenes/FtcScene";

loadFont("normal", { weights: ["400", "700", "800"], subsets: ["latin"] });

const SCENES: Array<{
  step: string;
  title: string;
  body: string;
  src: string;
  duration: number;
  panY?: number;
}> = [
  {
    step: "01 · Overview",
    title: "Every drop, live.",
    body: "Litres, deliveries, sites and FTC savings — updated as the truck pours.",
    src: "shots/01-overview.png",
    duration: 120,
    panY: -120,
  },
  {
    step: "02 · Deliveries",
    title: "Drill into any drop.",
    body: "Filter by site, project, or date. Download a branded PDF docket in one click.",
    src: "shots/02-deliveries.png",
    duration: 120,
    panY: -160,
  },
  {
    step: "03 · Projects",
    title: "Fuel by job.",
    body: "Cost-coded per project with weekly breakdowns and CO₂e attribution.",
    src: "shots/03-projects.png",
    duration: 120,
    panY: -180,
  },
  {
    step: "04 · Plant",
    title: "Per-machine fuel.",
    body: "Drag-and-drop plant onto projects. Spot a thirsty machine before it costs you.",
    src: "shots/04-plant.png",
    duration: 120,
    panY: -160,
  },
  {
    step: "05 · Emissions",
    title: "ESG + FTC, sorted.",
    body: "Auto-calculated Scope 1 CO₂e and NGER assumptions — plus Fuel Tax Credit savings tallied per litre. Export, file, claim.",
    src: "shots/05-emissions.png",
    duration: 120,
    panY: -100,
  },
];

const TRANSITION = 16;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={80}>
          <IntroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {SCENES.map((s, i) => (
          <>
            <TransitionSeries.Sequence key={`s-${i}`} durationInFrames={s.duration}>
              <PortalScene
                step={s.step}
                title={s.title}
                body={s.body}
                src={s.src}
                panY={s.panY}
              />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition
              key={`t-${i}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: TRANSITION })}
            />
          </>
        ))}

        <TransitionSeries.Sequence durationInFrames={140}>
          <FtcScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={100}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};