# Changelog Interno

## Supabase migration - Fase 1 y base de Fase 2

### Cambios introducidos

- Sustituida la cookie propia `maduration_session` por sesiones reales de Supabase Auth.
- Reescrito el cliente server de Supabase con `@supabase/ssr` y cookies de Next App Router.
- Anadido cliente browser de Supabase para futuros componentes cliente.
- Anadido `src/proxy.ts` para refresco de sesion y proteccion de rutas en Next 16.
- Actualizadas las rutas de login/logout para usar `supabase.auth.signInWithPassword` y `signOut`.
- Actualizadas `/` y `/login` para decidir redireccion usando sesion real.
- `getSessionUser()` ahora resuelve `user_id`, `club_id`, email, rol y nombre de club desde Supabase.
- `AppStateProvider` acepta `initialState`, dejando `localStorage` solo como fallback temporal.
- El layout protegido carga estado inicial desde Supabase antes de renderizar las pantallas privadas.
- Las preferencias de idioma se guardan en `user_preferences` cuando hay usuario autenticado.

### Schema/RLS

- Anadida tabla `club_members` para vincular usuarios Auth con clubes y roles.
- Activado RLS en tablas de club, equipos, jugadores, mediciones, preferencias y rendimiento.
- Anadida funcion `my_club_id()` para aislar datos por club.
- Extendidas tablas existentes con campos que ya usa la UI: escudo, color, deporte, fotos, posiciones y categorias.
- Anadidas tablas `performance_entries`, `training_load_entries` y `performance_definitions`.

### Correcciones posteriores

- Eliminadas consultas embebidas de Supabase en el render inicial para reducir friccion con RLS.
- Anadidos timeouts por query Supabase para evitar que `/hub` se quede indefinidamente en rendering si una tabla o policy falla.
- Eliminados logs de depuracion que imprimian payloads completos de Supabase.
- Corregido un error de tipos en alertas de crecimiento rapido de `analysis`.
- Corregidos dos `any` en exportacion Excel de performance para que `lint` no falle.

### Fase 3 iniciada

- Anadidas Server Actions para crear, actualizar y eliminar equipos.
- Anadidas Server Actions para crear, actualizar y eliminar jugadores.
- Anadidas Server Actions para crear, actualizar y eliminar mediciones antropometricas.
- Conectadas las mutaciones de equipos, jugadores y mediciones del `AppStateProvider` a persistencia optimista en Supabase.
- La importacion masiva de mediciones empieza a persistir filas nuevas en background.

### Pendiente siguiente

- Completar Server Actions de rendimiento, carga de entrenamiento, definiciones de tests y ajustes del club.
- Eliminar `localStorage` cuando todas las escrituras importantes persistan en Supabase.

## DataHub restructure

Resumen conservado del cambio mas visible encontrado en la entrega original.

### Cambios introducidos

- Nueva arquitectura con sidebar y tres secciones principales.
- Navegacion actualizada para enlazar a `Club`, `Maturation` y `Performance`.

### Secciones resultantes

#### Club

- Equipos
- Jugadores
- Ajustes del club

#### Maturation

- Funcionalidad antropometrica y de maduracion
- Filtros por jugador, equipo, posicion, edad, estatura y masa
- Filtros de maduracion por banda, offset, Moore APHV, `% PAH` y Mirwald
- Import/export Excel bilingue
- Flujos para anadir jugador, anadir medicion y editar jugador

#### Performance

- Tests fisicos, tecnico-tacticos y psicologicos
- Definicion de tests personalizados
- Import/export Excel
- Tabla de resultados con agrupacion e historico

### Archivos destacados

- `datahub-sidebar.tsx`
- `club-section.tsx`
- `performance-section.tsx`
- `performance-constants.ts`

### Pendientes mencionados en esa entrega

- Calendario de carga de entrenamiento con RPE x minutos
- GPS
- Integracion completa del color del club
- Subida de escudo del club
