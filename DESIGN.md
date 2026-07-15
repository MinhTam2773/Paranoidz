# DESIGN.md — Paranoidz Streetwear
 
> Agent-friendly design system for Paranoidz e-commerce webapp.
> Reference layout: btmstudios.com.vn — light mode, clean streetwear aesthetic.
 
---
 
## 1. Visual Theme & Atmosphere
 
- **Brand identity**: Vietnamese streetwear with edge. The name "Paranoidz" carries tension and underground energy, but the shopping experience is clean and inviting.
- **Mood**: Bright, editorial, confident. Think high-end streetwear lookbooks — crisp white spaces with bold black typography and controlled red accents.
- **Design philosophy**: Clean e-commerce layout inspired by BTM Studios. Light, airy backgrounds let product photography do the talking. The brand's edge comes through in typography and accent color, not in dark UI.
- **Density**: Medium. Generous whitespace between sections. Products breathe. Text is sparse and deliberate.
- **Logo**: Futuristic italic wordmark "PARANOIDZ" — sharp, forward-leaning letterforms. Black on light backgrounds. No icon, no emblem. The wordmark IS the brand.
---
 
## 2. Color Palette & Roles
 
| Token              | Hex       | Role                                              |
| ------------------- | --------- | ------------------------------------------------- |
| `--bg-primary`      | `#FFFFFF` | Page background, main canvas                      |
| `--bg-secondary`    | `#F5F5F5` | Card backgrounds, alternate sections, product image areas |
| `--bg-tertiary`     | `#EBEBEB` | Input fields, hover states, subtle containers     |
| `--bg-dark`         | `#111111` | Footer, hero overlays, inverted sections          |
| `--text-primary`    | `#111111` | Headings, product names, primary content          |
| `--text-secondary`  | `#666666` | Descriptions, metadata, secondary labels          |
| `--text-muted`      | `#999999` | Placeholders, disabled states, footnotes          |
| `--text-on-dark`    | `#FFFFFF` | Text on dark backgrounds (footer, hero overlay)   |
| `--accent`          | `#FF2D2D` | Sale badges, CTAs, promo banners, urgency signals |
| `--accent-hover`    | `#E01F1F` | Hover state for accent elements                   |
| `--accent-soft`     | `#FF2D2D10` | Accent backgrounds at ~6% opacity               |
| `--border`          | `#E0E0E0` | Card borders, dividers, input outlines            |
| `--border-hover`    | `#CCCCCC` | Hover state for bordered elements                 |
| `--success`         | `#00C853` | In-stock indicators, success messages             |
| `--warning`         | `#FFD600` | Low stock warnings                                |
 
### Color rules
- The default experience is light. White and off-white surfaces dominate.
- `--bg-dark` (#111111) is used ONLY for the footer, hero banner overlays, and occasional inverted sections for contrast.
- Accent red is reserved for actions and urgency — sale badges, primary buttons, promo bar. Do not use it decoratively.
- Product images sit on `--bg-secondary` (#F5F5F5) cards. No colored backgrounds behind product photos.
---
 
## 3. Typography Rules
 
| Element            | Font Family             | Weight | Size    | Line Height | Letter Spacing | Transform   |
| ------------------- | ---------------------- | ------ | ------- | ----------- | -------------- | ----------- |
| Logo / Brand        | `"Rajdhani", sans-serif` | 700  | —       | —           | `0.05em`       | uppercase   |
| H1 (Hero title)     | `"Inter", sans-serif`  | 800    | `48px`  | `1.1`       | `-0.02em`      | uppercase   |
| H2 (Section title)  | `"Inter", sans-serif`  | 700    | `28px`  | `1.2`       | `-0.01em`      | uppercase   |
| H3 (Card title)     | `"Inter", sans-serif`  | 600    | `20px`  | `1.3`       | `0`            | none        |
| Body                | `"Inter", sans-serif`  | 400    | `15px`  | `1.6`       | `0`            | none        |
| Product name        | `"Inter", sans-serif`  | 500    | `14px`  | `1.4`       | `0`            | none        |
| Product price       | `"Inter", sans-serif`  | 700    | `16px`  | `1`         | `0.02em`       | none        |
| Price (sale/old)    | `"Inter", sans-serif`  | 400    | `13px`  | `1`         | `0`            | line-through|
| Nav link            | `"Inter", sans-serif`  | 500    | `13px`  | `1`         | `0.06em`       | uppercase   |
| Button label        | `"Inter", sans-serif`  | 600    | `14px`  | `1`         | `0.04em`       | uppercase   |
| Caption / Meta      | `"Inter", sans-serif`  | 400    | `12px`  | `1.4`       | `0.02em`       | none        |
 
### Typography rules
- All headings and navigation are uppercase. Body text and product names are sentence case.
- Use `Rajdhani` only for the logo wordmark. Everything else uses `Inter`.
- Text is predominantly `--text-primary` (#111111) on light backgrounds. High contrast, easy to read.
- Font imports: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@700&display=swap`
---
 
## 4. Component Stylings
 
### Top announcement bar
- Background: `--accent` (`#FF2D2D`)
- Text: white, `12px`, uppercase, centered
- Content: Free shipping threshold, promo codes, hotline number
- Dismissible with `×` icon on right
### Navigation bar (two-row header)
- Background: `--bg-primary` (#FFFFFF)
- Sticky on scroll. Total height: `~120px` (two rows combined)
**Row 1 — Utility bar** (height: `64px`):
- Left: PARANOIDZ logo wordmark in black, bold italic futuristic font
- Center: Search input field — wide, light gray (#F5F5F5) background, `1px solid --border`, rounded `4px`, placeholder "Search product...", search icon on left inside the input. Width: ~50% of container.
- Right (inline, spaced): "HOTLINE: 0972 926 956" in `--text-primary` 13px. User icon + "LOGIN / REGISTER" link in `--text-primary` 13px. Cart icon with red badge showing item count.
- Bottom border: `1px solid --border`
**Row 2 — Navigation links** (height: `48px`):
- Centered row of uppercase nav links: HOME, OUTLET 2026, NEW COLLECTION, PRODUCT, CUSTOMER FEEDBACK, BRANDING, POLICY
- Font: `13px`, weight 500, `letter-spacing: 0.06em`, uppercase
- Color: `--text-secondary` default → `--text-primary` on hover
- Active link: `--text-primary` with `2px` bottom border in `--accent` red
- Links separated by generous horizontal spacing (`32px–48px` gap)
- Bottom border: `1px solid --border`
**Mobile behavior:**
- Row 1 collapses: logo left, hamburger icon right, search becomes icon that expands on tap
- Row 2 hidden — nav links move into hamburger full-screen overlay menu
- Cart icon + item count always visible in Row 1
### Breadcrumb (path subheader)
- Appears below the navigation bar on all inner pages (NOT on homepage)
- Background: `--bg-primary` (#FFFFFF)
- Padding: `12px 0`
- Format: `HOME / PRODUCT / POLO COLLECTION / BTM HAFL ZIP BASIC SLIMFIT`
- Each segment is a link in `--text-secondary` (`13px`, weight 400, uppercase)
- Separator: ` / ` in `--text-muted`
- Last segment (current page): `--text-primary`, not clickable
- No border, no background — just subtle text path
### Hero banner
- Full-width container, aspect ratio `21:9` on desktop, `16:9` on mobile
- Background: lifestyle photography with subtle dark gradient overlay from bottom for text legibility
- Collection name: H1, white text over image, centered or left-aligned
- Subtitle: white with slight opacity, body size, beneath title
- Optional CTA button below
### Collection cards (grid row below hero)
- 4-column grid on desktop, 2-column on mobile
- Each card: full-bleed lifestyle image with subtle dark gradient overlay from bottom
- Collection name + year ("2026") overlaid at bottom-left in white uppercase
- "SHOP NOW" label appears on hover with slide-up animation
- Border-radius: `4px`
- Gap: `16px`
### Product card
- Background: `--bg-primary` (#FFFFFF)
- Border: `1px solid --border`
- Border-radius: `4px`
- Padding: `0` (image flush to top) + `16px` text area at bottom
- Image area: `--bg-secondary` (#F5F5F5) background behind product photo
- Image: aspect ratio `3:4`, `object-fit: cover`, subtle zoom on hover (`transform: scale(1.05)`, `overflow: hidden`)
- Product name: `--text-primary`, 14px, 500 weight, max 2 lines with ellipsis
- Price: `--text-primary`, 16px, 700 weight. Format: `₫XXX.000` (Vietnamese Dong, dot separator)
- Sale price: accent red, original price in `--text-muted` with line-through beside it
- Sale badge: Small pill top-left of image, `--accent` background, white text, `-XX%`
- Quick-view / video icon: appears on hover, centered over image, semi-transparent circle
### Tab switcher (NEW GOODS / BEST SELLER)
- Horizontal tabs above product grid
- Active tab: `--text-primary` with bold weight + bottom border or filled background pill
- Inactive tab: `--text-secondary`
- Background toggle style: active = `--text-primary` bg + white text, inactive = transparent
### Promotion section
- Section title: "TOP PRODUCTS ON PROMOTION" in H2, left-aligned with vertical accent bar (`4px` wide, `--accent` red)
- Products displayed in scrollable row or grid
- Each card has sale badge and dual pricing
### Category section
- Section title with same vertical accent bar pattern: "SLEEVELESS T-SHIRT", "SHORTS", etc.
- Horizontal scrollable row of rounded product thumbnails
- Product name and price beneath each thumbnail
- Dot pagination indicators below
### Buttons
- **Primary**: `--accent` background, white text, `height: 48px`, `border-radius: 4px`, `letter-spacing: 0.04em`, uppercase. Hover: `--accent-hover` with subtle lift (`translateY(-1px)`, `box-shadow: 0 2px 8px rgba(255,45,45,0.3)`)
- **Secondary**: Transparent, `1px solid --text-primary`, `--text-primary` text. Hover: `--text-primary` fill + white text
- **Ghost**: No border, `--text-secondary`. Hover: `--text-primary`
- Transition: all `200ms ease`
### Inputs
- Background: `--bg-primary` (#FFFFFF)
- Border: `1px solid --border`
- Border-radius: `4px`
- Text: `--text-primary`
- Placeholder: `--text-muted`
- Focus: border changes to `--text-primary`, subtle glow `box-shadow: 0 0 0 2px var(--accent-soft)`
- Height: `44px`
### Newsletter signup
- Background: `--bg-secondary` or `--bg-dark` (inverted section)
- Email input + "REGISTRATION" accent button side by side
- Full-width on mobile
### Footer
- Background: `--bg-dark` (#111111)
- 4-column layout: About / Policy / Store Info / Fanpage
- Text: `--text-on-dark` at reduced opacity (~70%), small size
- Social icons: white, 24px, row with `gap: 12px`
- Payment method icons at bottom-right
- Hotline number in full white
- Logo wordmark in white at top-left of footer
---
 
## 5. Layout Principles
 
### Spacing scale
| Token   | Value  | Usage                           |
| ------- | ------ | ------------------------------- |
| `--s-1` | `4px`  | Tight gaps, inline spacing      |
| `--s-2` | `8px`  | Icon-to-text, compact padding   |
| `--s-3` | `16px` | Card padding, grid gaps         |
| `--s-4` | `24px` | Section inner padding           |
| `--s-5` | `32px` | Between components              |
| `--s-6` | `48px` | Between major sections          |
| `--s-7` | `64px` | Page section vertical rhythm    |
| `--s-8` | `96px` | Hero vertical padding           |
 
### Grid
- Max content width: `1280px`, centered with `auto` margins
- Product grid: `3 columns` on desktop (≥1024px), `2 columns` on tablet (≥640px), `2 columns` on mobile with smaller gap
- Grid gap: `--s-3` (16px) horizontal and vertical
- Side padding: `--s-4` (24px) on desktop, `--s-3` (16px) on mobile
### Page structure (top to bottom, matching BTM Studios)
1. Announcement bar (accent red, dismissible)
2. Navigation bar Row 1 (logo, search bar, hotline, login/register, cart)
3. Navigation bar Row 2 (centered nav links with active indicator)
4. Breadcrumb path (inner pages only — e.g., HOME / PRODUCT / POLO COLLECTION / ...)
5. Hero banner (full-width lifestyle image + collection title — homepage only)
6. Collection cards row (4 cards: Shirts / Shorts / Polo / Pants with 2026 labels)
7. "NEW GOODS" / "BEST SELLER" toggle tabs
8. Product grid (3 columns, paginated or load-more)
9. Promotion section (sale items with discount badges)
10. Category carousels (Sleeveless, Polo, Shorts, Jeans, etc.)
11. Newsletter signup
12. Footer (dark inverted section)
---
 
## 6. Depth & Elevation
 
| Level | Shadow                                             | Usage                              |
| ----- | -------------------------------------------------- | ---------------------------------- |
| 0     | none                                               | Flat surfaces, default cards       |
| 1     | `0 1px 3px rgba(0,0,0,0.08)`                      | Hovered cards, dropdowns           |
| 2     | `0 4px 12px rgba(0,0,0,0.1)`                      | Modals, floating cart, popovers    |
| 3     | `0 8px 32px rgba(0,0,0,0.15)`                     | Full-screen menus, lightboxes      |
 
### Depth rules
- On light backgrounds, depth is communicated through subtle shadows — soft and diffused.
- Shadows use low-opacity black. No colored shadows except on accent buttons (red glow on hover).
- Cards at rest have no shadow (Level 0). Shadow appears on hover (Level 1) for interactive feedback.
- The footer is the only permanently dark surface, creating a grounding anchor at the bottom.
---
 
## 7. Do's and Don'ts
 
### Do
- Keep the UI bright and clean. White space is your friend. Let product photography carry the visual weight.
- Use accent red sparingly — only for CTAs, sale badges, and the announcement bar.
- Use the dark footer and occasional inverted sections to bring in the Paranoidz edge without overwhelming the shopping experience.
- Maintain consistent vertical rhythm with the spacing scale.
- Use uppercase for headings, nav, and buttons. Sentence case for body content.
- Show prices in Vietnamese Dong format: `₫` prefix, thousands separated by `.` (e.g., `₫269.000`)
- Include lifestyle/lookbook photography in hero and collection sections.
- Animate product image zoom on hover for visual feedback.
### Don't
- NEVER use dark backgrounds for the main shopping area. Dark is reserved for footer + hero overlays + occasional inverted sections.
- NEVER use more than 2 font families. Stick to Inter + Rajdhani (logo only).
- NEVER use colored or gradient backgrounds behind product images. Always clean `--bg-secondary` (#F5F5F5).
- NEVER use rounded corners larger than `8px`. Keep edges sharp — `4px` is the standard.
- NEVER stack more than 3 CTAs in a single viewport. One primary action per section.
- NEVER use decorative borders or ornamental dividers. Separation is achieved through spacing and surface color.
- NEVER use the brand red as a background for large areas (except the thin announcement bar).
---
 
## 8. Responsive Behavior
 
| Breakpoint | Width     | Behavior                                                       |
| ---------- | --------- | -------------------------------------------------------------- |
| Mobile     | `<640px`  | 2-col product grid, stacked layout, hamburger nav, full-width hero |
| Tablet     | `640–1023px` | 2-col grid, side-by-side collection cards (2×2), compact nav |
| Desktop    | `≥1024px` | 3-col product grid, 4 collection cards in row, full nav        |
 
### Mobile specifics
- Navigation Row 1 collapses: logo left, search icon + cart + hamburger right. Row 2 hidden → links in full-screen overlay
- Hero banner: `16:9` ratio, text scales down to `32px` H1
- Collection cards: 2×2 grid
- Product cards: 2-column, tighter gap (`12px`)
- Category carousels: horizontal scroll with snap points
- Touch targets: minimum `44px` height
- Sticky "Add to Cart" bar on product detail pages
- Footer: single-column stack
---
 
## 9. Agent Prompt Guide
 
### Quick color reference
```
Background:  #FFFFFF (primary), #F5F5F5 (cards/image areas), #EBEBEB (inputs)
Dark areas:  #111111 (footer, hero overlay, inverted sections)
Text:        #111111 (primary), #666666 (secondary), #999999 (muted)
Accent:      #FF2D2D (red — CTAs, sales, urgency)
Border:      #E0E0E0 (default), #CCCCCC (hover)
```
 
### Ready-to-use prompts
 
**Homepage:**
"Build a light-mode streetwear e-commerce homepage for Paranoidz. White background, clean layout. Two-row header: Row 1 has black PARANOIDZ logo, wide search bar, hotline number, login/register, cart icon. Row 2 has centered uppercase nav links with red underline on active. Red announcement bar above header. Full-width hero banner with lifestyle photo and dark gradient overlay showing 'NEW COLLECTION 2026' in white text. Below: 4 collection cards with overlaid labels. Then a 3-column product grid on white background with subtle gray image areas. Use #FFFFFF background, #F5F5F5 for product image areas, #FF2D2D for sale badges. Black text, Inter font, uppercase headings. Dark footer at bottom."
 
**Product card:**
"Create a product card: white background, 4px border-radius, light gray (#F5F5F5) image area with 3:4 aspect ratio and hover zoom. Product name in black 14px medium weight, price in bold 16px below. Red sale badge pill in top-left showing discount percentage. Subtle border (#E0E0E0), shadow on hover."
 
**Navigation:**
"Build a two-row sticky white header for Paranoidz streetwear. Row 1: black PARANOIDZ italic wordmark logo on left, wide centered search input with placeholder 'Search product...' and search icon, then on the right: 'HOTLINE: 0972 926 956' text, user icon with 'LOGIN / REGISTER' link, and cart icon with red item count badge. Row 2: centered uppercase nav links (HOME, OUTLET 2026, NEW COLLECTION, PRODUCT, CUSTOMER FEEDBACK, BRANDING, POLICY) in 13px gray text, active link has red 2px bottom border. Both rows have bottom border #E0E0E0."
 
**Breadcrumb:**
"Add a breadcrumb path below the navigation on inner pages. Format: HOME / PRODUCT / POLO COLLECTION / PRODUCT NAME. Each segment is a gray uppercase link separated by ' / '. The last segment is black and not clickable. No background, just subtle text. 13px Inter font."
 
**Footer:**
"Dark footer (#111111) with 4 columns: brand intro with hotline, policy links, store address, and social media links. White text at 70% opacity, full white for hotline number. White Paranoidz logo wordmark top-left. Payment method icons bottom-right."
 
**Mobile navigation:**
"Mobile header: Row 1 simplifies to PARANOIDZ logo left, search icon + cart icon + hamburger right. Row 2 nav links hidden — they move into a full-screen overlay menu with white background, large centered uppercase links with 48px touch targets. Close button top-right. Social icons at bottom. Smooth slide-in from right."