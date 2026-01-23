# Static Asset Mapping

Maps `example_static_assets/` files to their target sections/beads.

## Hero Section (`ghost-blog-qoh`)
Desert landscape with parallax

| Asset | Description | Usage |
|-------|-------------|-------|
| `desert_dune_tufts_big_red.jpg` | Big Red dune with tufts, blue sky | **Primary hero** - main parallax layer |
| `desert_ground_from_top_of_big_red.jpg` | Sunset view from Big Red | Background layer (sky/clouds) |
| `pano_desert.jpg` | Panoramic desert shot | Wide hero option, good for full-width |
| `windswept_video.mp4` | Ambient desert video | Hero background video (optional) |
| `checking_depth.jpg` | Outback water crossing | Secondary/About section |

**Parallax layer suggestion:**
1. Sky layer (slow): cropped sky from `desert_ground_from_top_of_big_red.jpg`
2. Dune layer (medium): `desert_dune_tufts_big_red.jpg`
3. Foreground (fast): text/UI elements

---

## Speaker Section (`ghost-blog-1vy`)
The Speaker - talks showcase

| Asset | Description | Usage |
|-------|-------------|-------|
| `Peter Doherty Awards 2023-75.jpg` | Formal speaking at Peter Doherty Awards | **Primary** - professional speaking |
| `speaking_awards_ceremony.jpg` | Closeup at podium | Alternate angle |
| `presso.jpeg` | Casual presentation with bio slides | Informal talks, shows credentials |
| `thought-leadership.jpeg` | Workshop/panel discussion | Collaborative speaking |
| `community day.jpeg` | AWS Community Day Melbourne | Tech community involvement |

**Suggested approach:** Gallery with hover effects, primary image prominent

---

## Coder Section (`ghost-blog-bgp`)
The Coder - keyboard, GitHub viz

| Asset | Description | Usage |
|-------|-------------|-------|
| `pc_asset.jpg` | Server internals, multiple HDDs, clean build | Hardware/infrastructure focus |
| `benchtop_problem_solving.jpg` | Motherboard on desk, RGB keyboard visible | Hands-on debugging aesthetic |

**Note:** These show hardware work. May need additional assets for:
- Keyboard typing animation
- Screen/terminal shots
- GitHub contribution visualization

---

## Consultant Section (`ghost-blog-f50`)
The Consultant - enterprise work

| Asset | Description | Usage |
|-------|-------------|-------|
| `laptop_in_bag.jpg` | MacBook going into backpack | **Primary** - mobility, on-the-go consulting |
| `thought-leadership.jpeg` | Leading workshop discussion | Consulting/advising context |

**Note:** May need additional assets showing:
- Enterprise environment
- Meeting/whiteboard sessions
- Client work (anonymized)

---

## Content Creator Section (`ghost-blog-401`)
3D YouTube embed

| Asset | Description | Usage |
|-------|-------------|-------|
| `tv.jpg` | Vintage CRT TV | Creative frame for YouTube embed |

**Idea:** Embed YouTube video inside the TV screen with 3D perspective effect

---

## Unused/General Assets

| Asset | Potential Use |
|-------|---------------|
| `checking_depth.jpg` | About section, personal story, Australian theme |

---

## Asset Gaps Identified

| Section | Missing |
|---------|---------|
| **8 Claude Codes** (`dt3`) | Terminal screenshots, Claude Code UI |
| **Projects** (`ajk`) | Project screenshots, live site previews |
| **Content Creator** (`401`) | YouTube thumbnail, recording setup |
| **Coder** (`bgp`) | Code on screen, GitHub profile |
