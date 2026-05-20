# Changelog interno — Maduration App

Registro de cambios relevantes para el equipo. Detalle técnico ampliado en `docs/engineering/changes/`.

---

## [2026-05-20] — Validación y mensajes de error en formularios (DataHub)

### Resumen

Los formularios de alta en DataHub (jugador, equipo, medición, test, resultado de rendimiento) muestran ahora **qué campos faltan o son incorrectos** en lugar de fallar en silencio. Incluye importación Excel con conteo de filas omitidas y equipo **obligatorio** al crear jugadores en Club.

### Usuario

- Banner: *"Revisa los campos marcados antes de guardar"* + lista con nombre del campo y mensaje concreto.
- Mensajes bajo cada input con borde rojo.
- Textos en ES/EN según idioma de la app.
- Excel: aviso si se importaron X filas y se omitieron Y por datos incompletos o inválidos.

### Técnico

- Nueva capa: `src/lib/form-errors.ts`, esquemas en `src/lib/validations.ts`, `FormErrorBanner`, `LabeledField.error`.
- `addPerformanceEntry` devuelve `boolean`.
- Fix: claves React duplicadas en banner (mensajes por campo, no genérico repetido).

**Documentación detallada:** [`docs/engineering/changes/2026-05-20-form-validation-feedback.md`](engineering/changes/2026-05-20-form-validation-feedback.md)

---

## [2026-05-08] — Barra Lateral Replegable en DataHub y Análisis + Adaptación Responsive

### Resumen (histórico)

Se han realizado dos grupos de cambios: (1) refactorización de la barra lateral de DataHub para hacerla replegable y se ha añadido una barra lateral equivalente en el área de Análisis; (2) adaptación del layout de la aplicación al tamaño de pantalla.

---

## [2026-05-08] — Barra Lateral Replegable (DataHub y Análisis)

### DataHub — `datahub-sidebar.tsx`

- **Eliminado** el botón de `Home` (icono casita + label "Workspace") que redirigía al landing.
- **Añadido** botón hamburguesa (`Menu` de lucide-react) en la parte superior de la barra lateral que alterna el estado `collapsed`.
- **Comportamiento colapsado:** la barra se reduce de `w-56` a `w-14` con transición CSS (`transition-all duration-200`). En modo colapsado, los ítems muestran sólo el icono centrado, y el label se expone mediante el atributo `title` (tooltip nativo del navegador).
- **Prop `activeSection`** ampliada para aceptar también `"landing"` (evita error de tipos al pasar el estado desde `page.tsx`).

**Archivos modificados:**
- `src/app/(protected)/datahub/datahub-sidebar.tsx`

---

### DataHub — `page.tsx`

- **Eliminada** la condición `{section !== "landing" && <DataHubSidebar ... />}`.
- La barra lateral ahora se renderiza **siempre**, independientemente de si se está en la landing o en una subsección. Esto permite navegar entre secciones desde cualquier punto sin que la barra desaparezca.

**Archivos modificados:**
- `src/app/(protected)/datahub/page.tsx`

---

### Análisis — `analysis/page.tsx`

- **Nuevo componente `AnalysisSidebar`** (definido en el mismo archivo antes del componente `AnalysisPage`):
  - Misma mecánica de hamburguesa/colapso que la barra de DataHub.
  - Tres ítems: **Individual** (`Users`), **Colectivo** (`Group`), **Asistente** (`Activity`).
  - Botón "Volver" (`ArrowLeft`) visible cuando hay una pestaña activa, que resetea la selección a `null` (landing de selección).
  - Color activo: `bg-teal-600 text-white` (coherente con la paleta del módulo de análisis).
- **Refactorizado `AnalysisPage`**: el `return` pasa de un `div` centrado con padding a un layout `flex` de pantalla completa (`flex min-h-[calc(100vh-4rem)] w-full min-w-0`), con la barra lateral a la izquierda y el contenido en `min-w-0 flex-1`.
- **Imports añadidos:** `Menu` (lucide-react), `cn` (fusionado en el import de `@/lib/utils`).

**Archivos modificados:**
- `src/app/(protected)/analysis/page.tsx`

---

## [2026-05-07] — Adaptación del Layout al Tamaño de Pantalla

### Cambios introducidos

- **Layout base (`datahub/page.tsx`):** Contenedor raíz cambiado a `flex min-h-[calc(100vh-4rem)] w-full min-w-0` para evitar desbordamientos horizontales en viewports estrechos.
- **Área de contenido principal:** clase `min-w-0 flex-1 p-6` asegura que el contenido cede espacio correctamente con `flex` sin truncarse.
- **Secciones internas (maturation, club, performance):** Uso consistente de `grid-cols-1 sm:grid-cols-N` para adaptar tablas y formularios a pantallas pequeñas.
- **Tablas con overflow:** Envueltas en `overflow-x-auto` para permitir scroll horizontal en lugar de romper el layout en pantallas < 768 px.
- **Modales:** Ancho máximo limitado con `max-w-lg w-full` y márgenes laterales seguros.
- **Análisis:** Contenedor migrado a layout `flex` en consonancia con DataHub para garantizar coherencia visual entre módulos.

### Archivos destacados

- `src/app/(protected)/datahub/page.tsx`
- `src/app/(protected)/datahub/datahub-sidebar.tsx`
- `src/app/(protected)/analysis/page.tsx`
- `src/app/(protected)/datahub/maturation-section.tsx`
- `src/app/(protected)/datahub/club-section.tsx`
- `src/app/(protected)/datahub/performance-section.tsx`