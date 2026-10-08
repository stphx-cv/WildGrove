---
title: reference-index
updated: 2026-10-08
status: current
---

# Referencia

Cómo está hecho Wild Grove. Nueve documentos, pensados para leerse en este orden si es la primera vez.

| | Documento | De qué va |
|---|---|---|
| 01 | [Arquitectura](01-architecture.md) | Las dos aplicaciones, los paquetes compartidos, cómo se renderiza una página y cómo se guarda un cambio |
| 02 | [Modelo de datos](02-data-model.md) | Las 30 tablas y las decisiones que les dan forma |
| 03 | [Qué hace el producto](03-features.md) | El recorrido por todo lo que se puede hacer, de cara al cliente y de cara al personal |
| 04 | [Sistema de diseño](04-design-system.md) | La paleta, la tipografía y las reglas visuales |
| 05 | [La API](05-api.md) | Las tres superficies, y la pública para agentes con detalle |
| 06 | [Variables de entorno](06-environment.md) | Qué configurar y de dónde sacar cada credencial |
| 07 | [Por qué está hecho así](07-decisions.md) | Las decisiones importantes, con la alternativa que se descartó |
| 08 | [La voz de Wild Grove](08-brand-voice.md) | Cómo suena el texto de la tienda, los correos y Sage: trato, vocabulario, mayúsculas y lo que no se escribe |
| 09 | [Cómo verificar un cambio en local](09-local-verification.md) | Técnicas para comprobar un cambio contra la pila local sin tocar producción: sesiones, correo, límites, navegador e imágenes de Docker |

## Si solo vas a leer uno

**Para entender el proyecto:** [Arquitectura](01-architecture.md).

**Para levantarlo en tu máquina:** [Variables de entorno](06-environment.md).

**Para saber si merece la pena mirarlo:** [Por qué está hecho así](07-decisions.md).

## Lo que no está aquí

Las instrucciones para trabajar dentro del repositorio están en [`rules/`](../rules/00-rules-index.md). Son las reglas que sigue cualquiera que toque el código, persona o agente de IA.

Tampoco hay nada sobre dónde está alojado el proyecto. Eso no hace falta para entender la arquitectura y no se publica. Ver [Qué nunca hacer](../rules/03-never-do.md), punto 2.
