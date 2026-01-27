import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

export const ConsultantScene: React.FC = () => {
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

  // Case studies
  const caseStudies = [
    {
      challenge: "Legacy Infrastructure",
      solution: "Cloud-Native Architecture",
      challengeDesc: "Aging on-premise systems",
      solutionDesc: "Modern AWS infrastructure",
    },
    {
      challenge: "Manual Deployments",
      solution: "Automated DevOps",
      challengeDesc: "Error-prone releases",
      solutionDesc: "CI/CD pipelines",
    },
    {
      challenge: "Developer Bottlenecks",
      solution: "Platform Engineering",
      challengeDesc: "Blocked by manual processes",
      solutionDesc: "Self-service platforms",
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        opacity: sceneOpacity * fadeOut,
      }}
    >
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
          The Consultant
        </span>
        <h2
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            marginTop: 12,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [fps * 0.4, fps * 0.8], [20, 0], {
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          Solving Enterprise Challenges
        </h2>
      </div>

      {/* Case study cards */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {caseStudies.map((study, i) => {
          const cardDelay = fps + i * 25;
          const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const cardX = interpolate(frame, [cardDelay, cardDelay + 15], [-50, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Arrow animation
          const arrowProgress = interpolate(
            frame,
            [cardDelay + 20, cardDelay + 35],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                opacity: cardOpacity,
                transform: `translateX(${cardX}px)`,
              }}
            >
              {/* Challenge */}
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Challenge
                </span>
                <h3
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 24,
                    fontWeight: 600,
                    color: COLORS.text,
                    margin: "8px 0",
                  }}
                >
                  {study.challenge}
                </h3>
                <p
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 14,
                    color: COLORS.textMuted,
                    margin: 0,
                  }}
                >
                  {study.challengeDesc}
                </p>
              </div>

              {/* Arrow */}
              <div
                style={{
                  width: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="60"
                  height="24"
                  viewBox="0 0 60 24"
                  style={{
                    opacity: arrowProgress,
                    transform: `scaleX(${arrowProgress})`,
                  }}
                >
                  <line
                    x1="0"
                    y1="12"
                    x2="45"
                    y2="12"
                    stroke={COLORS.accent}
                    strokeWidth="2"
                  />
                  <polyline
                    points="40,6 50,12 40,18"
                    fill="none"
                    stroke={COLORS.accent}
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Solution */}
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  background: `${COLORS.accent}10`,
                  borderRadius: 12,
                  border: `2px solid ${COLORS.accent}30`,
                }}
              >
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Solution
                </span>
                <h3
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 24,
                    fontWeight: 600,
                    color: COLORS.text,
                    margin: "8px 0",
                  }}
                >
                  {study.solution}
                </h3>
                <p
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 14,
                    color: COLORS.textSoft,
                    margin: 0,
                  }}
                >
                  {study.solutionDesc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
