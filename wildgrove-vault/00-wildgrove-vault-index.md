---
title: wildgrove-vault-index
updated: 2026-10-04
status: current
---

# Wild Grove Vault

El almacén del proyecto: documentación, reglas, planes, versiones, e imágenes o archivos de apoyo. No es un paquete. No entra en los workspaces.

| Carpeta | Qué contiene |
|---|---|
| [reference/](reference/00-reference-index.md) | Cómo está hecho el proyecto |
| [rules/](rules/00-rules-index.md) | Cómo se trabaja aquí |
| [plans/](plans/00-plans-index.md) | El expediente de cada trabajo grande |
| [versions/](versions/00-versions-index.md) | El registro de cambios |
| [assets/](assets/00-assets-index.md) | Imágenes y binarios de apoyo |
| `private/` | Lo que no se sube nunca. Git la ignora y solo existe en la copia de trabajo del propietario. Ver [Cómo se planifica un trabajo grande](rules/06-plans.md#qué-nunca-entra-en-un-plan) |

Los cuatro tipos de conocimiento siguen siendo tipos. Un plan no se escribe en `reference/`. Una regla no se escribe fuera de `rules/`.

Los binarios van a `assets/`, no sueltos en esta carpeta. Secretos, credenciales y detalle privado de infraestructura no entran en nada de lo que se sube, porque el repositorio es público. Ver [Qué nunca hacer](rules/03-never-do.md), puntos 1 y 2.

Los punteros de la raíz (`README.md`, `AGENTS.md`, `CLAUDE.md`) no se mueven. Las herramientas los buscan allí.
