import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

// Speaker scene with talk showcase
export const SpeakerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene transitions
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [fps * 5, fps * 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Talks data
  const talks = [
    { title: "Building Scalable Systems", venue: "Tech Summit 2024", icon: "🎤" },
    { title: "AI in Production", venue: "DevConf Sydney", icon: "🤖" },
    { title: "Modern Web Architecture", venue: "WebDev Meetup", icon: "🌐" },
  ];

  // Stage elements animation
  const spotlightRotation = interpolate(frame, [0, fps * 6], [0, 360], {
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * fadeOut,
        background: `linear-gradient(135deg, \${COLORS.bgDark} 0%, #1a1a2e 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Stage spotlight effect */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          width: 600,
          height: 600,
          transform: `translateX(-50%) rotate(\${spotlightRotation}deg)`,
          background: `conic-gradient(from 0deg, transparent, \${COLORS.accent}10, transparent, \${COLORS.accent}10, transparent)`,
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />

      {/* Section Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          fontFamily: "system-ui, sans-serif",
          fontSize: 48,
          fontWeight: "bold",
          color: COLORS.accent,
          opacity: interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        The Speaker
      </div>

      {/* Microphone Icon */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 120,
          fontSize: 120,
          opacity: interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(\${interpolate(frame, [fps * 0.5, fps * 1], [0.5, 1], {
            extrapolateRight: "clamp",
          })})`,
        }}
      >
        🎙️
      </div>

      {/* Talk Cards */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 150,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {talks.map((talk, i) => {
          const cardDelay = fps * (0.8 + i * 0.3);
          const cardOpacity = interpolate(frame, [cardDelay, cardDelay + fps * 0.3], [0, 1], {
            extrapolateRight: "clamp",
          });
          const cardX = interpolate(frame, [cardDelay, cardDelay + fps * 0.3], [100, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                width: 500,
                padding: 24,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 16,
                backdropFilter: "blur(10px)",
                border: `1px solid \${COLORS.accent}30`,
                opacity: cardOpacity,
                transform: `translateX(\${cardX}px)`,
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ fontSize: 48 }}>{talk.icon}</div>
              <div>
                <div
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 24,
                    fontWeight: "bold",
                    color: COLORS.textOnDark,
                    marginBottom: 8,
                  }}
                >
                  {talk.title}
                </div>
                <div
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 16,
                    color: COLORS.textMuted,
                  }}
                >
                  {talk.venue}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audience silhouettes */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          display: "flex",
          justifyContent: "center",
          gap: 20,
          opacity: interpolate(frame, [fps * 1.5, fps * 2], [0, 0.3], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 80,
              height: 120,
              background: COLORS.text,
              borderRadius: "40px 40px 0 0",
              transform: `translateY(\${20 + (i % 3) * 15}px)`,
            }}
          />
        ))}
      </div>

      {/* Sound wave animation */}
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 250,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const barHeight = interpolate(
            (frame + i * 5) % 30,
            [0, 15, 30],
            [20, 60, 20],
            { extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{
                width: 8,
                height: barHeight,
                background: COLORS.accent,
                borderRadius: 4,
                opacity: interpolate(frame, [fps * 1, fps * 1.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
