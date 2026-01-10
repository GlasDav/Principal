# DollarData - Brand Guidelines

Based on [Midfunnel by O/M Design](https://www.offmenu.design/projects/midfunnel).

---

## Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `primary` | `#5D5DFF` | - | Primary actions, links, active states |
| `primary-hover` | `#4B4BE6` | - | Hover state for primary elements |
| `surface` | `#F5F5F7` | `#1A1A2E` | Page background |
| `card` | `#FFFFFF` | `#252538` | Card backgrounds |
| `text-primary` | `#191B18` | `#F5F5F7` | Headings, body text |
| `text-muted` | `#666666` | `#9CA3AF` | Secondary text, labels |
| `button-dark` | `#232522` | - | Dark CTA buttons |
| `border` | `#E5E5E7` | `#374151` | Borders, dividers |
| `accent-success` | `#34D399` | - | Success states |
| `accent-warning` | `#FB923C` | - | Warning states |
| `accent-error` | `#EF4444` | - | Error states |

---

## Typography

**Font Family:** Inter (falls back to system-ui)

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Component Styles

### Buttons

```jsx
// Primary (Indigo)
<button className="bg-primary hover:bg-primary-hover text-white rounded-full px-6 py-2">

// Dark CTA
<button className="bg-button-dark hover:bg-button-dark-hover text-white rounded-full px-6 py-2">
```

### Cards

```jsx
<div className="bg-card dark:bg-card-dark rounded-card shadow-card hover:shadow-card-hover">
```

### Text

```jsx
<h1 className="text-text-primary dark:text-text-primary-dark">
<p className="text-text-muted dark:text-text-muted-dark">
```

---

## Migration Guide

| Old Class | New Class |
|-----------|-----------|
| `bg-indigo-600` | `bg-primary` |
| `hover:bg-indigo-700` | `hover:bg-primary-hover` |
| `bg-slate-50` | `bg-surface` |
| `bg-white` | `bg-card` |
| `dark:bg-slate-800` | `dark:bg-card-dark` |
| `text-slate-900` | `text-text-primary` |
| `text-slate-500` | `text-text-muted` |
| `border-slate-200` | `border-border` |
| `rounded-2xl` | `rounded-card` |
