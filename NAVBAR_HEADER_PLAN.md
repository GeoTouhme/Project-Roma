# 🎨 Navbar & Header Redesign Plan — ConsumersLiquor.com Style

> **Project:** Bal-Port Liquors (Project Roma)  
> **Target:** `customer-panel/` (CRA + React 19 + TailwindCSS 3)  
> **Reference:** [ConsumersLiquor.com](https://consumersliquor.com/)  
> **Current primary color:** `#B5223B` (deep red — works perfectly for liquor branding)

---

## 📐 Architecture Overview

The ConsumersLiquor.com header follows a **3-tier stacked layout** with a full-width hero slider beneath. Here's the target structure:

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: Announcement / Promo Bar (dark bg, dismissible)│
├─────────────────────────────────────────────────────────┤
│  TIER 2: Main Navigation Bar                            │
│  [Logo]  [Nav Links centered]  [Search] [Icons]         │
├─────────────────────────────────────────────────────────┤
│  TIER 3: Category Bar (scrollable pill-style links)     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              HERO SLIDER (full-width)                   │
│        Auto-playing image carousel with CTAs            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 ConsumersLiquor.com Design Breakdown

### Tier 1 — Announcement Bar
| Attribute | Detail |
|-----------|--------|
| **Background** | Solid dark (black `#1a1a1a` or deep navy) |
| **Text** | White, small (13-14px), centered promotional message |
| **Behavior** | Dismissible with an ✕ button; can auto-rotate messages |
| **Content** | Promo text like "Free delivery on orders over $50" or "New arrivals this week!" |
| **Height** | ~36-40px |

### Tier 2 — Main Navigation Bar
| Attribute | Detail |
|-----------|--------|
| **Background** | White `#FFFFFF` |
| **Layout** | 3-column: Logo (left) · Nav Links (center) · Icons (right) |
| **Logo** | Left-aligned, ~80-100px width |
| **Nav Links** | Horizontally centered: Home, About, Shop, etc. — uppercase or title-case, medium weight |
| **Dropdowns** | Mega-menu style on hover (subcategories grid) |
| **Right Icons** | Search (expandable), User/Account, Wishlist (heart), Cart (bag with badge) |
| **Search** | Expandable search bar that slides open on click, with live suggestions dropdown |
| **Border** | Subtle bottom border (`#eee`) |
| **Sticky** | Becomes sticky on scroll with subtle shadow + slight background opacity |
| **Height** | ~64-72px |

### Tier 3 — Category Bar
| Attribute | Detail |
|-----------|--------|
| **Background** | Light gray `#f5f5f5` or white |
| **Layout** | Horizontally scrollable pill-shaped category links |
| **Style** | Rounded pills, active state = filled primary color |
| **Visibility** | Shows on all pages (or product pages only — your choice) |
| **Height** | ~48px |

### Hero Slider
| Attribute | Detail |
|-----------|--------|
| **Type** | Full-width image carousel with CSS fade transitions |
| **Height** | Desktop: ~550-650px, Mobile: ~300px |
| **Overlay** | Dark gradient overlay for text readability |
| **Content** | Centered text: headline + subtitle + CTA button |
| **Dots** | Pagination dots at bottom |
| **Auto-play** | 4-5 second intervals |

---

## 📁 Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `components/header/AnnouncementBar.jsx` | Tier 1 — promo bar component |
| `components/header/MainNav.jsx` | Tier 2 — main navigation (optional: can stay in index.jsx) |
| `components/header/SearchOverlay.jsx` | Expandable search with live suggestions |

### Modified Files
| File | Changes |
|------|---------|
| `components/header/index.jsx` | Major rewrite — restructure to 3-tier layout |
| `src/index.css` | Add header-specific styles, sticky behavior, animations |
| `components/header/CategoryBar.tsx` | Update styling to match pill design, show on all pages |
| `tailwind.config.js` | Extend with new colors, breakpoints if needed |
| `pages/home/index.jsx` | Update hero slider styling |
| `App.css` | Clean up conflicting styles |

---

## 🛠️ Implementation Steps

### Phase 1: Announcement Bar (`AnnouncementBar.jsx`)

```jsx
// New component: customer-panel/src/components/header/AnnouncementBar.jsx
```

**Requirements:**
- Dark background (`bg-[#1a1a1a]`) with white text
- Centered promotional text (e.g., store hours, promos, free delivery threshold)
- Dismissible via ✕ button (store dismissed state in `sessionStorage`)
- Optional: rotating messages with fade animation
- Responsive: text truncates or stacks on mobile
- Close icon on the right side
- Smooth slide-up animation on dismiss

**Example content options:**
- `"🎉 Free delivery on orders over $75 | Newport Beach & surrounding areas"`
- `"📍 4521 W Coast Hwy, Newport Beach, CA 92663 | Open Mon-Sun"`
- `"🍷 New arrivals: Premium Bourbons & Tequilas now in stock!"`

---

### Phase 2: Main Navigation Bar Redesign

**Structural changes to `index.jsx`:**

1. **Remove** the current `top_header` (phone/email/address bar) — merge this info into the announcement bar or footer
2. **Restructure** the `bottom_header` into a clean 3-column grid:

```
┌──────────────┬────────────────────────┬──────────────┐
│    LOGO      │   NAV LINKS (center)   │   ICONS      │
│  (flex-none) │  (flex-1, centered)    │  (flex-none) │
└──────────────┴────────────────────────┴──────────────┘
```

3. **Nav Links** — displayed horizontally with hover underline effect:
   - Home
   - Products (with mega-menu dropdown)
   - Each category from API (with subcategory dropdowns)
   
4. **Right Icons** — clean icon group:
   - 🔍 Search icon (click to expand search overlay)
   - 👤 Account icon
   - ❤️ Wishlist icon (if authenticated)
   - 🛒 Cart icon with badge count

5. **Sticky Behavior:**
   - On scroll past 100px, header gets:
     - `position: sticky; top: 0;`
     - `backdrop-filter: blur(10px);`
     - `background-color: rgba(255,255,255,0.95);`
     - `box-shadow: 0 2px 20px rgba(0,0,0,0.08);`
   - Announcement bar hides on scroll (stays above sticky area)

6. **Mega-Menu Dropdown:**
   - On hover, show subcategories in a clean grid below the nav
   - Full-width or auto-width with subtle shadow
   - Smooth fade-in animation (`opacity 0→1`, `translateY -10px→0`)
   - Categories displayed in columns

---

### Phase 3: Search Experience

**Replace** inline search bar with a ConsumersLiquor-style approach:

**Option A — Expandable Search Bar (recommended):**
- Search icon in the header icons group
- On click, a full-width search bar slides down below the nav (or overlays the nav)
- Live suggestions dropdown (keep existing logic from current `index.jsx`)
- Close with ✕ button or Escape key

**Option B — Search Overlay:**
- Click search icon → full-screen overlay with centered search input
- Dark semi-transparent background
- Large search input with auto-focus
- Live results grid below

**Keep existing features:**
- Debounced search (300ms)
- Category suggestions (pill tags)
- Product suggestions (thumbnail + name + price)
- "No results" state

---

### Phase 4: Category Bar Redesign

**Update `CategoryBar.tsx`:**
- Show on **all pages** (not just `/products`)
- Horizontal scrollable row of category pills
- Active state: filled primary background with white text
- Inactive state: light gray background with dark text
- Smooth scroll behavior, hide scrollbar
- On mobile: horizontal swipeable
- Add subtle left/right fade gradients to indicate scrollability

**Style:**
```css
.category-pill {
  @apply whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium 
         transition-all duration-200 cursor-pointer;
}
.category-pill.active {
  @apply bg-primary text-white shadow-sm;
}
.category-pill.inactive {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
}
```

---

### Phase 5: Mobile Navigation

**Current behavior** (keep but enhance):
- Hamburger icon → slide-in drawer from left

**Enhancements:**
- Add store branding (logo) at the top of the drawer
- Add search bar at the top of the drawer
- Smooth accordion-style subcategory expansion (instead of second-level drawer)
- Add user account quick links at the bottom of the drawer
- Add store info (phone, address) at the drawer footer
- Consistent with ConsumersLiquor mobile nav pattern:
  - Full-screen overlay with smooth animation
  - Clear hierarchy with section dividers
  - Close button (✕) more prominent

**Mobile Bottom Nav** (existing component — keep as is):
- Home, Categories, Cart, Account tabs

---

### Phase 6: Hero Slider Polish

**Update `home/index.jsx` hero section:**

- Add dark gradient overlay: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5))`
- Better text hierarchy:
  - Small uppercase label (e.g., "PREMIUM COLLECTION")
  - Large headline (50px desktop, 32px mobile)
  - Subtitle text
  - CTA button with hover scale effect
- Smoother fade transition between slides
- Pagination dots styled to match brand:
  - Active: primary color, larger
  - Inactive: white with opacity
- Ensure hero sits directly below the header with no gap

---

### Phase 7: Tailwind Config Updates

```js
// tailwind.config.js additions
extend: {
  colors: {
    primary: "#B5223B",
    secondary: "#B5223B",
    dark: "#1a1a1a",       // Announcement bar, dark sections
    cream: "#FBFAFA",       // Page background (already set in body)
    border_light: "#EEEEEE", // Subtle borders
  },
  animation: {
    'slide-down': 'slideDown 0.3s ease-out',
    'fade-in': 'fadeIn 0.3s ease-out',
    'slide-up': 'slideUp 0.3s ease-out',
  },
  keyframes: {
    slideDown: {
      '0%': { transform: 'translateY(-100%)', opacity: 0 },
      '100%': { transform: 'translateY(0)', opacity: 1 },
    },
    fadeIn: {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 },
    },
    slideUp: {
      '0%': { transform: 'translateY(0)', opacity: 1 },
      '100%': { transform: 'translateY(-100%)', opacity: 0 },
    },
  },
}
```

---

### Phase 8: CSS Updates (`index.css`)

```css
/* Sticky header behavior */
.header-sticky {
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

/* Mega-menu animation */
.mega-menu-enter {
  animation: fadeIn 0.2s ease-out;
}

/* Search overlay */
.search-overlay {
  animation: slideDown 0.3s ease-out;
}

/* Hero slider dot overrides */
.hero-slider .slick-dots li button:before {
  color: white;
  opacity: 0.5;
  font-size: 10px;
}
.hero-slider .slick-dots li.slick-active button:before {
  color: #B5223B;
  opacity: 1;
}

/* Announcement bar dismiss animation */
.announcement-dismiss {
  animation: slideUp 0.3s ease-out forwards;
}

/* Category bar scroll fade */
.category-scroll::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 40px;
  background: linear-gradient(to right, transparent, white);
  pointer-events: none;
}
```

---

## 📊 Visual Comparison

### Current Design
```
┌─────────────────────────────────────────┐
│ Phone | Email | Address    (top bar)    │
├─────────────────────────────────────────┤
│ [Logo]  [Home][Products]  🔍 👤 ❤️ 🛒  │
│         [====Search Bar====]            │
├─────────────────────────────────────────┤
│ Hero Slider                             │
└─────────────────────────────────────────┘
```

### Target Design (ConsumersLiquor style)
```
┌─────────────────────────────────────────┐
│ 🎉 Free delivery over $75! Newport... ✕│  ← Dark announcement bar
├─────────────────────────────────────────┤
│ [Logo]  Home · Shop · Wine · Spirits   │  ← Clean nav, centered links
│                         🔍 👤 ❤️ 🛒    │  ← Icon group, compact
├─────────────────────────────────────────┤
│ [All] [Whiskey] [Tequila] [Wine] [Beer] │  ← Category pill bar  
├─────────────────────────────────────────┤
│                                         │
│    ████████████████████████████████████  │  ← Full-width hero
│    █  PREMIUM WINES COLLECTION       █  │
│    █  Curated for every occasion     █  │
│    █       [ SHOP NOW ]              █  │
│    ████████████████████████████████████  │
│                  · · ● · ·              │  ← Styled dots
└─────────────────────────────────────────┘
```

---

## ⚡ Implementation Order

| Step | Task | Estimated Effort |
|------|------|-----------------|
| 1 | Create `AnnouncementBar.jsx` | 30 min |
| 2 | Update `tailwind.config.js` with new tokens | 10 min |
| 3 | Add CSS animations & sticky styles to `index.css` | 20 min |
| 4 | Rewrite `header/index.jsx` — restructure to 3-tier layout | 2-3 hrs |
| 5 | Build expandable search overlay component | 45 min |
| 6 | Update `CategoryBar.tsx` — show on all pages, restyle | 30 min |
| 7 | Update `home/index.jsx` — hero slider polish | 30 min |
| 8 | Mobile drawer enhancements | 1 hr |
| 9 | Testing & responsive fine-tuning | 1 hr |

**Total estimated effort: ~6-7 hours**

---

## ⚠️ Important Notes

- The `header/index.jsx` (JSX) is the **active file** used in production. The `index.tsx` file appears to be an older version without the search feature. All changes should target the `.jsx` file.

- The `CategoryBar.tsx` currently only renders on `/products` routes (controlled in `index.tsx`). Since we're working with `index.jsx`, the category bar needs to be properly integrated into the main header component.

- The store already has a `storeStatus` banner in `App.js` (line 47) that shows "Store is closed" — this should remain **above** the announcement bar or be merged into it for a cleaner look.

---

## 🎯 Key Design Decisions Needed

1. **Announcement bar content** — What promotional message(s) should rotate? Or just store info?
2. **Category bar visibility** — Show on all pages or only product/home pages?
3. **Search style** — Expandable bar below nav, or full-screen overlay?
4. **Sticky behavior** — Should the category bar also be sticky (below the nav), or just the nav?
5. **Mobile drawer** — Keep the current two-level drawer or switch to accordion-style?

---

*Ready to implement when you give the green light! 🚀*
