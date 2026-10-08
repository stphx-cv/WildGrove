---
title: agent-memory
updated: 2026-10-08
status: current
---

# La memoria de los agentes

Cualquier agente de IA que trabaje en este repositorio guarda lo que aprende dentro de la carpeta del proyecto. Ninguna memoria vive fuera de ella.

## Qué significa

- **No se guarda nada en la memoria propia de la herramienta.** Eso incluye las carpetas de memoria que Claude Code mantiene bajo el directorio personal de la persona y las memorias globales de otros asistentes. Lo que una herramienta escribe ahí solo lo lee esa herramienta, en esa máquina, y ningún otro agente llega a verlo.
- **Lo que merece recordarse se escribe en el proyecto, en el sitio que le toca.** Una regla va en `wildgrove-vault/rules/`. Cómo está hecho algo va en `wildgrove-vault/reference/`. Una decisión y la alternativa que se descartó van en [Por qué está hecho así](../reference/07-decisions.md). Un trabajo grande va en `wildgrove-vault/plans/`.
- **Lo que no puede subirse a GitHub va en `wildgrove-vault/private/`.** Es lo que nombra el servidor o una protección que falta, según el punto 2 de [Qué nunca hacer](03-never-do.md). La carpeta está dentro del proyecto, Git la ignora y se indexa en su `00-private-index.md`.
- **Nada personal ni privado en ninguna memoria.** Ni datos personales de quien trabaja con el proyecto, ni direcciones, ni identificadores de cuentas, ni claves. Las credenciales siguen en el gestor de contraseñas del propietario, también fuera de `private/`.

## Si una herramienta crea memoria por su cuenta

Pasa lo que sirva a su sitio en el proyecto y borra la copia local. Antes de borrarla, comprueba que cada dato quedó escrito o que ya no vale.

## Por qué

Una memoria local no se revisa, no viaja con el repositorio y se pierde al cambiar de máquina o de herramienta. El proyecto ya tiene un sitio para cada tipo de conocimiento, y mantenerlo todo ahí hace que otro agente, o una persona, parta de lo mismo.
