---
title: how-to-write-here
updated: 2026-09-20
status: current
---

# Cómo escribir aquí

## La cabecera

Todo archivo `.md` de este repositorio empieza así, y después viene un `# Título` y el contenido:

```
---
title: <identificador>
updated: <YYYY-MM-DD>
status: draft | current
---
```

**`title` es el nombre del archivo sin el prefijo numérico y sin la extensión.** Va en inglés, no se inventa y no se traduce:

| Archivo | `title` |
|---|---|
| `00-rules-index.md` | `rules-index` |
| `wildgrove-vault/reference/02-data-model.md` | `data-model` |
| `06-plans.md` | `plans` |

**`status` dice si se puede confiar en el contenido:**

| Valor | Significa |
|---|---|
| `draft` | Tiene contenido, pero no se verificó contra el código |
| `current` | Se verificó contra el código y se puede actuar sobre él |

**Un documento en `draft` no es fuente de verdad.** Lee el código antes de fiarte, y promuévelo a `current` en la misma sesión en que lo verifiques.

Esta cabecera es la razón de tener la documentación ordenada. Sin ella no hay forma de saber si lo que estás leyendo describe el código de hoy o el de hace cuatro meses.

## `updated`

Ponle la fecha en que de verdad cambiaste el archivo. No la toques si solo lo leíste.

## Tamaño

- Un archivo, un tema. Nada de documentos que acumulan cosas sueltas.
- Si un archivo crece más de lo que se lee cómodamente de una sentada, divídelo y actualiza el índice de su carpeta.
- Prefiere listas y tablas antes que párrafos largos.

**Escribe para que lo lea una persona.** Este repositorio es público: quien llegue quiere entender cómo está hecho el proyecto, no descifrar notas internas. Si una frase no le sirve a un lector que acaba de llegar, sobra.

## Un párrafo, una línea

No se cortan las líneas a un ancho fijo. Cada párrafo va en una sola línea, por larga que sea, y el editor se encarga de doblarla en pantalla.

Markdown une las líneas seguidas en un mismo párrafo, así que cortar o no cortar se ve idéntico en GitHub. La diferencia está en el archivo en crudo: cortado a 100 caracteres parece que lleva saltos de línea sueltos por el medio, y cada edición obliga a recolocar el corte de todo lo que viene después.

Esto vale para párrafos, elementos de lista y celdas de tabla. Los bloques de código se dejan exactamente como están.

## Cómo tiene que sonar

Esta documentación la escriben agentes de IA, y los agentes tienen costumbres de escritura que se notan al leer. El texto queda correcto pero suena a máquina, y en un repositorio público eso resta.

La regla de fondo: **explica el mecanismo, no dejes la moraleja.** Si una frase no le da al lector algo que pueda usar, sobra.

### Lo que no se escribe

**Nada de rayas largas.** Ni `—` ni `–`. Usa una coma, un punto, un paréntesis o dos puntos, según lo que pida la frase. Es la marca más reconocible de un texto generado.

**No cierres los párrafos con una frase de efecto.** La costumbre es explicar algo y rematar con una sentencia corta y redonda. Termina cuando termines de explicar.

| Así no | Así sí |
|---|---|
| "Cada ruta fuera del guard es una puerta más, y la segunda nadie la revisa." | "Cada ruta que se deja fuera de esa comprobación hay que revisarla aparte, y con el tiempo alguna deja de revisarse." |

**No uses la construcción "no es X, es Y" para revelar algo.** Di directamente lo que es.

| Así no | Así sí |
|---|---|
| "Diez correcciones no son un retoque: son una sesión entera." | "Diez correcciones ya no son un retoque, son una sesión entera de trabajo." |

**Nada de metáforas decorativas.** "Son animales distintos", "no las llaves de la casa", "la puerta dura del sistema". Si la comparación no aclara nada que la explicación directa no aclare, quítala.

**No anuncies que vas a decir algo. Dilo.** Fuera "merece un aviso", "vale la pena señalar", "es importante destacar", "cabe mencionar".

**No des una orden cuando puedes dar la condición.** "No lo toques hasta que tengas un motivo" no le sirve a nadie. Di cuál es el motivo.

| Así no | Así sí |
|---|---|
| "No la toques hasta que tengas un motivo." | "Subirla tiene sentido cuando el panel va lento con varias personas dentro." |

**No agrupes de tres por ritmo.** Si hay dos cosas, escribe dos.

**Los inventarios van en cifras.** 30 tablas, 140 endpoints, 6 reglas. En letra solo cuando el número es parte de la frase y no una cuenta: "las dos aplicaciones", "los tres roles".

**No cuentes un pasado que el lector no vio.** Nada de "esto llegó después de encontrar", "antes esto no existía", "la versión anterior no lo tenía". Quien lee acaba de llegar y para él el proyecto es lo que hay hoy. Explica cómo funciona y por qué, no el camino hasta aquí.

La excepción es [Por qué está hecho así](../reference/07-decisions.md), que existe justo para contar decisiones y sus alternativas descartadas. Ahí el pasado es el contenido.

### Lo que sí

- Frases declarativas, en el orden en que pasan las cosas.
- El dato concreto antes que la valoración. "Tarda 70 segundos" antes que "es rápido".
- La segunda persona cuando le hablas al lector. "Si clonas el repositorio", no "el usuario que clone el repositorio".
- Una explicación puede ser seria sin ser solemne. Esto documenta un proyecto real, no es un ensayo.

### Cuando revises un documento

Léelo entero buscando estos patrones antes de darlo por terminado. Aparecen sobre todo al final de las secciones, que es donde da la tentación de rematar.

## Nombres de archivo

- Prefijo numérico de dos dígitos que fija el orden de lectura **dentro de su carpeta**: `01-`, `02-`.
- En inglés, en minúsculas, palabras separadas por guiones.
- **Todos los nombres de archivo son únicos en el repositorio**, aunque estén en carpetas distintas. Así puedes abrir cualquiera por su nombre sin conocer su ruta.

## Índices

Cada carpeta de documentación tiene su índice, `00-<carpeta>-index.md`, con una línea por archivo. El `00-` lo mantiene arriba del todo.

**Si creas o renombras un archivo, actualiza el índice de su carpeta en el mismo paso.**

## Cómo citar el código

Nombra el archivo por su ruta en el repositorio (`packages/core/orders/OrderService.ts`), nunca por una ruta absoluta del disco.

Cuando cites una función o una clase, di **qué garantiza**, no en qué línea está. Los números de línea envejecen más rápido que ninguna otra cosa.

## Fechas

Siempre absolutas: "agosto de 2026", nunca "el mes pasado" ni "hace poco". Un documento se lee meses después de escribirse.

## Cuando cambias un archivo

Actualiza su `updated` a la fecha de hoy y revisa su `status`. Si cambiaste el código que el documento describe pero no el documento, ese documento ya está en `draft` como mucho.
