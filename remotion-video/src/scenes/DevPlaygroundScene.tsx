import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

export const DevPlaygroundScene: React.FC = () => {
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

  // .dev projects
  const devProjects = [
    { icon: "₿", domain: "bitcoin.dev", status: "Active" },
    { icon: "🎬", domain: "remotion.dilger.dev", status: "WIP" },
    { icon: "🔗", domain: "beads.dilger.dev", status: "Active" },
    { icon: "🔌", domain: "mcp.dilger.dev", status: "WIP" },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        opacity: sceneOpacity * fadeOut,
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.accent}10 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Section header */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 500,
            color: COLORS.accent,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Experiments
        </span>
        <h2
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            marginTop: 12,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Dev Playground
        </h2>
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            color: COLORS.textMuted,
            marginTop: 12,
            opacity: interpolate(frame, [fps * 0.6, fps], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Works in progress and weekend experiments
        </p>
      </div>

      {/* Project tiles grid */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 24,
        }}
      >
        {devProjects.map((project, i) => {
          const tileDelay = fps + i * 12;
          const tileOpacity = interpolate(frame, [tileDelay, tileDelay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tileScale = interpolate(frame, [tileDelay, tileDelay + 10], [0.8, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tileY = interpolate(frame, [tileDelay, tileDelay + 10], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Floating animation
          const floatOffset = Math.sin((frame + i * 20) * 0.08) * 3;

          return (
            <div
              key={i}
              style={{
                width: 280,
                padding: "32px 24px",
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
                textAlign: "center",
                opacity: tileOpacity,
                transform: `scale(${tileScale}) translateY(${tileY + floatOffset}px)`,
                border: `1px solid ${COLORS.bgAlt}`,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 16,
                }}
              >
                {project.icon}
              </div>

              {/* Domain */}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.text,
                  marginBottom: 12,
                }}
              >
                {project.domain}
              </div>

              {/* Status badge */}
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 16px",
                  background:
                    project.status === "Active"
                      ? `${COLORS.accent}15`
                      : `${COLORS.warm}20`,
                  borderRadius: 20,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    project.status === "Active" ? COLORS.accent : COLORS.earth,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {project.status}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer decoration */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [fps * 3, fps * 3.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            background: COLORS.bgAlt,
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 14,
              color: COLORS.textSoft,
            }}
          >
            Always building something new
          </span>
          <span
            style={{
              display: "inline-block",
              animation: "none",
              opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0.5,
            }}
          >
            ⚡
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
