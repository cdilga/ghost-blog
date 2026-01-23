import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

// Projects showcase scene
export const ProjectsScene: React.FC = () => {
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

  // Project cards data
  const projects = [
    { name: "SwiftOpenAI", desc: "Swift SDK for OpenAI", color: "#F05138", icon: "🦅" },
    { name: "AI Tools", desc: "Developer productivity", color: "#10B981", icon: "🛠️" },
    { name: "Ghost Theme", desc: "Portfolio website", color: COLORS.accent, icon: "👻" },
    { name: "Claude Agents", desc: "Automation framework", color: "#8B5CF6", icon: "🤖" },
  ];

  // Grid layout animation
  const getCardAnimation = (index: number) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const delay = fps * (0.5 + index * 0.2);
    
    const scale = interpolate(frame, [delay, delay + fps * 0.3], [0.8, 1], {
      extrapolateRight: "clamp",
    });
    const opacity = interpolate(frame, [delay, delay + fps * 0.3], [0, 1], {
      extrapolateRight: "clamp",
    });
    const y = interpolate(frame, [delay, delay + fps * 0.3], [30, 0], {
      extrapolateRight: "clamp",
    });

    return { scale, opacity, y };
  };

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * fadeOut,
        background: COLORS.bg,
        overflow: "hidden",
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `${COLORS.accent}10`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `${COLORS.warm}20`,
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
          color: COLORS.text,
          opacity: interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Featured Projects
      </div>

      {/* Projects Grid */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 80,
          right: 80,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
        }}
      >
        {projects.map((project, i) => {
          const { scale, opacity, y } = getCardAnimation(i);
          
          // Hover-like effect based on frame
          const hoverPhase = Math.sin((frame + i * 20) * 0.05);
          const hoverY = hoverPhase * 5;

          return (
            <div
              key={i}
              style={{
                background: "white",
                borderRadius: 20,
                padding: 32,
                boxShadow: `0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px \${project.color}20`,
                transform: `scale(\${scale}) translateY(\${y + hoverY}px)`,
                opacity,
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
              }}
            >
              {/* Project icon */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  background: `\${project.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                }}
              >
                {project.icon}
              </div>

              {/* Project info */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 28,
                    fontWeight: "bold",
                    color: COLORS.text,
                    marginBottom: 8,
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 18,
                    color: COLORS.textMuted,
                    marginBottom: 16,
                  }}
                >
                  {project.desc}
                </div>

                {/* Tech badges */}
                <div style={{ display: "flex", gap: 8 }}>
                  {["Swift", "TypeScript", "Python"].slice(0, 2 + (i % 2)).map((tech, j) => (
                    <div
                      key={j}
                      style={{
                        padding: "6px 12px",
                        background: COLORS.bgAlt,
                        borderRadius: 20,
                        fontFamily: "system-ui, sans-serif",
                        fontSize: 12,
                        color: COLORS.textSoft,
                        fontWeight: 500,
                      }}
                    >
                      {tech}
                    </div>
                  ))}
                </div>
              </div>

              {/* Project color accent */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 100,
                  height: 100,
                  background: `linear-gradient(135deg, \${project.color}30, transparent)`,
                  borderTopRightRadius: 20,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* GitHub CTA */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: COLORS.bgDark,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill={COLORS.textOnDark}>
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </div>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            color: COLORS.textSoft,
          }}
        >
          github.com/cdilga
        </span>
      </div>
    </AbsoluteFill>
  );
};
