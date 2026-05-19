# 📖 Documentación de Arquitectura de Navegación Híbrida y Políticas de Reinicio de Filtros

Este documento proporciona una guía de referencia técnica exhaustiva acerca de cómo se gestiona la persistencia de navegación, los paneles del espacio de trabajo y las políticas de restablecimiento de filtros en la aplicación.

---

## 🧭 1. El Concepto Clave: "Espacio de Trabajo Persistente, No Consultas Efímeras"

La aplicación utiliza un **modelo híbrido** para gestionar el estado de la UI:
1. **URL State (Deep Linking):** Guarda variables estructurales de primer nivel como la pestaña activa global (`tab`), el ID del atleta abierto en maturation (`player`) o el área de rendimiento (`area`). Permite compartir enlaces directos.
2. **Session Storage UI State (`usePersistentState`):** Guarda configuraciones del espacio de trabajo y sub-pestañas activas. Evita la sobrecarga de la URL y elimina retardos en los clics.
3. **Transient Local State (`useState`):** Guarda filtros volátiles, inputs textuales y ordenaciones que no deben perdurar en visitas posteriores.

---

## 🔄 2. Tabla de Persistencia: ¿Cuándo se Restablece y Qué?

La siguiente tabla resume con precisión matemática qué variables se mantienen intactas en un refresco (**F5**) y cuáles se limpian al cambiar de pantalla.

| Área / Componente | Variable de Estado | Tipo de Almacenamiento | ¿Persiste al Recargar (F5)? | ¿Se Restablece al Cambiar de Módulo (SPA)? | ¿Se Restablece al Cambiar de Sub-área / Pestaña? |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Global DataHub** | `section` (Pestaña principal: Club, Maturation, Performance) | URL query param (`tab`) | **SÍ** | **SÍ** (Inicia en "club") | *No aplica* |
| **Global DataHub** | `expandedAthleteId` | URL query param (`player`) | **SÍ** | **SÍ** | **SÍ** (Al cambiar de sub-área) |
| **Club - Structure** | `activeTab` (Pestaña interna: structure, testBattery, settings) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Vuelve al default: "structure") |
| **Club - Rosters** | `structureSubTab` (Visualización: players, teams) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Vuelve al default: "players") |
| **Club - Rosters** | `selectedTeamId` (Equipo seleccionado en "teams") | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Se limpia a `null`) |
| **Club - Rosters** | `selectedAthleteId` (Perfil de atleta abierto) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Se limpia a `null`) |
| **Club - Tests** | `testBatteryArea` (Categoría de test: physical, etc.) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Vuelve al default: "physical") |
| **Club - Tests** | `selectedDef` (Test concreto abierto en Test Battery) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Se limpia a `null`) |
| **Performance** | `perfTab` (Sub-subárea: tests, trainingLoad, gps) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Vuelve al default: "tests") |
| **Performance** | `selectedPanel` (Panel de detalles del jugador) | URL query params / State | **SÍ** | **SÍ** | **SÍ** (Se limpia a `null`) |
| **Performance - Tests**| `playerSearch` (Búsqueda textual de jugadores) | Local state (`useState`) | **NO** | **NO** | **SÍ** (Se limpia a "") |
| **Performance - Tests**| `filterTeams` (Filtros multiselect de equipos) | Local state (`useState`) | **NO** | **NO** | **SÍ** (Se limpia a `[]`) |
| **Performance - Tests**| `filterPositions` (Filtros multiselect de posiciones) | Local state (`useState`) | **NO** | **NO** | **SÍ** (Se limpia a `[]`) |
| **Performance - Tests**| `groupByTeam` / `groupByPos` (Agrupación activa) | Local state (`useState`) | **NO** | **NO** | **SÍ** (Se limpia a `false`) |
| **Performance - Tests**| `sortBy` / `sortCol` (Criterio de ordenación activo) | Local state (`useState`) | **NO** | **NO** | **SÍ** (Se limpia a "name" / `null`) |
| **Analysis** | `activeTab` (Sub-área: individual, collective, assistant) | URL query param (`tab`) | **SÍ** | **SÍ** (Inicia limpio) | *No aplica* |
| **Analysis - Indiv** | `compare` / `compConfig` / `compPanel` (Comparativas abiertas) | `sessionStorage` | **SÍ** | **SÍ** | **SÍ** (Se limpian a sus valores por defecto) |

---

## 🛠️ 3. Mecanismos Técnicos de Prevención de Falsos Positivos

Para garantizar que Next.js renderice en el servidor con los valores por defecto (evitando el error de **Hydration Mismatch**) y restaure en el cliente los valores de `sessionStorage` sin interpretarlo erróneamente como un cambio de pestaña que deba limpiar el estado, hemos implementado el patrón **Delayed Mount Guard (`isMountedRef`)**:

```typescript
  // 1. Guardar una referencia mutable del estado de montaje
  const isMountedRef = useRef(false);

  // 2. Establecer la bandera en true tras un retardo seguro de 100ms
  // Esto permite que todos los hooks usePersistentState terminen su inicialización asíncrona
  useEffect(() => {
    const timer = setTimeout(() => {
      isMountedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 3. Condicionar las limpiezas de transición únicamente cuando isMountedRef es true
  useEffect(() => {
    const currentTab = activeTab;
    const prevTab = prevActiveTabRef.current;
    if (isMountedRef.current && prevTab !== null && prevTab !== currentTab) {
      setSelectedAthleteId(null);
      setSelectedTeamId(null);
      setSelectedDef(null);
      
      // Restablecer sub-vistas predeterminadas
      setStructureSubTab("players");
      setTestBatteryArea("physical");
    }
    prevActiveTabRef.current = currentTab;
  }, [activeTab]);
```

Este retardo de **100ms** asegura que, durante la fase inicial del cliente en la que se vuelcan los datos de `sessionStorage` hacia los estados locales de React, la bandera `isMountedRef` sea `false`, haciendo que los condicionales ignoren el cambio inicial y preservando el equipo y test activo en su totalidad al recargar con F5.
