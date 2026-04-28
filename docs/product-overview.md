# Product Overview

## Resumen

Maduration es una plataforma web orientada a futbol formativo y entornos de academias que busca contextualizar el crecimiento biologico de los jugadores junto con datos de rendimiento y estructura de club.

La propuesta actual combina tres ejes:

- operativa de club y jugadores
- maduracion biologica y bio-banding
- rendimiento y carga

## Que ya esta implementado

### Hub

Pantalla de acceso al ecosistema de modulos, con acceso rapido a DataHub, Analysis, Community y Research.

### DataHub

Es el bloque mas desarrollado de la app. Contiene:

- `Club`
  - gestion basica de equipos
  - gestion de jugadores
  - ajustes del club
  - bateria de tests y definiciones de pruebas
- `Maturation`
  - alta de mediciones
  - filtros avanzados
  - importacion y exportacion Excel
  - calculo de maduracion y visualizacion tabular
- `Performance`
  - registro de tests por area
  - estructura para resultados historicos
  - carga de entrenamiento
  - base para GPS, aun no activa

### Analysis

Modulo con mas valor analitico. Incluye:

- vista individual
- vista colectiva
- bio-banding
- alertas
- comparativas por equipo y jugador
- graficos de evolucion y distribucion

## Que esta parcialmente implementado

### Persistencia real

Existe un esquema SQL y una capa minima para Supabase, pero el flujo principal sigue trabajando sobre estado cliente persistido en `localStorage`.

### Community

Solo representa la intencion del modulo: formacion, comunidad y colaboracion entre clubes.

### Research

Solo representa la intencion del modulo: investigacion, conocimiento y futuras capas de evidencia aplicada.

## Logica de negocio destacable

La app no es solo una UI. Tiene logica real de calculo de maduracion y clasificacion biologica en `src/lib/maturation`, incluyendo:

- Mirwald
- Moore
- Fransen
- Khamis-Roche

Con esas formulas genera:

- offset de maduracion
- APHV
- porcentaje de estatura adulta estimada
- bandas `Pre-PHV`, `Mid-PHV`, `Post-PHV`
- warnings e insights

## Lectura recomendada para continuidad

- Empezar por `README.md` para contexto general.
- Revisar `src/lib/store/app-state.tsx` para entender el estado actual real de la app.
- Revisar `src/lib/maturation/calculations.ts` para entender el valor diferencial del producto.
- Revisar `docs/roadmap.md` para ver que falta y que se considera siguiente iteracion.
