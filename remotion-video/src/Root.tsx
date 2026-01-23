import { Composition, Folder } from "remotion";
import { WebsiteShowcase } from "./compositions/WebsiteShowcase";
import { VerticalShowcase } from "./compositions/VerticalShowcase";
import { HeroScene } from "./scenes/HeroScene";
import { CoderScene } from "./scenes/CoderScene";
import { SpeakerScene } from "./scenes/SpeakerScene";
import { ProjectsScene } from "./scenes/ProjectsScene";
import { ConsultantScene } from "./scenes/ConsultantScene";
import { ClaudeCodesScene } from "./scenes/ClaudeCodesScene";
import { ContentCreatorScene } from "./scenes/ContentCreatorScene";
import { DevPlaygroundScene } from "./scenes/DevPlaygroundScene";

// Design tokens from the Ghost theme
export const COLORS = {
  accent: "#F7931A", // Bitcoin orange
  accentHover: "#E5820F",
  bg: "#F5F0E8",
  bgAlt: "#EDE5D8",
  bgDark: "#2D2D2D",
  text: "#2D2D2D",
  textSoft: "#4A4A4A",
  textMuted: "#6B6B6B",
  textOnDark: "#F5F0E8",
  warm: "#D4A574",
  sky: "#87CEEB",
  earth: "#8B4513",
};

export const RemotionRoot = () => {
  return (
    <>
      {/* Main Showcase - Landscape 1920x1080 */}
      <Composition
        id="WebsiteShowcase"
        component={WebsiteShowcase}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "chris.dilger.me",
        }}
      />

      {/* Vertical Showcase for TikTok/Reels - 1080x1920 */}
      <Composition
        id="VerticalShowcase"
        component={VerticalShowcase}
        durationInFrames={450} // 15 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "chris.dilger.me",
        }}
      />

      {/* Individual Scenes for Testing */}
      <Folder name="Scenes">
        <Composition
          id="HeroScene"
          component={HeroScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="CoderScene"
          component={CoderScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ClaudeCodesScene"
          component={ClaudeCodesScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="SpeakerScene"
          component={SpeakerScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ContentCreatorScene"
          component={ContentCreatorScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ConsultantScene"
          component={ConsultantScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ProjectsScene"
          component={ProjectsScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="DevPlaygroundScene"
          component={DevPlaygroundScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
