# Engineering Docs

## Proposito

Esta carpeta guarda documentacion tecnica viva generada durante el trabajo sobre el proyecto. Su objetivo es conservar contexto util que normalmente se pierde entre commits, refactors o conversaciones:

- cambios ejecutados
- decisiones tomadas
- razonamiento tecnico
- notas de refactor y deuda

La idea es que alguien que hereda el proyecto pueda entender no solo que se cambio, sino tambien por que se hizo asi.

## Estructura

- `changes/`
  - registro de cambios implementados
  - usar cuando lo importante es explicar que se toco, impacto y riesgos
- `decisions/`
  - decisiones de arquitectura o diseno tecnico
  - usar formato ADR ligero
- `reasoning/`
  - explicaciones de criterio, tradeoffs o logica compleja
  - util cuando el "por que" no encaja bien en un changelog ni en un ADR
- `refactors/`
  - notas de limpiezas estructurales o reorganizaciones internas
  - documentar objetivo, alcance, mejora conseguida y deuda pendiente

## Convenciones de nombres

### Changes

Formato recomendado:

- `YYYY-MM-DD-short-title.md`

Ejemplos:

- `2026-04-28-datahub-import-cleanup.md`
- `2026-05-03-analysis-selector-reuse.md`

### Decisions

Formato recomendado:

- `ADR-001-short-title.md`
- `ADR-002-short-title.md`

Numeracion secuencial estable. No reutilizar numeros.

### Reasoning

Formato recomendado:

- `YYYY-MM-DD-short-topic.md`

Ejemplos:

- `2026-04-28-maturity-band-thresholds.md`
- `2026-05-02-local-vs-remote-state.md`

### Refactors

Formato recomendado:

- `YYYY-MM-DD-short-title.md`

Ejemplos:

- `2026-04-28-codebase-cleanup-phase-1.md`
- `2026-05-04-performance-module-split.md`

## Que debe ir en cada tipo de documento

### `changes/`

Incluir:

- contexto breve
- objetivo
- que se toco
- impacto esperado
- riesgos o seguimiento

No usar para decisiones estables de arquitectura.

### `decisions/`

Incluir:

- problema
- opciones consideradas
- decision tomada
- consecuencias

Usarlo solo cuando la decision tenga valor reutilizable en el tiempo.

### `reasoning/`

Incluir:

- pregunta o duda tecnica
- criterios usados
- logica elegida
- limites o puntos a revisar

### `refactors/`

Incluir:

- situacion inicial
- objetivo de la limpieza
- piezas reorganizadas
- resultado conseguido
- deuda que sigue abierta

## Regla practica

Si dudas entre carpetas:

- si explica un cambio puntual, va en `changes/`
- si fija una decision, va en `decisions/`
- si explica el criterio, va en `reasoning/`
- si la intervencion principal fue ordenar codigo, va en `refactors/`

## Documentos iniciales

Esta carpeta arranca con:

- `decisions/ADR-001-documentation-structure.md`
- `refactors/2026-04-28-codebase-cleanup-phase-1.md`
- `changes/2026-05-20-form-validation-feedback.md` — validación y feedback de errores en formularios DataHub

## Cambios recientes (índice rápido)

| Fecha | Documento | Tema |
|-------|-----------|------|
| 2026-05-20 | `changes/2026-05-20-form-validation-feedback.md` | Validación formularios, i18n errores, Excel |
| 2026-05-08 | `changes/2026-05-08-mobile-responsive.md` | Sidebar replegable y responsive |
| 2026-04-30 | `changes/2026-04-30-*.md` | UUID, búsqueda global, fotos, drag-drop Excel |

Changelog resumido para el equipo: [`../changelog-internal.md`](../changelog-internal.md).
