# Métodos de Estimación de Maduración

Guía científica completa de los algoritmos, fundamentos y limitaciones de cada método implementado en Maduration.

> **Versión:** 2.0 — Mayo 2026  
> **Basado en:** Verificación fórmula a fórmula contra los artículos originales

---

## Índice

1. [Fransen et al. (2018) — Maturity Ratio para chicos](#1-fransen-et-al-2018--maturity-ratio-para-chicos)
2. [Mirwald et al. (2002) — Maturity Offset](#2-mirwald-et-al-2002--maturity-offset)
3. [Moore et al. (2015) — Ecuación simplificada](#3-moore-et-al-2015--ecuación-simplificada)
4. [Khamis-Roche (1994) — Predicted Adult Height (PAH)](#4-khamis-roche-1994--predicted-adult-height-pah)
5. [WHO BMI Z-Score (2007)](#5-who-bmi-z-score-2007)
6. [SITAR — Modelo longitudinal individual](#6-sitar--modelo-longitudinal-individual)
7. [Motor de Consenso Ponderado](#7-motor-de-consenso-ponderado)
8. [Estrategias de Bio-banding](#8-estrategias-de-bio-banding)
9. [Tabla Comparativa](#9-tabla-comparativa)
10. [Consideraciones Prácticas](#10-consideraciones-prácticas)
11. [Limitaciones Generales y Avisos Clínicos](#11-limitaciones-generales-y-avisos-clínicos)
12. [Glosario](#12-glosario)
13. [Referencias Bibliográficas](#13-referencias-bibliográficas)

---

## 1. Fransen et al. (2018) — Maturity Ratio para chicos

**Estado:** ✅ Motor primario AUTO para chicos  
**Aplicable a:** Masculino únicamente  
**Rango de edad validado:** 8–18 años

### Fundamento

El paper de Fransen et al. (2018) introduce el concepto de **Maturity Ratio** (MR): la proporción entre la edad cronológica actual y la edad en el pico de velocidad de crecimiento (APHV). A diferencia de las ecuaciones de Mirwald y Moore —que estiman directamente el offset— Fransen calcula primero el ratio y de él deriva el APHV.

El modelo usa un polinomio de segundo y tercer grado para corregir la no-linealidad del crecimiento, lo que mejora especialmente la precisión en los extremos de la distribución (maduradores muy tempranos y muy tardíos), donde Mirwald presentaba sesgo sistemático.

El modelo fue desarrollado y validado en **1.330 jugadores de academias belgas de fútbol** y es el único de los métodos de offset diseñado específicamente para población futbolística masculina de academia.

### Variables de entrada

| Variable | Símbolo | Unidad |
|----------|---------|--------|
| Edad cronológica | AGE | años |
| Masa corporal | BM | kg |
| Estatura total | H | cm |
| Longitud de pierna | LL | cm (= H − SH) |

### Fórmula completa (Table 2, Fransen et al. 2018)

```
MR = 6.986547255416
   + 0.115802846632 × AGE
   + 0.001450825199 × AGE²
   + 0.004518400406 × BM
   − 0.000034086447 × BM²
   − 0.151951447289 × H
   + 0.000932836659 × H²
   − 0.000001656585 × H³
   + 0.032198263733 × LL
   − 0.000269025264 × LL²
   − 0.000760897942 × (H × AGE)

APHV = AGE / MR
MO   = AGE − APHV
```

**Interpretación del ratio:** MR < 1 indica que aún no se ha alcanzado el pico; MR > 1 indica que ya se superó. MR = 1 señala el APHV.

### Validación y precisión

- Validado en muestra independiente de jugadores belgas de élite
- Corrige el sesgo de Mirwald en maduradores tempranos y tardíos
- **No tiene versión para chicas** — el paper es explícito: *"only refer to a male population"*
- En poblaciones con APHV medio diferente (mediterráneas, africanas, asiáticas) la precisión puede ser menor

### Estado de implementación

Los **11 coeficientes** implementados en `calculations.ts` son idénticos a los publicados en Table 2 del paper hasta la última cifra decimal. ✅

### Referencias

- **Fransen, J., Bush, S., Woodcock, S., Novak, A., Deprez, D., Baxter-Jones, A.D.G., Vaeyens, R., & Lenoir, M. (2018).** Improving the Prediction of Maturity From Anthropometric Variables Using a Maturity Ratio. *Pediatric Exercise Science*, 30(2), 296–307. [doi:10.1123/pes.2017-0009](https://doi.org/10.1123/pes.2017-0009)

---

## 2. Mirwald et al. (2002) — Maturity Offset

**Estado:** ✅ Activo (motor de respaldo y método propio)  
**Aplicable a:** Masculino y femenino (ecuaciones separadas)  
**Rango de edad validado:** 8–16 años

### Fundamento

El método de Mirwald (2002) fue el primero en estimar el offset madurativo —años hasta o desde el PHV— a partir exclusivamente de medidas antropométricas sin necesidad de edad ósea. Se desarrolló sobre datos del estudio longitudinal Saskatchewan Growth and Development Study (SGDS), combinados con Bone Mineral Accrual Study (BMAS) y Lloyd's Longitudinal Study (LLTS).

El paper presenta **dos sets de ecuaciones**: las de muestra única (BMAS solo) y las ecuaciones combinadas de los tres estudios. La app implementa las **ecuaciones combinadas** (Eq. 3 para chicos, Eq. 4 para chicas), que son las recomendadas por el paper como más robustas.

### Variables de entrada

| Variable | Símbolo | Unidad |
|----------|---------|--------|
| Edad cronológica | AGE | años |
| Estatura total | H | cm |
| Altura sentado | SH | cm |
| Longitud de pierna | LL | cm (= H − SH) |
| Masa corporal | BM | kg |

### Ecuación para chicos (Eq. 3, p. 692)

```
MO = −9.236
   + 0.0002708 × (LL × SH)
   − 0.001663  × (AGE × LL)
   + 0.007216  × (AGE × SH)
   + 0.02292   × ((BM / H) × 100)

APHV = AGE − MO
```

### Ecuación para chicas (Eq. 4, p. 692)

```
MO = −9.376
   + 0.0001882 × (LL × SH)
   + 0.0022    × (AGE × LL)
   + 0.005841  × (AGE × SH)
   − 0.002658  × (AGE × BM)
   + 0.07693   × ((BM / H) × 100)

APHV = AGE − MO
```

> **Nota sobre la ecuación femenina:** Esta misma fórmula es la que la app usa bajo el nombre «Mirwald (♀)». El paper de Sherar et al. (2005) — frecuentemente citado en el contexto de la maduración femenina — describe un método de predicción de talla adulta que **utiliza** la ecuación de Mirwald para calcular el offset, pero no publica una ecuación de offset propia.

### Validación y precisión

- R² = 0.891 en chicos; 0.890 en chicas
- SEE = 0.592 años en chicos; 0.569 años en chicas
- Validado principalmente en población caucásica norteamericana
- Koziel & Malina (2018) confirman que el error se multiplica ×2–6 para maduradores con offset < −3 o > +3 años

### Estado de implementación

Todos los coeficientes verificados contra el paper original. ✅

### Referencias

- **Mirwald, R.L., Baxter-Jones, A.D.G., Bailey, D.A., & Beunen, G. (2002).** An assessment of maturity from anthropometric measurements. *Medicine & Science in Sports & Exercise*, 34(4), 689–694. [doi:10.1097/00005768-200204000-00020](https://doi.org/10.1097/00005768-200204000-00020)

---

## 3. Moore et al. (2015) — Ecuación simplificada

**Estado:** ✅ Activo (fallback de Fransen ♂ y motor principal ♀)  
**Aplicable a:** Masculino y femenino (ecuaciones separadas)  
**Rango de edad validado:** 8–18 años

### Fundamento

Moore et al. (2015) propusieron simplificar el modelo de Mirwald para reducir la multicolinealidad. El resultado son ecuaciones de un único término de interacción que mantienen precisión comparable con muchas menos variables. El paper presenta dos variantes para chicos: **Moore-1** (con altura sentado) y **Moore-2** (sin altura sentado, usando estatura total).

### Variables de entrada

| Variable | Símbolo | Moore-1 ♂ | Moore-2 ♂ | Moore ♀ |
|----------|---------|-----------|-----------|---------|
| Edad cronológica | AGE | ✅ | ✅ | ✅ |
| Altura sentado | SH | ✅ | — | — |
| Estatura total | H | — | ✅ | ✅ |

### Ecuaciones (p. 1759 y p. 1761)

**Chicos — Moore-1** (requiere altura sentado):
```
MO = −8.128741 + 0.0070346 × (AGE × SH)
APHV = AGE − MO
```

**Chicos — Moore-2** (sin altura sentado, fallback):
```
MO = −7.999994 + 0.0036124 × (AGE × H)
APHV = AGE − MO
```

**Chicas** (usa estatura total, no altura sentado):
```
MO = −7.709133 + 0.0042232 × (AGE × H)
APHV = AGE − MO
```

### Validación y precisión

- Validado en muestra longitudinal polaca independiente (Koziel & Malina, 2018): 193 chicos, 198 chicas
- Moore-1 para chicas presenta **sesgo sistemático positivo** desde los 10 años (predicha > observada) — limitación del modelo documentada
- Para chicas, ninguna ecuación de offset tiene una ventana clara de buena predicción comparable a la de chicos
- Moore-2 tiene un MAD ~0.1 años mayor que Moore-1 según Koziel & Malina (2018)

### Estado de implementación

Moore-1 (♂ y ♀) verificado. ✅  
Moore-2 (♂ fallback sin SH): implementación planificada como mejora próxima.

### Referencias

- **Moore, S.A., McKay, H.A., Macdonald, H., Nettlefold, L., Baxter-Jones, A.D.G., Cameron, N., & Brasher, P.M.A. (2015).** Enhancing a somatic maturity prediction model. *Medicine & Science in Sports & Exercise*, 47(8), 1755–1764. [doi:10.1249/MSS.0000000000000588](https://doi.org/10.1249/MSS.0000000000000588)
- **Koziel, S.M. & Malina, R.M. (2018).** Modified Maturity Offset Prediction Equations: Validation in Independent Longitudinal Samples of Boys and Girls. *Sports Medicine*, 48(1), 221–236. [doi:10.1007/s40279-017-0797-4](https://doi.org/10.1007/s40279-017-0797-4)

---

## 4. Khamis-Roche (1994) — Predicted Adult Height (PAH)

**Estado:** ✅ Activo — indicador principal de talla adulta estimada  
**Aplicable a:** Masculino y femenino  
**Rango de edad validado:** 4.0 – 17.5 años (paso 0.5 años)

### Fundamento

El método de Khamis & Roche (1994) fue desarrollado como alternativa al método RWT (Roche-Wainer-Thissen) que requería edad ósea. Usando datos del estudio longitudinal Fels (223 varones y 210 mujeres, southwest Ohio), los autores demostraron que la edad ósea puede omitirse con solo un ligero deterioro en la precisión.

El método estima la **talla adulta predicha (PAH)** a partir de tres variables: talla actual, masa corporal y talla mid-parental. Usa tablas de coeficientes de regresión específicas por edad y sexo.

### Variables de entrada

| Variable | Símbolo | Unidad | Notas |
|----------|---------|--------|-------|
| Estatura actual | H | cm | — |
| Masa corporal | BM | kg | — |
| Talla de la madre | HM | cm | Medida o autoreportada |
| Talla del padre | HP | cm | Medida o autoreportada |
| Edad cronológica | AGE | años | Para selección de tabla |

### Fórmula de regresión

```
PAH = β₀ + β₁ × H + β₂ × BM + β₃ × MPS
```

Donde `MPS` (Mid-Parent Stature) es la media de las tallas parentales ajustadas, y los coeficientes β₀–β₃ provienen de tablas por edad y sexo (Tables 1 y 2 del paper original, 27 filas de 4.0 a 17.5 años).

**Fragmento de tabla — varones (Table 1, Khamis & Roche 1994):**

| Edad | β₀ | β₁ (H) | β₂ (BM) | β₃ (MPS) |
|------|----|--------|---------|---------|
| 11.0 | −10.4917 | 0.81239 | −0.0029050 | 0.54781 |
| 12.0 | −9.3522 | 0.68325 | −0.0020076 | 0.60927 |
| 13.0 | −7.8632 | 0.60818 | −0.0013895 | 0.62407 |
| 14.0 | −6.4299 | 0.59151 | −0.0009776 | 0.58762 |

> Los coeficientes del paper trabajan en unidades mixtas (pulgadas y libras para stature/weight, pulgadas para MPS). La app convierte las entradas a esas unidades antes de aplicar la regresión.

### Ajuste de tallas parentales

Las tallas parentales autoreportadas tienden a sobreestimarse. La app aplica una corrección de overreporting siguiendo la literatura (Epstein et al., 1995):

```
HM_adj = ((HM_cm × 0.3937 × 0.953) + 2.803) × 2.54   // madre
HP_adj = ((HP_cm × 0.3937 × 0.955) + 2.316) × 2.54   // padre
MPS    = (HM_adj + HP_adj) / 2
```

> ⚠️ **Importante:** Esta corrección solo debe aplicarse cuando las tallas son **autoreportadas**. Si las tallas parentales han sido medidas directamente, debe usarse la conversión de unidades sin los factores de corrección. La UI permite indicar el tipo de talla (próxima mejora).

### Métricas derivadas

```
PAH%  = (H / PAH) × 100           // % de talla adulta alcanzado
Z_PAH = (PAH% − refMean) / refSD  // Solo varones; requiere tabla de referencia
```

### Precisión del método

Según el paper original (Table 3, Khamis & Roche 1994):

| Población | MAD promedio (cm) | Límite 90% (cm) |
|-----------|-------------------|-----------------|
| Varones | ~2.16 cm (0.851 in) | ~5.33 cm (2.101 in) |
| Mujeres | ~1.67 cm (0.657 in) | ~4.25 cm (1.675 in) |

El 50% de las predicciones tendrá un error menor que el MAD; el 90% tendrá un error menor que el límite al 90%.

### Estado de implementación

Coeficientes de regresión (Tables 1 y 2) verificados contra el paper original. ✅  
Ajuste parental: implementado; verificación contra Epstein et al. (1995) en curso.

### Referencias

- **Khamis, H.J. & Roche, A.F. (1994).** Predicting adult stature without using skeletal age: The Khamis-Roche method. *Pediatrics*, 94(4), 504–507.

---

## 5. WHO BMI Z-Score (2007)

**Estado:** ✅ Activo  
**Aplicable a:** Masculino y femenino  
**Rango de edad:** 5–19 años

### Fundamento

Calcula el Z-score del IMC ajustado a edad y sexo usando el método LMS de la OMS (WHO Reference 2007). Permite identificar bajo peso, normopeso, sobrepeso y obesidad en relación con la población de referencia internacional.

### Fórmula LMS (Box-Cox)

```
BMI = BM / (H / 100)²

// Cuando L ≠ 0:
Z = [(BMI / M)^L − 1] / (L × S)

// Caso especial L = 0:
Z = ln(BMI / M) / S
```

| Parámetro | Descripción |
|-----------|-------------|
| L | Parámetro Box-Cox (corrige asimetría de la distribución) |
| M | Mediana (valor central esperado del IMC para esa edad y sexo) |
| S | Coeficiente de variación (dispersión relativa) |

Las tablas LMS cubren 29 puntos por sexo (de 5.0 a 19.0 años en paso 0.5). Ejemplo varones:

| Edad | L | M | S |
|------|---|---|---|
| 10.0 | −2.281 | 16.7 | 0.129 |
| 12.0 | −2.422 | 18.1 | 0.144 |
| 14.0 | −2.414 | 19.8 | 0.150 |

### Interpretación

| Rango Z | Clasificación |
|---------|---------------|
| Z > +2 | Sobrepeso / obesidad |
| −2 ≤ Z ≤ +2 | Peso normal |
| Z < −2 | Bajo peso |

### Estado de implementación

Fórmula LMS y tablas verificadas contra la referencia OMS 2007. ✅

### Referencias

- **De Onis, M., Onyango, A.W., Borghi, E., Siyam, A., Nishida, C., & Siekmann, J. (2007).** Development of a WHO growth reference for school-aged children and adolescents. *Bulletin of the World Health Organization*, 85(9), 660–667. [doi:10.2471/BLT.07.043497](https://doi.org/10.2471/BLT.07.043497)

---

## 6. SITAR — Modelo longitudinal individual

**Estado:** ✅ Activo (selección explícita en Ajustes Madurativos — requiere ≥3 mediciones longitudinales ♂)  
**Aplicable a:** Masculino  
**Mínimo de mediciones:** 3, con un intervalo mínimo de 6 meses  
**Selección:** Manual — no se activa automáticamente

### Fundamento

SITAR (*SuperImposition by Translation And Rotation*) es un modelo de efectos mixtos no lineales que adapta una curva de crecimiento media de referencia a cada individuo estimando tres parámetros personales. Es el único método que incorpora la **historia de crecimiento longitudinal** del deportista.

El modelo fue propuesto por Cole et al. (2010) y validado para fútbol de élite por Monasterio et al. (2026) en jugadores de la academia del Athletic Club de Bilbao.

### Modelo matemático

```
h_i(t) = a_i + M( (t − b_i) × exp(c_i) )
```

| Parámetro | Símbolo | Interpretación |
|-----------|---------|----------------|
| Desplazamiento en tamaño | a | Diferencia (cm) respecto a la talla media de referencia |
| Desplazamiento en timing | b | Adelanto/retraso del PHV respecto a la media (años). Positivo = PHV más tardío |
| Escala de velocidad | c | Factor de velocidad. exp(c) > 1 = crecimiento más lento |

### Curva de referencia

La función M(t) se implementa como interpolación sobre una tabla calibrada para futbolistas masculinos de élite (Monasterio et al., 2026):

| Parámetro de referencia | Valor |
|------------------------|-------|
| APHV medio | 13.5 años |
| PHV medio | 10.1 cm/año |
| Talla adulta media | 179.5 cm |

### Outputs SITAR

```
APHV_SITAR = 13.5 + b
PHV_SITAR  = 10.1 × exp(−c)
PAH_SITAR  = 179.5 + a
```

### Optimización

El código usa un **grid search + hill climbing** para minimizar el MSE entre alturas observadas y predichas. Aunque menos preciso que REML (como usa el paquete R `sitar`), produce resultados aceptables con ≥3 mediciones bien distribuidas alrededor del PHV.

### Precisión según Monasterio et al. (2026)

- Con datos desde U11: clasifica correctamente el ~80% de jugadores en pre/circa/post-PHV
- Con solo datos U13–U15: error típico de ±0.6 años en APHV
- Superior a los métodos de offset (~50–70% de clasificación correcta) cuando hay datos longitudinales suficientes

### Estado de implementación

Modelo matemático verificado. Parámetros de referencia actualizados a valores de fútbol élite (Monasterio 2026). ✅

### Referencias

- **Cole, T.J., Donaldson, M.D.C., & Ben-Shlomo, Y. (2010).** SITAR — a useful instrument for growth curve analysis. *International Journal of Epidemiology*, 39(6), 1558–1566. [doi:10.1093/ije/dyq115](https://doi.org/10.1093/ije/dyq115)
- **Monasterio, X. et al. (2026).** Application of the SITAR model for estimating APHV, PHV, and adult height in elite male football players. *Science and Performance in Sport Research*, 287.

---

## 7. Motor de Consenso Ponderado

**Estado:** ✅ Activo (modo de visualización complementario)

### Principio

El consenso combina los outputs de múltiples métodos con pesos científicamente fundamentados para proporcionar una estimación robusta, reduciendo el impacto de los sesgos individuales de cada ecuación.

### Pesos predeterminados

```
Fransen / Mirwald(♀):   50%   — método especializado por sexo
Moore:                  30%   — versátil, baja multicolinealidad
Mirwald:                20%   — complementario

APHV_consenso = Σ(APHV_método × w_método) / Σ w_método
```

Cuando Fransen no está disponible (chicas), los pesos se renormalizan entre Mirwald(♀) (50%), Moore (30%) y Mirwald (20%).

> **Nota:** Los pesos asignados son decisiones de diseño de la app basadas en la literatura, no valores derivados de una validación cruzada propia. Representan el criterio científico del equipo sobre la calidad relativa de cada método por sexo.

---

## 8. Estrategias de Bio-banding

### 8.1 Basada en Offset Madurativo

Agrupa deportistas según su posición temporal respecto al PHV:

| Banda | Criterio | Significado biológico |
|-------|----------|-----------------------|
| **Pre-PHV** | Offset ≤ −1.0 años | Más de 1 año antes del pico. Pre-puberal / inicio puberal. |
| **Mid-PHV** | −1.0 < Offset < +1.0 años | Dentro del año previo/posterior al pico. Máximo crecimiento. |
| **Post-PHV** | Offset ≥ +1.0 años | Más de 1 año después del pico. Pubertad tardía / post-puberal. |

**Uso óptimo:** desarrollo físico y agrupamiento por carga de entrenamiento.  
**Limitación:** el offset no es independiente de la edad cronológica (r ≈ 0.92–0.97). En grupos con diferencias de edad > 2 años, parte del offset refleja simplemente la diferencia de edad.

### 8.2 Basada en % de Talla Adulta (PAH%)

Agrupa deportistas por el porcentaje de su talla adulta estimada ya alcanzado:

| Banda PAH | Criterio | Interpretación |
|-----------|----------|----------------|
| **≤ 85%** | PAH% < 85 | Muy lejos de la talla adulta. Crecimiento temprano. |
| **85–90%** | 85 ≤ PAH% < 90 | Inicio del período de aceleración puberal. |
| **90–95%** | 90 ≤ PAH% < 95 | Período peripuberal. Máxima variabilidad individual. |
| **≥ 95%** | PAH% ≥ 95 | Cercano a la talla adulta. Post-puberal tardío. |

**Uso óptimo:** estimación del potencial de crecimiento futuro y planificación de desarrollo a largo plazo.  
**Ventaja para chicas:** menos sesgado que el offset, especialmente en maduradores extremos.

---

## 9. Tabla Comparativa

| Aspecto | Fransen | Mirwald(♂/♀) | Moore | K-R (PAH) | SITAR |
|---------|---------|-------------|-------|-----------|-------|
| **Sexo** | Solo ♂ | ♂ y ♀ | ♂ y ♀ | ♂ y ♀ | Solo ♂ |
| **Edad óptima** | 8–18 | 8–16 | 8–18 | 4–17.5 | Sin límite (longitudinal) |
| **Variables mínimas** | AGE, H, BM, LL | AGE, H, SH, BM | AGE, SH (♂) / H (♀) | H, BM, talla parental | ≥3 mediciones H/edad |
| **Datos longitudinales** | No | No | No | No | **Sí (imprescindible)** |
| **Qué estima** | Offset / APHV | Offset / APHV | Offset / APHV | Talla adulta (PAH) | APHV, PHV, PAH |
| **Precisión en ♀** | N/A | Moderada | Moderada | Alta | N/A |
| **Complejidad fórmula** | Alta (polinomio 11 términos) | Media | Baja (1 término) | Media (tablas) | Muy alta (optimización) |
| **Población de validación** | Fútbol academia belga | Canada / UK | Canada / Poland | USA (Fels Study) | Fútbol élite español |

---

## 10. Consideraciones Prácticas

### Calidad de las mediciones

La precisión de todos los métodos depende directamente de la calidad de las mediciones:

- **Estatura:** medir en bipedestación sin calzado, con escala o estadiómetro calibrado. Reproducibilidad ±0.5 cm.
- **Altura sentado:** medir con el deportista en posición erguida sobre una superficie plana. Es la medida con mayor variabilidad inter-observador: errores de 0.5 cm producen ±0.2 años en el offset.
- **Peso:** medición reciente, mismas condiciones (ropa ligera, sin calzado, a la misma hora).
- **Tallas parentales:** preferiblemente medidas. Si son autoreportadas, indicarlo en la app para aplicar la corrección de overreporting correctamente.

### Frecuencia de medición recomendada

| Período | Frecuencia recomendada |
|---------|------------------------|
| Pre-PHV y Mid-PHV (offset > −1) | Cada 3–6 meses |
| Post-PHV tardío (offset > +2) | Cada 6–12 meses |
| Para disponibilidad SITAR | Mínimo 3 mediciones en ≥6 meses |

### Selección de motor

**Para chicos:**
1. **AUTO (recomendado):** Fransen → Moore-1 → Moore-2 (fallback sin SH) → Mirwald
2. Si ≥3 mediciones longitudinales: seleccionar **SITAR** manualmente en Ajustes Madurativos para mejor precisión en APHV

**Para chicas:**
1. **AUTO:** Mirwald (♀) → Moore → Mirwald
2. Dar mayor peso visual al **PAH%** (Khamis-Roche) que al offset, por mayor precisión en chicas

---

## 11. Limitaciones Generales y Avisos Clínicos

### Maduradores extremos ⚠️

> Todos los métodos de offset (Mirwald, Moore, Fransen) presentan errores de predicción significativamente mayores cuando el offset calculado es inferior a −3 años o superior a +3 años. En estos casos, el error típico puede multiplicarse por 2–6 (Koziel & Malina, 2018).

La app muestra un aviso cuando se entra en este rango. En esas situaciones, se recomienda:
- Priorizar el PAH% (Khamis-Roche) como indicador
- Interpretar el offset con precaución
- Buscar confirmación con SITAR si hay datos longitudinales disponibles

### Población de referencia

La mayoría de modelos fueron validados en poblaciones caucásicas norteamericanas o europeas. En poblaciones con distinto APHV medio (mediterráneas, africanas, asiáticas) los coeficientes pueden tener menor precisión. La app no aplica correcciones por origen étnico.

### Rango de edad

Los rangos publicados son 8–16 años (Mirwald), 8–18 años (Moore, Fransen) y 4–17.5 años (K-R). Los cálculos fuera de estos rangos se ejecutan, pero la app genera warnings automáticos.

### Correlación offset-edad cronológica

La correlación entre offset predicho y edad cronológica es muy alta (r ≈ 0.92–0.97). Esto significa que el offset no es completamente independiente de la edad. Al comparar jugadores con diferencias de edad > 2 años, parte del offset refleja la diferencia de edad, no solo la maduración biológica.

### Chicas vs. chicos

Las ecuaciones de offset tienen menor precisión general en chicas que en chicos. No existe una "ventana de validación" equivalente para el offset femenino. El PAH% es el indicador más fiable para población femenina.

---

## 12. Glosario

| Término | Definición |
|---------|-----------|
| **APHV** | Age at Peak Height Velocity. Edad en la que ocurre el máximo crecimiento en talla. |
| **PHV** | Peak Height Velocity. Velocidad máxima de crecimiento (cm/año). |
| **MO / Offset** | Maturity Offset. Diferencia (años) entre la edad cronológica actual y el APHV. Negativo = antes del pico; positivo = después. |
| **PAH** | Predicted Adult Height. Talla adulta estimada (cm). |
| **PAH%** | Percentage of Adult Height. Porcentaje de la talla adulta ya alcanzado: (H / PAH) × 100. |
| **MPS** | Mid-Parent Stature. Media de las tallas ajustadas del padre y la madre. |
| **SHR** | Sitting Height Ratio. Cociente altura sentado / talla total. Varía con la pubertad. |
| **LMS** | Parámetros de la transformación Box-Cox usados por la OMS: L (poder), M (mediana), S (coeficiente de variación). |
| **Bio-banding** | Agrupamiento de deportistas por madurez biológica en lugar de edad cronológica. |
| **SITAR** | SuperImposition by Translation And Rotation. Modelo de curva de crecimiento individual. |
| **Maturity Ratio** | Cociente CA / APHV. Si MR < 1, el PHV aún no ha ocurrido. |
| **Pre/Mid/Post-PHV** | Bandas de madurez: antes (offset < −1), durante (−1 a +1) y después (> +1) del pico. |

---

## 13. Referencias Bibliográficas

**Cole, T.J., Donaldson, M.D.C., & Ben-Shlomo, Y. (2010).** SITAR — a useful instrument for growth curve analysis. *International Journal of Epidemiology*, 39(6), 1558–1566. https://doi.org/10.1093/ije/dyq115

**De Onis, M., Onyango, A.W., Borghi, E., Siyam, A., Nishida, C., & Siekmann, J. (2007).** Development of a WHO growth reference for school-aged children and adolescents. *Bulletin of the World Health Organization*, 85(9), 660–667. https://doi.org/10.2471/BLT.07.043497

**Fransen, J., Bush, S., Woodcock, S., Novak, A., Deprez, D., Baxter-Jones, A.D.G., Vaeyens, R., & Lenoir, M. (2018).** Improving the Prediction of Maturity From Anthropometric Variables Using a Maturity Ratio. *Pediatric Exercise Science*, 30(2), 296–307. https://doi.org/10.1123/pes.2017-0009

**Khamis, H.J. & Roche, A.F. (1994).** Predicting adult stature without using skeletal age: The Khamis-Roche method. *Pediatrics*, 94(4), 504–507.

**Koziel, S.M. & Malina, R.M. (2018).** Modified Maturity Offset Prediction Equations: Validation in Independent Longitudinal Samples of Boys and Girls. *Sports Medicine*, 48(1), 221–236. https://doi.org/10.1007/s40279-017-0797-4

**Mirwald, R.L., Baxter-Jones, A.D.G., Bailey, D.A., & Beunen, G. (2002).** An assessment of maturity from anthropometric measurements. *Medicine & Science in Sports & Exercise*, 34(4), 689–694. https://doi.org/10.1097/00005768-200204000-00020

**Monasterio, X. et al. (2026).** Application of the SITAR model for estimating APHV, PHV, and adult height in elite male football players. *Science and Performance in Sport Research*, 287.

**Moore, S.A., McKay, H.A., Macdonald, H., Nettlefold, L., Baxter-Jones, A.D.G., Cameron, N., & Brasher, P.M.A. (2015).** Enhancing a somatic maturity prediction model. *Medicine & Science in Sports & Exercise*, 47(8), 1755–1764. https://doi.org/10.1249/MSS.0000000000000588

**Sherar, L.B., Mirwald, R.L., Baxter-Jones, A.D.G., & Thomis, M. (2005).** Prediction of adult height using maturity-based cumulative height velocity curves. *Journal of Pediatrics*, 147(4), 508–514. https://doi.org/10.1016/j.jpeds.2005.04.065

---

**Última actualización:** Mayo 2026  
**Versión:** 2.0  
**Autor:** Maduration Scientific Team