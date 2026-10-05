---
title: versions-index
updated: 2026-09-20
status: current
---

# Versiones

El registro de cambios del proyecto. Cada versión cuenta qué cambió **en palabras simples**, sin rutas de archivo ni jerga.

**El número de la versión actual no se repite aquí.** Está en [la portada](../../README.md) y arriba del todo en [Vista previa](preview/00-preview-index.md), que son los dos sitios que el protocolo manda mantener al día. Un número copiado en tres sitios se queda viejo en alguno.

## Fases

- [Vista previa](preview/00-preview-index.md) | la fase actual. Prefijo `p`.

Cuando el proyecto salga de `preview` se creará `stable/` y el prefijo pasará a `v`.

## Cómo leer un número

```
p 1 . 0 . 0 . 0
│ │   │   │   └── Retoque     | un bug, un texto, un estilo
│ │   │   └────── Ajuste      | algo que ya existía se comporta distinto
│ │   └────────── Función     | una capacidad nueva, o una que se retira
│ └────────────── Estructura  | cambia la forma del proyecto
└──────────────── fase preview
```

Muchos cambios pequeños suman: a partir de 5 en el mismo nivel, la versión sube un nivel.

El protocolo completo está en [Cómo versionar este proyecto](../rules/04-versioning.md).
