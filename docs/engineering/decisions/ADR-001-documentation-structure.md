# ADR-001: Documentation Structure for Technical Context

## Estado

Aprobado

## Problema

El proyecto ya tenia documentacion de producto y handoff, pero no una zona clara para guardar contexto tecnico generado durante cambios reales. Sin una estructura estable, el razonamiento detras de refactors, decisiones y limpiezas tiende a perderse o a quedarse disperso en conversaciones.

## Opciones consideradas

1. Guardar toda la documentacion tecnica en archivos sueltos dentro de `docs/`.
2. Usar una unica carpeta de notas internas sin separar tipos de contenido.
3. Crear una zona dedicada `docs/engineering/` con subcarpetas por funcion.

## Decision

Se adopta `docs/engineering/` como espacio estable para documentacion tecnica viva, separada de la documentacion de producto.

La estructura elegida es:

- `changes/`
- `decisions/`
- `reasoning/`
- `refactors/`

con un `README.md` en la raiz de `docs/engineering/` que explique reglas, naming y criterios de uso.

## Consecuencias

### Positivas

- El contexto tecnico deja de depender de memoria o chat history.
- Se separa claramente documentacion de producto vs documentacion de ingenieria.
- Cada cambio futuro tiene un destino obvio segun su naturaleza.

### Costes

- Requiere disciplina minima para mantener la carpeta al dia.
- Puede generar duplicacion si no se sigue bien la regla de que cada documento tenga una funcion clara.

## Notas

Esta estructura esta pensada para uso interno y continuidad del proyecto. No pretende ser un sistema documental pesado ni introducir tooling adicional.
