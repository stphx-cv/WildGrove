---
title: architecture
updated: 2026-10-04
status: current
---

# Arquitectura

Wild Grove es un restaurante ficticio con una tienda pública y un panel de administración. Las dos aplicaciones viven en el mismo repositorio, comparten una sola copia de la lógica de negocio, y se despliegan por separado.

Este documento explica cómo está armado. Si buscas qué hace el producto, está en [Funciones](03-features.md); si buscas cómo se guardan los datos, en [Modelo de datos](02-data-model.md).

## El mapa

```
      Clientes                            Personal
          │                                   │
          ▼                                   ▼
   www.wildgrove.cv                    cms.wildgrove.cv
   wildgrove-web                       wildgrove-cms
   Next.js · español e inglés          Next.js · un solo idioma
          │                                   │
          └──────────────┬────────────────────┘
                         ▼
                    packages/
         ┌───────────────┼────────────────┐
         ▼               ▼                ▼
   @wildgrove/db   @wildgrove/core   @wildgrove/ui
   esquema y       toda la lógica    componentes y
   migraciones     de negocio        tokens de diseño
                         │
                         ▼
              Un backend autoalojado
         PostgreSQL · autenticación · archivos
```

**Dos despliegues, un repositorio, una sola copia de la lógica.** Nada del negocio vive dentro de una app: si las dos lo necesitan, sube a `packages/`.

Las sesiones **no se cruzan entre las dos aplicaciones**. Las cookies de sesión están atadas a su dominio, así que entrar en la tienda no te deja entrar en el panel. El panel tiene su propio acceso.

## Con qué está construido

| Pieza | Qué se usó | Por qué |
|---|---|---|
| Framework | Next.js 16 (App Router) | Los componentes de servidor permiten leer la base de datos directamente al renderizar, sin montar una API para la primera carga |
| Lenguaje | TypeScript 7 | El compilador nativo revisa los tipos de cada aplicación en alrededor de un segundo durante la compilación |
| Base de datos | PostgreSQL con Prisma 7 | Un solo esquema para las dos aplicaciones |
| Backend | InsForge autoalojado | Da PostgreSQL, autenticación y almacenamiento de archivos en un solo servicio, y es de código abierto: el proyecto no queda atado a un proveedor |
| Estilos | Tailwind 4 | |
| Idiomas | next-intl 4 | Español e inglés, con rutas traducidas |
| Validación | Zod 4 | Toda petición que escribe datos se valida antes de tocar la base |
| Chatbot | Un modelo de decisión, Jev, delante de un cliente compatible con OpenAI | Jev decide qué hace cada respuesta y el código lo ejecuta; el modelo generativo solo escribe el texto, y su proveedor se elige desde el panel. Las claves solo viven en el servidor |
| Monorepo | npm workspaces y Turborepo | Un solo `package-lock.json`, compilaciones que reutilizan trabajo |

## La estructura de carpetas

```
WildGrove/
├── wildgrove-web/            la tienda pública
│   ├── app/[locale]/         las páginas, en español e inglés
│   ├── app/api/              los endpoints públicos
│   ├── components/           secciones, carrito, cuenta, chat, formularios
│   ├── messages/             las traducciones
│   └── proxy.ts              idiomas y protección de /portal y /account
│
├── wildgrove-cms/            el panel de administración
│   ├── app/(panel)/          escritorio, carta, pedidos, reservas, tickets
│   ├── app/api/              los endpoints del panel
│   └── proxy.ts              exige rol ADMIN u OWNER en todas las rutas salvo /login y las de acceso
│
├── packages/
│   ├── db/                   esquema de Prisma, migraciones, cliente único
│   ├── core/                 pedidos, billetera, pagos, reparto, chat, correo,
│   │                         tickets, reseñas, PDF, rutas traducidas
│   └── ui/                   componentes compartidos y tokens de diseño
│
└── wildgrove-vault/          documentación, reglas, planes, versiones y archivos de apoyo
    ├── reference/            cómo está hecho el proyecto
    ├── rules/                cómo se trabaja aquí
    ├── plans/                el expediente de cada trabajo grande
    ├── versions/             el registro de cambios
    └── assets/               imágenes y binarios de apoyo
```

En números: 30 modelos de datos, 147 endpoints, 19 páginas públicas, 27 páginas de panel y 42 plantillas de correo, 21 en cada idioma.

### Tres reglas que sostienen el reparto

1. **El código compartido sube, nunca cruza.** Una app jamás importa de la otra. Si las dos lo necesitan, va a `packages/`.
2. **`packages/core` no importa de ninguna app.** Si lo hiciera, dejaría de ser compartible y las dos aplicaciones quedarían atadas por debajo.
3. **Solo la tienda ejecuta las migraciones.** Si el panel también lo hiciera, dos despliegues simultáneos competirían por el mismo bloqueo y uno de los dos fallaría.

## Cómo se renderiza una página

Las páginas públicas y las del panel son **componentes de servidor**: leen la base de datos mientras se renderizan, en el servidor, y mandan HTML ya resuelto. No hay una llamada desde el navegador para pintar la primera pantalla. Eso hace que la primera carga sea rápida y que el contenido sea legible para los buscadores sin trucos.

El navegador solo toma el mando donde hace falta interacción: el carrito, el chat, los formularios y las tablas del panel.

## Cómo se guardan los cambios

Toda la lógica vive en los endpoints de `app/api/`. No hay un servidor aparte.

Cada endpoint que escribe sigue la misma secuencia:

```
petición → se valida con Zod → se comprueba la sesión y el rol → se escribe → se invalida la caché
```

Si la validación falla, la petición no llega a tocar la base de datos. Si el rol no alcanza, tampoco.

## La caché y el problema de las dos aplicaciones

La carta pública se cachea: no tiene sentido consultar la base de datos por cada visitante cuando el menú cambia una vez al día.

Eso crea un problema propio de tener dos despliegues separados. Cuando alguien edita un plato desde el panel, **el panel no puede invalidar la caché de la tienda**: son dos aplicaciones distintas y cada una tiene la suya. Antes de resolverlo, guardar un cambio actualizaba el panel y dejaba la carta pública mostrando la versión vieja.

La solución es que el panel, al guardar, llame a la tienda por HTTP para que tire su caché. Por si esa llamada se pierde, cada entrada cacheada caduca sola a los cinco minutos.

## Autenticación y roles

Un usuario se registra con correo y contraseña, o entra con Google. El teléfono es un dato de contacto del perfil, no una forma de acceder. Los códigos de seis dígitos que manda la aplicación verifican direcciones de correo: la de la cuenta cuando se cambia, y las de recuperación cuando se añaden.

Cada usuario tiene un perfil con un rol. Los roles de personal son `ADMIN` y `OWNER`, y son los únicos que pueden entrar al panel. Entran con correo y contraseña o con Google, y con Google solo si la cuenta ya existe con uno de esos roles: el retorno de Google del panel busca el perfil y no crea ninguno.

**El panel comprueba el rol en todas sus rutas excepto las de acceso**, sin más excepciones. Las de acceso son las que abren, renuevan, consultan o cierran la sesión, y por eso pueden llegar sin ella. La de retorno de Google lleva la comprobación dentro: busca el perfil y no deja ninguna cookie si el rol no es de personal. Cada ruta que se deja fuera de esa comprobación es una segunda entrada al panel que hay que revisar aparte, y con el tiempo alguna deja de revisarse. Por eso está escrito como límite en [Qué nunca hacer](../rules/03-never-do.md) y no como recomendación.

## Los dos idiomas

La tienda funciona en español e inglés, y **casi todas las rutas se traducen**: la misma página es `/es/reservas` y `/en/reservations`. La carta es la excepción y se sirve en `/menu` en los dos idiomas. La tabla que empareja esas rutas vive en `packages/core`, porque la usan tanto la tienda como los correos que enlazan de vuelta a ella.

El panel es de un solo idioma. Lo usa el personal, no el público.

## Los pagos están abstraídos a propósito

El cobro no llama a un proveedor concreto, llama a una interfaz. Hoy la única implementación es la billetera interna.

Está hecho así porque cambiar de pasarela es algo que pasa de verdad en un negocio, y no debería obligar a tocar la lógica de pedidos.

## Cómo se despliega

Las dos aplicaciones y la base de datos viven en la misma máquina. Cada aplicación se empaqueta entera, con Node 24 dentro, y el servidor descarga ese paquete y lo ejecuta. La integración continua compila con la misma versión.

**Compilar y desplegar son dos cosas distintas, y solo la segunda cambia lo que ve un visitante.**

**Al subir un cambio se compila**, fuera del servidor, en integración continua. Un cambio que solo toca el panel no compila la tienda, y al revés; lo deciden los archivos que cambiaron. La compilación construye primero la imagen del migrador y la usa para aplicar las migraciones a un PostgreSQL desechable, así que una migración rota se descubre ahí y no delante de los visitantes. La imagen de la aplicación se construye después sobre la misma instalación de dependencias que usó el migrador, así que cada compilación instala una sola vez. Entre compilaciones no se guarda nada. El resultado son imágenes etiquetadas con el número de versión y con el commit, de modo que lo que está corriendo se puede leer hacia atrás hasta su documento de versión. Junto a la de la tienda se publica una imagen aparte que solo aplica las migraciones, con las mismas dos etiquetas, para que el contenedor que sirve al público no tenga que llevar el motor de migraciones.

**Desplegar lo lanza el propietario** con `scripts/ship.sh` desde su máquina. El comando espera la compilación del commit que va a desplegar, lee qué aplicaciones se publicaron y llama al script del servidor por SSH. La llave se queda en la máquina del propietario; integración continua no tiene acceso al servidor.

Un despliegue no reemplaza lo que sirve. Si es la tienda, lo primero es aplicar las migraciones, con la imagen de migraciones de esa misma versión: el guion de despliegue la deduce de la imagen de la tienda que recibe, así que las dos no pueden venir de versiones distintas. Solo la tienda migra, para que dos despliegues no compitan por el mismo bloqueo. La tienda y el panel pueden desplegarse a la vez; el panel espera la marca de migración de esa versión antes de mover su tráfico. Mientras tanto la versión anterior sigue sirviendo sobre el esquema ya migrado, que es por lo que las migraciones que viajan solas con un despliegue solo añaden.

Después arranca la versión nueva **al lado** de la que está en marcha, sin que nadie la alcance, tira su caché, le pide sus páginas en los dos idiomas y **cuenta los platos que devuelven**. Una página que responde correctamente pero con la carta vacía no pasa esa cuenta.

Solo si todo eso sale bien se mueve el tráfico, y se mueve cambiando un registro que el proxy inverso vigila, sin reiniciar ni recrear el contenedor recién comprobado. Recrearlo tiraría la caché que el calentado acaba de construir, y el primer visitante se encontraría justo la carta vacía que toda esta secuencia existe para evitar.

El script devuelve el control al mover el tráfico. El color anterior sigue arrancado durante 20 s por defecto y después se para en segundo plano. Cada aplicación conserva su propio candado hasta que termina esa retirada.

**Si algo falla antes del cambio de tráfico, no hay nada que deshacer:** la versión anterior nunca dejó de servir.

El cliente de Prisma se genera durante la compilación, nunca al instalar dependencias. En [Convenciones de código](../rules/02-code-conventions.md) está explicada la política de dependencias y por qué los scripts de instalación están apagados.

### Lo que se gana y lo que se pierde

Las aplicaciones y los datos en el mismo sitio dejan de necesitar que la base de datos acepte conexiones desde el internet público, que era el motivo de juntarlas. A cambio, **una caída de esa máquina se lleva el sitio entero**, incluida la tienda. No hay redundancia, y con el presupuesto sin mover no hay forma de tenerla.

Para que perder esa máquina no sea perder los datos, cada día sale fuera de ella una copia cifrada de la base de datos, de los archivos que suben los clientes y el panel, y de la configuración del servidor. Se guardan 7 copias diarias, 4 semanales y 6 mensuales. Una vez al mes, la última se restaura sola en una base temporal y se compara, tabla por tabla, con lo que se copió. Si una copia o esa prueba no llegan a tiempo, el propietario recibe un aviso. La copia está hecha para recuperar los datos; volver a levantar el sitio en otra máquina sigue llevando horas, no minutos.

Las páginas se generan en una sola máquina en lugar de en una red de servidores repartida por el mundo. Los archivos estáticos sí siguen sirviéndose desde el borde. Medido desde Perú en septiembre de 2026, la diferencia en el primer byte se cuenta en decenas de milisegundos; desde otros continentes será mayor.

## Qué servicios externos usa

| Servicio | Para qué |
|---|---|
| El proveedor de IA que elijas | El texto de las respuestas de Sage |
| OpenRouter, y TypeSafe como segunda vía | El modelo de decisión de Sage |
| Google Maps | Direcciones, geocodificación y zonas de reparto |
| SMTP | Los correos transaccionales |
| Upstash Redis | Límites de peticiones en los endpoints que cuestan dinero o son atacables |

Cada uno necesita sus propias credenciales. Cómo conseguirlas está en [Variables de entorno](06-environment.md).

## Qué no vas a encontrar aquí

Este documento explica cómo está construido el proyecto, no dónde está alojado. No hay direcciones de servidores, nombres de máquinas ni configuración de infraestructura. Nada de eso hace falta para entender la arquitectura, y publicarlo solo le ahorra trabajo a quien quiera atacar el sitio.

Si clonas el repositorio y quieres levantarlo, no necesitas nada de eso. Necesitas tus propias credenciales, y eso está en [Variables de entorno](06-environment.md).
