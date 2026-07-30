# DRCALL PABX — Design System & Angular Material Rules

> **Fonte-da-verdade canônica** do design system do DRCALL PABX. Este documento é a
> referência da skill `pabx-design-system` (viaja junto com a skill ao ser instalada),
> consumida pelo gate `styles-frontend` e pela verificação visual. Editar aqui.

## Design Philosophy

This is a **telecom management platform** used by call center operators and admins who need to see maximum information at a glance. The aesthetic is **compact professional** — inspired by tools like Linear, Vercel, and shadcn/ui where every pixel earns its place.

### Core Principles

1. **High density, high clarity** — Pack more data per viewport without sacrificing readability. Smaller type, tighter spacing, clean hierarchy. The interface should feel like a high-DPI Retina screen: precise, crisp, information-rich.
2. **Quiet UI** — The interface should whisper, not shout. Neutral surfaces, subtle borders, muted secondary text. Only actionable elements (buttons, links, status badges) draw attention. No decorative noise.
3. **Systematic spacing** — Every margin, padding, and gap comes from a strict scale. Inconsistency destroys the compact feel.
4. **Semantic surfaces** — Color conveys meaning (status, hierarchy, interaction state), never decoration. Light/dark themes must work with the same markup.
5. **Component restraint** — Use Angular Material components as-is with token overrides. Never build custom versions of components that Material already provides.

### Design Thinking — Before Writing UI Code

Before implementing any new view or component, reason through:

- **Information hierarchy**: What does the user need FIRST? What's secondary? What can be progressive-disclosed (expandable, tooltip, dialog)?
- **Data density target**: How many meaningful data points should be visible without scrolling? Tables, metric cards, and lists should maximize visible rows.
- **Interaction model**: Is this a read-heavy view (dashboard, report) or write-heavy (form, config)? Read-heavy → prioritize scan speed. Write-heavy → prioritize flow and validation clarity.
- **Empty and error states**: Every data view needs an empty state. Every async operation needs loading and error representations. Plan these before the happy path.

## Typography Scale

Use a compact type scale. The base is `12px` inside dialogs/forms, `13–14px` for page body. Everything is intentionally smaller than Material defaults.

| Role | Size | Weight | Token / Usage |
|------|------|--------|---------------|
| Page title | 18px | 600 | `--mat-sys-title-large` or `h1` |
| Section header | 15px | 600 | `--mat-sys-title-medium` or `h2` |
| Dialog title | 13px | 600 | `mat-dialog-title`, with bottom border |
| Card title | 14px | 500 | `--mat-sys-title-small` or `h3` |
| Body text | 13–14px | 400 | `--mat-sys-body-medium` |
| Secondary text | 12px | 400 | `--mat-sys-body-small`, color `--mat-sys-on-surface-variant` |
| Caption / label | 10–11px | 600 | `--mat-sys-label-small`, uppercase, letter-spacing 0.3–0.5px |
| Metric / KPI number | 24–32px | 700 | Custom, used in dashboard cards |
| Table cell | 12–13px | 400 | Inherited from body |
| Button text (page) | 13px | 500 | Material default at density -2 |
| Button text (dialog) | 12px | 500 | Dialog action buttons |
| Form field text | 12px | 400 | Override via `.mat-mdc-form-field` |
| Form field label | 12px | 400 | `.mat-mdc-floating-label` |
| Select option | 12px | 400 | `.mat-mdc-option`, min-height 32px |
| Tab label | 11px | 600 | `--mat-tab-header-label-text-size`, letter-spacing 0.3px |
| Info callout | 11px | 400 | Small contextual messages inside forms |

**Font family**: `'Open Sans', sans-serif` — defined in `_base-theme.scss`. Do not introduce other fonts.

## Spacing Scale

All spacing follows a 4px base grid. Use these consistently:

| Token | Value | Usage |
|-------|-------|-------|
| `--app-spacing-2xs` | 2px | Icon-to-text inline gap |
| `--app-spacing-xs` | 4px | Tight padding (compact buttons, badges, chips) |
| `--app-spacing-sm` | 8px | Inner card padding, form field gaps, table cell padding |
| `--app-spacing-md` | 12px | Section gaps, card content padding |
| `--app-spacing-lg` | 16px | Card outer padding, column gaps |
| `--app-spacing-xl` | 24px | Major section separation |
| `--app-spacing-2xl` | 32px | Page-level top/bottom margins |

### Compact Component Heights

| Element | Height | Notes |
|---------|--------|-------|
| Button (default) | 32px | Material density -2 |
| Button (dialog) | 30px | `--mdc-filled-button-container-height: 30px` |
| Button (small) | 26–28px | Use for inline/table actions, filter cards |
| Icon button | 32px | Square, no label |
| Icon button (table) | 24px | `--mdc-icon-button-state-layer-size: 24px`, icon 16px |
| Form field | 38px | `--mat-form-field-container-height: 38px`, vertical padding 7px |
| Table row | 36–40px | Tight rows maximize visible data |
| Sidebar nav item | 32px | Icon + text, single line |
| Tab | 36px | `--mdc-secondary-navigation-tab-container-height: 36px` |
| Chip / badge | 22–24px | Compact inline indicators |
| Toolbar / header bar | 46px | Fixed height app bar |
| Select option | 32px | `min-height: 32px`, padding `0 12px` |
| Export button (PDF/CSV) | 26px | `--mdc-outlined-button-container-height: 26px`, 11px font, 14px icon |
| Preset select | 26px | `mat-form-field` wrapper height 26px, 11px font |
| Customize icon button | 26px | `--mdc-icon-button-state-layer-size: 26px`, 16px icon |
| Dialog tab (compact) | 34px | Used in voice intelligence and similar modals |

## Color System

### Surface Hierarchy (Light Mode)

Design with **layered surfaces** to create depth without borders where possible:

| Layer | Token | Typical Use |
|-------|-------|-------------|
| Page background | `--mat-sys-surface` | Outermost shell (`#f4f4f4`) |
| Card / panel | `--mat-sys-surface-container` | Cards, modals (`#ffffff`) |
| Nested container | `--mat-sys-surface-container-high` | Nested cards, table headers (`#f8f9fa`) |
| Highest surface | `--mat-sys-surface-container-highest` | Hover states, selected rows (`#eaeaea`) |

### Status Colors

| Status | Color token | Background token | Usage |
|--------|-------------|-----------------|-------|
| Error | `--mat-sys-error` / `--app-error` | `--mat-sys-error-container` | Validation, failed calls |
| Success | `--app-success` | — | Call connected, queue healthy |
| Warning | `--app-warning` | — | Threshold alerts, pending |
| Info | `--app-info` | — | Neutral notifications |

### Text Hierarchy

| Level | Token | When to use |
|-------|-------|-------------|
| Primary text | `--mat-sys-on-surface` | Headings, primary data, values |
| Secondary text | `--mat-sys-on-surface-variant` | Labels, descriptions, metadata |
| Disabled text | `--mat-sys-on-surface` at 38% opacity | Disabled controls |
| Link text | `--mat-sys-primary` | Clickable text (not buttons) |

## Layout Patterns

### Page Shell — Standard Structure

Every feature page MUST use the standard page shell. This is defined in global `styles.scss` and provides consistent header, breadcrumbs, and content area.

```html
<div class="content-wrapper">
  <header class="header-container">
    <section class="content-header">
      <h1>Page Title</h1>
      <!-- Optional: action button aligned right -->
      <button mat-flat-button class="add-btn" (click)="openAdd()">
        <mat-icon>add</mat-icon>
        Adicionar
      </button>
    </section>
    <tails-breadcrumbs [breadcrumbs]="breadcrumbs"></tails-breadcrumbs>
  </header>

  <div class="content">
    <!-- Page content here -->
  </div>
</div>
```

**Global styles (already defined in `styles.scss`):**
- `.content-wrapper` — page background (`#e2e2e2`)
- `.header-container` — sticky header with bottom border
- `.content-header` — flex row with `justify-content: space-between` + `align-items: center`
- `.content-header h1` — 17px / 600 weight
- `.content > *` — 16px padding

The `h1` and action button go **directly inside** `<section class="content-header">` — do NOT wrap them in a `<div class="page-header">`. The flex layout is on `.content-header` itself.

**Required imports in the component TS:**

```typescript
import { ActivatedRoute } from '@angular/router'
import { Breadcrumb } from 'app/breadcrumbs/breadcrumbs.model'
import { BreadcrumbsComponent } from 'app/breadcrumbs/breadcrumbs.component'
```

Add `BreadcrumbsComponent` to the `imports` array. Wire breadcrumbs from route data:

```typescript
breadcrumbs: Breadcrumb[]

constructor(private activatedRoute: ActivatedRoute) {}

ngOnInit() {
  this.activatedRoute.data.subscribe(
    ({ breadcrumbs }) => (this.breadcrumbs = breadcrumbs)
  )
}
```

Breadcrumb data is defined in `app-routing.ts` per route:

```typescript
{
  path: 'my-feature',
  data: {
    breadcrumbs: [{ iconClass: 'icon_name', alias: 'Feature Name', url: '/my-feature' }]
  }
}
```

**Do NOT** use a standalone `<h2>` or custom header outside this shell. Every page follows this pattern.

### Button Color Convention

Buttons follow a strict color convention. Do NOT use `color="primary"` or `color="warn"` — use CSS classes instead:

| Role | Class | Background | Text | Usage |
|------|-------|------------|------|-------|
| Primary action | `.btn-primary-green` | `--app-success` (#28a745) | white | Save, Activate, Add, Confirm |
| Secondary action | `.btn-secondary` | `--mat-sys-surface-container-highest` (#e0e0e0) | `--mat-sys-on-surface` | Cancel, Close, Deactivate |
| Add button (header) | `.add-btn` | `--app-success` (#28a745) | white | "Adicionar" in page headers |

```css
.btn-primary-green {
  --mdc-filled-button-container-color: var(--app-success, #28a745);
  --mdc-filled-button-label-text-color: #fff;
  --mdc-filled-button-container-height: 32px;
  --mdc-filled-button-label-text-size: 12px;
}

.btn-secondary {
  --mdc-filled-button-container-color: var(--mat-sys-surface-container-highest, #e0e0e0);
  --mdc-filled-button-label-text-color: var(--mat-sys-on-surface, #1a1a1a);
  --mdc-filled-button-container-height: 32px;
  --mdc-filled-button-label-text-size: 12px;
}

/* OBRIGATÓRIO junto de .btn-secondary — sem isto o botão fica ILEGÍVEL no hover
   do tema claro. `src/_bootstrap-utilities.scss` é global e define
   `.btn-secondary:hover { background-color: #5A6268 }`, que vence o Material no
   hover (classe + pseudo). O gate `tails/complete-bootstrap-override` reprova
   quem declarar .btn-secondary sem declarar o :hover. Mesmo vale para as outras
   classes que aquele arquivo define com :hover: .btn, .btn-danger, .btn-dark,
   .btn-default, .btn-info, .btn-success, .btn-warning, .btn-outline-danger,
   .btn-outline-secondary, .close, .dropdown-item, .nav-link. */
.btn-secondary:hover {
  background-color: var(--mat-sys-surface-container-highest, #d6d9dd);
  color: var(--mat-sys-on-surface, #1a1a1a);
}

:host-context(.theme-default-dark) .btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--mat-sys-on-surface, #e0e0e0);
}
```

> **Cuidado com tokens que este app não define.** `--mat-sys-primary` resolve para **vazio** aqui —
> usá-lo deixa o elemento com a cor herdada e um link fica indistinguível de texto. Para link, use a
> classe global **`.link`** (`#007bff` no claro, `#64b5f6` no escuro).

```html
<!-- CORRECT -->
<button mat-flat-button class="btn-primary-green" (click)="save()">Salvar</button>
<button mat-flat-button class="btn-secondary" (click)="cancel()">Cancelar</button>

<!-- WRONG — do NOT use color attribute for action buttons -->
<button mat-flat-button color="primary">Salvar</button>
<button mat-flat-button color="warn">Cancelar</button>
```

**Exception**: Dialog buttons (`mat-dialog-actions`) use `mat-button` (text) for secondary and `mat-flat-button color="primary"` for primary, since dialogs use the M3 theme-level primary color.

### Dashboard / KPI Cards — `dash-card` Pattern

Dashboards use the **`dash-card`** pattern: lightweight `<div>` cards (NOT `<mat-card>`) with a header, big value, and description. Cards are laid out in responsive CSS grids. This is inspired by shadcn/ui dashboards, adapted to Material 3 tokens.

Reference implementation: `audit.component.html` (Métricas de Autorização tab), `validation-dashboard.component`, `satisfaction-dashboard.component`.

#### Dashboard Container

The dashboard content area uses `width: 100%` — no `max-width` constraint. Dashboards fill the available viewport to maximize data density:

```css
.dashboard-container { width: 100%; padding-top: var(--app-spacing-lg, 16px); }
.dashboard { display: flex; flex-direction: column; gap: 12px; }
```

#### Grid Layout

```css
/* Uniform grids */
.dash-grid { display: grid; gap: 12px; }
.dash-grid-2 { grid-template-columns: repeat(2, 1fr); }
.dash-grid-4 { grid-template-columns: repeat(4, 1fr); }
.dash-grid-5 { grid-template-columns: repeat(5, 1fr); }

/* Composite grids — combine chart cards + tables in a single row */
.dash-grid-charts { grid-template-columns: 1fr 1fr 1fr; }          /* 3 equal chart cards */
.dash-grid-trend-table { grid-template-columns: 5fr 7fr; align-items: start; } /* trend + table */

@media (max-width: 1200px) {
  .dash-grid-charts { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 992px) {
  .dash-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .dash-grid-5 { grid-template-columns: repeat(3, 1fr); }
  .dash-grid-2, .dash-grid-charts, .dash-grid-trend-table { grid-template-columns: 1fr; }
}
@media (max-width: 576px) {
  .dash-grid-4, .dash-grid-5 { grid-template-columns: 1fr; }
}
```

#### Card Structure

```html
<!-- Standard KPI card -->
<div class="dash-card">
  <div class="dash-card-header">
    <span class="dash-card-title">Verificações</span>
    <mat-icon class="dash-card-icon">verified</mat-icon>
  </div>
  <span class="dash-card-value">310</span>
  <span class="dash-card-desc">Total de checks de autorização</span>
</div>

<!-- Card with trend indicator -->
<div class="dash-card">
  <div class="dash-card-header">
    <span class="dash-card-title">Cache Hit Rate</span>
    <mat-icon class="dash-card-icon">speed</mat-icon>
  </div>
  <span class="dash-card-value">91.8<small class="dash-card-unit">%</small></span>
  <span class="dash-card-desc dash-desc-success">
    <mat-icon class="dash-trend-icon">trending_up</mat-icon>
    Acima do ideal
  </span>
</div>

<!-- Compact metric card (performance row) -->
<div class="dash-card dash-card-compact">
  <span class="dash-card-title">Tempo Médio</span>
  <span class="dash-card-value dash-value-sm">17.63<small class="dash-card-unit">ms</small></span>
</div>

<!-- Card with chart -->
<div class="dash-card">
  <div class="dash-card-header">
    <div>
      <span class="dash-card-title">Top Usuários — Acesso Negado</span>
      <span class="dash-card-subtitle">3 usuários com acessos negados</span>
    </div>
  </div>
  <div class="dash-chart">
    <canvas #chartRef></canvas>
  </div>
</div>
```

#### Card CSS

```css
.dash-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px; border-radius: 8px;
  background: var(--mat-sys-surface-container, #fff);
  border: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.08));
}
.dash-card-compact { padding: 10px 12px; gap: 2px; }

.dash-card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.dash-card-title { font-size: 12px; font-weight: 500; color: var(--mat-sys-on-surface-variant, #666); display: block; }
.dash-card-subtitle { font-size: 10px; color: var(--mat-sys-on-surface-variant, #999); display: block; margin-top: 1px; }
.dash-card-icon { font-size: 16px; width: 16px; height: 16px; color: var(--mat-sys-on-surface-variant, #aaa); opacity: .6; }
.dash-card-value { font-size: 28px; font-weight: 700; line-height: 1; color: var(--mat-sys-on-surface, #222); margin-top: 2px; }
.dash-value-sm { font-size: 20px; }
.dash-value-success { color: #2e7d32; }
.dash-value-warning { color: #e65100; }
.dash-value-danger { color: #d32f2f; }
.dash-card-unit { font-size: 14px; font-weight: 600; opacity: .5; margin-left: 1px; }
.dash-card-desc { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--mat-sys-on-surface-variant, #888); margin-top: 2px; }
.dash-desc-success { color: #2e7d32; }
.dash-desc-warning { color: #e65100; }
.dash-desc-danger { color: #d32f2f; }
.dash-trend-icon { font-size: 14px; width: 14px; height: 14px; }
.dash-chart { position: relative; height: 260px; margin-top: 8px; }
.dash-chart canvas { width: 100% !important; height: 100% !important; }
```

#### Score Ring (optional — for compliance/satisfaction score)

```html
<div class="dash-card">
  <div class="dash-card-header">
    <span class="dash-card-title">Score médio</span>
    <mat-icon class="dash-card-icon">grade</mat-icon>
  </div>
  <div class="dash-score-row">
    <div class="score-ring" [style.border-color]="getColor(score)">
      <span class="score-ring-value">{{ scorePercent }}%</span>
    </div>
    <div class="dash-score-copy">
      <span class="dash-card-desc">de conformidade</span>
    </div>
  </div>
</div>
```

```css
.dash-score-row { display: flex; align-items: center; gap: var(--app-spacing-md, 12px); }
.dash-score-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.score-ring { width: 60px; height: 60px; border-radius: 50%; border: 5px solid var(--app-success, #28a745); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.score-ring-value { font-size: 22px; font-weight: 700; line-height: 1; color: var(--mat-sys-on-surface, #222); }
```

#### Dashboard Meta Footer

```html
<div class="dash-meta">
  <mat-icon class="dash-meta-icon">schedule</mat-icon>
  Atualizado: {{ lastUpdate }}
  <span class="meta-sep">·</span>
  Reset: {{ lastReset }}
</div>
```

```css
.dash-meta { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--mat-sys-on-surface-variant, #aaa); padding: 4px 0; border-top: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.06)); }
.dash-meta-icon { font-size: 12px; width: 12px; height: 12px; }
.meta-sep { margin: 0 4px; opacity: .4; }
```

#### Dark Mode

```css
:host-context(.theme-default-dark) .dash-card { border-color: rgba(255, 255, 255, 0.12); }
```

#### Dashboard Rules

- Use `div.dash-card` — do NOT use `<mat-card>` for dashboard KPI cards
- Dashboard container: `width: 100%`, no `max-width` — dashboards fill the viewport
- **Uniform grids**: `dash-grid-4` for KPIs, `dash-grid-5` for compact metrics, `dash-grid-2` for paired panels
- **Composite grids**: prefer combining related visualizations into a single row to reduce vertical scrolling and balance the layout:
  - `dash-grid-charts` (3-col equal) — for multiple chart cards (e.g. 2 pie charts + 1 trend bar chart)
  - `dash-grid-trend-table` (`5fr 7fr`) — for placing a trend/chart card beside a `table-section` breakdown
- **Trend cards in grids**: when a `dash-card-trend` sits inside a composite grid, use `flex: 1` on `.dash-trend-scroll`, `.trend-bars`, and `.trend-bar-wrapper` so the bars stretch to fill the card height, aligning visually with adjacent chart cards
- Values: 28px/700 for primary, 20px for compact (`dash-value-sm`)
- Titles: 12px/500, muted `--mat-sys-on-surface-variant`
- Icons in header: 16px, muted with 0.6 opacity — decorative, not attention-grabbing
- Status colors on descriptions: `dash-desc-success`, `dash-desc-warning`, `dash-desc-danger`
- Responsive: 3-col → 2-col at 1200px for `dash-grid-charts`; everything stacks to 1-col at 992px; KPI grids 1-col at 576px

### Data Tables — Table Section Pattern

Tables MUST be wrapped in a **`.table-section`** container — a bordered, rounded panel that groups the header bar, table, empty state, and pagination into a single visual unit. Do NOT use `<mat-card>` for table containers.

Reference implementation: `audit.component.html` / `audit.component.css`.

#### Full Structure

```html
<div class="table-section">
  <!-- Header bar: title + actions -->
  <div class="table-header">
    <span class="table-title">Section Title</span>
    <div class="header-actions">
      <button mat-stroked-button class="filter-toggle-btn" (click)="drawer.toggle()">
        <mat-icon>filter_list</mat-icon>
        Filtros
        <span *ngIf="drawer.activeFilterCount > 0" class="filter-badge">
          {{ drawer.activeFilterCount }}
        </span>
      </button>
      <!-- Optional: export buttons -->
      <button mat-stroked-button class="export-btn" (click)="downloadPdf()">
        <mat-icon>picture_as_pdf</mat-icon> PDF
      </button>
    </div>
  </div>

  <!-- Optional: active filter chips -->
  <div class="active-filters-bar" *ngIf="drawer.activeFilters.length > 0">
    <mat-icon class="active-filters-icon">filter_list</mat-icon>
    <span class="active-filters-label">Filtros ({{ drawer.activeFilterCount }}):</span>
    <div class="active-chips">
      <span *ngFor="let chip of drawer.activeFilters" class="filter-chip">
        <span class="chip-key">{{ chip.label }}:</span>
        <span class="chip-value">{{ chip.displayValue }}</span>
        <mat-icon class="chip-remove" (click)="drawer.removeChip(chip)">close</mat-icon>
      </span>
    </div>
    <button mat-button class="clear-filters-link" (click)="drawer.clearAllFilters()">Limpar</button>
  </div>

  <!-- Loading indicator -->
  <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

  <!-- Table -->
  <div class="table-responsive" *ngIf="!loading">
    <table mat-table [dataSource]="data" class="data-table">
      <!-- columns... -->
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  </div>

  <!-- Empty state (required for every data view) -->
  <div class="empty-state" *ngIf="!loading && data.length === 0">
    <mat-icon>search_off</mat-icon>
    <p class="empty-state-title">Nenhum registro encontrado</p>
    <p class="empty-state-subtitle" *ngIf="drawer.activeFilterCount > 0">
      Tente ajustar os filtros ou limpar a busca
    </p>
  </div>

  <!-- Pagination -->
  <div class="pagination-area" *ngIf="!loading && total > 0">
    <tails-pagination [page]="page" [qtdPerPag]="perPage"
                      [totalReg]="total" [qtdAdjacentes]="3"
                      (onPaginate)="onPaginationChange($event)"></tails-pagination>
  </div>
</div>
```

#### Table Section CSS

These classes MUST be applied consistently across all data table views:

```css
/* Container */
.table-section {
  border: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.08));
  border-radius: 6px;
  overflow: hidden;
  background: var(--mat-sys-surface-container, #fff);
}

/* Header bar */
.table-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; min-height: 34px; flex-wrap: wrap;
  background-color: var(--mat-sys-surface-container, #f2f2f2);
  border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.08));
}

.table-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .5px; color: var(--mat-sys-on-surface-variant, #555);
}

.header-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }

/* Table rows */
.data-table .mat-mdc-header-row { height: 36px; background-color: var(--mat-sys-surface-container-high, #f8f9fa); }
.data-table .mat-mdc-header-cell {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .3px; color: var(--mat-sys-on-surface-variant, #555); padding: 0 8px;
}
.data-table .mat-mdc-row { height: 38px; }
.data-table .mat-mdc-cell { font-size: 12px; padding: 0 8px; }
.data-table .mat-mdc-row:hover { background-color: var(--mat-sys-surface-container-highest, rgba(0,0,0,.03)); }

/* Pagination */
.pagination-area { padding: 4px 10px; border-top: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.08)); }

/* Table responsive */
.table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

#### Table Rules

- Row height: **36–40px** — never taller unless cells contain multi-line content
- Header: `surface-container-high` background, 10px uppercase, 700 weight
- No alternating row colors. Use hover highlight + subtle bottom borders
- Action buttons in rows: `mat-icon-button` with `--mdc-icon-button-state-layer-size: 24px`, icon 16px
- Pagination: use `tails-pagination` component (NOT `mat-paginator`)
- Every `mat-icon-button` MUST have `aria-label`

### Filter Drawer — `tails-filter-drawer`

Every data-listing page MUST use the `FilterDrawerComponent` to provide a filter sidebar that opens from the right. Do NOT use inline form fields in the table header for filtering.

#### Scope of the rule

- **Applies to listing *pages*** — templates that use the page shell (`content-wrapper`) with a `table-section` and `tails-pagination`.
- **Applies even when the page has no filters yet.** A listing page with no search/filter UI at all is NOT compliant — the absence of *inline* filters is not evidence of compliance. Check the service: it usually already accepts a `search` param that no UI is calling, so adding the drawer both fixes the design and unlocks an existing capability.
- **Does NOT apply** to tables embedded in dialogs or drill-down panels of a dashboard (result dialogs, campaign sub-tables). A filter sidebar makes no sense there; those tables are already scoped by the parent context.

#### Integration Pattern

The `<tails-filter-drawer>` component uses content projection (`<ng-content>`). The table section is placed **inside** the drawer as projected content:

```html
<tails-filter-drawer
  #drawer
  [fields]="filterConfig"
  [values]="filterValues"
  (applied)="onFiltersApplied($event)"
  (cleared)="onFiltersCleared()"
  (chipRemoved)="onChipRemoved($event)"
>
  <!-- All page content goes here — it gets projected -->
  <div class="table-section">
    <!-- ... table-header with filter button, table, empty state, pagination ... -->
  </div>
</tails-filter-drawer>
```

#### Required Imports

```typescript
import { FilterDrawerComponent } from 'app/shared/filter-drawer/filter-drawer.component'
import { FilterField } from 'app/shared/filter-drawer/filter-drawer.model'
```

Add `FilterDrawerComponent` to the component's `imports` array.

#### Filter Configuration

Define filter fields using `FilterField[]`:

```typescript
filterConfig: FilterField[] = [
  { key: 'search', label: 'Busca', type: 'text', placeholder: 'Buscar...' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
  ]},
  { key: 'methods', label: 'Métodos', type: 'multi-select', defaultValue: ['GET', 'POST'], options: [
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
  ]},
  { key: 'period', label: 'Período', type: 'date-range', includeTime: true },
]

filterValues: Record<string, any> = { search: '', status: '', methods: ['GET', 'POST'] }
```

Available field types: `text`, `select`, `multi-select`, `date`, `date-range` (with optional `includeTime`).

#### Filter Handlers Pattern

```typescript
// Type ALIAS with optional props — not an interface. A type alias gets the implicit
// index signature required by the drawer's `@Input() values: Record<string, any>`,
// and typing the values avoids `any` (which fails the zero-warnings lint gate).
type MyFilterValues = {
  search?: string
  status?: string
}

filterValues: MyFilterValues = { search: '', status: '' }

onFiltersApplied(values: MyFilterValues): void {
  this.search = values.search ?? ''
  this.statusFilter = values.status ?? ''
  this.page = 1
  this.syncFilterValues()
  this.loadData()
}

// Must NOT fetch: clearAllFilters() emits `cleared` AND `applied`. Fetching in both
// handlers fires two requests for one user action.
onFiltersCleared(): void {
  this.resetFilterState()
}
```

#### Wiring rules

- **`(chipRemoved)` is unnecessary** — `removeChip()` emits `applied` right after, which already reloads. Binding it and re-applying causes a duplicate request; leaving an empty handler forces a comment, which the PABX project forbids in production code. Omit the binding.
- **Rebuild `filterConfig` when async options arrive.** Options for queues/categories/tags load after `ngOnInit`; assign a **new array** to `filterConfig` in each subscription so the drawer's `ngOnChanges` picks it up. Mutating the existing array does nothing.
- **When retrofitting an existing screen, preserve its public API.** Existing specs set individual filter properties (`statusFilter`, `search`) and call `applyFilters()` / `clearFilters()` directly. Keep those as the source of truth that `loadData()` reads, and let the drawer *feed* them via `onFiltersApplied`. Never adapt the spec to the refactor (see "Test Compatibility").
- **The drawer's own CSS classes are not global.** `.filter-toggle-btn`, `.filter-badge`, `.active-filters-bar`, `.filter-chip`, `.chip-key`, `.chip-remove`, `.clear-filters-link` and `.header-actions` must be present in the component's styles — a screen that projects the markup without them renders the filter UI unstyled. Prefer a shared base CSS per module (see "Shared Base CSS") over copying the block into every screen.
- The generic empty option renders as **"Todos"** for every `select`, including grammatically feminine labels (Prioridade, Fila, Categoria). It comes from the shared component and is consistent platform-wide — do not fork the drawer to fix agreement.

#### Filter Button & Badge CSS

```css
/* 26px compact button for header-actions */
.filter-toggle-btn {
  height: 26px; padding: 0 10px; font-size: 11px; border-radius: 4px;
  --mdc-outlined-button-container-height: 26px;
  display: inline-flex; align-items: center; gap: 4px;
}
.filter-toggle-btn .mat-icon { font-size: 14px; width: 14px; height: 14px; }

/* Active count badge */
.filter-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background-color: var(--mat-sys-primary); color: var(--mat-sys-on-primary);
  font-size: 10px; font-weight: 600;
}

/* Export buttons (same height) */
.export-btn {
  height: 26px; padding: 0 10px; font-size: 11px; border-radius: 4px;
  --mdc-outlined-button-container-height: 26px;
  --mdc-filled-button-container-height: 26px;
}
.export-btn .mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
```

#### Active Filter Chips Bar CSS

```css
.active-filters-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; margin: 8px 10px 0;
  background-color: var(--mat-sys-surface-container, rgba(0,0,0,.03));
  border-radius: 6px; flex-wrap: wrap;
}
.active-filters-icon { font-size: 16px; width: 16px; height: 16px; color: var(--mat-sys-on-surface-variant); }
.active-filters-label { font-size: 11px; font-weight: 600; color: var(--mat-sys-on-surface-variant); }
.active-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; }
.filter-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  background-color: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
  border-radius: 12px; font-size: 11px;
}
.chip-key { font-weight: 600; }
.chip-remove { font-size: 13px; width: 13px; height: 13px; cursor: pointer; opacity: .6; }
.chip-remove:hover { opacity: 1; }
.clear-filters-link { font-size: 11px; --mdc-text-button-container-height: 24px; margin-left: auto; }
```

### Pagination — `tails-pagination`

Use `PaginationComponent` for all paginated tables. Do NOT use Angular Material's `mat-paginator`.

```typescript
import { PaginationComponent } from 'app/pagination/pagination.component'
```

Add to `imports` array. Usage:

```html
<tails-pagination
  [page]="page"
  [qtdPerPag]="perPage"
  [totalReg]="total"
  [qtdAdjacentes]="3"
  (onPaginate)="onPaginationChange($event)"
></tails-pagination>
```

Handler receives the page number directly:

```typescript
onPaginationChange(page: number) {
  this.page = page
  this.loadData()
}
```

### Loading States

Use `mat-progress-bar` (indeterminate) as the loading indicator **inside** the data container (`.table-section`, card, or list panel). It MUST be spatially contained within the same visual boundary as the data it represents — never floating above the page header or outside the content area. Place it between the `table-header` and the `table-responsive` div:

```html
<mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>
<div class="table-responsive" *ngIf="!loading">
  <!-- table -->
</div>
```

Import: `import { MatProgressBarModule } from '@angular/material/progress-bar'`

Do NOT use text-based "Carregando..." messages. Do NOT use spinner overlays for tables.

### Empty States

Every data view MUST have an empty state **inside** the data container (`.table-section`, card, or list panel), shown when `!loading && data.length === 0`. The empty state replaces the data area — it MUST NOT appear outside the container, above the page header, or as a page-level floating element:

```html
<div class="empty-state" *ngIf="!loading && data.length === 0">
  <mat-icon>search_off</mat-icon>
  <p class="empty-state-title">Nenhum registro encontrado</p>
  <p class="empty-state-subtitle" *ngIf="hasActiveFilters">
    Tente ajustar os filtros ou limpar a busca
  </p>
</div>
```

```css
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 48px 24px; text-align: center;
}
.empty-state mat-icon {
  font-size: 48px; width: 48px; height: 48px;
  color: var(--mat-sys-on-surface-variant); margin-bottom: 16px; opacity: .6;
}
.empty-state-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.empty-state-subtitle { margin: 0; font-size: 12px; color: var(--mat-sys-on-surface-variant); }
```

Choose a contextually appropriate icon (e.g. `search_off`, `dns`, `group_off`, `inbox`). Always include a subtitle when filters are active.

### Tabbed Pages with Filter Drawers

When a page has tabs, each tab gets its own `FilterDrawerComponent` instance. The structure nests as:

```html
<mat-tab-group animationDuration="0ms">
  <mat-tab label="Tab Name">
    <div class="tab-content">
      <tails-filter-drawer #tabDrawer [fields]="config" [values]="values" ...>
        <div class="tab-inner">
          <div class="table-section">
            <!-- table-header, table, empty-state, pagination -->
          </div>
        </div>
      </tails-filter-drawer>
    </div>
  </mat-tab>
</mat-tab-group>
```

```css
.tab-content { padding: 12px 0 0; }
.tab-inner { width: 100%; display: flex; flex-direction: column; gap: 8px; }
```

Always use `animationDuration="0ms"` on `mat-tab-group` — data must render instantly.

### Forms & Dialogs

All forms follow a **high-density compact pattern**. Reference implementation: `form-queue.component.css`.

#### Dialog Structure

```css
/* Title: 13px, border-bottom separator */
:host ::ng-deep .mat-mdc-dialog-title.mdc-dialog__title {
  padding: 10px 16px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
}

/* Content: tight padding, scrollable */
:host ::ng-deep mat-dialog-content {
  padding: 12px 16px !important;
  max-height: 72vh !important;
}

/* Actions: border-top separator, 30px buttons */
:host ::ng-deep mat-dialog-actions {
  padding: 8px 16px !important;
  border-top: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
  gap: 6px;
}

:host ::ng-deep mat-dialog-actions button {
  font-size: 12px;
  height: 30px;
  --mdc-filled-button-container-height: 30px;
  --mdc-text-button-container-height: 30px;
}
```

#### Form Fields

```css
/* 38px height, 12px font, 4px border-radius — tokens never need !important */
:host ::ng-deep .mat-mdc-form-field {
  --mat-form-field-container-height: 38px;
  --mat-form-field-container-vertical-padding: 7px;
  --mdc-outlined-text-field-container-shape: 4px;
  font-size: 12px;
}

/* !important needed: Material's internal label has high specificity */
:host ::ng-deep .mat-mdc-form-field .mat-mdc-floating-label {
  font-size: 12px !important;
}

:host ::ng-deep .mat-mdc-select-value-text {
  font-size: 12px;
}

:host ::ng-deep .mat-mdc-select-arrow-wrapper {
  transform: scale(0.8);
}

/* !important needed: Material option has competing internal styles */
:host ::ng-deep .mat-mdc-option {
  font-size: 12px !important;
  min-height: 32px !important;
  padding: 0 12px !important;
}
```

#### Form Field `subscriptSizing`

Always use `subscriptSizing="dynamic"` on `mat-form-field` inside compact dialogs. Without it, Material reserves a fixed 22px space below every field for hint/error text — this causes overlapping fields in our 38px compact layout.

```html
<!-- CORRECT — subscript only takes space when an error is active -->
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Email</mat-label>
  <input matInput formControlName="email" />
  <mat-error *ngIf="...">Obrigatório</mat-error>
</mat-form-field>

<!-- WRONG — fixed subscript space causes overlap in compact grids -->
<mat-form-field appearance="outline">
  ...
</mat-form-field>
```

With `dynamic`, the field container expands only when `<mat-error>` or `<mat-hint>` becomes visible, then collapses back. This pairs well with `gap: 2px 8px` in form grids.

#### Form Layout

- Use **CSS Grid** (`form-grid`, `form-grid-2`, `form-grid-3`) with `gap: 2px 8px` — not flexbox
- Group related fields with subtle section headers (`10–11px`, uppercase, `600` weight, `--mat-sys-on-surface-variant`)
- Place actions (save/cancel) right-aligned in `mat-dialog-actions`
- Use `mat-hint` sparingly — only for non-obvious fields
- Validation errors: show inline via `<mat-error>`, never as toast/snackbar

#### Tabs Inside Dialogs

```css
:host ::ng-deep .mat-mdc-tab-group {
  --mat-tab-header-label-text-size: 11px;
  --mat-tab-header-label-text-weight: 600;
  --mat-tab-header-label-text-letter-spacing: 0.3px;
}

:host ::ng-deep .mat-mdc-tab {
  flex-grow: 0 !important;
  min-width: 0;
  padding: 0 14px;
  --mdc-secondary-navigation-tab-container-height: 36px;
}
```

#### Steppers Inside Dialogs

When using `mat-stepper` inside a dialog, apply compact overrides for step icons, labels, and content area:

```css
:host ::ng-deep .mat-horizontal-stepper-header-container { margin-bottom: 4px; }
:host ::ng-deep .mat-step-header { padding: 0 8px !important; min-height: 36px; }
:host ::ng-deep .mat-step-icon { width: 22px; height: 22px; font-size: 11px; }
:host ::ng-deep .mat-step-label { font-size: 11px; font-weight: 500; min-width: 0; }
:host ::ng-deep .mat-step-label.mat-step-label-active,
:host ::ng-deep .mat-step-label.mat-step-label-selected { font-weight: 600; }
:host ::ng-deep .mat-stepper-horizontal-line { margin: 0 -4px; }
:host ::ng-deep .mat-horizontal-content-container { padding: 8px 0 0 !important; }
```

Step action buttons (Cancelar / Próximo / Voltar) should be placed in a `.step-actions` container with a subtle top border:

```css
.step-actions {
  display: flex; justify-content: flex-end; gap: 6px;
  margin-top: 10px; padding-top: 8px;
  border-top: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.06));
}
.step-actions button {
  font-size: 12px; height: 30px;
  --mdc-filled-button-container-height: 30px;
  --mdc-text-button-container-height: 30px;
}
```

#### Expansion Panels (Compact)

When using `mat-expansion-panel` inside dialogs or forms (e.g. group permission lists):

```css
:host ::ng-deep .mat-expansion-panel {
  margin-bottom: 2px !important;
  box-shadow: none !important;
  border: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
  border-radius: 4px !important;
}
:host ::ng-deep .mat-expansion-panel-header {
  min-height: 34px !important; height: 34px;
  padding: 0 12px !important; font-size: 12px;
}
:host ::ng-deep .mat-expansion-panel-header.mat-expanded {
  min-height: 34px !important; height: 34px;
}
:host ::ng-deep .mat-expansion-panel-body { padding: 6px 12px 8px !important; }
:host ::ng-deep .mat-expansion-indicator::after { padding: 3px !important; }
```

For `mat-checkbox` inside expansion panels, compact the checkbox itself:

```css
:host ::ng-deep .mdc-checkbox { width: 16px; height: 16px; padding: 0; }
:host ::ng-deep .mdc-checkbox__background { width: 16px; height: 16px; top: 0; left: 0; }
:host ::ng-deep .mat-mdc-checkbox-touch-target { width: 24px; height: 24px; }
:host ::ng-deep .mdc-checkbox__ripple,
:host ::ng-deep .mat-mdc-checkbox-ripple { display: none; }
```

#### Section Labels (Fila, Codec, etc.)

```css
.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--mat-sys-on-surface-variant, #555);
}
```

#### Info Callouts Inside Forms

Two variants: **info** (blue, default) and **warning** (orange).

```css
.info-callout {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  margin-bottom: 10px;
  background-color: rgba(25, 118, 210, 0.05);
  border-radius: 0 4px 4px 0;
  border-left: 3px solid var(--mat-sys-primary, #1976d2);
}

.info-callout mat-icon {
  color: var(--mat-sys-primary, #1976d2);
  flex-shrink: 0;
  font-size: 14px;
  width: 14px;
  height: 14px;
}

.info-callout p {
  margin: 0;
  font-size: 11px;
  color: var(--mat-sys-on-surface-variant, #555);
}

/* Warning variant — for destructive or caution contexts */
.info-callout-warn {
  background-color: rgba(237, 108, 2, 0.05);
  border-left-color: var(--app-warning, #ed6c02);
}

.info-callout-warn mat-icon {
  color: var(--app-warning, #ed6c02);
}
```

```html
<!-- Info (default) -->
<div class="info-callout">
  <mat-icon>info</mat-icon>
  <p>Informational message here.</p>
</div>

<!-- Warning -->
<div class="info-callout info-callout-warn">
  <mat-icon>warning</mat-icon>
  <p>Caution: this action cannot be undone.</p>
</div>
```

### Permission / Toggle Lists

When rendering a list of boolean options (permissions, features, settings), use the **permission-card** pattern: compact cards with a category header and toggle rows.

#### Structure

```html
<div class="permissions-container">
  <div *ngFor="let group of groups">
    <div class="permission-card">
      <div class="permission-card-header">
        <span class="permission-card-title">{{ group.title }}</span>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-input" (click)="checkAll($event, group.id)" />
          <span class="toggle-track"></span>
        </label>
      </div>
      <div class="permissions-list">
        <div class="permission-row" *ngFor="let option of group.options">
          <span class="permission-label">{{ option.label }}</span>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-input" [checked]="option.checked"
                   (change)="onToggle(option, $event)" />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
```

#### CSS

```css
.permissions-container { display: flex; flex-direction: column; gap: 6px; }

.permission-card {
  border: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
  border-radius: 4px; overflow: hidden;
}

.permission-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px;
  background-color: var(--mat-sys-surface-container-high, #f8f9fa);
  border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
}

.permission-card-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.3px; color: var(--mat-sys-on-surface-variant, #555);
}

.permission-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 12px;
  border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.04));
}
.permission-row:last-child { border-bottom: none; }
.permission-row:hover { background-color: var(--mat-sys-surface-container-highest, rgba(0,0,0,0.03)); }

.permission-label { font-size: 12px; color: var(--mat-sys-on-surface, #333); }
```

#### CSS Toggle Switch (native checkbox styled as switch)

When a component uses native `<input type="checkbox">` with DOM-based logic (e.g. `checkAll` via `document.querySelector`), do NOT replace with `mat-slide-toggle` — it will break the DOM manipulation. Instead, wrap the checkbox in a `<label>` with a sibling `<span>` for the visual track.

**IMPORTANT**: `<input>` is a void/replaced element — `::before`/`::after` pseudo-elements do NOT render on it. Always use a sibling `<span>` for the track visual.

```html
<label class="toggle-switch">
  <input type="checkbox" class="toggle-input" ... />
  <span class="toggle-track"></span>
</label>
```

```css
.toggle-switch {
  display: inline-flex; align-items: center;
  cursor: pointer; flex-shrink: 0;
}
.toggle-input {
  position: absolute; opacity: 0; width: 0; height: 0;
  pointer-events: none;
}
.toggle-track {
  display: inline-block; width: 34px; height: 18px;
  background-color: var(--mat-sys-outline, #bbb);
  border-radius: 9px; position: relative;
  transition: background-color 0.2s ease; cursor: pointer;
}
.toggle-track::before {
  content: ''; position: absolute;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; top: 2px; left: 2px;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.toggle-input:checked + .toggle-track {
  background-color: var(--mat-sys-primary, #1976d2);
}
.toggle-input:checked + .toggle-track::before {
  transform: translateX(16px);
}
```

The `<label>` click propagates to the hidden `<input>`, so `input.click()` and `input.checked` in DOM manipulation code still work correctly.

### Password Fields with Tooltip

When a password field has a validation tooltip (e.g. `tails-password-rules-tooltip`), place the field and tooltip in a **dedicated row** — never inside a multi-column grid. The tooltip is absolutely positioned and will overflow into adjacent columns.

```html
<!-- CORRECT — password on its own row -->
<div class="password-row">
  <mat-form-field appearance="outline" class="password-field">
    <mat-label>Senha</mat-label>
    <input matInput [type]="passwordVisible ? 'text' : 'password'" ... />
    <button mat-icon-button matSuffix type="button"
            (click)="passwordVisible = !passwordVisible"
            aria-label="Alternar visibilidade da senha">
      <mat-icon>{{ passwordVisible ? 'visibility_off' : 'visibility' }}</mat-icon>
    </button>
  </mat-form-field>
  <tails-password-rules-tooltip></tails-password-rules-tooltip>
</div>

<!-- Then other fields in a separate grid -->
<div class="form-grid form-grid-2">
  <mat-form-field>...</mat-form-field>
  <mat-form-field>...</mat-form-field>
</div>
```

```css
.password-row { position: relative; margin-bottom: 8px; }
.password-field { width: 100%; max-width: 340px; }
```

### Sidebar Navigation

- Nav items: 32px height, 12px left padding, `body-small` font
- Active item: `primary-container` background, `primary` text
- Icons: 18px, aligned left with 8px gap to text
- Sections: separated by subtle divider + uppercase section label
- Collapsed state: icons only, 48px width with tooltip on hover

## Micro-interactions & Motion

Use animation with restraint — motion should **clarify state changes**, not decorate.

| Interaction | Animation | Duration |
|------------|-----------|----------|
| Page transition | None (instant) | — |
| Dialog open | Scale from 0.95 + fade | 150ms `ease-out` |
| Dialog close | Fade out | 100ms `ease-in` |
| Sidebar expand/collapse | Width transition | 200ms `ease-in-out` |
| Button hover | Background color shift | 100ms |
| Table row hover | Background highlight | Instant (no transition) |
| Loading skeleton | Pulse animation | CSS `animation: pulse 1.5s infinite` |
| Snackbar enter | Slide up + fade | 200ms |
| Tooltip | Delay 300ms, then fade 100ms | — |

**Never** add entrance animations to data rows, list items, or cards on page load. Data should appear instantly.

## Project Context

Angular 19 + Angular Material (M3 theme system). Component prefix: `tails`. Bootstrapped via `bootstrapApplication` with lazy-loaded feature NgModules.

## Architecture: Hybrid Standalone + NgModule

| Layer | Pattern | Example |
|-------|---------|---------|
| Root bootstrap | `bootstrapApplication` + `provideRouter` | `main.ts` |
| Feature domains | Lazy-loaded **NgModules** (`loadChildren`) | `queues.module.ts` |
| Components | **`standalone: true`** with explicit imports | All `.component.ts` |
| Shared UI | `SharedModule` re-exports `MaterialModule` + standalone components | `shared.module.ts` |

**Decision rules:**
- New **components** → always `standalone: true`
- New **feature areas** → use `loadComponent` with standalone (no new NgModules)
- Editing existing NgModule features → keep the module pattern, don't refactor mid-task

## Material Imports — Use Modules

Import Material via `Mat*Module`, not standalone component classes:

```typescript
// CORRECT
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'

@Component({
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
})
```

```typescript
// WRONG — do NOT use standalone component imports
import { MatButton } from '@angular/material/button'
```

When inside a feature NgModule that imports `SharedModule`, Material modules are already available — don't re-import them in the component's `imports`.

## Button Syntax — Legacy Selectors

Use legacy directive selectors. Do NOT introduce the new `matButton` API:

```html
<!-- CORRECT -->
<button mat-button>Basic</button>
<button mat-raised-button color="primary">Elevated</button>
<button mat-stroked-button>Outlined</button>
<button mat-flat-button color="primary">Filled</button>
<button mat-icon-button aria-label="Menu"><mat-icon>more_vert</mat-icon></button>
```

```html
<!-- WRONG -->
<button matButton>Basic</button>
<button matButton="elevated">Elevated</button>
```

## Component Styling — CSS Files

- Component styles → `.component.css` using `var(--mat-sys-*)`
- Theme definitions → `.scss` using `@angular/material` SCSS API
- Global overrides → `src/styles.scss`

Never create `.component.scss` files for components.

## Theme Architecture

```
src/themes/_base-theme.scss    ← mat.theme() + mat.theme-overrides() (light/dark)
src/themes/default-theme.scss  ← .theme-default / .theme-default-dark + sidebar vars
src/styles.scss                ← global entry: imports theme + bootstrap-utilities
```

- Theme: `mat.$azure-palette` primary, `mat.$blue-palette` tertiary, `Open Sans`, `density: -2`
- Dark mode: `ThemeService` swaps `theme-default` / `theme-default-dark` class on `<body>`
- React to theme: inject `ThemeService`, subscribe to `isDarkMode$`

## Dark Mode — Component-Level Overrides

For custom backgrounds that don't use Material tokens automatically (e.g. `code` blocks, custom containers), add dark mode overrides using `:host-context(.theme-default-dark)`:

```css
/* Light mode uses token defaults; dark mode needs explicit overrides for custom elements */
:host-context(.theme-default-dark) .my-custom-container {
  background-color: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.12);
}

:host-context(.theme-default-dark) .btn-secondary {
  --mdc-filled-button-container-color: rgba(255,255,255,0.12);
  --mdc-filled-button-label-text-color: #e0e0e0;
}
```

Material token-based colors (`--mat-sys-*`) switch automatically — only add `:host-context` for elements using hardcoded `rgba()`, hex values, or custom backgrounds not covered by tokens.

## Customizing Material Tokens

```scss
// System-level (theme SCSS files only)
@include mat.theme-overrides((
  primary-container: #84ffff,
));

// Component-level (theme SCSS files only)
@include mat.card-overrides((
  elevated-container-color: red,
  elevated-container-shape: 32px,
));
```

Never override Material internals via `.mdc-*` or `.mat-mdc-*` class selectors.

## `!important` Policy

Use `!important` with extreme restraint. It is a last resort, not a default.

### When `!important` is NEVER needed

1. **CSS custom properties (tokens)** — Setting `--mdc-*` or `--mat-*` tokens. These are variables consumed via `var()`, not competing property declarations. Specificity of the selector is enough.

```css
/* CORRECT — no !important on tokens */
:host ::ng-deep .mat-mdc-form-field {
  --mat-form-field-container-height: 38px;
  --mdc-outlined-text-field-container-shape: 4px;
}

/* WRONG — tokens don't need !important */
:host ::ng-deep .mat-mdc-form-field {
  --mat-form-field-container-height: 38px !important;
}
```

2. **Our own CSS classes** — `.form-row`, `.filter-card`, `.phone-row`, etc. We control the specificity entirely.

3. **Properties on host/component-scoped selectors** — When no Material internal style competes.

### When `!important` MAY be needed

Only for **direct CSS property overrides** on Material internal elements where Material's own compiled styles have equal or higher specificity:

| Pattern | Example | Why |
|---------|---------|-----|
| Dialog title/content/actions padding/margin | `.mat-mdc-dialog-title { padding: 10px 16px !important }` | Material sets these via high-specificity internal selectors |
| `::before` pseudo-elements on Material | `.mdc-dialog__title::before { display: none !important }` | Material injects pseudo-elements with `!important` itself |
| `flex-grow` on tabs | `.mat-mdc-tab { flex-grow: 0 !important }` | Material forces `flex-grow: 1` internally |
| Floating label font-size | `.mat-mdc-floating-label { font-size: 12px !important }` | Material's internal selector has high specificity |

### Strategy: prefer tokens over property overrides

Before reaching for `!important`, check if a token exists:

```css
/* PREFER: token approach (no !important) */
:host ::ng-deep .mat-mdc-tab {
  --mdc-secondary-navigation-tab-container-height: 36px;
}

/* AVOID: direct property override (needs !important) */
:host ::ng-deep .mat-mdc-tab {
  height: 36px !important;
}
```

### In `styles.scss` (global)

Global selectors in `styles.scss` have lower specificity than Material's component-scoped styles. `!important` is acceptable here for **direct property overrides** (not tokens) that must win globally. Keep these to a minimum.

## Code Style

- Semicolons: **omitted** in TypeScript
- Quotes: **single quotes**
- Component selector prefix: **`tails-`**
- Date handling: **Moment.js**, locale `pt-BR`, format `DD/MM/YYYY`
- All user-facing text: **Portuguese (pt-BR)**

## Test Compatibility — NEVER Break Existing Tests

When refactoring UI or applying the design system to existing components, **all existing tests must continue passing without any modifications to the test files**. Tests are the source of truth for the component's public API.

### Rules

1. **Never modify test files to make them pass** — If a test references a property, method, or DOM element, the component MUST expose it. Adapt the component, not the test.
2. **Preserve public API** — When refactoring, keep all properties, methods, `@Input()`s, and `@Output()`s that existing tests reference. Add new ones freely, but never remove or rename existing ones.
3. **Add backward-compatible aliases** — If the design system introduces a new pattern (e.g. filter drawer values), keep the original properties (`userSearchTerm`, `onSearch()`) alongside new ones. Sync them.
4. **Guard new dependencies** — When adding new imports (e.g. `BreadcrumbsComponent`, `ActivatedRoute`), use `@Optional()` for injectable dependencies and `*ngIf` guards on template elements to prevent `NullInjectorError` in tests that don't provide them.
5. **Match DOM selectors tests expect** — If a test queries `querySelector('h2')`, the template must use `<h2>`. Do not change heading levels or element types that tests select by tag name.
6. **Run affected tests before committing** — After any component change, run `npx jest --testPathPatterns="<component>.spec"` and confirm 0 failures before considering the task done.

### Common Patterns

```typescript
// Backward-compatible method alias
onSearch() {
  this.page = 1
  this.loadData()
}

// Backward-compatible paginator bridge (old mat-paginator → new tails-pagination)
onPage(event: { pageIndex: number; pageSize: number }) {
  this.page = event.pageIndex + 1
  this.perPage = event.pageSize
  this.loadData()
}

// Guard optional dependency
constructor(@Optional() private activatedRoute: ActivatedRoute) {}
ngOnInit() {
  this.activatedRoute?.data.subscribe(({ breadcrumbs }) => (this.breadcrumbs = breadcrumbs))
}
```

```html
<!-- Guard template elements with optional dependencies -->
<tails-breadcrumbs *ngIf="breadcrumbs.length > 0" [breadcrumbs]="breadcrumbs"></tails-breadcrumbs>
```

### Compact Mat-Menu (Dropdown Menus)

When using `mat-menu` for toolbar dropdowns (e.g. tenant switcher, user menu), apply compact overrides via `::ng-deep` targeting the menu's `class`:

```html
<button mat-icon-button [matMenuTriggerFor]="myMenu" aria-label="Menu label">
  <mat-icon>swap_horiz</mat-icon>
</button>

<mat-menu #myMenu="matMenu" class="my-menu">
  <button mat-menu-item *ngFor="let item of items" (click)="select(item)"
    [class.active]="item.id === currentId">
    <mat-icon>{{ item.id === currentId ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
    <span>{{ item.label }}</span>
  </button>
</mat-menu>
```

```css
/* Panel shape */
:host ::ng-deep .my-menu.mat-mdc-menu-panel {
  min-width: 200px;
  max-width: 280px;
  border-radius: 6px;
  --mat-menu-container-color: var(--mat-sys-surface-container, #fff);
}

/* Compact menu items: 32px, 12px font */
:host ::ng-deep .my-menu .mat-mdc-menu-item {
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 32px;
}

:host ::ng-deep .my-menu .mat-mdc-menu-item .mat-icon {
  font-size: 16px; width: 16px; height: 16px;
  margin-right: 6px;
  color: var(--mat-sys-on-surface-variant, #888);
}

/* Active item highlight */
:host ::ng-deep .my-menu .mat-mdc-menu-item.active {
  font-weight: 600;
  background-color: var(--mat-sys-primary-container, rgba(25, 118, 210, 0.08));
}

:host ::ng-deep .my-menu .mat-mdc-menu-item.active .mat-icon {
  color: var(--mat-sys-primary, #1976d2);
}

/* Text overflow for long labels */
:host ::ng-deep .my-menu .mat-mdc-menu-item span {
  font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
```

If the menu contains a search field, place it in a non-menu-item div with `(click)="$event.stopPropagation()"` to prevent closing:

```html
<div class="menu-search" (click)="$event.stopPropagation()" *ngIf="items.length > 5">
  <mat-form-field appearance="outline" subscriptSizing="dynamic">
    <input matInput placeholder="Buscar..." [(ngModel)]="searchTerm" (ngModelChange)="filter()" />
  </mat-form-field>
</div>
```

```css
.menu-search {
  padding: 6px 10px;
  border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
}
.menu-search mat-form-field {
  width: 100%;
  --mat-form-field-container-height: 32px;
  --mat-form-field-container-vertical-padding: 4px;
  --mdc-outlined-text-field-container-shape: 4px;
  font-size: 12px;
}
```

### Auth Pages — Shared Base CSS

Auth pages (sign-in, tenant-selection, account-recovery, two-factor, etc.) render inside a centered `mat-card` provided by `auth.component.html`. Each auth page component MUST include the shared base CSS in its `styleUrls`:

```typescript
@Component({
  styleUrls: ['./my-auth-page.component.css', '../auth.base.css']
})
```

`auth.base.css` defines shared classes used across all auth pages:

| Class | Purpose |
|-------|---------|
| `h1.title` | Page title: 15px / 600 weight, centered |
| `p.login-box-msg` | Subtitle: 12px, centered, muted color |
| `.separator` | Horizontal rule: 1px, 12px vertical margin |
| `.link` | Centered text link: 12px, primary color |
| `.recaptcha-disclosure` | Fine print: 11px, muted |

**Missing `auth.base.css` in `styleUrls` causes browser-default `<h1>` sizing (~32px) and unstyled elements.** Always include it.

Auth card container (`auth.component.css`) applies:
- Card content padding: `16px 20px 12px`
- Logo: 36px height, centered
- Copyright: 12px, muted, below card

### Shared Base CSS — generalize the `auth.base.css` pattern

`auth.base.css` is not a one-off: **a `*.base.css` added to `styleUrls` is the accepted way to share styles across a family of components in the same module.** Use it whenever the same block would otherwise be copied into three or more components — most often the compact-dialog overrides and the filter-bar classes.

```typescript
// One shared file per concern, at the module root
@Component({
  styleUrls: ['./customer-form.component.css', '../../ticket-dialog.base.css']
})
```

Reference implementation: the tickets module ships `ticket-dialog.base.css` (compact dialog: title/content/actions, 38px form fields, 12px labels/options, compact checkbox, `.section-label`) and `ticket-filter-bar.base.css` (filter toggle button, badge, active-filter chips bar).

Rules:

- **Plain class selectors work** in a base file — they still get the component's scoping attribute. Use `:host ::ng-deep` only where you would in the component's own CSS.
- **Target Material structural parts by CLASS, never by element.** Both forms exist in this codebase: `<mat-dialog-content>` and `<div mat-dialog-content>` (the attribute form is the more common one). An element selector like `mat-dialog-actions { ... }` silently misses every attribute-form dialog and the padding/border never applies. Always use `.mat-mdc-dialog-content` / `.mat-mdc-dialog-actions`.
- When you create a base file, **remove the now-duplicated blocks** from the components that already had them, so there is a single source of truth.
- A new dialog or listing in a module that has a base file must **include the base file**, not re-declare the overrides.

### mat-card Padding Reset

Angular Material's `<mat-card>` renders internally as a `.mdc-card` element with **`padding: 8px 16px`** applied by Material's compiled styles. This padding is **in addition to** any padding set on child elements (`mat-card-header`, `mat-card-content`, `mat-card-actions`). If you only override the children's padding, the card itself still adds its own, resulting in excessive spacing.

**The fix**: zero out the `.mdc-card` padding on every `mat-card` that uses our compact layout:

```css
:host ::ng-deep .my-card-class.mdc-card {
  padding: 0 !important;
}
```

This is one of the few justified uses of `!important` on a `.mdc-*` selector — there is no CSS token for `mat-card` container padding.

#### When to use `mat-card` vs plain `div`

| Context | Use | Why |
|---------|-----|-----|
| Report filter cards | `mat-card` + padding reset | Legacy usage; works with the reset |
| Agent report form cards | `mat-card` + padding reset | Legacy usage; works with the reset |
| Table containers | `div.table-section` | Never use `mat-card` for tables |
| Dashboard KPI cards | `div.dash-card` | Never use `mat-card` for dashboards |
| Filter panels (simple) | `div.filter-panel` | Preferred — no `.mdc-card` gotcha |
| Campaign form panels | `div.campaign-form-panel` | Preferred — no `.mdc-card` gotcha |

**Prefer plain `div` containers** with manual border/radius for new components. Only use `mat-card` when maintaining existing components that already use it.

#### Compact `mat-card` override pattern

When `mat-card` is used in filter/form cards, apply this full set of overrides:

```css
.filter-card {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
  box-shadow: none;
  overflow: hidden;
}

:host ::ng-deep .filter-card.mdc-card {
  padding: 0 !important;
}

:host ::ng-deep .filter-card .mat-mdc-card-header {
  padding: 10px 12px 0 !important;
  margin: 0 !important;
}

:host ::ng-deep .filter-card .mat-mdc-card-title {
  font-size: 11px !important;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--mat-sys-on-surface-variant, #555);
  margin: 0 !important;
  padding: 0 !important;
}

:host ::ng-deep .filter-card .mat-mdc-card-content {
  flex: 1;
  padding: 8px 12px 4px !important;
  margin: 0 !important;
}

:host ::ng-deep .filter-card .mat-mdc-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px 12px !important;
  margin: 0 !important;
  flex-wrap: nowrap;
  flex-shrink: 0;
}
```

Reference implementation: `reports-filter.component.css`, `queue-report-filter.component.css`, `agent-report/*-form/*.component.css`.

### Report Filter Card Pattern

Report pages use compact filter cards arranged in responsive grids. Each card contains form fields, radio/checkbox groups, and action buttons.

#### Card grid

```css
.cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) { .cards-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .cards-grid { grid-template-columns: 1fr; } }
```

#### Action buttons in filter cards

- Buttons are **always side-by-side** (`flex-wrap: nowrap`), right-aligned
- **No icons** on text action buttons ("Limpar campos", "Gerar relatório")
- **No border-top** separator above the action area
- Use `.btn-secondary` for "Limpar campos" and `.btn-primary-green` for "Gerar relatório"

```html
<mat-card-actions align="end">
  <button mat-flat-button class="btn-secondary" type="button" (click)="reset()">Limpar campos</button>
  <button mat-flat-button class="btn-primary-green" type="button" [disabled]="!valid" (click)="generate()">
    Gerar relatório
  </button>
</mat-card-actions>
```

#### Radio and checkbox groups (compact)

```css
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 4px;
}

:host ::ng-deep .radio-group .mat-mdc-radio-button {
  --mat-radio-label-text-size: 12px;
  --mdc-radio-state-layer-size: 28px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 4px;
}

:host ::ng-deep .checkbox-group .mat-mdc-checkbox .mdc-label { font-size: 12px; }
:host ::ng-deep .checkbox-group .mdc-checkbox { width: 16px; height: 16px; padding: 0; }
:host ::ng-deep .checkbox-group .mdc-checkbox__background { width: 16px; height: 16px; top: 0; left: 0; }
:host ::ng-deep .checkbox-group .mat-mdc-checkbox-touch-target { width: 28px; height: 28px; }
```

#### Form fields inside filter cards

Add `margin-bottom: 2px` to collapse vertical whitespace between stacked fields:

```css
:host ::ng-deep .mat-mdc-form-field {
  --mat-form-field-container-height: 38px;
  --mat-form-field-container-vertical-padding: 7px;
  --mdc-outlined-text-field-container-shape: 4px;
  font-size: 12px;
  margin-bottom: 2px;
}
```

### Report Table Header Actions — Export & Preset Pattern

Report result dialogs place export buttons (PDF, CSV) and column preset selectors **inside** the `.table-header` bar, right-aligned via `.header-actions`. Do NOT place them in a separate bar above the table.

#### Structure

```html
<div class="table-header">
  <span class="table-title">Registros</span>
  <div class="header-actions">
    <tails-pdf-generator ...></tails-pdf-generator>
    <tails-csv-generator ...></tails-csv-generator>
    <report-preset-select ...></report-preset-select>
  </div>
</div>
```

#### Compact Export Buttons (26px)

All export button components (`tails-pdf-generator`, `tails-csv-generator`, `tails-pdf-download`, `tails-csv-download`) MUST use these compact tokens:

```css
.pdf-btn, .csv-btn {
  --mdc-outlined-button-container-height: 26px;
  --mdc-outlined-button-container-shape: 4px;
  --mdc-outlined-button-label-text-size: 11px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pdf-btn .mat-icon, .csv-btn .mat-icon {
  font-size: 14px; width: 14px; height: 14px; margin: 0;
}
```

- PDF buttons: red border/text via `--mdc-outlined-button-label-text-color: var(--mat-sys-error)`
- CSV buttons: green border/text via `--mdc-outlined-button-label-text-color: var(--app-success)`
- Icon **before** text: `<mat-icon>picture_as_pdf</mat-icon> PDF`
- Do NOT use `color="warn"` on export buttons — use CSS tokens instead

#### Compact Preset Select (26px)

The `report-preset-select` component uses a `mat-select` inside a `mat-form-field` with compact overrides:

```css
.preset-select {
  font-size: 11px;
  min-width: 130px;
  max-width: 180px;
}

:host ::ng-deep .preset-select .mat-mdc-text-field-wrapper { height: 26px !important; }
:host ::ng-deep .preset-select .mat-mdc-form-field-flex { height: 26px !important; }
:host ::ng-deep .preset-select .mdc-text-field--outlined {
  --mdc-outlined-text-field-container-shape: 4px;
  padding: 0 8px !important;
}
:host ::ng-deep .preset-select .mat-mdc-select-value-text { font-size: 11px; }
:host ::ng-deep .preset-select .mat-mdc-select-arrow-wrapper { transform: scale(0.75); }

/* Dropdown panel — ensure options are readable */
:host ::ng-deep .mat-mdc-select-panel { min-width: 180px !important; }
:host ::ng-deep .mat-mdc-select-panel .mat-mdc-option {
  font-size: 12px !important; min-height: 32px !important; padding: 0 12px !important;
}
```

The customize button beside the select: `--mdc-icon-button-state-layer-size: 26px`, icon 16px.

Reference implementations: `report-preset-select.component.css`, `pdf-generator.component.css`, `csv-generator.component.css`, `pdf-download.component.css`, `csv-download.component.css`.

### Voice Intelligence Modal Pattern

The `VoiceIntelligenceModalComponent` displays call transcription, semantic analysis, sentiment, and validation data in a tabbed dialog. It follows the compact dialog pattern with additional domain-specific styles.

#### Key dimensions

| Element | Value |
|---------|-------|
| Dialog width | 800px, maxHeight 90vh |
| Tab height | 34px |
| Tab icon | 16px, 4px right margin |
| Info chips (transcript) | 11px font, 3px 8px padding, 12px radius |
| Indicator cards (sentiment) | 10px 12px padding, 26px icon, 6px radius |
| Satisfaction/compliance rings | 42–44px diameter, 3px border |
| Entity/topic chips | 11px font, 3px 6px/8px padding, 12px radius |
| Sentiment badges | 10px font, white text on all variants |
| Validation cards | 8px 10px padding, 22px icons, 16px count font |
| Empty state | 36px padding, 40px icon, 13px text |

#### Dialog title

Title is text-only ("Inteligência de voz") — no icon, no call ID. Close button with 30px state layer, 18px icon.

#### Sentiment badge colors

All sentiment badges (positive, negative, neutral) use `color: #fff` for consistent contrast against their colored backgrounds.

## Anti-Patterns — Do NOT

1. **Oversized UI** — Default Material sizing is too large for data-dense apps. Always apply density -2 and compact overrides
2. **Decorative borders everywhere** — Use surface layering for hierarchy; borders only for explicit separation
3. **Giant padding** — Cards with 24px+ padding waste space. Use 12–16px
4. **Full-width forms** — Cap form containers at 600–800px max-width for readability
5. **Color for decoration** — Every color must convey meaning (status, interaction, hierarchy)
6. **Entrance animations on data** — Tables, lists, cards with data must render instantly. No stagger, no fade-in
7. **New NgModules** — Use standalone components with `loadComponent`
8. **Standalone component imports** — Use `Mat*Module`, not `MatButton`, `MatIcon`, etc.
9. **New button syntax** — Use `mat-button`, not `matButton`
10. **`.component.scss`** — Use `.component.css`
11. **Hardcoded colors** — Use `--mat-sys-*` or `--app-*` variables
12. **`mat.define-theme`, `mat.core()`** — Use `mat.theme()` only
13. **Overriding `.mdc-*` classes** — Use override mixins or CSS variables. **Exception**: `.mdc-card` padding reset (see "mat-card Padding Reset" section) — there is no token for card-level padding, so `:host ::ng-deep .card-class.mdc-card { padding: 0 !important }` is the only way
14. **Import `SharedModule` in standalone components** — Import only specific `Mat*Module`s needed
15. **`16px` base font on components** — Body text is `13–14px` in this system
16. **`!important` on CSS tokens** — Never use `!important` on `--mdc-*` or `--mat-*` custom properties. Only use on direct property overrides when Material's internal specificity competes
17. **`color="primary"` / `color="warn"` on page buttons** — Use `.btn-primary-green` and `.btn-secondary` classes instead. The `color` attribute maps to theme palette colors (azure), not our action color convention (green primary, neutral secondary)
18. **Custom page headers** — Do NOT use standalone `<h2>`, `<div class="my-header">`, or any custom header structure. Always use the standard page shell: `content-wrapper` > `header-container` > `content-header` (flex container) with `<h1>` + button directly inside, then `<tails-breadcrumbs>`. Do NOT wrap `h1` + button in an extra `<div class="page-header">` — the flex is on `.content-header` itself
19. **Missing breadcrumbs** — Every page must import `BreadcrumbsComponent`, `Breadcrumb`, and `ActivatedRoute`, and wire breadcrumbs from route data
20. **`<mat-card>` for table containers** — Use `.table-section` div with border/radius. `mat-card` is only for metric cards and dashboards
21. **`mat-paginator`** — Use `tails-pagination` component for all paginated data
22. **Custom container classes** — Do NOT create `<div class="my-feature-container">` as root. Use the standard `content-wrapper` which provides 16px padding via global `styles.scss`
23. **Inline header filters** — Do NOT put form fields in the table header for filtering. Use `tails-filter-drawer` sidebar
24. **Missing empty state** — Every data table MUST have an `.empty-state` div shown when `!loading && data.length === 0`
25. **Text-based loading** — Do NOT use "Carregando..." text or spinner overlays. Use `mat-progress-bar mode="indeterminate"` inside the table section
26. **Missing `aria-label` on icon buttons** — Every `mat-icon-button` MUST have an `aria-label` describing the action
27. **`<h3>`/`<h4>` for section headers in dialogs** — Use `<div class="section-label">` with 10px uppercase styling
28. **`mat-slide-toggle` replacing native checkboxes with DOM manipulation** — When existing code uses `document.querySelector` or direct DOM access on checkboxes (e.g. `checkAll`), do NOT refactor to `mat-slide-toggle`. Use the `<label class="toggle-switch">` + hidden `<input>` + `<span class="toggle-track">` pattern (see "CSS Toggle Switch" section). NEVER apply `::before`/`::after` pseudo-elements directly on `<input>` — it's a void element and pseudo-elements won't render
29. **Password fields inside multi-column grids** — Never place a password field with a tooltip/popover inside `form-grid-2` or `form-grid-3`. The tooltip overflows into adjacent columns. Use a dedicated `.password-row` outside the grid
30. **Prominent/loud permission lists** — Permission or toggle lists must use the quiet `.permission-card` pattern (11px uppercase headers, subtle borders, 12px labels). Do NOT use Bootstrap-style `.card` / `.card-header` / `.card-title` classes, bold large headers, or high-contrast backgrounds that draw disproportionate attention
31. **Descriptive text as page headers** — Do NOT add informational paragraphs or callout banners at the top of list/table pages (e.g. "Adicione, modifique e exclua..."). The page title and breadcrumbs provide sufficient context. Info callouts belong inside forms/dialogs where contextual guidance is needed
32. **Missing `subscriptSizing="dynamic"` in compact dialogs** — Every `mat-form-field` inside a compact dialog/stepper MUST use `subscriptSizing="dynamic"`. Without it, the fixed subscript space (22px) causes error messages to overlap adjacent fields in tight grids
33. **Default-sized steppers** — `mat-stepper` inside dialogs must use compact overrides (22px step icons, 11px labels, 36px header height). Default Material stepper sizing is too large for data-dense dialogs
34. **Default-sized expansion panels** — `mat-expansion-panel` must use compact overrides (34px header, no box-shadow, subtle border, 12px font). Remove ripple on nested `mat-checkbox` for cleaner visuals
35. **Modifying test files to fix broken tests** — NEVER change `.spec.ts` files to accommodate refactoring. If a test breaks, the component code must be adapted to preserve backward compatibility (keep old properties/methods, use `@Optional()` for new dependencies, guard templates with `*ngIf`). Tests are immutable contracts
36. **Default-sized mat-menu items** — `mat-menu` dropdown items must use compact overrides (32px height, 12px font, 16px icons). Default Material menu items are too tall for a compact toolbar. Use tokenized colors for active state (`--mat-sys-primary-container`), not hardcoded `rgba()`
37. **Missing `auth.base.css` in auth page `styleUrls`** — Every auth page component MUST include `'../auth.base.css'` in its `styleUrls` array. Without it, shared classes (`.title`, `.login-box-msg`, `.separator`, `.link`) get no styling, causing browser-default sizing (e.g. `<h1>` at ~32px instead of 15px)
38. **Loading indicator outside the data container** — The loading indicator (`mat-progress-bar` or spinner) MUST always render **inside** the data container (`.table-section`, card, or list panel) — never floating above the page header or outside the content area. The user must see the loading state spatially associated with the data it represents. Same rule applies to empty states and error/feedback messages: they belong inside the data container, not at page level
39. **Feedback messages outside the data container** — Error messages, "Nenhum registro" empty states, and success/warning alerts MUST render **inside** the same container that holds the data (`.table-section`, card, or panel). Do NOT place them above the page title, in the header area, or as floating page-level banners. The feedback must replace or overlay the data area, never the page shell
40. **`<mat-card>` for dashboard KPI cards** — Use `div.dash-card` with the `dash-card` CSS pattern (border, radius, padding, no shadow). `<mat-card>` adds Material elevation and extra wrapper elements that conflict with the flat, border-based dashboard style. Only use `<mat-card>` for non-dashboard contexts (e.g. auth pages, standalone panels)
41. **`max-width` on dashboard containers** — Dashboard pages MUST use `width: 100%` with no `max-width`. Dashboards fill the viewport to maximize data density. Do NOT add `max-width: 1200px` or `margin: 0 auto` on `.dashboard-container`
42. **Old `metric-label` / `metric-value` in dashboards** — Use the `dash-card-*` class naming convention (`dash-card-title`, `dash-card-value`, `dash-card-desc`) for dashboard views. The old `metric-label` / `metric-value` pattern is superseded by the `dash-card` system for consistency across all dashboard pages
43. **Stacking chart cards and tables in separate full-width rows** — When a dashboard has multiple chart cards (e.g. pie charts + trend) or a chart card alongside a breakdown table, combine them into a single composite grid row (`dash-grid-charts` or `dash-grid-trend-table`). Do NOT give each visualization its own full-width row — this wastes horizontal space, makes charts oversized, and forces unnecessary vertical scrolling
44. **Missing `.mdc-card` padding reset on `mat-card`** — Every `mat-card` with compact layout MUST include `:host ::ng-deep .card-class.mdc-card { padding: 0 !important; }`. Without this, Material's internal `.mdc-card` adds `padding: 8px 16px` that stacks on top of `mat-card-header`/`mat-card-content`/`mat-card-actions` padding, causing excessive spacing that is invisible in CSS inspection of child elements
45. **Icons on text action buttons in filter/report forms** — Do NOT add `<mat-icon>` to text buttons like "Gerar relatório", "Limpar campos", "Salvar", "Excluir" in filter cards and report forms. Icons are reserved for icon-only buttons (`mat-icon-button`) and specific UI elements (e.g. header "Adicionar" button). Text action buttons in compact forms should be text-only
46. **Border-top separator on filter card actions** — Do NOT add `border-top` to the action area of filter/report cards. The compact layout already provides sufficient visual separation between content and actions via padding. Border separators add unnecessary visual weight and break the clean, minimal aesthetic
47. **`mat-card` for new filter/form panels** — When building new filter panels or form containers, prefer a plain `div` with manual border/radius (`.filter-panel`, `.campaign-form-panel`) instead of `mat-card`. This avoids the `.mdc-card` padding gotcha entirely. Only use `mat-card` when maintaining existing components that already use it
48. **Export buttons in a separate actions bar** — PDF, CSV, and column preset buttons MUST be placed inside `.header-actions` within the `.table-header`, not in a separate bar above the table. This groups them visually with the "Registros" title and keeps the layout compact
49. **`color="warn"` on export buttons** — Do NOT use `color="warn"` on PDF/CSV buttons. Use explicit CSS tokens (`--mdc-outlined-button-label-text-color`, `--mdc-outlined-button-outline-color`) to set red for PDF and green for CSV buttons
50. **Default-sized export buttons** — Export buttons (PDF, CSV) MUST be 26px height with 11px font and 14px icons. Default Material button height (36px) is too large for the compact table header. Always use `.pdf-btn` / `.csv-btn` classes with compact overrides
51. **Icon after text on export buttons** — Icon MUST come before text: `<mat-icon>picture_as_pdf</mat-icon> PDF`, not `PDF <mat-icon>download</mat-icon>`. The icon provides instant visual recognition before reading the label
52. **Default-sized preset select** — The `report-preset-select` component MUST use 26px height, 11px font, and compact `mat-form-field` wrapper overrides. The dropdown panel needs `min-width: 180px` to prevent option text truncation
53. **Decorative icons and IDs in dialog titles** — Dialog titles should be clean text only (e.g. "Inteligência de voz"). Do NOT add decorative icons (like `psychology`) or internal IDs (like `callId`) to dialog titles. Use a simple close button with 30px state layer
54. **Dark text on colored sentiment badges** — Status/sentiment badges with colored backgrounds (positive=green, negative=red, neutral=grey) MUST use `color: #fff` for text. Never inherit the default text color — it becomes illegible on colored backgrounds
55. **Empty state hints not centered** — Empty state messages (like "Selecione colunas ao lado para definir a ordem") inside dialogs MUST use `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center` to center both vertically and horizontally, with the icon above the text
56. **Listing page with no filter UI at all** — A `content-wrapper` page with a `table-section` and `tails-pagination` and *no* search/filter is NOT compliant. Having no inline filters is not compliance with anti-pattern #23; the drawer is required regardless. Check the service — it usually already accepts a `search` param that no UI calls
57. **Duplicating dialog/filter overrides per component** — When three or more components in a module need the same compact-dialog or filter-bar block, extract a `*.base.css` and add it to each `styleUrls` (see "Shared Base CSS"). Do NOT copy the block into each component, and do NOT ship a screen that uses the filter-drawer markup without those classes — it renders unstyled
58. **Targeting Material dialog parts by element selector** — Use `.mat-mdc-dialog-content` / `.mat-mdc-dialog-actions`, never `mat-dialog-content` / `mat-dialog-actions` as element selectors. Most dialogs use the attribute form (`<div mat-dialog-content>`), which an element selector silently misses — the padding and separators never apply and nothing errors
59. **Concluding compliance from grep** — Do NOT report a screen as design-system compliant because the expected classes exist. Classes record intent; only the computed values prove application. Measure the numeric rules in the browser (see "Audit by value, not by class presence")
60. **Fetching in both `cleared` and `applied`** — `clearAllFilters()` emits `cleared` **and** `applied`. Reload data in the `applied` handler only; doing it in both fires two requests per user action. Likewise, do not bind `(chipRemoved)` — `removeChip()` also emits `applied`

## Visual Verification — Mandatory Browser MCP Usage

Every UI change guided by this design system rule MUST be visually verified using the **browser MCP** (`browser-use` subagent or browser tools) before considering the task complete. Code-only reviews are insufficient for design system compliance — visual regressions, spacing inconsistencies, and token misuse are only detectable in the rendered output.

### When to Verify

You MUST open the affected page/component in the browser and visually inspect it when:

1. **Any CSS or styling change** — spacing, colors, typography, borders, shadows, density overrides
2. **New component or page creation** — verify the full page shell, breadcrumbs, table sections, dashboards
3. **Layout changes** — grid configurations, responsive breakpoints, flex alignment
4. **Theme token usage** — confirm light and dark mode render correctly
5. **Dialog/form creation or modification** — verify compact heights, field alignment, action button placement
6. **Dashboard cards** — verify card density, value sizing, grid responsiveness
7. **Table sections** — verify row height, header styling, empty state, pagination placement

### Audit by value, not by class presence

**The single most common audit error is concluding compliance from the presence of a class.** A template that has `table-section`, `empty-state` and `subscriptSizing` can still be entirely off-spec, because the classes say what was *intended*, not what *renders*. In a real retrofit, every screen had `table-section` and every dialog looked structurally correct, yet all six dialogs rendered 48px form fields (Material's default) instead of the 38px this document specifies — no CSS in the module set `--mat-form-field-container-height` at all. Grep found nothing because there was nothing to find; only measuring the rendered output exposed it.

So when auditing an existing screen:

- Grep answers "is the pattern referenced?" — it never answers "is the pattern applied?". Treat a grep pass as a **starting point**, not a result.
- For every numeric rule in this document (heights, font sizes, padding), read the **computed value** in the browser and compare it to the table.
- Check that the token is actually *declared somewhere in the component's `styleUrls` union*, not just that the markup looks right.

### Measurement recipes (avoid false readings)

These specific measurements are easy to get wrong, and a wrong reading sends you chasing a bug that does not exist:

| What | Measure this | Not this |
|---|---|---|
| Form field height | `.mat-mdc-text-field-wrapper` → **38px** | `.mat-mdc-form-field` (≈48px — it includes the dynamic subscript space) |
| `subscriptSizing="dynamic"` applied | `document.querySelectorAll('.mat-mdc-form-field-subscript-dynamic-size').length` | `classList.contains(...)` on `.mat-mdc-form-field` — the class sits on a different element, so this reports a **false negative** |
| Loading indicator placement | `bar.closest('.table-section')` is non-null while data is loading (intercept/delay the request to catch the state) | a screenshot taken after load, which shows nothing |
| Select panel surface | compare `getComputedStyle(panel).backgroundColor` against the card behind it | eyeballing a dark screenshot |

### How to Verify

Use the browser MCP / `playwright-cli` to:

1. Navigate to the affected page/route (e.g. `http://localhost:4200/my-feature`)
2. Take a screenshot and inspect the rendered output against this design system
3. If the page has dark mode: toggle to dark mode and take another screenshot
4. If the component is a dialog: trigger the dialog open and screenshot the modal
5. **Measure, don't just look**: read the computed values for the numeric rules (see the recipes above) — spacing and density regressions are frequently invisible in a screenshot
6. Prefer a **CSS selector** over a role locator when clicking design-system elements (`click '.filter-toggle-btn'`). A role locator like `getByRole('button', { name: 'Filtros' })` can resolve to a different element and make a working component look broken
7. To verify a transient state (loading, empty), intercept and delay the request rather than trying to catch it by timing
8. Report any visual discrepancies found and fix them before completing the task

### Exceptions

Browser verification may be skipped ONLY when:

- The change is purely logic/data (no template or style files modified)
- The dev server is confirmed not running and the user explicitly declines starting it
- The change is limited to test files (`.spec.ts`)

**If you skip verification, you MUST explicitly state why and get user acknowledgment.**
