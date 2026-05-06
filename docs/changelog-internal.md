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

### [2026-05-05] - Refactor de Navegación Individual, Sub-áreas y Corrección de Lógica de Comparativa

#### Añadido
- **Navegación por Equipos:** Selector de atletas agrupado por equipos con funcionalidad de acordeón para mejorar la usabilidad con grandes volúmenes de datos.
- **Sub-áreas de Análisis Individual:** Estructura modular dividida en tres secciones:
    - **Maduración:** Perfiles, Z-Scores y predicciones de talla.
    - **Rendimiento:** Snapshot de pruebas y gráfico de evolución histórica de métricas.
    - **Carga de Entrenamiento:** Historial de carga (RPE x min) con gráficos de barras y tablas detalladas.
- **Visualización de Carga:** Integración de datos de `training_load` en el módulo de análisis para una visión holística del atleta.

#### Mejorado
- **Lógica de Comparativa:** Corregido el sistema de comparación para que utilice únicamente el **último valor registrado** de cada atleta en las comparativas de equipo y grupo, evitando duplicados históricos en los gráficos.
- **Formateo Numérico:** Aplicación estricta de 2 decimales en todos los gráficos (Tooltips y etiquetas) de las vistas individual y colectiva.
- **UX de Selección:** Reducción del desorden visual en la vista individual mediante la agrupación jerárquica.
- **Consistencia Visual:** Aplicación de sparklines y gráficos dinámicos en todas las sub-áreas.
- **Internacionalización:** Soporte completo (ES/EN) para todas las nuevas etiquetas y cabeceras de sub-áreas.
- **Tipado TypeScript:** Resolución de errores de tipado en acumuladores de carga y formateadores de Recharts.

## Refactorización y Estandarización del Módulo de Análisis (Mayo 2026)

### Cambios introducidos

- **Nueva UI de Navegación**: Se ha eliminado la barra de pestañas persistente en `/analysis`, sustituyéndola por una landing page de selección (Individual, Colectivo, Asistente) para mejorar el flujo de usuario.
* **Estandarización Numérica**: Se ha implementado un límite estricto de **máximo 2 decimales** en toda la suite de análisis (tablas, tarjetas de métricas y gráficos) utilizando la utilidad `formatNumber(val, 2)`.
* **Internacionalización Completa (i18n)**: Se han integrado todas las claves de traducción faltantes en `dictionaries.ts` (ES/EN) para términos dinámicos y etiquetas de gráficos en las vistas individuales y colectivas.
* **Estabilización de Gráficos**: Se han resuelto las advertencias de dimensiones de `Recharts` (`width(-1)`) definiendo contenedores con tamaños mínimos explícitos (`min-h-[XXpx]`) y anchos completos.
* **Corrección de Cálculos**: Se han redondeado los promedios del Perfil Psicológico Colectivo y los datos de tendencia temporal para evitar ruidos visuales por exceso de precisión.

### Archivos destacados

- `src/app/(protected)/analysis/page.tsx`
- `src/lib/i18n/dictionaries.ts`
- `src/components/maturation-insights.tsx`
- `src/lib/utils.ts` (uso intensivo de `formatNumber`)

### [2026-05-05] - Optimización de UI de Selección y Estabilidad Técnica

#### Añadido
- **Comparativa Multi-Jugador:** Nueva funcionalidad que permite seleccionar uno o varios atletas adicionales para contrastar datos en tiempo real dentro del área individual.
- **Selector de Atleta Colapsable:** Implementada una lógica de "auto-repliegue" que minimiza el selector de jugadores una vez elegido uno, liberando espacio vertical para el análisis de datos.
- **Barra de Atleta Seleccionado:** Nueva interfaz compacta que muestra el resumen del jugador activo cuando el selector está minimizado.
- **Gráficos Multi-Línea:** El gráfico de tendencia temporal ahora soporta múltiples líneas (una por cada jugador seleccionado) con estilos diferenciados (línea sólida para el principal, discontinua para comparativas).
- **Hardenización de Persistencia:** Reforzado el sistema de recuperación de estado (`localStorage`) con validaciones de JSON y captura de errores para prevenir el error "Unexpected end of JSON input".

#### Mejorado
- **Gráfico de Comparación de Equipo:** Ahora resalta en color ámbar a los jugadores seleccionados para comparativa, facilitando su ubicación respecto al resto de la plantilla.
- **Estabilidad de Gráficos (Recharts):** Sustitución de alturas porcentuales por valores fijos en píxeles y adición de un disparador de "resize" automático para eliminar definitivamente las advertencias de dimensiones en el navegador.
- **Layout de Maduración:** Sustitución de fragmentos React por contenedores con espaciado consistente (`space-y-6`), eliminando la compresión visual entre gráficos.
- **Corrección de Accesibilidad (HTML):** Eliminado el error de botones anidados en el selector de atletas, sustituyéndolos por hermanos de nivel superior para evitar errores de hidratación y mejorar el cumplimiento del estándar HTML.
- **Lógica de Referencia Dinámica:** Implementado el cambio automático de base para Z-Score y diferencias; si hay comparativa activa, se usa la media del grupo seleccionado; si no, se usa la media del equipo.
- **Mejora Visual de Selección:** Actualizado el selector de atletas con etiquetas de texto explícitas ("COMPARAR") para mejorar la descubribilidad de la función.
- **Feedback de Contexto:** Añadido un indicador visual de "Referencia activa" en el perfil de maduración para clarificar contra qué se está comparando al jugador.

### [2026-05-05] - Estandarización de Tooltips y Profesionalización del Análisis

#### Añadido
- **Tooltips Educativos (Individual):** Implementados iconos de información (`Info`) con explicaciones técnicas detalladas en todas las tarjetas de métricas críticas de maduración: Z-Score, Diferencia vs Media, Banda Madurativa, Estado Madurativo y Predicción de Altura Adulta.
- **Tooltips de Grupo (Colectivo):** Estandarización de explicaciones para las métricas colectivas: Offset medio, Edad media, Estatura media y Peso medio.
- **Glosario de Métricas:** Incorporación de definiciones técnicas en el diccionario bilingüe (`dictionaries.ts`) para asegurar que el staff técnico interprete los datos bajo criterios unificados.

#### Mejorado
- **Precisión de Tooltips:** Corrección de la explicación de "Diferencia vs Media" para especificar que se trata del **Offset Madurativo** y no un valor absoluto, ajustándose a la realidad técnica de los datos mostrados.
- **Estabilidad de Diccionarios:** Reparación y saneamiento del archivo `dictionaries.ts` tras una corrupción de estructura, eliminando duplicidades y claves misaligned para garantizar la integridad de la interfaz bilingüe.
- **Consistencia de UI:** Homogeneización del diseño de tooltips (estilo overlay oscuro con tipografía pequeña) en todos los componentes del módulo de análisis.
