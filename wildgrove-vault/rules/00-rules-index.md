---
title: rules-index
updated: 2026-10-08
status: current
---

# Reglas de trabajo

Instrucciones para cualquier agente de IA que trabaje en este repositorio, y para cualquier persona que quiera contribuir. Léelas antes de escribir o modificar nada.

- [Cómo escribir aquí](01-how-to-write-here.md) | formato de los documentos, cómo tiene que sonar el texto, nombres e índices.
- [Convenciones de código](02-code-conventions.md) | las reglas que aplican a todo cambio de código.
- [Qué nunca hacer](03-never-do.md) | los límites innegociables.
- [Cómo versionar este proyecto](04-versioning.md) | dejar escrito cada cambio antes de cada commit.
- [Git y GitHub](05-git-and-github.md) | la rama, quién firma y quién sube los cambios.
- [Cómo se planifica un trabajo grande](06-plans.md) | contexto, plan, ejecución y reporte.
- [La memoria de los agentes](07-agent-memory.md) | dónde se guarda lo que un agente aprende: dentro del proyecto.

## Esta carpeta es el único sitio donde viven las reglas

**Todas las reglas del proyecto están aquí.** No hay un segundo juego en ningún otro sitio.

Cada herramienta insiste en tener su propio punto de entrada, y esos archivos existen solo para mandarte aquí. No contienen ninguna regla propia y nunca debe añadirse una:

| Archivo | Lo lee | Qué es |
|---|---|---|
| `AGENTS.md` | Codex y la mayoría de agentes | La forma del proyecto y dónde está cada documento. Apunta aquí |
| `CLAUDE.md` | Claude Code | Una línea: lee las reglas |

**Si vas a escribir una regla dentro de uno de esos archivos, para.** Escríbela aquí y deja el puntero como está. Cuando la misma regla existe en dos sitios, tarde o temprano se edita solo una, y entonces ya no sabes cuál de las dos vale.

## Idioma

**La prosa se escribe en español. Los identificadores se escriben en inglés.**

Identificador es todo lo que una máquina lee: nombres de carpetas y de archivos, claves y valores de la cabecera, variables, funciones, ramas y etiquetas.

**El mensaje de un commit no es un identificador.** Su título sí, porque es el número de versión, pero la descripción es prosa que lee una persona, así que va en español como el resto del texto.

| Esto | Así |
|---|---|
| Nombre de archivo | `02-data-model.md`, nunca `02-modelo-de-datos.md` |
| Cabecera del documento | `title: data-model`, nunca `title: modelo-de-datos` |
| El `# Título` de dentro | `# Modelo de datos`, en español |
| El texto | En español |
| Código, variables, funciones | En inglés |
| Título del commit | El número de versión, `p1.2.0.0` |
| Descripción del commit | En español |

La razón es que el código y el producto son en inglés, y un nombre de archivo traducido a medias obliga a adivinar en qué idioma se guardó cada cosa.
