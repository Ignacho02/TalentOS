# Codebase Cleanup Phase 1

## Contexto

Antes de avanzar en funcionalidad nueva, el proyecto tenia varias zonas con mezcla de responsabilidades:

- estado global con persistencia, migracion y CRUD en un unico archivo
- logica de DataHub dispersa dentro de paginas
- utilidades de import/export Excel embebidas en componentes grandes
- logica repetida para selectores y datos derivados
- componentes con helpers visuales duplicados

## Objetivo

Reducir acoplamiento y dejar una base mas mantenible sin cambiar comportamiento funcional.

## Cambios realizados

### Store

Se separo la responsabilidad de `app-state` en varias piezas:

- `app-state.tsx` como capa de composicion del contexto
- `app-state-updaters.ts` para transformaciones y operaciones de estado
- `app-state-normalization.ts` para migracion y normalizacion
- `app-state-storage.ts` para persistencia local y confirmacion de reset

### DataHub

Se extrajeron utilidades a:

- `src/lib/datahub/excel.ts`
- `src/lib/datahub/navigation.ts`

Con ello `datahub/page.tsx` quedo mas enfocado en coordinacion de vista y menos en logica interna.

### Selectores

Se creo `src/lib/maturation/selectors.ts` para centralizar:

- latest assessments por atleta
- equipos y posiciones unicas
- filtros de DataHub
- ayudas para Analysis

### UI compartida

Se creo `src/components/labeled-field.tsx` para evitar helpers duplicados de formulario.

### Performance

Se saco parte de la estructura pesada a `performance-section.parts.tsx`, dejando fuera del archivo principal subcomponentes grandes y reutilizables.

## Resultado

- mejor separacion entre dominio, estado y UI
- menos logica repetida
- archivos base mas faciles de leer
- punto de partida mas seguro para futuros cambios funcionales

## Deuda que sigue abierta

- `maturation-section.tsx` sigue siendo grande y admite una segunda ola de extraccion de subcomponentes
- `club-section.tsx` sigue concentrando demasiada UI y logica
- falta validacion con toolchain completa porque el directorio no tenia `node_modules` listos en este entorno

## Impacto esperado

Esta limpieza no cambia el producto visible, pero reduce el coste de evolucion futura y prepara mejor el proyecto para persistencia real, mas tests y modulos funcionales nuevos.
