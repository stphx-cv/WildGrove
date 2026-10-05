---
title: api
updated: 2026-10-04
status: current
---

# La API

No hay un servidor aparte. Toda la lógica vive en los manejadores de ruta de las dos aplicaciones de Next.js, bajo `app/api/`.

Son 147 endpoints en total, 82 en la tienda y 65 en el panel. Los 82 de la tienda incluyen los 7 de la superficie pública. Este documento no los lista uno por uno: explica cómo están organizados, qué reglas cumplen todos, y describe con detalle la única parte que es un contrato público.

## Tres superficies

```
interna de la tienda   ·  75 endpoints  ·  la usa el navegador del cliente
interna del panel      ·  65 endpoints  ·  la usa el navegador del personal
pública para agentes   ·   7 endpoints  ·  la usa cualquiera, sin credenciales
```

Las dos primeras son de uso interno. Cambian cuando el producto cambia y no prometen nada a nadie de fuera.

La tercera es distinta: **es un contrato publicado**, y esa diferencia es la razón de que exista por separado.

## Lo que cumplen todos los endpoints

**Se valida con Zod en el borde.** Toda petición que escribe pasa por un esquema antes de tocar nada. Si no valida, se rechaza ahí mismo.

**La respuesta tiene siempre la misma forma.** Un sobre con `success` y `data`, así que quien consume no tiene que adivinar la estructura según el endpoint.

**Un rechazo lleva su motivo.** En los pedidos, tanto en la tienda como en el panel, un pedido que no existe responde 404, y cualquier otro rechazo del servicio de pedidos responde 422 con un `code` que dice qué pasó: `ALREADY_TERMINAL` a quien cancela un pedido que otra persona acaba de cerrar, `INVALID_TRANSITION` a un cambio de estado que no está permitido. Quedarse sin saldo, al pagar o al reactivar, es la excepción: responde 402. Un 500 lleva el mensaje de la ruta, nunca el texto interno del error.

**El rol se comprueba en el servidor.** Los endpoints del panel exigen `ADMIN` u `OWNER`, y eso se verifica contra la sesión, nunca contra lo que diga el cliente. Los de acceso son la excepción porque abren la sesión, y tanto el de contraseña como el retorno de Google del panel comprueban el rol contra el perfil antes de dejarla abierta.

**Los que cuestan dinero o se pueden atacar por fuerza bruta tienen límite de peticiones.** El chat, las reservas, el envío de códigos y el acceso. Una reserva manda correos, así que el formulario de la página y el del chat comparten el mismo límite por cuenta, y Sage aplica el suyo al crear una.

```
petición → Zod → sesión y rol → límite de peticiones → lógica → sobre de respuesta
```

## La API pública para agentes

Esta parte es la más interesante del proyecto y merece su propia explicación.

La idea: un sitio de restaurante en 2026 no lo lee solo una persona con un navegador. Lo lee un asistente al que alguien le pidió "búscame dónde cenar el viernes". Wild Grove publica una superficie pensada para eso.

### Los endpoints

| Endpoint | Qué devuelve |
|---|---|
| `/api/agent/v1/menu` | La carta publicada por categorías, en el idioma que se pida |
| `/api/agent/v1/venue` | Horario, dirección, teléfono, correo, redes |
| `/api/agent/v1/availability` | Si hay hueco para una fecha, hora y número de personas |
| `/api/agent/v1/reviews` | Las reseñas aprobadas, de la más reciente hacia atrás |
| `/api/agent/v1/status` | Si el servicio responde |
| `/api/agent/mcp` | Un servidor MCP con cuatro herramientas de solo lectura |
| `/api/agent/markdown/...` | Cualquier página pública en markdown, explicado más abajo |

Van versionados en la ruta, contestan con el mismo sobre que el resto y permiten peticiones desde cualquier origen. En `/openapi.json` están descritos los 4 que devuelven contenido: `status` queda fuera porque solo dice si el servicio está en pie.

### Cualquier página se puede pedir en markdown

Si una petición a una página pública llega con la cabecera `Accept: text/markdown`, el sitio devuelve esa misma página en markdown en lugar de HTML, sin cambiar la dirección.

```
GET /es/menu
Accept: text/html      →  la página normal

GET /es/menu
Accept: text/markdown  →  la misma página, en markdown
```

El markdown no se genera convirtiendo el HTML ya renderizado. Sale de los mismos datos que lee la página, lo que evita que un agente reciba menús de navegación, botones y pies de página mezclados con el contenido.

### Documentos de descubrimiento

Para que un agente encuentre todo eso sin que nadie se lo diga:

| Documento | Para qué |
|---|---|
| `/robots.txt` | Permite la zona de agentes, y declara que el contenido se puede leer pero no usar para entrenar |
| `/openapi.json` | La descripción formal de la API pública |
| `/.well-known/api-catalog` | El catálogo de APIs del sitio |
| `/.well-known/mcp/server-card.json` | La ficha del servidor MCP |
| `/.well-known/agent-skills/` | Instrucciones de uso, cada una con su huella |
| `/.well-known/ai-catalog.json` | El manifiesto que enlaza todo lo anterior |
| `/auth.md` | Dice que no hay autenticación y dónde se paran las escrituras |

La página también registra sus herramientas en el navegador con WebMCP, para un asistente que esté mirando la pestaña abierta.

### La regla que gobierna todo esto

**Nada de lo que se publica aquí puede describir algo que no responda.**

Cada documento de descubrimiento apunta a un endpoint vivo. Cada instrucción se calcula sobre los bytes que de verdad se sirven. Y cuando una comprobación de conformidad solo se podía aprobar afirmando algo que no era cierto, se declinó en lugar de aprobarla.

El caso concreto: publicar un documento de descubrimiento de OAuth habría subido la puntuación de una auditoría, pero habría descrito un servidor de autorización que no existe. No se publicó.

### Lo que no existe a propósito

**No hay autenticación y no hay escrituras.** Todo lo que devuelven estos endpoints ya es público en el sitio. Un agente puede consultar la carta y comprobar si hay hueco el viernes, pero **no puede reservar la mesa ni hacer un pedido**.

Eso está escrito en `/auth.md` con todas sus letras, y no es un hueco pendiente de rellenar. Es la decisión. Un agente que busca una credencial la busca hasta que alguien le dice que no la hay; diciéndoselo, devuelve la reserva a una persona en lugar de quedarse dando vueltas.

### Un error que vale la pena contar

Durante un tiempo, la API pública, la herramienta de MCP y la representación en markdown devolvían **el precio de catálogo**, mientras que la página web mostraba el precio con el descuento automático ya aplicado.

Es decir: preguntarle al sitio cuánto cuesta un plato daba una respuesta distinta según quién preguntara. Y "cuánto cuesta este plato" era una de las consultas de ejemplo que el propio manifiesto declaraba saber responder.

Todas las superficies pasan por la misma función de precio y leen la misma lista de descuentos automáticos que la carta y el pago, con las fechas de inicio y fin comprobadas en cada consulta. El precio de lista va aparte. Los cupones nunca entran, porque un cupón es de quien lo tiene.

## El chat

El chat de la tienda es interno, pero dos de sus endpoints tienen reglas que conviene conocer.

**`POST /api/chat` responde en streaming.** Devuelve líneas de JSON: el mensaje guardado del cliente, el texto de Sage mientras se escribe y, al final, el mensaje guardado con sus tarjetas. En el modo "solo con el personal" responde de una vez, con la conversación ya pasada a una persona y el aviso de sistema. Con el chat apagado responde 403 con `chat_off`, igual que las demás rutas del chat que reciben mensajes.

**`POST /api/chat/menu-more`** trae la página siguiente de la carta de un mensaje de Sage, el botón "Ver N más". Recibe la clave de la conversación, el identificador del mensaje y el idioma de la página. Abre la conversación con la misma regla que `/api/chat/session`: una de invitado la abre quien tenga la clave, y una de una cuenta solo esa cuenta. Tiene el límite de peticiones del chat, no llama a ningún modelo y no cuenta para el cupo de respuestas de IA. Un mensaje se continúa una sola vez: la segunda petición sobre el mismo responde 409.

**`POST /api/chat/reservation/dismiss`** anota que la persona cerró el formulario de reserva del chat por su cuenta. Recibe la clave de la conversación y la abre con la misma regla. No escribe un mensaje, no llama a ningún modelo y no crea una reserva. El mensaje siguiente de Sage lee esa nota.

Ninguna ruta de la tienda devuelve la fila de un mensaje tal cual. Todas pasan por `toClientMessage` (`packages/core/chat/client-message.ts`), que deja el identificador, quién lo escribió, el texto, el nivel, la fecha y, si la carta del mensaje tiene platos sin enseñar, cuántos quedan. Lo que Sage decidió se queda en la base para el panel.

## Entre las dos aplicaciones

Hay dos endpoints de la tienda que no encajan en ninguna de las tres superficies, porque solo los llama el panel. Van autenticados con la misma contraseña compartida y resuelven el problema de tener dos despliegues separados.

| Endpoint | Para qué |
|---|---|
| `POST /api/revalidate` | El panel avisa a la tienda de que tire su caché cuando se edita la carta o los ajustes. Está explicado en [Arquitectura](01-architecture.md) |
| `GET /api/chat/status` | El panel pregunta si la tienda tiene las claves que necesita Sage y cuándo respondió y falló por última vez el modelo de decisión. La respuesta solo dice sí o no de cada clave, nunca su valor |

El panel pide el estado a través de su propio `GET /api/settings/chat-status`, y lo vuelve a pedir al guardar un modo con Sage: si la tienda no contesta o le falta una clave, el modo no se guarda.

## Dónde está el código

| Ruta | Qué hay |
|---|---|
| `wildgrove-web/app/api/` | Los endpoints de la tienda |
| `wildgrove-cms/app/api/` | Los endpoints del panel |
| `wildgrove-web/app/api/agent/` | La API pública, el servidor MCP y el markdown |
| `wildgrove-web/app/.well-known/` | Los documentos de descubrimiento |
| `packages/core/agent/` | Las consultas, el cálculo de precios y las instrucciones |
| `packages/core/chat/` | El chat: el modelo de decisión y sus reglas (`decide/`), el redactor, las tarjetas y las páginas de la carta |
