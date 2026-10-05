---
title: data-model
updated: 2026-10-04
status: current
---

# Modelo de datos

PostgreSQL con Prisma. 30 tablas y 24 listas de valores fijos, todo en un solo esquema que comparten la tienda y el panel.

Este documento explica cómo está organizado y por qué, no repite el esquema campo por campo. El esquema está en `packages/db/prisma/schema.prisma` y se lee solo.

## El mapa

```
                          Profile
                (una persona, con su rol)
                             │
      ┌──────────┬───────────┼───────────┬──────────┐
      │          │           │           │          │
   Wallet      Cart       Order      Reservation  Ticket
      │          │           │                       │
 Transaction  CartItem   OrderItem               TicketMessage
                             │
                         MenuItem ──── MenuCategory
```

`Profile` es el centro. Casi todo lo que hace una persona cuelga de ahí: su billetera, su carrito, sus pedidos, sus reservas y sus tickets de soporte.

`MenuItem` es el otro polo. Es lo que se vende, y lo tocan el carrito, los pedidos y las reseñas.

## Las 30 tablas, por área

| Área | Tablas | Qué guarda |
|---|---|---|
| Personas | `Profile` | Nombre, contacto, rol y las conexiones de acceso |
| Carta | `MenuCategory`, `MenuItem` | Los platos y sus categorías |
| Carrito | `Cart`, `CartItem` | Lo que alguien tiene puesto antes de pagar |
| Pedidos | `Order`, `OrderItem`, `OrderDiscount`, `OrderEvent`, `OrderCounter`, `DocumentCounter` | El pedido, sus líneas, sus descuentos, su historial y los numeradores |
| Billetera | `Wallet`, `WalletTransaction` | El saldo y cada movimiento que lo cambió |
| Descuentos | `Discount`, `DiscountApplication` | Las promociones y quién las ha usado |
| Reservas | `Reservation`, `ReservationChangeRequest` | Las mesas. `ReservationChangeRequest` es el resto de una función de peticiones de cambio que nunca se terminó: nada la escribe ni la lee |
| Reseñas | `Review`, `ProductReview` | Opinión del local y opinión de un plato concreto |
| Soporte | `Ticket`, `TicketMessage`, `TicketAttachment`, `TicketCounter` | La conversación de soporte y sus archivos |
| Chat | `ChatSession`, `ChatMessage` | Las conversaciones con el asistente |
| Reparto | `UserAddress`, `DeliveryZone` | Direcciones guardadas y zonas de cobertura |
| Verificación | `VerificationCode` | Los códigos de un solo uso que se mandan por correo |
| Sistema | `AppSettings`, `AdminNotification` | La configuración del negocio y los avisos al personal |

---

## Decisiones que explican el resto

### El perfil no guarda contraseñas

La autenticación vive en el backend, en sus propias tablas. `Profile` es la tabla de la aplicación y su `id` es el mismo identificador del usuario autenticado, así que las dos hablan de la misma persona sin duplicar nada.

Lo que queda en `Profile` es lo que el negocio necesita: nombre, teléfono, avatar, correos de recuperación, y el rol. No hay contraseñas ni tokens.

El rol tiene tres valores: `CUSTOMER`, `ADMIN` y `OWNER`. Los dos últimos son los únicos que entran al panel.

### Un pedido guarda una foto del momento

Esta es la decisión que más forma le da al esquema.

Un pedido no apunta solo al plato: **copia lo que era cierto cuando se compró**. `OrderItem` guarda el nombre del plato en ese momento, el precio de catálogo antes del descuento, y el precio que se cobró de verdad. El pedido guarda además el nombre de la zona de reparto, la dirección y el teléfono tal y como estaban.

```
MenuItem            "Arroz con pollo"  ·  28.00 PEN     ← cambia con el tiempo
   │
   ▼  al comprar se copia
OrderItem           "Arroz con pollo"  ·  28.00 → 24.80  ← queda congelado
```

Sin esas copias, cambiar el nombre de un plato o subirle el precio reescribiría pedidos del año pasado, y el historial dejaría de coincidir con lo que la gente pagó de verdad.

### La billetera es un libro de cuentas, no un número

`Wallet` tiene un saldo, pero ese saldo no se edita a mano. Cada cambio entra como una fila en `WalletTransaction`, con el importe, si suma o resta, el motivo, y el saldo que quedó después.

Así el saldo siempre se puede reconstruir desde los movimientos, y cualquier descuadre se puede rastrear hasta la fila que lo causó.

Cada movimiento puede llevar una clave de idempotencia. Si la misma operación llega dos veces, por un reintento o por un doble clic, la segunda choca con esa clave y no se aplica. Es lo que evita cobrar dos veces el mismo pedido.

Ningún cambio escribe un saldo calculado a partir de una lectura anterior. Cobrar, recargar, devolver y ajustar suman o restan sobre el saldo guardado, y fijar un saldo exacto bloquea la fila antes de leerlo. Si el propietario ajusta un saldo mientras el cliente paga, la segunda operación espera a la primera y se aplica encima, sin borrar el cobro.

Una persona puede tener una billetera por moneda. El par persona más moneda es único.

### El saldo de prueba nace con el perfil

`INITIAL_BALANCE` es el tipo de movimiento del saldo que recibe una cuenta nueva. A diferencia de `RECHARGE` y de los ajustes, no lo hace el dueño: no lleva autor (`performedById` queda vacío), ni referencia, ni nota, no avisa al personal, y su clave de idempotencia es `initial-balance:<perfil>:<moneda>`.

Los dos importes son columnas de `AppSettings`, `initialBalancePEN` e `initialBalanceUSD` (`Decimal(12, 2)`, 200 y 80 de fábrica). Un 0 deja esa moneda sin movimiento.

**El perfil y su saldo se escriben en la misma transacción.** La clave primaria de `Profile` deja que una sola transacción cree el perfil de un usuario, y el abono se deshace con él. Por eso el perfil existe si y solo si el saldo se abonó, y lo que le pase después al historial de movimientos no cuenta. El alta usa `create` y no `upsert`: si dos peticiones crean el mismo perfil a la vez, la segunda choca con la clave primaria, se deshace entera y sigue como una actualización del perfil que creó la primera. El porqué está en [Por qué está hecho así](07-decisions.md#el-saldo-de-prueba-nace-con-la-cuenta).

Borrar una cuenta desde el panel borra primero los movimientos de sus billeteras. La clave foránea de `WalletTransaction` hacia `Wallet` es `ON DELETE RESTRICT`, y las billeteras caen en cascada con el perfil, así que con movimientos la cuenta no se podría borrar. Una cuenta con pedidos sigue sin poder borrarse, y la transacción se deshace entera.

### Carrito y pedido son cosas distintas

El carrito cambia todo el rato y puede pertenecer a alguien que todavía no se ha registrado, identificado por una clave de invitado en lugar de por un perfil.

El pedido ya no cambia: se crea al pagar y a partir de ahí solo avanza de estado. Cada cambio de estado deja una fila en `OrderEvent`, así que el historial de un pedido es una lista de hechos con su fecha.

### Los números que lee una persona vienen de un contador

`OrderCounter`, `TicketCounter` y `DocumentCounter` existen para que el pedido sea el número 412 y no un identificador de veinticinco caracteres.

Los identificadores internos siguen siendo largos y aleatorios, que es lo correcto para una base de datos. Los contadores dan el número corto y correlativo que aparece en pantalla y en los documentos.

### Los documentos fiscales son peruanos

Un pedido puede emitir boleta o factura, que son los dos comprobantes que se usan en Perú, y guarda la serie y el número del documento como copia fija.

La boleta admite DNI opcional. La factura exige RUC, razón social y dirección fiscal. Todo eso se guarda dentro del pedido, no en el perfil, porque una factura puede ir a nombre de una empresa distinta cada vez.

Un pedido hecho con los dos comprobantes apagados no lleva ninguno: la serie y el número quedan vacíos. `documentType` no admite vacío y se queda con su valor por defecto, así que lo que dice si un pedido tiene comprobante es la serie, no el tipo.

### Los dos idiomas viven en la misma fila

Un plato tiene `name` y `nameEs`, `description` y `descriptionEs`, `slug` y `slugEs`, y lo mismo con los ingredientes y las etiquetas.

La alternativa habría sido una tabla de traducciones aparte. Para dos idiomas fijos, tenerlos en columnas es más simple de consultar y evita una unión en cada lectura de la carta, que es la consulta más frecuente del sitio.

Los dos `slug` son únicos por separado, porque la dirección del plato cambia con el idioma: `/es/menu/granola-de-las-alturas` y `/en/menu/highland-granola`. La ruta es `/menu` en los dos idiomas, y lo que se traduce es el `slug`.

### La carta tiene borradores

`MenuItem` se relaciona consigo mismo. Un plato publicado puede tener versiones en borrador colgando de él, marcadas como tales y con un enlace a su plato padre.

Eso permite preparar un cambio de carta sin que los clientes lo vean, y publicarlo cuando esté listo.

Un borrador hijo nace con el `available` y el `featured` de su padre. No guarda el `sku` del padre, porque la columna es única y los dos registros existen a la vez: en un borrador hijo, un `sku` vacío significa "el del padre". El panel lo enseña así, y al publicar el padre conserva el suyo. Publicar borra el borrador y copia su contenido al padre en una misma transacción.

Qué platos ve y vende la tienda lo decide una sola regla, en `packages/core/menu-visibility.ts`: publicado es un plato que no es borrador y cuya categoría tampoco lo es, y a la venta es publicado y disponible.

### El dinero nunca es un número con coma flotante

Todos los importes son `Decimal` con dos decimales. Un número con coma flotante acumula errores de redondeo, y en un total de pedido eso significa cobrar de menos o de más.

La moneda se guarda junto al importe. La principal es el sol peruano y el dólar es secundaria.

### Los ajustes del chat y lo que guarda un mensaje

`AppSettings` es una sola fila con la configuración del negocio. Cinco columnas son del chat:

| Columna | Qué guarda |
|---|---|
| `chatMode` | Quién atiende: `off`, `staff`, `sage` o `mixed`. Sin fila, el código usa `staff` |
| `sageMenuDefaultCount` | Cuántas tarjetas muestra Sage cuando el mensaje no nombra un número. De 1 a 12, y nunca por encima del máximo. De fábrica, 4 |
| `sageMenuPageSize` | El máximo de tarjetas de platos en un mensaje, de 1 a 12. De fábrica, 8 |
| `sageDecisionModel` | El modelo de decisión, fijado a una versión |
| `sageShowTechnicalDetails` | Si el chat del panel enseña la decisión debajo de cada respuesta |

`liveChatEnabled` sigue en la tabla, pero ya no se lee ni se escribe: su valor pasó a `chatMode` en la migración que lo creó, y borrar una columna es una migración destructiva que se decide aparte.

`ChatMessage.metadata` es un campo JSON que solo lee el panel. Una respuesta de Sage guarda ahí:

```
decision   qué modelo respondió y por qué clave, los milisegundos, los intentos
           fallidos con su motivo, las probabilidades de cada pregunta, los platos
           con la suya y los pasos que eligieron las reglas
writer     el modelo que escribió, los milisegundos, las herramientas que usó,
           si saltó la protección de precios y si el texto lo escribió el código
menu       { ids, shown }: la lista completa de platos y cuántos lleva enseñados,
           para "Ver N más". `continued` marca la lista que ya siguió en otro mensaje
source     "menu_more" en los mensajes de "Ver N más", que no cuentan para el cupo de IA
```

Ninguna ruta de la tienda devuelve `metadata` ni `sessionId`: el navegador del cliente recibe cada mensaje reducido a lo que pinta.

---

## Cómo se sigue un pedido de principio a fin

```
1. Alguien añade un plato          →  Cart + CartItem
                                      (precio copiado al añadir)

2. Paga                            →  el pedido, el cobro y la retirada
                                      de las líneas cotizadas, juntos
                                      Order + OrderItem
                                      (nombre y precios copiados)
                                      OrderCounter da el número visible
                                      DocumentCounter da la serie fiscal
                                      WalletTransaction anota el cobro
                                      con el identificador del pedido

3. Si ese pago se devuelve         →  un solo abono de ese pago
                                      Reactivarlo lo vuelve a cobrar
                                      una sola vez, con hora de pago nueva

4. Si había promoción              →  OrderDiscount
                                      DiscountApplication registra el uso

5. Cada cambio de estado           →  OrderEvent

6. Si es reparto                   →  la dirección y la zona quedan
                                      copiadas dentro del pedido
```

Al pagar, esas tres escrituras se confirman juntas: el pedido, el movimiento de la billetera y la retirada de las líneas del carrito que se habían cotizado. Si una falla, no queda ni el cargo ni el pedido. Cada pago se devuelve una sola vez. Reactivar el pedido cobra de nuevo ese pago, también una sola vez, y deja una hora de pago nueva para el ciclo siguiente.

Al terminar, el pedido se explica solo. No hace falta consultar la carta, ni las promociones, ni las zonas de reparto para saber qué se vendió y a qué precio, porque todo lo que importaba quedó guardado dentro.

## Índices

Las consultas que se hacen en cada carga llevan índice: los pedidos por persona y por estado, los platos por categoría, por slug y por destacado, los movimientos de la billetera por billetera y fecha.

No hay índices puestos por si acaso. Cada uno responde a una consulta que existe en el código.
