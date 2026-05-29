# 📖 Documentación de Arquitectura de Navegación Híbrida y Políticas de Reinicio de Filtros

Este documento es la referencia técnica canónica sobre cómo se gestiona la persistencia de navegación, los paneles del espacio de trabajo y las políticas de restablecimiento de filtros en la aplicación.

**Última actualización:** 2026-05-29

---

## 🧭 1. El Concepto Clave: "Espacio de Trabajo Persistente, No Consultas Efímeras"

La aplicación utiliza un **modelo híbrido** para gestionar el estado de la UI:

1. **URL State (Deep Linking):** Guarda variables estructurales de primer nivel como la pestaña activa global (`tab`), el ID del atleta abierto en maturation (`player`) o el área de rendimiento (`area`). Permite compartir enlaces directos y sobrevive a un F5.
2. **Session Storage UI State (`usePersistentState`):** Guarda configuraciones del espacio de trabajo y sub-pestañas activas. Evita la sobrecarga de la URL y elimina retardos en los clics. Sobrevive a F5 pero se limpia al salir del módulo o cambiar de pestaña principal.
3. **Transient Local State (`useState`):** Guarda filtros volátiles, inputs textuales y ordenaciones que no deben perdurar en visitas posteriores.

---

## 🔄 2. Tabla de Persistencia

La siguiente tabla resume qué variables se mantienen en un refresco (**F5**) y cuáles se limpian al cambiar de pantalla.

| Área / Componente | Clave de sessionStorage | ¿Persiste al F5? | ¿Se limpia al salir del módulo? | ¿Se limpia al cambiar de sección/pestaña? |
| :--- | :--- | :---: | :---: | :---: |
| **DataHub** — sección activa | URL param `tab` | **SÍ** | **SÍ** | *No aplica* |
| **DataHub** — atleta expandido | URL param `player` | **SÍ** | **SÍ** | **SÍ** |
| **Club** — pestaña interna (plantilla/admin) | `datahub_club_active_tab_v2` | **SÍ** | **SÍ** | **SÍ** |
| **Club** — sub-pestaña (players/teams) | `datahub_club_sub_tab` | **SÍ** | **SÍ** | **SÍ** |
| **Club** — equipo seleccionado | `datahub_club_selected_team_id` | **SÍ** | **SÍ** | **SÍ** |
| **Club** — atleta seleccionado | `datahub_club_selected_athlete_id` | **SÍ** | **SÍ** | **SÍ** |
| **Performance** — sub-pestaña (tests/trainingLoad/gps) | `datahub_perf_tab_v2` | **SÍ** | **SÍ** | **SÍ** |
| **Performance** — sub-pestaña carga (training/gps) | `datahub_training_load_sub_tab` | **SÍ** | **SÍ** | **SÍ** |
| **Performance** — área de test battery | `datahub_club_test_battery_area` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis** — pestaña activa | URL param `tab` | **SÍ** | **SÍ** | *No aplica* |
| **Analysis Individual** — IDs de comparación | `analysis_indiv_compare` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Individual** — config de comparación | `analysis_indiv_comp_config` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Individual** — panel de comparación | `analysis_indiv_comp_panel` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Individual** — sub-pestaña activa | `analysis_indiv_subtab` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Individual** — áreas de performance | `analysis_indiv_perf_areas` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Individual** — tests seleccionados | `analysis_indiv_perf_tests` | **SÍ** | **SÍ** | **SÍ** |
| **Analysis Colectivo** — equipo seleccionado | `analysis_collective_team` | **SÍ** | **SÍ** | **SÍ** |
| **Performance** — filtros textuales/multiselect | `useState` local | **NO** | **NO** | **SÍ** |

---

## 🛠️ 3. Mecanismo de Limpieza: Doble Efecto con `prevRef`

Cada módulo principal (DataHub, Analysis) implementa **dos efectos de limpieza** complementarios:

### 3a. Cleanup al salir del módulo (unmount)
Se ejecuta cuando el usuario navega a otra página completamente distinta. Limpia **todas** las claves de sessionStorage del módulo:

```typescript
useEffect(() => {
  return () => {
    // Solo se ejecuta al desmontar el componente (cambio de ruta a otro módulo)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("datahub_club_active_tab_v2");
      sessionStorage.removeItem("datahub_club_sub_tab");
      // ... resto de claves del módulo
    }
  };
}, []);
```

### 3b. Cleanup al cambiar de sección dentro del módulo (top-level)

Se ejecuta cuando `section` cambia (`club` ↔ `sports` ↔ `landing`). Limpia el estado de **ambas** áreas.

### 3c. Cleanup al cambiar de sub-sección dentro de Sports

Se ejecuta cuando `sportsSubSection` cambia (`maturation` ↔ `performance`). El guard `prevSportsSubSectionRef !== null` evita el falso positivo en F5. Limpia estado de performance y resetea `expandedAthleteId`:
Se ejecuta cuando el usuario cambia de sección dentro del mismo módulo. El guard `prevRef !== null` es **crítico**: evita que un F5 (donde `prevRef` arranca en `null`) dispare una limpieza falsa.

```typescript
const prevSectionRef = useRef<string | null>(null);
useEffect(() => {
  const prevSection = prevSectionRef.current;
  if (prevSection !== null && prevSection !== section) {
    // Solo limpia cuando hay una transición real entre secciones
    sessionStorage.removeItem("datahub_club_active_tab_v2");
    // ...
  }
  prevSectionRef.current = section;
}, [section]);
```

> **⚠️ Regla de mantenimiento:** Cada vez que se añada una nueva clave con `usePersistentState` en cualquier sub-componente de DataHub o Analysis, debe añadirse a **ambos** bloques de limpieza del `page.tsx` padre correspondiente.

---

## 🔑 4. Inventario Completo de Claves de sessionStorage

### DataHub (`datahub/page.tsx` gestiona la limpieza)

| Clave | Definida en | Valor por defecto |
| :--- | :--- | :--- |
| `datahub_club_active_tab_v2` | `club-section.tsx` | `"plantilla"` |
| `datahub_club_sub_tab` | `club-section.tsx` | `"players"` |
| `datahub_club_selected_team_id` | `club-section.tsx` | `null` |
| `datahub_club_selected_athlete_id` | `club-section.tsx` | `null` |
| `datahub_club_test_battery_area` | `performance-section.tsx` | `"physical"` |
| `datahub_perf_tab_v2` | `performance-section.tsx` | `"tests"` |
| `datahub_training_load_sub_tab` | `performance-section.tsx` | `"training"` |
| `datahub_club_selected_def` | *(legacy, sin uso activo)* | `null` |

> **Nota:** Las claves `datahub_club_active_tab` y `datahub_perf_tab` (sin `_v2`) son obsoletas. Fueron renombradas en refactorizaciones sucesivas. No deben usarse ni limpiarse por su nombre antiguo.

### Analysis (`analysis/page.tsx` gestiona la limpieza)

| Clave | Definida en | Valor por defecto |
| :--- | :--- | :--- |
| `analysis_indiv_compare` | `IndividualView` | `[]` |
| `analysis_indiv_comp_config` | `IndividualView` | `{ mode: "solo", ... }` |
| `analysis_indiv_comp_panel` | `IndividualView` | `false` |
| `analysis_indiv_subtab` | `IndividualView` | `"maturation"` |
| `analysis_indiv_perf_areas` | `IndividualView` | `[]` |
| `analysis_indiv_perf_tests` | `IndividualView` | `[]` |
| `analysis_collective_team` | `CollectiveView` | `""` (primer equipo) |

---

## 🔗 5. Estado en URL (Deep Linking)

| Param | Módulo | Valores posibles |
| :--- | :--- | :--- |
| `tab` | DataHub | `club`, `maturation`, `performance` |
| `area` | DataHub | área de performance activa |
| `player` | DataHub | UUID del atleta expandido |
| `playerArea` | DataHub | área del panel de jugador |
| `tab` | Analysis | `individual`, `collective`, `assistant` |

La función `resolveDataHubRouteState` en `src/lib/datahub/navigation.ts` es la fuente de verdad para interpretar estos parámetros.

---

## 📋 6. Checklist para añadir nueva navegación persistente

Al añadir un nuevo `usePersistentState` en cualquier sub-componente:

- [ ] Elegir una clave con el prefijo del módulo (`datahub_` o `analysis_`)
- [ ] Añadir la clave al bloque de **unmount cleanup** en el `page.tsx` padre
- [ ] Añadir la clave al bloque de **tab-switch cleanup** en el `page.tsx` padre
- [ ] Actualizar la tabla de inventario de este documento
- [ ] Si la clave reemplaza a otra existente, marcar la antigua como obsoleta aquí