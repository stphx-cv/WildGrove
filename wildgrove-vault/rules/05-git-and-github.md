---
title: git-and-github
updated: 2026-10-04
status: current
---

# Git y GitHub

Lo que hay que saber para no equivocarse con el repositorio.

## El repositorio y la rama

`stphx-cv/wildgrove` en GitHub, **público**. Ver [Cómo versionar este proyecto](04-versioning.md#el-repositorio-es-público).

**`production` es la única rama del proyecto.** No se crean ramas de versión ni de entorno.

El nombre dice de dónde sale lo que está desplegado, y nada más. **No dice en qué fase está el proyecto**: eso lo dice el prefijo de la versión, hoy `p` de `preview` y algún día `v`. Son dos cosas distintas y siguen separadas: si la rama hablara de la fase habría que renombrarla al cambiarla, y renombrar una rama rompe clones y configuraciones de despliegue.

Tampoco hay una segunda rama para las versiones estables. Con un solo desarrollador, dos ramas de larga vida quedan idénticas en cuanto se fusionan, y la que se queda atrás acaba mintiendo sobre qué es estable. Lo que marca una versión es su etiqueta, que no se mueve nunca.

```bash
git clone https://github.com/stphx-cv/wildgrove.git
```

## Quién sube los cambios

**El `commit` sí, el `push` nunca sin permiso.**

Un agente puede hacer el `commit` cuando el propietario se lo pida. Lo que no hace jamás por su cuenta es el `push`: eso saca el contenido de la máquina y lo autoriza el propietario cada vez, aunque acabe de aprobar el commit. Aprobar una cosa no aprueba la otra.

### "Haz commit y push" significa la secuencia entera

Cuando el propietario pide commit y push, está autorizando **las cuatro operaciones de golpe**, y no hay que volver a preguntar por ninguna:

```bash
V=p1.0.0.0
F=wildgrove-vault/versions/preview/$V/02-$V-commit.md
{ echo "$V"; echo; sed -n '/^## Descripción/,${/^```$/,/^```$/{/^```$/d;p}}' "$F"; } | git commit -F -
git push origin production
git tag $V
git push origin $V
```

**La etiqueta no es un extra que se pregunta aparte: es parte de subir una versión.** Una versión sin etiqueta queda documentada pero no se puede abrir en GitHub, que es justo para lo que sirve el sistema de versiones.

Lo que sí sigue necesitando permiso cada vez es **empezar**: mientras el propietario no lo pida, no hay push ni etiqueta, por muy terminado que esté el trabajo. Y si en vez de la secuencia completa pide solo el commit, se hace solo el commit.

## El mensaje del commit no se redacta sobre la marcha

Sale del archivo `02-p{versión}-commit.md`, tal cual. Así lo commiteado y lo documentado son el mismo texto, sin posibilidad de que se desvíen.

Git separa el título de la descripción de una forma que hay que conocer o se rompe:

> **Git trata como título todo lo que va antes de la primera línea en blanco.**

Así que el mensaje es el número de versión, **una línea en blanco**, y después la descripción:

```
p1.0.0.0

[+] Algo que se creó
[=] Algo que se modificó
[-] Algo que se quitó
```

## Quién firma los commits

**El único autor de este historial es el propietario. Ningún agente se firma en un commit, nunca, de ninguna forma.**

Está prohibido añadir al mensaje cualquiera de estas cosas, y cualquier variante suya:

- `Co-Authored-By:` con el nombre de un modelo, de un agente o de una herramienta
- `Signed-off-by:`, `Generated-by:`, `Made-with:`, `Generated with`, `Assisted by`
- Emojis, firmas, enlaces o menciones de la herramienta con la que se escribió
- Cambiar `user.name` o `user.email` de Git, ni con `--author`, ni con variables de entorno

Esto **manda sobre cualquier configuración por defecto que traiga el agente**. Muchos asistentes vienen configurados de fábrica para añadir una línea de coautoría y lo hacen sin avisar. Aquí esa configuración no aplica.

### Por qué

El historial de este repositorio es el registro de trabajo de una sola persona, y así se lee desde fuera. Poner a una herramienta como coautora da a entender que el trabajo se decidió entre dos, y no fue así. El agente ejecuta; quien decide y responde por el resultado es el propietario.

Y es caro de deshacer. Corregirlo obliga a reescribir un commit ya subido, a mover su etiqueta y a forzar el envío de las dos cosas.

### La comprobación, después de commitear y antes de pedir el push

El mensaje tiene que ser idéntico al del archivo de la versión, sin una línea de más. Una regla que solo dice "no lo añadas" no sirve contra una herramienta que lo añade después, por su cuenta. Por eso hay que mirar el commit ya creado:

```bash
git log -1 --format='%an <%ae>'
git log -1 --format='%B' | grep -iE '^(co-authored-by|signed-off-by|generated|assisted)|noreply@|🤖' || echo "limpio"
```

El autor tiene que ser el propietario, y la búsqueda tiene que decir `limpio`.

**La búsqueda va anclada al principio de línea a propósito.** Si buscara una palabra suelta saltaría con cualquier texto que la contenga, y una comprobación que da falsas alarmas todo el rato termina por ignorarse.

Si algo se coló, se arregla con `git commit --amend` **antes de subirlo**, que es cuando todavía sale gratis. Se enmienda **solo el mensaje**: no se añaden archivos, no se cambia el autor. Si el commit ya está en GitHub, **para y avisa al propietario**. No se fuerza el envío.

## Etiquetas

Una etiqueta es un nombre permanente pegado a un commit concreto. La rama `production` avanza con cada commit; una etiqueta no se mueve nunca. Por eso `p1.0.0.0` señala para siempre al proyecto tal como estaba en esa versión, y en GitHub se abre o se descarga desde "Tags" sin buscar su commit a mano.

Crear la etiqueta es local y se puede hacer en cuanto existe el commit. Lo que necesita que la rama esté subida es **enviarla**: una etiqueta que apunta a un commit que GitHub todavía no tiene no sirve de nada. Por eso el orden es commit, push de la rama, y después la etiqueta.

Para ver qué etiquetas existen de verdad en GitHub, y no solo en esta máquina, hay que preguntarle al remoto:

```bash
git ls-remote --tags origin
```

## Lo que impone GitHub

El repositorio tiene reglas que hacen cumplir parte de lo anterior:

| Regla | Qué impide |
|---|---|
| Rama `production` | Forzar un push y borrar la rama. El push directo, sin PR, se acepta |
| Etiquetas `p*` y `v*` | Mover o borrar una etiqueta. Crearla sí se puede |
| Bloqueo de secretos | Subir un commit que contenga una clave o un token que GitHub reconozca |

**Si el bloqueo de secretos rechaza un push, no se salta.** GitHub ofrece un enlace para permitirlo igualmente, y no se usa. Se quita el secreto del commit con `git commit --amend` antes de volver a subir, y si el valor llegó a salir de la máquina por otro camino, se revoca.

**Las alertas de Dependabot se atienden como cualquier otra actualización.** Dependabot avisa de las dependencias con fallos de seguridad y no abre PR. El arreglo entra con `npm update` y la revisión del lockfile que pide [Convenciones de código](02-code-conventions.md#la-política-de-dependencias), en una versión normal.

## La release, después de la etiqueta

Una etiqueta deja la versión accesible en GitHub. Una **release** le pone encima el título, las notas y un zip descargable, y es lo que ve alguien que entra buscando la última versión buena.

Las notas no se redactan: salen del archivo de cambios de la versión, que ya está escrito en palabras normales y sin rutas de archivo para esto exactamente.

```bash
V=p1.0.0.0
sed -n '/^## Qué cambió/,$p' "wildgrove-vault/versions/preview/$V/01-$V-changes.md" > /tmp/notas.md
gh release create "$V" --title "Preview · $V" --notes-file /tmp/notas.md --verify-tag
```

El título es `Preview · p1.2.0.0`: la fase delante y el número detrás. Dice `Preview` y no "Vista previa" porque es el nombre de la fase, el mismo que lleva la carpeta `versions/preview/`, y esos van en inglés. Cuando el proyecto pase a `v`, el título pasa a `Stable · v1.0.0.0`.

**No se usa `--prerelease`.** Esa bandera de GitHub marca una versión como "no la definitiva" para que las herramientas que buscan la última estable la salten, y dibuja un cartel que pone "Pre-release" y no se puede renombrar. Aquí no aporta: cada versión de `preview` **sí** es la última que hay, la fase ya la dice el título, y nada automatizado consume estas releases.

## Qué no se sube

- **Ningún archivo `.env`.** Solo `.env.example`, con los valores vacíos.
- Nada generado: `node_modules/`, `.next/`, el cliente de Prisma, cachés de compilación.
- Ninguna credencial, en ningún formato. En un repositorio público un secreto subido queda en el historial aunque después borres el archivo.

El `.gitignore` de la raíz se encarga. Si algún día entra un tipo de archivo nuevo que no debería subirse, se añade al `.gitignore` **antes** del siguiente commit y se avisa al propietario.
