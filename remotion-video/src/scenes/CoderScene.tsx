import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

// Terminal-style animation for the coder scene
export const CoderScene: React.FC = () => {
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

  // Keyboard key animation
  const keyScale = (delay: number) =>
    interpolate(
      frame,
      [delay, delay + 5, delay + 10],
      [1, 0.9, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  // Typing animation for code
  const codeLines = [
    "const portfolio = {",
    "  name: 'Chris Dilger',",
    "  role: 'Senior Engineer',",
    "  passion: 'Building amazing things'",
    "};",
  ];

  const charsPerSecond = 20;
  const totalChars = codeLines.join("").length;
  const typedChars = Math.floor((frame / fps) * charsPerSecond);

  // Calculate which characters to show
  const getDisplayedCode = () => {
    let remaining = typedChars;
    return codeLines.map((line) => {
      if (remaining <= 0) return "";
      if (remaining >= line.length) {
        remaining -= line.length;
        return line;
      }
      const partial = line.substring(0, remaining);
      remaining = 0;
      return partial;
    });
  };

  const displayedLines = getDisplayedCode();

  // GitHub contribution graph animation
  const contributionWeeks = 12;
  const contributionDays = 7;
  const getContributionOpacity = (weekIndex: number, dayIndex: number) => {
    const cellDelay = (weekIndex * 7 + dayIndex) * 2;
    return interpolate(frame, [fps + cellDelay, fps + cellDelay + 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  // Contribution levels (random-ish pattern)
  const getContributionLevel = (week: number, day: number) => {
    const seed = (week * 7 + day) % 5;
    return seed;
  };

  const contributionColors = [
    COLORS.bgAlt,
    `${COLORS.accent}30`,
    `${COLORS.accent}50`,
    `${COLORS.accent}80`,
    COLORS.accent,
  ];

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * fadeOut,
        background: COLORS.bgDark,
        overflow: "hidden",
      }}
    >
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
        The Coder
      </div>

      {/* Terminal Window */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 150,
          width: 800,
          height: 400,
          background: "#1e1e1e",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          transform: `translateX(${interpolate(frame, [fps * 0.2, fps * 0.7], [-100, 0], {
            extrapolateRight: "clamp",
          })}px)`,
          opacity: interpolate(frame, [fps * 0.2, fps * 0.7], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            height: 32,
            background: "#333",
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27ca40" }} />
        </div>

        {/* Terminal content */}
        <div style={{ padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>
          {displayedLines.map((line, i) => (
            <div key={i} style={{ color: COLORS.textOnDark, lineHeight: 1.6 }}>
              {line}
              {i === displayedLines.length - 1 &&
                typedChars < totalChars && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 20,
                      background: COLORS.accent,
                      marginLeft: 2,
                      opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0,
                    }}
                  />
                )}
            </div>
          ))}
        </div>
      </div>

      {/* GitHub Contribution Graph */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 180,
          background: "#161b22",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          transform: `translateX(${interpolate(frame, [fps * 0.5, fps * 1], [100, 0], {
            extrapolateRight: "clamp",
          })}px)`,
          opacity: interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 16,
            color: COLORS.textOnDark,
            marginBottom: 16,
          }}
        >
          GitHub Contributions
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: contributionWeeks }).map((_, weekIndex) => (
            <div key={weekIndex} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: contributionDays }).map((_, dayIndex) => (
                <div
                  key={dayIndex}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: contributionColors[getContributionLevel(weekIndex, dayIndex)],
                    opacity: getContributionOpacity(weekIndex, dayIndex),
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Floating Keyboard Keys */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
        }}
      >
        {["⌘", "C", "O", "D", "E"].map((key, i) => (
          <div
            key={key}
            style={{
              width: 60,
              height: 60,
              background: COLORS.bgAlt,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "system-ui, sans-serif",
              fontSize: 24,
              fontWeight: "bold",
              color: COLORS.text,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2), inset 0 -2px 0 rgba(0,0,0,0.1)",
              transform: `scale(${keyScale(fps * 2 + i * 5)})`,
              opacity: interpolate(frame, [fps * 1.5 + i * 8, fps * 2 + i * 8], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {key}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
