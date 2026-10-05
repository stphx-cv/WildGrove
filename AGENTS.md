---
title: agents
updated: 2026-10-03
status: current
---

# Wild Grove | instrucciones para agentes

## Qué es este proyecto

Un restaurante ficticio construido entero como pieza de portafolio. Dos aplicaciones de Next.js sobre un monorepo, con lógica de negocio compartida.

```
WildGrove/
├── wildgrove-web/       la tienda pública, español e inglés
├── wildgrove-cms/       el panel de administración
├── packages/db/         esquema de Prisma, migraciones, cliente
├── packages/core/       toda la lógica de negocio
├── packages/ui/         componentes compartidos y tokens de diseño
├── wildgrove-vault/     documentación, reglas, planes, versiones y archivos de apoyo
└── scripts/             herramientas de diagnóstico
```

El mapa del almacén está en [`wildgrove-vault/00-wildgrove-vault-index.md`](wildgrove-vault/00-wildgrove-vault-index.md).

## Antes de empezar

**Lee [`wildgrove-vault/rules/00-rules-index.md`](wildgrove-vault/rules/00-rules-index.md) primero.** Es corto, gobierna todo lo que hay debajo, y es el único sitio donde viven las reglas de este repositorio.

| Regla | Qué cubre |
|---|---|
| [Cómo escribir aquí](wildgrove-vault/rules/01-how-to-write-here.md) | Formato, nombres, y cómo tiene que sonar el texto |
| [Convenciones de código](wildgrove-vault/rules/02-code-conventions.md) | **Las reglas que aplican a todo cambio** |
| [Qué nunca hacer](wildgrove-vault/rules/03-never-do.md) | Los límites innegociables |
| [Cómo versionar](wildgrove-vault/rules/04-versioning.md) | **Obligatorio al final de cada sesión** |
| [Git y GitHub](wildgrove-vault/rules/05-git-and-github.md) | Quién firma y quién sube los cambios |
| [Cómo se planifica un trabajo grande](wildgrove-vault/rules/06-plans.md) | Contexto, plan, aprobación, ejecución y reporte |

Este archivo **no repite** ninguna de esas reglas. Dos copias de una regla siempre acaban diciendo cosas distintas.

## Dónde está cada cosa

| Si trabajas en... | Lee |
|---|---|
| Entender el proyecto entero | [`wildgrove-vault/reference/01-architecture.md`](wildgrove-vault/reference/01-architecture.md) |
| Base de datos, modelos, relaciones | [`wildgrove-vault/reference/02-data-model.md`](wildgrove-vault/reference/02-data-model.md) |
| Qué hace el producto | [`wildgrove-vault/reference/03-features.md`](wildgrove-vault/reference/03-features.md) |
| Interfaz, colores, componentes | [`wildgrove-vault/reference/04-design-system.md`](wildgrove-vault/reference/04-design-system.md) |
| Endpoints y la superficie para agentes | [`wildgrove-vault/reference/05-api.md`](wildgrove-vault/reference/05-api.md) |
| Variables de entorno | [`wildgrove-vault/reference/06-environment.md`](wildgrove-vault/reference/06-environment.md) |
| Por qué algo está hecho así | [`wildgrove-vault/reference/07-decisions.md`](wildgrove-vault/reference/07-decisions.md) |
| Escribir o cambiar un texto de la tienda, un correo, un mensaje de Sage o la descripción de un plato | [`wildgrove-vault/reference/08-brand-voice.md`](wildgrove-vault/reference/08-brand-voice.md) |
| Un trabajo grande, pasado o planeado | [`wildgrove-vault/plans/00-plans-index.md`](wildgrove-vault/plans/00-plans-index.md) |
| Qué cambió y cuándo | [`wildgrove-vault/versions/00-versions-index.md`](wildgrove-vault/versions/00-versions-index.md) |

**Mira el campo `status:` antes de fiarte de un documento.** `current` significa que se verificó contra el código; `draft`, que no. Si un documento contradice al código, gana el código: corrige el documento en la misma sesión, o ponlo en `draft` y di por qué.

## Dos cosas que se olvidan

**El idioma.** La prosa se escribe en español, y eso incluye la descripción de los commits. En inglés van los nombres de archivos, las variables, las ramas y las etiquetas.

**La versión.** Ninguna sesión que toque archivos termina sin dejar su versión escrita. No se pide permiso: se hace y se avisa en una línea.
