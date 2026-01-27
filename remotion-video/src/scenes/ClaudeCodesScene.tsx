import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../Root";

// Terminal typing animation
const TerminalLine: React.FC<{
  text: string;
  startFrame: number;
  isOutput?: boolean;
  isSuccess?: boolean;
}> = ({ text, startFrame, isOutput, isSuccess }) => {
  const frame = useCurrentFrame();
  const charDelay = isOutput ? 1 : 2;
  const charsToShow = Math.floor((frame - startFrame) / charDelay);
  const visibleText = text.slice(0, Math.max(0, charsToShow));
  const showCursor = !isOutput && charsToShow >= 0 && charsToShow < text.length;

  let color = COLORS.textOnDark;
  if (isSuccess) color = "#27CA41";
  if (isOutput) color = COLORS.textMuted;

  return (
    <code
      style={{
        display: "block",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color,
        opacity: frame >= startFrame ? 1 : 0,
        minHeight: 16,
      }}
    >
      {!isOutput && <span style={{ color: COLORS.accent }}>$ </span>}
      {visibleText}
      {showCursor && (
        <span
          style={{
            opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
            color: COLORS.accent,
          }}
        >
          |
        </span>
      )}
    </code>
  );
};

// Terminal component
const Terminal: React.FC<{
  title: string;
  lines: Array<{ text: string; output?: boolean; success?: boolean }>;
  index: number;
}> = ({ title, lines, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const terminalDelay = fps * 0.5 + index * 8;
  const terminalOpacity = interpolate(frame, [terminalDelay, terminalDelay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const terminalScale = interpolate(frame, [terminalDelay, terminalDelay + 10], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "#1E1E1E",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        opacity: terminalOpacity,
        transform: `scale(${terminalScale})`,
      }}
    >
      {/* Terminal header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          background: "#2D2D2D",
          gap: 6,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F56" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27CA41" }} />
        <span
          style={{
            marginLeft: 8,
            fontFamily: "monospace",
            fontSize: 10,
            color: COLORS.textMuted,
          }}
        >
          {title}
        </span>
      </div>

      {/* Terminal content */}
      <div style={{ padding: "12px", height: 120, overflow: "hidden" }}>
        {lines.map((line, i) => (
          <TerminalLine
            key={i}
            text={line.text}
            startFrame={terminalDelay + 15 + i * 12}
            isOutput={line.output}
            isSuccess={line.success}
          />
        ))}
      </div>
    </div>
  );
};

export const ClaudeCodesScene: React.FC = () => {
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

  // Terminals data
  const terminals = [
    {
      title: "claude-1: feature",
      lines: [
        { text: 'claude -p "implement auth"' },
        { text: "Creating auth middleware", output: true },
        { text: "✓ Auth module complete", success: true },
      ],
    },
    {
      title: "claude-2: tests",
      lines: [
        { text: 'claude -p "write tests"' },
        { text: "Coverage: 87% → 94%", output: true },
        { text: "✓ 47 tests added", success: true },
      ],
    },
    {
      title: "claude-3: refactor",
      lines: [
        { text: 'claude -p "refactor api"' },
        { text: "Extracting utilities", output: true },
        { text: "✓ -340 lines removed", success: true },
      ],
    },
    {
      title: "claude-4: docs",
      lines: [
        { text: 'claude -p "update docs"' },
        { text: "Generating OpenAPI spec", output: true },
        { text: "✓ Docs synchronized", success: true },
      ],
    },
    {
      title: "claude-5: bugfix",
      lines: [
        { text: 'claude -p "fix #142"' },
        { text: "Root cause: race cond", output: true },
        { text: "✓ Issue resolved", success: true },
      ],
    },
    {
      title: "claude-6: perf",
      lines: [
        { text: 'claude -p "optimize"' },
        { text: "Adding memoization", output: true },
        { text: "✓ 3x faster response", success: true },
      ],
    },
    {
      title: "claude-7: security",
      lines: [
        { text: 'claude -p "audit"' },
        { text: "Checking OWASP top 10", output: true },
        { text: "✓ 0 vulnerabilities", success: true },
      ],
    },
    {
      title: "claude-8: deploy",
      lines: [
        { text: 'claude -p "deploy"' },
        { text: "Deploying to prod", output: true },
        { text: "✓ v2.1.0 live", success: true },
      ],
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDark,
        opacity: sceneOpacity * fadeOut,
      }}
    >
      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.accent}08 1px, transparent 1px), linear-gradient(90deg, ${COLORS.accent}08 1px, transparent 1px)`,
          backgroundSize: "30px 30px",
        }}
      />

      {/* Section header */}
      <div
        style={{
          position: "absolute",
          top: 40,
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
          8 Claude Codes
        </span>
        <h2
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.textOnDark,
            margin: 0,
            marginTop: 8,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Parallel AI Development
        </h2>
      </div>

      {/* Terminal grid */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 60,
          right: 60,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: 20,
        }}
      >
        {terminals.map((terminal, i) => (
          <Terminal key={i} title={terminal.title} lines={terminal.lines} index={i} />
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [fps * 4, fps * 4.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            color: COLORS.textMuted,
            margin: 0,
          }}
        >
          Multiply your development velocity with AI
        </p>
      </div>
    </AbsoluteFill>
  );
};
