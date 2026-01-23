import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { HeroScene } from "../scenes/HeroScene";
import { CoderScene } from "../scenes/CoderScene";
import { SpeakerScene } from "../scenes/SpeakerScene";
import { ProjectsScene } from "../scenes/ProjectsScene";
import { COLORS } from "../Root";

export type WebsiteShowcaseProps = {
  title: string;
};

export const WebsiteShowcase: React.FC<WebsiteShowcaseProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene timing (in seconds, converted to frames)
  const heroStart = 0;
  const heroDuration = 5 * fps;
  const coderStart = heroDuration;
  const coderDuration = 6 * fps;
  const speakerStart = coderStart + coderDuration;
  const speakerDuration = 6 * fps;
  const projectsStart = speakerStart + speakerDuration;
  const projectsDuration = 6 * fps;
  const outroStart = projectsStart + projectsDuration;

  // Fade out at the end
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Hero Scene */}
      <Sequence from={heroStart} durationInFrames={heroDuration}>
        <HeroScene />
      </Sequence>

      {/* Coder Scene */}
      <Sequence from={coderStart} durationInFrames={coderDuration}>
        <CoderScene />
      </Sequence>

      {/* Speaker Scene */}
      <Sequence from={speakerStart} durationInFrames={speakerDuration}>
        <SpeakerScene />
      </Sequence>

      {/* Projects Scene */}
      <Sequence from={projectsStart} durationInFrames={projectsDuration}>
        <ProjectsScene />
      </Sequence>

      {/* Outro - Fade to logo */}
      <Sequence from={outroStart}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.bgDark,
            opacity: interpolate(frame - outroStart, [0, fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 72,
              fontWeight: "bold",
              color: COLORS.accent,
              opacity: interpolate(frame - outroStart, [fps * 0.5, fps * 1.5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `scale(${interpolate(
                frame - outroStart,
                [fps * 0.5, fps * 1.5],
                [0.8, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )})`,
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Global fade out */}
      <AbsoluteFill
        style={{
          background: "black",
          opacity: 1 - outroOpacity,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
