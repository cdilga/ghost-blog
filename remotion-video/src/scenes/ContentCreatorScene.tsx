import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

export const ContentCreatorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const sceneOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Fade out transition
  const fadeOut = interpolate(frame, [fps * 5, fps * 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D perspective animation for YouTube embed
  const rotateY = interpolate(frame, [fps * 0.5, fps * 2], [15, 0], {
    extrapolateRight: "clamp",
  });
  const rotateX = interpolate(frame, [fps * 0.5, fps * 2], [10, 0], {
    extrapolateRight: "clamp",
  });
  const embedScale = interpolate(frame, [fps * 0.5, fps * 1.5], [0.9, 1], {
    extrapolateRight: "clamp",
  });
  const embedOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Play button animation
  const playPulse = Math.sin(frame * 0.1) * 0.05 + 1;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bgDark} 0%, #1a1a2e 100%)`,
        opacity: sceneOpacity * fadeOut,
        perspective: "1000px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 500,
          background: `radial-gradient(ellipse at center, ${COLORS.accent}20 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Section header */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.accent,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          The Content Creator
        </span>
        <h2
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.textOnDark,
            margin: 0,
            marginTop: 12,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Sharing Through Video
        </h2>
      </div>

      {/* 3D YouTube embed mockup */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${embedScale})`,
          transformStyle: "preserve-3d",
          opacity: embedOpacity,
        }}
      >
        {/* Video container with reflection */}
        <div
          style={{
            width: 800,
            height: 450,
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: `0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)`,
            position: "relative",
          }}
        >
          {/* Video thumbnail gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.accent}30 50%, ${COLORS.bgDark} 100%)`,
            }}
          />

          {/* Tech video overlay text */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 40,
              fontFamily: "system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.textOnDark,
              opacity: 0.8,
            }}
          >
            Building AI-Powered Apps
          </div>
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 40,
              fontFamily: "system-ui, sans-serif",
              fontSize: 16,
              color: COLORS.textMuted,
            }}
          >
            Technical Tutorial Series
          </div>

          {/* Play button */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${playPulse})`,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: COLORS.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 40px ${COLORS.accent}80`,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill={COLORS.text}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          {/* Progress bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                width: `${interpolate(frame, [fps * 2, fps * 5], [0, 60], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}%`,
                height: "100%",
                background: COLORS.accent,
              }}
            />
          </div>

          {/* Video duration */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              padding: "4px 8px",
              background: "rgba(0,0,0,0.7)",
              borderRadius: 4,
              fontFamily: "system-ui, sans-serif",
              fontSize: 12,
              color: "#fff",
            }}
          >
            12:34
          </div>
        </div>

        {/* Reflection */}
        <div
          style={{
            width: 800,
            height: 100,
            marginTop: 10,
            background: `linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)`,
            transform: "scaleY(-1) rotateX(180deg)",
            opacity: 0.3,
            borderRadius: "0 0 12px 12px",
          }}
        />
      </div>

      {/* YouTube subscribe CTA */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: interpolate(frame, [fps * 3, fps * 3.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            padding: "12px 24px",
            background: "#FF0000",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Subscribe
          </span>
        </div>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 16,
            color: COLORS.textMuted,
          }}
        >
          @chrisdilger
        </span>
      </div>
    </AbsoluteFill>
  );
};
