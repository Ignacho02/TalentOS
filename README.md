# Maduration

Maduration es una web app para clubes y staffs de formacion que convierte mediciones antropometricas y datos de rendimiento en contexto util para la toma de decisiones. El foco del producto esta en maduracion biologica, bio-banding, analisis comparativo y una estructura de DataHub que pueda crecer hacia operaciones reales de club.

Este repositorio esta preparado como handoff tecnico: explica que hace hoy la app, que partes estan realmente operativas y donde tocar segun el tipo de cambio.

## Que problema resuelve

En deporte formativo, la edad cronologica no basta para comparar jugadores, planificar cargas o interpretar rendimiento. Maduration intenta resolver eso con:

- captura de mediciones antropometricas
- calculo de maduracion biologica con varias formulas
- segmentacion por bandas de maduracion
- dashboards individuales y colectivos
- base para combinar maduracion, rendimiento y estructura de club

## Estado actual del proyecto

- Frontend funcional en Next.js con rutas protegidas, login demo y navegacion principal operativa.
- El nucleo de `DataHub` y `Analysis` esta implementado y usable con datos demo.
- La persistencia principal vive en `localStorage` a traves de un store cliente.
- Hay base de Supabase preparada, pero no esta integrada end-to-end como fuente principal de datos.
- Los modulos `Community` y `Research` existen, pero hoy funcionan como placeholders.

## Modulos principales

### Hub

Pantalla de entrada tras login. Resume los modulos y el estado de cada uno.

### DataHub

Centro operativo de la app. Reune tres bloques:

- `Club`: equipos, jugadores, ajustes y bateria de tests.
- `Maturation`: mediciones antropometricas, filtros, import/export Excel y calculo de maduracion.
- `Performance`: resultados de tests, definiciones de pruebas y carga de entrenamiento.

### Analysis

Modulo analitico con vistas individuales y colectivas, comparativas, bio-banding, alertas y graficos sobre maduracion.

### Community

Modulo conceptual para formacion y red de clubes. Aun no tiene funcionalidad de negocio implementada.

### Research

Modulo conceptual para investigacion y conocimiento aplicado. Aun no tiene funcionalidad de negocio implementada.

## Stack tecnico

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts
- XLSX y ExcelJS
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- Zod

## Como arrancarlo

### Requisitos

- Node.js 20 o superior recomendado
- npm

### Instalacion

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

La app arranca en `http://localhost:3000`.

### Credenciales demo

Si no configuras Supabase, el login usa credenciales demo definidas en `src/lib/config.ts`:

- email: `coach@maduration.app`
- password: `Maduration2026!`

Tambien se pueden sobrescribir con:

- `NEXT_PUBLIC_DEMO_EMAIL`
- `NEXT_PUBLIC_DEMO_PASSWORD`

### Variables para Supabase

Si quieres probar autenticacion con Supabase, define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Scripts disponibles

- `npm run dev`: arranca el entorno de desarrollo.
- `npm run build`: genera la build de produccion.
- `npm run start`: sirve la build compilada.
- `npm run lint`: ejecuta ESLint.
- `npm run test`: lanza el test actual de calculos de maduracion.

## Estructura del proyecto

- `src/app`: rutas, layouts y endpoints de la app.
- `src/components`: componentes reutilizables de interfaz.
- `src/lib`: dominio, tipos, store cliente, validaciones, i18n y logica de maduracion.
- `public`: assets estaticos.
- `supabase`: esquema SQL base para futura persistencia real.
- `docs`: documentacion complementaria para entender producto, roadmap y estado interno.

## Fuente de verdad de datos

Hoy conviven dos niveles:

- Estado operativo actual: `localStorage` + datos demo en cliente.
- Direccion futura: Supabase como backend real para autenticacion y persistencia.

Eso significa que la app sirve bien como demo funcional o base de producto, pero aun no debe leerse como sistema multiusuario terminado.

## Donde tocar segun el cambio

- Cambios de navegacion o pantallas: `src/app` y `src/components`.
- Cambios de formulas, clasificaciones o insight logic: `src/lib/maturation`.
- Cambios de tipos o entidades: `src/lib/types.ts`.
- Cambios de estado, CRUD o persistencia local: `src/lib/store/app-state.tsx`.
- Cambios de autenticacion o integracion backend: `src/app/api` y `src/lib/supabase`.

## Limitaciones conocidas

- El test actual depende de tener dependencias instaladas; sin `node_modules`, `npm test` falla.
- La persistencia principal no esta conectada aun a un backend real.
- `Community` y `Research` no estan implementados como modulos productivos.
- Parte de la experiencia actual esta pensada alrededor de datos demo y flujo de evaluacion interna.

## Proximos pasos recomendados

- Conectar persistencia real con Supabase mas alla del login.
- Endurecer validaciones y cobertura de tests.
- Definir un setup reproducible de entorno para nuevas personas del equipo.
- Seguir limpiando documentacion y separar mejor roadmap, changelog y decisiones de producto.

## Documentacion complementaria

- `docs/product-overview.md`
- `docs/roadmap.md`
- `docs/changelog-internal.md`
- `docs/engineering/README.md`
