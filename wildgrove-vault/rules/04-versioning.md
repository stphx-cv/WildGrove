---
title: versioning
updated: 2026-10-04
status: current
---

# Cómo versionar este proyecto

Obligatorio para cualquier agente de IA. **Ninguna sesión que toque archivos termina sin dejar su versión escrita.** No se pide permiso para hacerlo: se hace y se avisa en una línea.

Una cosa distingue este changelog de la mayoría: **se escribe en palabras que se entienden sin abrir el código.** Nada de rutas de archivo en la descripción, nada de nombres de función, nada de jerga. Quien lea las versiones quiere saber qué cambió para él, no qué archivo se tocó.

## El número

```
p 1 . 0 . 0 . 0
│ │   │   │   └── Retoque     | un bug, un texto, un estilo. Nadie nota un cambio de comportamiento.
│ │   │   └────── Ajuste      | algo que ya existía se comporta distinto.
│ │   └────────── Función     | una capacidad nueva, o una que se retira.
│ └────────────── Estructura  | cambia la forma del proyecto: una app, un paquete, un servicio.
└──────────────── p = fase preview
```

**Para subir:** manda el nivel más alto que hayas tocado, y todo lo que queda a su derecha vuelve a 0.

| Lo que hiciste | De | A |
|---|---|---|
| Corregir un texto mal escrito en la carta | `p1.2.3.0` | `p1.2.3.1` |
| Que el buscador del menú ignore los acentos | `p1.2.3.0` | `p1.2.4.0` |
| Añadir reservas para grupos grandes | `p1.2.3.0` | `p1.3.0.0` |
| Decidir que el chatbot pasa a un servicio aparte | `p1.2.3.0` | `p2.0.0.0` |
| Ejecutar esa decisión y crear el servicio | `p2.0.0.0` | `p2.1.0.0` |

Si en la misma sesión hay cambios de varios niveles, **gana el más alto**. Añadir una función y de paso corregir un typo es `Función`, no `Retoque`.

Si dudas entre dos niveles, elige **el más alto**.

### `Estructura` se cobra al decidir, no al ejecutar

Las dos últimas filas de la tabla son el mismo trabajo en dos momentos, y solo la primera sube el primer dígito.

**Cuando se aprueba un plan, el salto de arquitectura ya está pagado.** La sesión que escribe y aprueba el plan es la que decide que el proyecto va a cambiar de forma. La sesión que después lo ejecuta crea archivos y funciones, y eso es `Función`, por muchos que sean.

Cobrarlo dos veces inflaría el número: el primer dígito dejaría de contar cuántas veces cambió la arquitectura y pasaría a contar cuántas sesiones se dedicaron a ella.

**Regla práctica:** antes de subir a `Estructura`, mira si ese mismo cambio ya se planificó en una versión anterior. Si ya se planificó, es `Función`.

## Cuando se acumulan cambios pequeños

Diez correcciones sueltas ya no son un retoque, son una sesión entera de trabajo, y el número debería decirlo.

**Regla:** cuenta las entradas del nivel que ganó. Si son **5 o más**, la versión sube un nivel.

**Dos límites, para que esto no se desmadre:**

1. **Se sube un solo nivel, nunca dos.** Veinte retoques son `Ajuste`, no `Función`.
2. **La acumulación nunca llega a `Estructura`.** Ese nivel se gana por lo que es el cambio, no por cuántos son.

## Las fases

El proyecto está en **`preview`**, y por eso el número empieza por `p`.

Vista previa no quiere decir que esté roto. El sitio funciona y está en uso. Quiere decir que hay partes terminadas y partes que todavía no lo están, y que la documentación lo dice en lugar de disimularlo.

Cuando el propietario decida que el proyecto sale de `preview` se crea `wildgrove-vault/versions/stable/`, el prefijo pasa a `v` y la numeración vuelve a empezar en `v1.0.0.0`. Las versiones `p` se quedan donde están, porque son el registro de cómo se llegó hasta ahí. **No se hace antes de que el propietario lo pida.**

## El repositorio es público

El historial de versiones empieza en `p1.0.0.0`, el commit con que se publicó el proyecto. Es un registro del que se fía quien lo lee, y por eso [Qué nunca hacer](03-never-do.md), punto 5, no tiene excepciones: una versión que ya está en GitHub no se reescribe, se corrige con la siguiente.

Publicar el repositorio no fue salir de `preview`. El prefijo sigue siendo `p`, y el salto a `v` lo decide el propietario aparte.

Los prefijos son `p` y `v`, y ningún otro.

### Qué se puede decir de lo que falta

Lo que está a medias en el producto se cuenta sin problema: una función preparada pero no activada, una sección pendiente, una integración a medio camino. Eso es estado del proyecto y a un lector le sirve.

Lo que **no** se escribe nunca es qué protecciones de seguridad faltan por poner. Ver [Qué nunca hacer](03-never-do.md), punto 2. La diferencia está en para qué le sirve al que lo lee: saber que falta una pasarela de pago no le da nada, saber qué defensa no está puesta sí.

## Dónde vive

```
wildgrove-vault/versions/
├── 00-versions-index.md            ← cómo funciona el sistema
└── preview/
    ├── 00-preview-index.md          ← la lista de versiones, de la más nueva a la más vieja
    └── p1.0.0.0/
        ├── 01-p1.0.0.0-changes.md  ← qué cambió, en simple
        └── 02-p1.0.0.0-commit.md   ← qué poner en el commit
```

**El número de la versión actual no se repite en el índice de versiones.** Vive en la portada (`README.md`) y arriba del todo en `00-preview-index.md`. Un número copiado en tres sitios se queda viejo en alguno.

## El protocolo

Al final de cualquier sesión que haya cambiado archivos:

**1. Busca la versión actual.** La carpeta más alta dentro de `wildgrove-vault/versions/preview/`. Compara los números como números, no como texto: `p1.10.0.0` es más alta que `p1.9.0.0`.

**2. Mira si ya se commiteó.** Abre su `02-*-commit.md` y lee el campo `commit:`.

- `commit: pending` | la versión está **abierta**. Añade tus cambios a esa misma carpeta.
- `commit: done` | la versión está **cerrada**. Crea la siguiente.

**3a. Si estaba abierta:** añade tus entradas y **recalcula el número desde cero**, contando todo lo acumulado en el archivo, no solo lo que añadiste. Si el número cambia, renombra la carpeta y sus dos archivos. La versión describe todo lo que va a entrar en un mismo commit.

**3b. Si estaba cerrada:** crea `wildgrove-vault/versions/preview/p{N}/` con sus dos archivos.

**4. Actualiza los dos sitios que llevan el número:** la línea del `README.md` y la primera fila de `00-preview-index.md`.

**5. Cierra la versión ANTES de commitear.** Cambia `commit: pending` por `commit: done`, y entonces `git add`.

Si commiteas con la versión todavía en `pending`, el repositorio guarda para siempre una versión que afirma no haber sido subida, y corregirlo cuesta un segundo commit que solo cambia una palabra.

## Los dos archivos de una versión

**`01-p{N}-changes.md`** | qué cambió, para una persona:

````markdown
---
title: p1.0.0.0-changes
updated: YYYY-MM-DD
status: current
---

# p1.0.0.0

Fecha: YYYY-MM-DD · Nivel: Estructura | Función | Ajuste | Retoque

## Qué cambió

### [etiqueta corta]
- Una línea por cosa, en palabras normales. Sin rutas de archivo.

## Por qué
Una o dos frases. Qué problema resuelve.
````

**`02-p{N}-commit.md`** | el mensaje exacto del commit, para que lo commiteado y lo documentado sean el mismo texto:

````markdown
---
title: p1.0.0.0-commit
updated: YYYY-MM-DD
status: current
commit: pending
---

# Commit de p1.0.0.0

## Título

```
p1.0.0.0
```

## Descripción

```
[+] Algo que se creó o se añadió
[=] Algo que ya existía y se modificó
[-] Algo que se quitó
```
````

| Etiqueta | Cuándo |
|---|---|
| `[+]` | Se creó o se añadió algo |
| `[=]` | Se modificó algo que ya existía |
| `[-]` | Se quitó algo |

Las líneas van en español, cortas, una por cambio. El título del commit es el número de versión y no cambia; la descripción es prosa y se escribe como el resto del texto. Ver [Reglas de trabajo](00-rules-index.md).
