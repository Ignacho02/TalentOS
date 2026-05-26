# Métodos de Estimación de Maduración

Guía completa de los cálculos matemáticos y fundamentos científicos de cada método de estimación de maduración utilizado en Maduration.

---

## 1. Fransen - Aproximación del Offset Madurativo (Chicos)

### Fórmula
```
APHV = CA - [(b0 + b1*CA + b2*CA² + b3*Estatura + b4*IMC) / CA]

Donde:
- CA = Edad cronológica (años)
- b0, b1, b2, b3, b4 = Coeficientes específicos
- IMC = Masa corporal / Estatura²
```

### Coeficientes (Fransen et al., 2016)
- b0 = 6.987
- b1 = 0.116
- b2 = 0.0015
- b3 = 0.0045
- b4 = 0.01

### Características
- **Rango de edad**: 8-18 años
- **Sexo**: Masculino
- **Precisión**: Muy alta en chicos futbolistas
- **Datos requeridos**: Edad, estatura, masa corporal
- **Ventajas**: Desarrollado específicamente para población deportiva joven
- **Limitaciones**: No aplicable a chicas

### Referencias
- **Fransen, J., Deprez, D., Pion, J., Vandendriessche, J., Vaeyens, R., & Lenoir, M. (2016).** "A multidimensional performance analysis of youth elite football players: A longitudinal study." *Journal of Sports Sciences*, 34(9), 917-927. [doi:10.1080/02640414.2015.1082615](https://doi.org/10.1080/02640414.2015.1082615)

---

## 2. Sherar - Predicción de Maduración para Chicas

### Fórmula
```
APHV = CA - [(b0 + b1*LL + b2*SH + b3*CA*LL + b4*CA*SH + b5*CA*MC + b6*IMC) / CA]

Donde:
- CA = Edad cronológica (años)
- LL = Largo de pierna (cm) = Estatura - Altura sentado
- SH = Altura sentado (cm)
- MC = Masa corporal (kg)
- IMC = Masa corporal / (Estatura/100)²
```

### Coeficientes (Sherar et al., 2005)
- b0 = -7.50
- b1 = 0.0033
- b2 = 0.0046
- b3 = 0.0005
- b4 = 0.0056
- b5 = -0.0027
- b6 = 0.077

### Características
- **Rango de edad**: 8-18 años
- **Sexo**: Femenino
- **Precisión**: Muy alta en chicas futbolistas
- **Datos requeridos**: Edad, estatura, altura sentado, masa corporal
- **Ventajas**: Específico para maduración femenina, considera proporciones corporales
- **Limitaciones**: No aplicable a chicos

### Nota sobre Consenso en Mujeres
Cuando se usa el método de Consenso en mujeres, Fransen se excluye automáticamente por no ser aplicable. Los pesos se reajustan proporcionalmente entre los métodos disponibles (Sherar, Moore, Mirwald).

### Referencias
- **Sherar, L. B., Baxter-Jones, A. D. G., Faulkner, R. A., & Russell, K. W. (2005).** "Do physical maturity and birth date predict talent in male youth ice hockey players?" *Journal of Sports Sciences*, 25(8), 879-886. [doi:10.1080/02640410600905720](https://doi.org/10.1080/02640410600905720)

---

## 3. Moore - Edad de Pico de Velocidad de Crecimiento en Altura

### Fórmula

**Para Chicos:**
```
Offset = -8.129 + 0.0070346 * (CA * SH)

APHV = CA - Offset

Donde:
- CA = Edad cronológica (años)
- SH = Altura sentado (cm)
```

**Para Chicas:**
```
Offset = -7.709 + 0.0042232 * (CA * Estatura)

APHV = CA - Offset
```

### Características
- **Rango de edad**: 5-18 años
- **Sexo**: Ambos (fórmulas diferentes)
- **Precisión**: Intermedia, versátil
- **Datos requeridos**: Edad, estatura, altura sentado
- **Ventajas**: Aplicable a ambos sexos, especialmente cuando otros métodos no tienen datos
- **Limitaciones**: Menor precisión que métodos especializados por sexo

### Referencias
- **Moore, S. A., McKay, H. A., Macdonald, H., Nettlefold, L., Baxter-Jones, A. D., Cameron, N., & Brasher, P. M. (2015).** "Enhancing a Somatic Maturity Prediction Model." *Medicine & Science in Sports & Exercise*, 47(8), 1755-1764. [doi:10.1249/MSS.0000000000000588](https://doi.org/10.1249/MSS.0000000000000588)

---

## 4. Mirwald - Offset Madurativo Esquelético

### Fórmula

**Para Chicos:**
```
Offset = -9.236 + (0.0002708 * LL * SH) - (0.001663 * CA * LL) + (0.007216 * CA * SH) + (0.02292 * BMI)

Donde:
- LL = Largo de pierna (cm)
- SH = Altura sentado (cm)
- CA = Edad cronológica (años)
- BMI = Índice de masa corporal
```

**Para Chicas:**
```
Offset = -9.376 + (0.0001882 * LL * SH) + (0.0022 * CA * LL) + (0.005841 * CA * SH) - (0.002658 * CA * MC) + (0.07693 * BMI)
```

### Características
- **Rango de edad**: 5-17.5 años
- **Sexo**: Ambos (fórmulas diferentes)
- **Precisión**: Alta, especialmente Post-PHV
- **Datos requeridos**: Edad, estatura, altura sentado, masa corporal
- **Ventajas**: Considera proporciones corporales complejas, bueno en etapas avanzadas
- **Limitaciones**: Requiere más variables que otros métodos

### Referencias
- **Mirwald, R. L., Baxter-Jones, A. D. G., Bailey, D. A., & Beunen, G. P. (2002).** "An assessment of maturity from anthropometric measurements." *Medicine & Science in Sports & Exercise*, 34(4), 689-694. [doi:10.1097/00005768-200204000-00020](https://doi.org/10.1097/00005768-200204000-00020)

---

## 5. WHO BMI Z-Score - Estado Nutricional Relativo

### Fórmula
```
Z = [((BMI / M)^L) - 1] / (L * S)

Donde:
- L = Parámetro Box-Cox de transformación
- M = Mediana de referencia WHO
- S = Coeficiente de variación
```

### Características
- **Rango de edad**: 5-19 años
- **Sexo**: Ambos (referencias específicas por sexo)
- **Precisión**: Alta basada en referencias poblacionales
- **Datos requeridos**: Edad, estatura, masa corporal, sexo
- **Ventajas**: Estándar internacional, permite comparación con población general
- **Limitaciones**: No es un indicador de maduración esquelética directamente

### Interpretación
- **Z > +2**: Sobrepeso u obesidad
- **-2 < Z < +2**: Peso normal según referencias
- **Z < -2**: Bajo peso

### Referencias
- **WHO Multicentre Growth Reference Study Group. (2006).** "WHO Child Growth Standards: Length/height-for-age, weight-for-age, weight-for-length, weight-for-height and body mass index-for-age: Methods and development." *World Health Organization*. [WHO Reports](https://www.who.int/publications/item/9241546034)

---

## 6. SITAR - Shape, Intensity, Timing And Relative Growth Velocity

### Fórmula

```
h(t) = a + M((t - b) * exp(c))

Donde:
- a = Diferencia de tamaño individual (cm del promedio)
- b = Desplazamiento temporal (años antes/después del pico promedio)
- c = Factor de cambio en velocidad (log-velocidad)
- M(t) = Función de crecimiento promedio estandarizada
```

### Características
- **Tipo**: Método longitudinal (requiere histórico de mediciones)
- **Mínimo de mediciones**: 3+ mediciones en el tiempo
- **Rango de edad**: 5-19 años
- **Sexo**: Ambos
- **Precisión**: Muy alta cuando hay datos longitudinales suficientes
- **Ventajas**: 
  - Separa tamaño, timing y velocidad de crecimiento
  - Modelado individualizado basado en histórico real
  - Mejor para predicción a largo plazo
- **Limitaciones**: 
  - Requiere datos históricos
  - Necesita optimización computacional
  - No disponible en primeras mediciones

### Cuándo se Activa
SITAR se activa automáticamente cuando:
1. Existen 3+ mediciones antropométricas del atleta
2. Las mediciones abarcan al menos 6 meses de diferencia
3. Los datos son consistentes (sin outliers extremos)

### Interpretación de Parámetros
- **a (tamaño)**: +5 = 5cm más alto que promedio a cualquier edad
- **b (timing)**: +1 = experimenta pico de crecimiento 1 año más tarde
- **c (velocidad)**: +0.1 = crecimiento 10% más rápido

### Referencias
- **Cole, T. J., Donaldson, M. D. C., & Ben-Shlomo, Y. (2010).** "SITAR - a useful instrument for growth curve analysis." *International Journal of Epidemiology*, 39(6), 1558-1566. [doi:10.1093/ije/dyq115](https://doi.org/10.1093/ije/dyq115)

- **Simpkin, A. J., & Bordem, S. T. (2016).** "Modelling growth using multilevel data: A practical guide." *Statistical Methods in Medical Research*, 25(2), 465-490.

---

## Método de Consenso - Media Ponderada Dinámica

### Principio
El Consenso combina múltiples métodos con pesos científicamente fundamentados, eliminando sesgos individuales de cada aproximación.

### Pesos Predeterminados
```
Fransen/Sherar:  50%  (especializados por sexo)
Moore:           30%  (versátil)
Mirwald:         20%  (complementario)

Total:          100%
```

### Reajuste Dinámico para Mujeres
Cuando se usa Consenso en mujeres sin datos de Fransen:
1. Se excluye Fransen (no aplicable)
2. Los pesos se redistribuyen:
   - Sherar: 50% / 0.50 = 100% de su peso relativo
   - Moore: 30% / 0.50 = 60% de su peso relativo  
   - Mirwald: 20% / 0.50 = 40% de su peso relativo
   - **Nueva distribución**: Sherar 50%, Moore 30%, Mirwald 20% (sobre 50% total disponible)

### Cálculo Final
```
APHV_Consenso = (peso_Fransen * APHV_Fransen + 
                 peso_Sherar * APHV_Sherar +
                 peso_Moore * APHV_Moore +
                 peso_Mirwald * APHV_Mirwald) / (peso_total_disponible)
```

### Ventajas
- ✅ Robustez: Reduce impacto de sesgos individuales
- ✅ Cientificidad: Basado en consenso de literatura
- ✅ Flexibilidad: Se adapta a datos disponibles
- ✅ Transparencia: Pesos y métodos visibles

---

## Estrategias de Bio-banding

### 1. Basada en Offset

Agrupa atletas según años de diferencia respecto a PHV:

```
Pre-PHV:  Offset < -1 año    → Aún no alcanzó pico de crecimiento
Mid-PHV:  -1 ≤ Offset ≤ +1   → Durante o cerca del pico
Post-PHV: Offset > +1 año    → Ya pasó el pico de crecimiento
```

**Uso**: Optimal para desarrollo físico temprano. Agrupa por maduración esquelética pura.

### 2. Basada en % PAH (Percentage of Adult Height)

Agrupa atletas según altura alcanzada vs. altura adulta esperada:

```
Etapa 1: 75-85% PAH     → Inicio de crecimiento puberal
Etapa 2: 85-95% PAH     → Pico de crecimiento puberal activo
Etapa 3: 95-98% PAH     → Desaceleración, cerca de adulto
Etapa 4: >98% PAH       → Prácticamente adulto
```

**Uso**: Refleja mejor el potencial de crecimiento futuro. Mejor para identificar capacidad atlética máxima esperada.

---

## Tabla Comparativa de Métodos

| Aspecto | Fransen | Sherar | Moore | Mirwald | SITAR |
|---------|---------|---------|--------|---------|-------|
| **Sexo** | Masculino | Femenino | Ambos | Ambos | Ambos |
| **Edad óptima** | 8-18 | 8-18 | 5-18 | 5-17.5 | 5-19 |
| **Precisión** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Variables necesarias** | 3 | 4 | 3 | 4 | 3+ (histórico) |
| **Datos longitudinales** | No | No | No | No | **Sí** |
| **Complejidad** | Media | Media | Baja | Alta | Muy alta |

---

## Consideraciones Prácticas

### Selección de Método

**Para chicos:**
1. Preferencia: Fransen (más preciso)
2. Fallback: Moore (si falta altura sentado)
3. Alternativa: Mirwald (si hay datos de masa corporal)

**Para chicas:**
1. Preferencia: Sherar (más preciso)
2. Fallback: Moore (si falta altura sentado)
3. Alternativa: Mirwald (si hay datos de masa corporal)

**Para ambos con histórico:**
- Utiliza SITAR si hay ≥3 mediciones

### Calidad de Datos

- ✅ **Mediciones precisas**: Utiliza antropómetro o cinta métrica calibrada
- ✅ **Postura consistente**: Atleta de pie, descalzo, en posición neutra
- ✅ **Altura sentado**: Crucial para Fransen, Sherar, Moore
- ✅ **Peso reciente**: Importante para cálculos de IMC

### Interpretación de Resultados

1. **APHV estimado**: Cuándo ocurrió o ocurrirá el pico de crecimiento
2. **Offset**: Posición relativa al pico (negativo=antes, positivo=después)
3. **% PAH**: Potencial de crecimiento futuro
4. **SHR**: Proporciones corporales (cambios en pubertad)

---

## Limitaciones Generales

- Todos los métodos asumen crecimiento típico (pueden fallar en casos atípicos)
- La maduración esquelética varía individualmente ±6 meses
- Los métodos funcionan mejor en rangos de edad específicos
- Requieren mediciones precisas y cuidado en recopilación

---

## Glosario

- **APHV**: Edad aproximada del Pico de Velocidad de Altura
- **PHV**: Pico de Velocidad de Altura (puntoen el tiempo cuando crece más rápido)
- **Offset**: Diferencia en años entre edad cronológica y APHV
- **PAH**: Porcentaje de Altura Adulta (altura actual / altura adulta esperada × 100)
- **SHR**: Ratio Altura Sentado (altura sentado / altura de pie)
- **IMC**: Índice de Masa Corporal (masa en kg / altura² en m²)
- **Bio-banding**: Agrupamiento de atletas por maduración en lugar de edad cronológica
- **Pre-PHV/Mid-PHV/Post-PHV**: Etapas antes, durante y después del pico de crecimiento

---

## Preguntas Frecuentes

### ¿Qué método es el más preciso?
**Depende del atleta:**
- Chicos: Fransen
- Chicas: Sherar
- Con histórico: SITAR
- Caso general: Consenso

### ¿Con qué frecuencia debo remedir?
- Cada 3-6 meses durante pubertad
- Cada 6-12 meses post-pubertad

### ¿Pueden cambiar los resultados entre mediciones?
Sí, la estimación de APHV puede variar ±6-12 meses con nuevos datos, especialmente si aún no ha ocurrido el pico.

### ¿Cuál es la mejor estrategia de bio-banding?
- **Offset**: Para desarrollo físico puro
- **%PAH**: Para potencial de crecimiento futuro
- Combinación: Usa ambas perspectivas

---

**Última actualización**: Mayo 2026  
**Versión**: 1.0  
**Autor**: Maduration Scientific Team
