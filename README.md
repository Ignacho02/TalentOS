# TalentOS

<div align="center">

<img width="350" height="350" alt="D3B48F37-82BB-4ECE-85D9-730BA35E82EE" src="https://github.com/user-attachments/assets/c34ac68a-cac7-4611-993a-5aaad7add322" />


[![Deploy with Vercel](https://vercel.com/button)](https://maturation-and-bio-banding-app.vercel.app/login)

</div>


![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-ready-3ecf8e?logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/status-active%20development-orange)
![Architecture](https://img.shields.io/badge/architecture-handoff%20ready-blueviolet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TalentOS es una web app para clubes y staffs de formacion que convierte mediciones antropometricas y datos de rendimiento en contexto util para la toma de decisiones. El foco del producto esta en maduracion biologica, bio-banding, analisis comparativo y una estructura de DataHub que pueda crecer hacia operaciones reales de club.

Este repositorio esta preparado explica que hace hoy la app, que partes estan realmente operativas y donde tocar segun el tipo de cambio.
Para acceder a la documentación detallada leer el documento [Enterprise Documentation](docs/Maduration-Enterprise-Documentation.md)

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

## Documentacion complementaria

- `docs/product-overview.md`
- `docs/roadmap.md`
- `docs/changelog-internal.md`
- `docs/engineering/README.md`
- `docs/engineering/changes/2026-05-20-form-validation-feedback.md` — validacion UX en DataHub (mayo 2026)
