---
title: plans
updated: 2026-10-04
status: current
---

# Cómo se planifica un trabajo grande

Un plan es el expediente de un trabajo que no cabe en una conversación. Existe para que el trabajo se piense antes de hacerse, se apruebe antes de ejecutarse, y se pueda demostrar después.

## Cuándo se abre uno

Cuando el trabajo cumple cualquiera de estas:

- Sería nivel `Estructura`. Ver [Cómo versionar este proyecto](04-versioning.md).
- Necesita una migración de base de datos, una variable de entorno nueva o un servicio externo nuevo.
- Abarca varias sesiones, o lo va a ejecutar un agente distinto del que lo pensó.
- Tiene pasos que, hechos en desorden, dejan la producción a medias.

**No se abre un plan para arreglar un bug, cambiar una etiqueta o añadir una sección.** Eso se hace y se versiona.

## Qué nunca entra en un plan

Un plan describe qué se va a hacer y por qué. Este repositorio es público, y un plan se lee igual que cualquier otro documento.

Nunca se escribe dentro de un plan:

- Direcciones IP, nombres de servidores, de contenedores o de hosts privados.
- Políticas de acceso a la base de datos, puertos abiertos, identificadores de claves.
- Credenciales de cualquier tipo, aunque sean de un entorno de pruebas.
- **La lista de protecciones que todavía no están implementadas.** Decir "falta endurecer la política de seguridad de contenido" le dice a cualquiera exactamente por dónde entrar.

Si el trabajo necesita ese detalle para poder ejecutarse, **el detalle vive fuera de lo que se sube** y el plan se refiere a él sin transcribirlo: "las credenciales del servidor, en el gestor de contraseñas del propietario".

Para eso está `wildgrove-vault/private/`. Git la ignora, así que solo existe en la copia de trabajo y nunca llega a GitHub. Un plan que trata justo de una protección que falta no se puede escribir sin nombrarla, así que vive entero ahí, con sus cuatro archivos y su propio índice, y no entra en el índice de planes. Ahí van también las notas de trabajo que no deben subirse. Las credenciales no van ni siquiera ahí: siguen en el gestor de contraseñas del propietario.

Sin esta regla, un plan acaba conteniendo la dirección del servidor, su política de acceso a la base de datos y el inventario de lo que falta por asegurar.

## Dónde viven

En `wildgrove-vault/plans/`, nunca en `wildgrove-vault/reference/`, salvo los que necesitan detalle privado, que viven en `wildgrove-vault/private/`. Un plan y un documento de referencia sirven para cosas distintas: la referencia describe cómo está el proyecto ahora, y el plan describe cómo debería quedar.

**Un plan no se borra después de ejecutarse.** Se marca como hecho en `wildgrove-vault/plans/00-plans-index.md` y se queda. Es el razonamiento detrás de una decisión.

## Las cuatro etapas

Un plan es una carpeta con un identificador repetido en cada nombre de archivo, para que los nombres sigan siendo únicos en todo el repositorio:

```
wildgrove-vault/plans/
└── 01-group-reservations/
    ├── 00-group-reservations-context.md
    ├── 01-group-reservations-plan.md
    ├── 02-group-reservations-execution.md
    └── 03-group-reservations-report.md
```

**00 | Contexto.** Cuál es el problema y qué se quiere conseguir. Se escribe antes de decidir cómo. Lleva el problema en una frase, la situación de partida **verificada** (no la supuesta), lo que queda explícitamente fuera, las restricciones, los riesgos, y qué significa "terminado". **No elige la solución.** Si el contexto ya dice cómo implementar, nadie revisó la decisión.

**01 | Plan.** Cómo se hace, paso a paso, con detalle suficiente para un agente que no estuvo en la conversación. Las decisiones de diseño con las alternativas que se descartaron y por qué; las tareas en el orden en que deben ocurrir; qué archivos toca cada una; cómo se verifica cada una; los riesgos con su plan B. Su cabecera lleva un campo más:

```
approved: pending | YYYY-MM-DD
```

**Mientras diga `pending`, nadie ejecuta.** Es la única puerta dura del sistema y solo la abre el propietario.

**02 | Ejecución.** Las instrucciones que ejecutan el plan. Se escriben desde el plan aprobado, nunca de memoria. Dicen qué leer primero, en qué orden exacto, dónde parar y preguntar, qué está prohibido, y qué hay que entregar al final.

**03 | Reporte.** Qué pasó de verdad, no qué se pretendía. Tarea por tarea, hecha o no y con qué prueba; cada desviación del plan y por qué; qué queda pendiente; y qué versión se creó.

**Un plan sin reporte no está terminado**, aunque el trabajo se haya hecho. Dos meses después nadie puede saber si se ejecutó entero o se quedó a medias.

## Las puertas

```
Contexto escrito
        ↓
Plan escrito, approved: pending
        ↓
El propietario aprueba, approved: YYYY-MM-DD
        ↓
La ejecución corre de principio a fin
        ↓
Reporte escrito y versión creada
```

Dos reglas en cada entrega:

- El agente que recibe lee el archivo entero, no un resumen de la conversación.
- Si la realidad contradice al plan durante la ejecución, **se para y se anota la desviación**. No se improvisa otra solución en silencio.

## Relación con las versiones

Un plan no sustituye al changelog. La sesión que ejecuta un plan crea su versión como cualquier otra, y el reporte apunta a ella.

**Aprobar un plan es lo que sube el nivel `Estructura`**, no ejecutarlo. Ver [Cómo versionar este proyecto](04-versioning.md).
