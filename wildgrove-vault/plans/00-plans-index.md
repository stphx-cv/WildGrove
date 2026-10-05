---
title: plans-index
updated: 2026-10-04
status: current
---

# Planes

El expediente de cada trabajo grande: qué problema había, cómo se resolvió, y qué pasó de verdad al ejecutarlo.

El protocolo completo está en [Cómo se planifica un trabajo grande](../rules/06-plans.md).

## Estado

Todavía no hay ningún plan. El primero que se abra va en la primera fila.

| Plan | Escrito | Estado | De qué va |
|---|---|---|---|

## Cuándo se abre un plan

Cuando el trabajo sería de nivel `Estructura`, necesita una migración de base de datos, abarca varias sesiones, o tiene pasos que en desorden dejan la producción a medias.

No se abre un plan para arreglar un fallo o añadir una sección. Eso se hace y se versiona.

## Los planes no se borran

Un plan ejecutado se marca como hecho y se queda. Es el razonamiento detrás de una decisión. Lo que decide cada plan se resume además en [Por qué está hecho así](../reference/07-decisions.md), que es lo que se lee para entender el proyecto sin abrir los planes.
