import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Desert landscape layers parallax
  const bgOffset = interpolate(frame, [0, fps * 5], [0, -50], {
    extrapolateRight: "clamp",
  });
  const midOffset = interpolate(frame, [0, fps * 5], [0, -100], {
    extrapolateRight: "clamp",
  });
  const fgOffset = interpolate(frame, [0, fps * 5], [0, -150], {
    extrapolateRight: "clamp",
  });

  // Text animations
  const titleY = interpolate(frame, [0, fps], [100, 0], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Fade out transition
  const fadeOut = interpolate(frame, [fps * 4, fps * 5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeOut }}>
      {/* Sky gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COLORS.sky} 0%, ${COLORS.bg} 100%)`,
        }}
      />

      {/* Background mountains */}
      <div
        style={{
          position: "absolute",
          bottom: 300 + bgOffset,
          left: 0,
          right: 0,
          height: 400,
          background: `linear-gradient(180deg, ${COLORS.earth}40 0%, ${COLORS.warm}60 100%)`,
          clipPath: "polygon(0 100%, 20% 30%, 40% 60%, 60% 20%, 80% 50%, 100% 100%)",
        }}
      />

      {/* Mid-ground dunes */}
      <div
        style={{
          position: "absolute",
          bottom: 150 + midOffset,
          left: 0,
          right: 0,
          height: 300,
          background: `linear-gradient(180deg, ${COLORS.warm} 0%, ${COLORS.earth}80 100%)`,
          clipPath: "polygon(0 100%, 15% 40%, 35% 70%, 55% 30%, 75% 60%, 100% 100%)",
        }}
      />

      {/* Foreground sand */}
      <div
        style={{
          position: "absolute",
          bottom: fgOffset,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(180deg, ${COLORS.warm} 0%, ${COLORS.bg} 100%)`,
        }}
      />

      {/* Sun */}
      <div
        style={{
          position: "absolute",
          top: 100 + bgOffset * 0.5,
          right: 200,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: COLORS.accent,
          boxShadow: `0 0 80px ${COLORS.accent}80, 0 0 160px ${COLORS.accent}40`,
        }}
      />

      {/* Content overlay */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 120,
            fontWeight: "bold",
            color: COLORS.text,
            margin: 0,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          Chris Dilger
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 36,
            color: COLORS.textSoft,
            margin: 0,
            marginTop: 20,
            opacity: subtitleOpacity,
            letterSpacing: "0.1em",
          }}
        >
          CODER • SPEAKER • CONSULTANT
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
