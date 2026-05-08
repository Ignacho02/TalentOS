# Adaptación Responsive a Móvil

## Resumen

Se ha realizado una refactorización transversal para garantizar una experiencia usable en dispositivos móviles (< 768 px). Los cambios afectan al shell de la aplicación, la navbar, las barras laterales de DataHub y Análisis, y el sistema de layout global.

---

## [2026-05-08] — Responsive Mobile

### `app-shell.tsx`

- **`isFullBleed`**: Nueva condición que detecta si la ruta activa es `/datahub` o `/analysis`. En esas rutas, el wrapper elimina todo el padding (`p-0 max-w-none`) para que los layouts con sidebar gestionen su propio espaciado.
- **Rutas normales** (hub, community, research): padding reducido a `px-4 sm:px-6 py-6 sm:py-8` para mejor aprovechamiento en móvil.
- **Footer**: ocultado en rutas `isFullBleed` (DataHub y Análisis) para maximizar espacio de contenido.

**Archivos modificados:**
- `src/components/app-shell.tsx`

---

### `navbar.tsx`

- **Menú móvil (hamburger drawer)**: Añadido botón `Menu`/`X` visible solo en `md:hidden`. Al pulsarlo abre un drawer vertical que ocupa la altura disponible con scroll.
- **Estructura del drawer móvil**:
  - Cada ítem de navegación principal muestra icono + label.
  - Los ítems con subniveles (DataHub, Análisis) tienen un botón `ChevronRight`/`ChevronDown` que expande sus subareas inline con sangría y borde izquierdo de color.
  - Al pie: selector de idioma y botón de logout.
- **Bloqueo de scroll**: `document.body.style.overflow = "hidden"` mientras el drawer está abierto.
- **Cierre automático**: en cambio de ruta (`useEffect` sobre `pathname`) y al pulsar el backdrop semitransparente.
- **Desktop**: comportamiento intacto. Los iconos de la navbar en `md` y `lg` ahora tienen `hidden lg:inline` para el texto de los items, liberando espacio en tablets.
- **Logo**: adaptado con `truncate` y tamaños `sm:` para no desbordarse en móvil.

**Archivos modificados:**
- `src/components/navbar.tsx`

---

### `datahub-sidebar.tsx`

- **Desktop**: comportamiento colapsable intacto (`w-56` / `w-14` + hamburguesa).
- **Móvil**: 
  - La sidebar de escritorio usa `hidden md:flex` — completamente oculta en móvil.
  - Botón FAB circular flotante (`fixed bottom-4 right-4 z-40`) con icono `Menu` y color `bg-accent` que abre el drawer lateral.
  - Drawer de ancho `w-64` con `translate-x` para animación. Cabecera con título y botón de cierre (`X`).
  - Backdrop semitransparente cierra el drawer al pulsar fuera.
  - Al seleccionar una sección, el drawer se cierra automáticamente.

**Archivos modificados:**
- `src/app/(protected)/datahub/datahub-sidebar.tsx`

---

### `datahub/page.tsx`

- Padding del área de contenido principal actualizado a `p-4 sm:p-6` (antes fijo `p-6`).
- Añadido `overflow-x-hidden` para contener desbordamientos internos en tablas anchas.

**Archivos modificados:**
- `src/app/(protected)/datahub/page.tsx`

---

### `analysis/page.tsx` — `AnalysisSidebar`

- Misma lógica de FAB + drawer overlay que `DataHubSidebar`.
- FAB con color `bg-teal-600` (coherente con la paleta de análisis).
- Desktop: `hidden md:flex` para la sidebar colapsable.
- Padding del contenido actualizado a `p-4 sm:p-6 md:p-8` con `overflow-x-hidden`.

**Archivos modificados:**
- `src/app/(protected)/analysis/page.tsx`

---

## Consideraciones de diseño

- **FAB (Floating Action Button)**: se optó por un botón flotante en lugar de un top-bar secundario para no duplicar la navbar ya existente. El FAB aparece solo en mobile (`md:hidden`) y no interfiere con el contenido.
- **No se modificaron** las secciones internas de DataHub (maturation, club, performance) ni los componentes de análisis (IndividualView, CollectiveView, AssistantView). Sus grids y tablas ya usan clases responsive (`sm:grid-cols-N`, `overflow-x-auto`).
- **Breakpoint unificado**: `md` (768 px) como frontera entre móvil y escritorio, coherente con Tailwind por defecto.