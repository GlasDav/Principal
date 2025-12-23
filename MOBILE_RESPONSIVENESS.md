# Mobile Responsiveness Audit

This document provides guidelines and a checklist for ensuring consistent mobile experience across the Principal Finance application.

## Breakpoints

| Breakpoint | Size | Target Device |
|------------|------|---------------|
| `sm` | 640px | Small phones |
| `md` | 768px | Tablets (portrait) |
| `lg` | 1024px | Tablets (landscape), small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

## CSS Utilities

Import responsive utilities in your main CSS:

```css
@import './styles/responsive.css';
```

### Available Classes

- `.container-responsive` - Fluid container with responsive padding
- `.grid-responsive` - Auto-adjusting grid (1-4 columns)
- `.dashboard-grid` - Dashboard card layout
- `.table-responsive` - Horizontally scrollable tables
- `.stack-on-mobile` - Flex row → column on mobile
- `.hide-mobile` / `.hide-desktop` - Visibility toggles
- `.touch-target` - Minimum 44px touch targets (accessibility)
- `.safe-area-padding` - iPhone notch support
- `.chart-container` - Responsive chart heights

## Page Audit Checklist

### Dashboard
- [x] Summary cards stack vertically on mobile
- [x] Charts resize to full width
- [x] Date picker is touch-friendly
- [x] Sankey diagram scrollable horizontally

### Transactions
- [x] Table scrolls horizontally on mobile
- [x] Search bar full width on mobile
- [x] Batch select works with touch
- [x] Split transaction modal fits screen

### Settings
- [x] Budget table scrolls horizontally
- [x] Category edit modal is responsive
- [x] Toggle switches are touch-friendly
- [x] Rules table shows essential columns

### Reports
- [x] Charts stack vertically on mobile
- [x] Filter dropdowns work on touch
- [x] Export buttons accessible

### Net Worth
- [x] Account cards stack on mobile
- [x] Check-in modal is responsive
- [x] Holdings table scrolls

### Ingest (Import)
- [x] File upload area is touch-friendly
- [x] Transaction preview scrolls
- [x] Confirm buttons accessible

### Authentication
- [x] Login form centered on all sizes
- [x] Password visibility toggle touch-friendly
- [x] Error messages don't overflow

## Common Issues & Solutions

### Issue: Horizontal Overflow
```css
/* Wrap the content in a responsive container */
.table-responsive {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

### Issue: Tiny Touch Targets
```css
/* Ensure minimum 44px target size */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

### Issue: Fixed Sidebar Blocking Content
```css
/* Hide sidebar off-screen on mobile */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    left: -100%;
    transition: left 0.3s;
  }
  .sidebar.open {
    left: 0;
  }
}
```

### Issue: Modal Too Wide
```css
/* Cap modal width on mobile */
.modal {
  width: calc(100% - 2rem);
  max-width: 32rem;
}
```

## Testing Devices

Test on these viewport sizes:
- **iPhone SE**: 375 × 667
- **iPhone 14 Pro**: 393 × 852 
- **iPad Mini**: 768 × 1024
- **iPad Pro**: 1024 × 1366
- **Desktop**: 1440 × 900

## Browser DevTools Testing

1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select "Responsive" or specific device
4. Test at various widths: 320px, 480px, 768px, 1024px

## Tailwind Responsive Prefixes

If using Tailwind CSS:

```jsx
<div className="
  grid 
  grid-cols-1      /* Mobile: 1 column */
  sm:grid-cols-2   /* 640px+: 2 columns */
  lg:grid-cols-4   /* 1024px+: 4 columns */
  gap-4
">
```

---

*Last Audit: December 2025*
