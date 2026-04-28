# Changelog Interno

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
