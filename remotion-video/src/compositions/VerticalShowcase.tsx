import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

export type VerticalShowcaseProps = {
  title: string;
};

export const VerticalShowcase: React.FC<VerticalShowcaseProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Intro animation
  const titleScale = interpolate(frame, [0, fps], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: COLORS.bgDark, overflow: "hidden" }}>
      {/* Background gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COLORS.bgDark} 0%, ${COLORS.bg} 100%)`,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 48,
          fontWeight: "bold",
          color: COLORS.accent,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 24,
          color: COLORS.textOnDark,
          opacity: interpolate(frame, [fps * 0.5, fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Coder • Speaker • Consultant
      </div>

      {/* Device frame mockup area (for scroll capture video) */}
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 60,
          right: 60,
          bottom: 200,
          background: COLORS.bg,
          borderRadius: 24,
          boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
          overflow: "hidden",
          opacity: interpolate(frame, [fps, fps * 1.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(frame, [fps, fps * 1.5], [50, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        {/* Placeholder for website video */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            fontSize: 20,
            color: COLORS.textMuted,
          }}
        >
          Website scroll video goes here
        </div>
      </div>

      {/* Call to action */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 20,
          color: COLORS.textOnDark,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        chris.dilger.me
      </div>

      {/* Fade out overlay */}
      <AbsoluteFill
        style={{
          background: "black",
          opacity: 1 - fadeOut,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
