# Reporte de Migración: De Local-First a Supabase (Cloud)

Este documento detalla la transformación técnica realizada en la rama `codex/supabase` para convertir la aplicación desde un prototipo con datos locales (`main`) a una plataforma SaaS multi-usuario persistente en la nube.

## 1. Transformación de la Arquitectura
- **Desacoplamiento de Datos**: Se eliminó la dependencia de `demo-data.ts` como fuente de verdad. Ahora la aplicación es "Data-Driven" y consume una API en tiempo real.
- **Implementación de Server Actions**: Se han migrado todas las operaciones de escritura (crear jugador, editar equipo, registrar test) a Next.js Server Actions, garantizando que las validaciones y la seguridad ocurran en el servidor.
- **Cliente de Supabase Dual**: Configuración de clientes específicos para:
  - **Server Components**: Para carga de datos inicial ultrarrápida.
  - **Client Components**: Para interactividad en tiempo real.
  - **Middleware**: Para protección de rutas y gestión de sesiones.

## 2. Nuevo Esquema de Base de Datos (Relacional)
Se ha diseñado e implementado un esquema relacional completo en Postgres (Supabase) que soporta multi-tenancy (múltiples clubes):
- **Estructura de Club**: Tablas `clubs` y `club_members` para gestionar la propiedad de los datos.
- **Jerarquía Deportiva**: Tablas `teams` y `athletes` con relaciones de clave foránea.
- **Datos Biométricos**: Tabla `anthropometric_records` optimizada para series temporales (gráficas PHV).
- **Rendimiento**: Tablas `performance_definitions` (catálogo de tests) y `performance_entries` (resultados).
- **Configuración**: Tabla `user_preferences` para persistir idioma y ajustes de usuario.

## 3. Sistema de Autenticación y Seguridad
- **Migración a Supabase Auth**: Sustitución de cualquier sistema previo por el motor de autenticación de Supabase (JWT).
- **Seguridad a Nivel de Fila (RLS)**: Implementación de políticas SQL que aseguran que un entrenador de un club NUNCA pueda ver datos de otro club, incluso si conoce los IDs.
- **Middleware de Protección**: Sistema que intercepta cada petición para verificar la sesión y redirigir al login si es necesario.

## 4. Evolución del Estado Global (Store)
- **Sincronización Híbrida**: El `AppStateProvider` ahora recibe un `initialState` desde el servidor pero mantiene la reactividad en el cliente para una experiencia de usuario fluida (Optimistic Updates).
- **Eliminación de LocalStorage**: Se ha eliminado la persistencia en el navegador, moviendo toda la lógica de guardado a la nube.

## 5. Internacionalización Persistente
- El idioma seleccionado ya no solo se guarda en una cookie temporal, sino que se persiste en la base de datos del usuario, manteniendo su preferencia en cualquier dispositivo.

## 6. Mejoras de Rendimiento en esta Rama
- **Carga bajo demanda**: Se ha optimizado la carga de datos para que solo se descargue la información del club al que pertenece el usuario.
- **Manejo de Timeouts**: Implementación de `safe-query` para gestionar conexiones lentas a la base de datos sin bloquear la interfaz.

---
Este cambio posiciona la aplicación como un producto listo para producción (Production-Ready), escalable y con seguridad de grado empresarial.
