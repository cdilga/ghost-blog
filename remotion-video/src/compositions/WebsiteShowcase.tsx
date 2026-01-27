import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { HeroScene } from "../scenes/HeroScene";
import { CoderScene } from "../scenes/CoderScene";
import { ClaudeCodesScene } from "../scenes/ClaudeCodesScene";
import { SpeakerScene } from "../scenes/SpeakerScene";
import { ContentCreatorScene } from "../scenes/ContentCreatorScene";
import { ConsultantScene } from "../scenes/ConsultantScene";
import { ProjectsScene } from "../scenes/ProjectsScene";
import { DevPlaygroundScene } from "../scenes/DevPlaygroundScene";
import { COLORS } from "../Root";

export type WebsiteShowcaseProps = {
  title: string;
};

export const WebsiteShowcase: React.FC<WebsiteShowcaseProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene durations (in frames at 30fps)
  const sceneDuration = 6 * fps; // 6 seconds per scene
  const transitionDuration = 15; // 0.5 second transitions

  // Calculate outro start (after all scenes with transitions)
  // 8 scenes × 6 seconds = 48 seconds, minus 7 transitions × 0.5 seconds
  const totalScenesTime = 8 * sceneDuration - 7 * transitionDuration;
  const outroStart = totalScenesTime;
  const outroDuration = durationInFrames - outroStart;

  // Fade out at the end
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <TransitionSeries>
        {/* 1. Hero Scene - Desert parallax intro */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <HeroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 2. Coder Scene - Keyboard & code visualization */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <CoderScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 3. Claude Codes Scene - 8 terminal grid */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <ClaudeCodesScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 4. Speaker Scene - Conference talks */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <SpeakerScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 5. Content Creator Scene - 3D YouTube embed */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <ContentCreatorScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 6. Consultant Scene - Enterprise challenges */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <ConsultantScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 7. Projects Scene - Featured work cards */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <ProjectsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 8. Dev Playground Scene - .dev projects */}
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <DevPlaygroundScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* 9. Outro - Fade to logo */}
        <TransitionSeries.Sequence durationInFrames={outroDuration}>
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: COLORS.bgDark,
            }}
          >
            {/* Logo/Title */}
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 80,
                fontWeight: "bold",
                color: COLORS.accent,
                opacity: interpolate(frame - outroStart, [0, fps], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `scale(${interpolate(
                  frame - outroStart,
                  [0, fps],
                  [0.8, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )})`,
              }}
            >
              {title}
            </div>

            {/* Tagline */}
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 24,
                color: COLORS.textOnDark,
                marginTop: 20,
                letterSpacing: "0.15em",
                opacity: interpolate(frame - outroStart, [fps * 0.5, fps * 1.5], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              CODER • SPEAKER • CONSULTANT
            </div>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
      </TransitionSeries>

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
