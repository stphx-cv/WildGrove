---
title: readme
updated: 2026-10-08
status: current
---

# Wild Grove

Un restaurante ficticio, construido entero como pieza de portafolio: tienda pública, panel de administración, pedidos, pagos, reservas, reseñas, soporte y un asistente con herramientas propias.

Está en línea y en uso. La carta, los horarios y los datos del local se editan desde el panel, no están escritos en el código.

Versión actual: **p1.0.2.0** · fase `preview` · ver [Versiones](wildgrove-vault/versions/00-versions-index.md).

Toda la documentación está en español. Los nombres de carpetas, de archivos y todo lo que lee una máquina están en inglés.

## Dos proyectos

```
wildgrove.cv                              cms.wildgrove.cv
la tienda, en español e inglés            el panel, para el personal

carta · carrito · pedidos                 carta · pedidos · reservas
reservas · reseñas · soporte              billeteras · tickets · chat
chat con asistente · cuenta               clientes · reseñas · zonas
                                          descuentos · ajustes
```

Next.js 16 con App Router, TypeScript, Prisma 7 sobre PostgreSQL, Tailwind 4, next-intl y un backend InsForge autoalojado.

En números: 30 tablas, 147 endpoints, 19 páginas públicas, 27 de panel y 42 plantillas de correo, 21 en cada idioma.

## Por dónde empezar

**Si vienes a entender cómo está hecho**, empieza por [Arquitectura](wildgrove-vault/reference/01-architecture.md) y sigue el orden del [índice de referencia](wildgrove-vault/reference/00-reference-index.md). El mapa de todo el almacén está en [Wild Grove Vault](wildgrove-vault/00-wildgrove-vault-index.md).

**Si vienes a levantarlo en tu máquina**, ve directo a [Variables de entorno](wildgrove-vault/reference/06-environment.md), que explica qué necesitas y de dónde sacar cada credencial.

**Si eres un agente de IA y es tu primera vez aquí**, lee [`wildgrove-vault/rules/00-rules-index.md`](wildgrove-vault/rules/00-rules-index.md) antes de escribir nada.

## Levantarlo

Antes de empezar necesitas dos cosas instaladas:

| Pieza | Para qué |
|---|---|
| **Node 24 o superior** | Las dos aplicaciones y el monorepo |
| **Docker**, con `docker compose` | El backend, que se autoaloja en contenedores |

El backend es [InsForge](https://insforge.dev), de código abierto: trae PostgreSQL, autenticación y almacenamiento de archivos en un solo servicio. También puedes usar su nube, y entonces te saltas el paso 1 y sacas las claves de tu proyecto allí.

### 1. El backend

Su instalador deja una carpeta con todo lo que hace falta, y conviene que esté **fuera de este repositorio**:

```bash
curl -fsSL https://raw.githubusercontent.com/InsForge/InsForge/main/deploy/setup.sh | sh -s ~/insforge-local
cd ~/insforge-local && docker compose up -d
curl http://localhost:7130/api/health      # espera a que responda
```

La instalación genera un `.env` en esa carpeta con las credenciales de tu backend, y de ahí salen los valores que piden los dos `.env.local` del paso siguiente:

| Lo que pide este proyecto | De dónde sale |
|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | `http://localhost:7130` |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | `ACCESS_ANON_KEY` del `.env` del backend |
| `INSFORGE_API_KEY` | `ACCESS_API_KEY` del mismo archivo |
| `DATABASE_URL` y `DIRECT_URL` | `postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/insforge`, con la contraseña de ese mismo archivo |

El backend trae su propio panel en **`http://localhost:7130/dashboard`**, donde puedes ver las tablas, los usuarios y los archivos. Entra con el usuario y la contraseña que el instalador dejó en `ROOT_ADMIN_USERNAME` y `ROOT_ADMIN_PASSWORD`.

### 2. El repositorio

La configuración va antes de generar el cliente de Prisma, porque sin una conexión declarada no se genera:

```bash
# 1. Dependencias
npm ci                  # en la raíz, no dentro de una aplicación

# 2. Configuración. Rellena los dos con los valores del paso anterior.
cp wildgrove-web/.env.example wildgrove-web/.env.local
cp wildgrove-cms/.env.example wildgrove-cms/.env.local

# 3. Cliente de Prisma
npm run db:generate

# 4. Crear las tablas y las categorías iniciales
npm run db:migrate
npm run db:seed

# 5. Arrancar
npm run dev
```

La tienda queda en `localhost:4680` y el panel en `localhost:8640`.

### El primer administrador

El panel exige rol `ADMIN` u `OWNER` y quien se registra empieza como `CUSTOMER`, así que el primero se asigna a mano una sola vez:

1. Regístrate en la tienda como un cliente normal.
2. Abre la base de datos con `npm run db:studio`.
3. Busca tu fila en la tabla `Profile` y cambia `role` a `OWNER`.

A partir de ahí entras al panel y los demás roles se gestionan desde ahí.

Con eso ya funcionan la carta, el carrito, los pedidos, las reservas, las reseñas, el panel completo, los dos idiomas y el chat, atendido por el personal desde el panel. El correo, el asistente Sage, los mapas y el límite de peticiones necesitan credenciales de servicios externos, y sin ellas simplemente quedan apagados. Todo está explicado en [Variables de entorno](wildgrove-vault/reference/06-environment.md).

Ninguna credencial del proyecto original está en este repositorio. Cada aplicación trae su `.env.example` con los nombres y los valores vacíos.

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `wildgrove-web/` | La tienda pública |
| `wildgrove-cms/` | El panel de administración |
| `packages/db/` | El esquema de Prisma, las migraciones y el cliente |
| `packages/core/` | Toda la lógica de negocio |
| `packages/ui/` | Componentes compartidos y tokens de diseño |
| `wildgrove-vault/` | Documentación, reglas, planes, versiones y archivos de apoyo. El mapa está en su [índice](wildgrove-vault/00-wildgrove-vault-index.md) |
| `scripts/` | Herramientas de diagnóstico. Hoy una: comprobar que el correo saliente funciona |

## Qué significa "preview"

El proyecto funciona y está en uso, pero no todo está terminado: hay partes del producto a medio camino.

Se dice aquí en lugar de llamarlo estable, porque una versión 1.0 con huecos dice menos del autor que un `preview` honesto. Cuando deje de haberlos, el prefijo pasa a `v`. El sistema está explicado en [Cómo versionar este proyecto](wildgrove-vault/rules/04-versioning.md).

## Para agentes de IA

El sitio publica una superficie pensada para ser leída por máquinas: una API pública versionada, un servidor MCP, cualquier página disponible en markdown pidiéndola con `Accept: text/markdown`, y los documentos de descubrimiento que hacen falta para encontrarlo todo.

Es de solo lectura. Un agente puede consultar la carta y ver si hay mesa libre, pero no puede reservar ni pedir. Está explicado en [La API](wildgrove-vault/reference/05-api.md).

## Seguridad

Si encuentras una vulnerabilidad, avisa en privado como explica [Seguridad](SECURITY.md), no en un issue público.

## Licencia

[MIT](LICENSE). Puedes usar este código, modificarlo y construir lo que quieras con él, incluso para vender, siempre que conserves el aviso de copyright.

La marca Wild Grove, el nombre, el logotipo y las fotografías de los platos no entran en la licencia. El código sí.
