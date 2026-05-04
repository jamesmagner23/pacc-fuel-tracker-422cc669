import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { ScreenCard } from "../components/ScreenCard";

interface Props {
  step: string;
  title: string;
  body: string;
  src: string;
  panY?: number;
  zoomFrom?: number;
  zoomTo?: number;
}

export const PortalScene: React.FC<Props> = ({ step, title, body, src, panY, zoomFrom, zoomTo }) => {
  return (
    <AbsoluteFill>
      <Caption step={step} title={title} body={body} />
      <ScreenCard src={src} panY={panY} zoomFrom={zoomFrom} zoomTo={zoomTo} />
    </AbsoluteFill>
  );
};