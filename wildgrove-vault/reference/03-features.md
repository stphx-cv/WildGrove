---
title: features
updated: 2026-10-04
status: current
---

# Qué hace el producto

Wild Grove es un restaurante ficticio con todo lo que necesitaría uno real: carta, pedidos, pagos, reservas, reseñas, soporte y un panel para gestionarlo.

Este documento es el recorrido por lo que hace. Cómo está construido está en [Arquitectura](01-architecture.md), y qué guarda cada tabla en [Modelo de datos](02-data-model.md).

## Dos caras

```
  wildgrove.cv                          cms.wildgrove.cv
  ────────────                          ────────────────
  Lo que ve el cliente                  Lo que usa el personal

  carta · carrito · pedidos             carta · pedidos · reservas
  reservas · reseñas · soporte          billetera · tickets · chat
  chat con Sage · su cuenta             clientes · reseñas · zonas
  español e inglés                      descuentos · ajustes
```

Si una página de la tienda falla al prepararse, por ejemplo porque la base de datos no responde, sale una pantalla de error dentro del sitio, con la cabecera y el chat, en el idioma de la página. Su botón vuelve a pedir la página al servidor, así que basta con pulsarlo cuando el fallo ya pasó. Si lo que falla es el marco común a todas las páginas, sale una pantalla aparte, también en los 2 idiomas, que recarga el sitio entero. Las 2 responden 500 y enseñan una referencia del error.

---

## La carta

Los platos se organizan en categorías y cada uno lleva nombre, descripción, ingredientes, etiquetas y galería de imágenes. Todo eso existe **en español y en inglés dentro de la misma ficha**, incluidos los ingredientes y la dirección de la página.

La ficha de un plato tiene un botón para compartirlo. En un móvil o en un equipo que trae el compartir nativo abre el menú del sistema. En el resto, abre un menú con copiar el enlace y compartir en X, WhatsApp, Facebook, LinkedIn, Telegram o por correo; cada red abre su propia página de compartir en otra pestaña con el título del plato y su dirección. Instagram no tiene una dirección que reciba un enlace, así que su opción copia el enlace y abre Instagram para pegarlo.

Cada plato tiene precio en soles y en dólares. No hay conversión automática: los dos precios se fijan a mano, porque un precio de carta redondeado vende mejor que el resultado de multiplicar por un tipo de cambio.

El visitante elige si ve los precios en soles o en dólares, desde el menú de la cabecera o el del móvil, y el carrito lleva su propia moneda, que es la que se cobra. El dueño puede dejar una sola moneda para toda la tienda apagando la moneda doble en el panel y eligiendo ahí cuál. Entonces la carta, la ficha de plato, la portada, el carrito y las tarjetas de plato del chat enseñan solo esa, sin selector, aunque el visitante tuviera la otra guardada. Un carrito que estaba en la otra moneda pasa a la de la tienda al abrirlo o al cotizar, y un pago que llegue todavía en la otra se rechaza sin cobrar. El panel sigue viendo y editando los dos precios de cada plato. La superficie para agentes (la API, el texto en Markdown y la herramienta MCP) da los precios en la moneda de la tienda, y en soles cuando la tienda tiene las dos.

**Los cambios de carta se preparan en borrador.** Un plato publicado puede tener versiones en borrador colgando de él, que el cliente no ve. Cuando la versión nueva está lista, se publica y sustituye a la anterior.

Un borrador nace con la visibilidad, el destacado y el código de producto del plato publicado, así que publicarlo sin tocar esos campos los deja como estaban. En la lista del panel se distingue por la etiqueta "(draft)" detrás del nombre, o "(copy)" si es un duplicado; al publicarlo, esa etiqueta no pasa al plato, que conserva su nombre salvo que se haya editado. Abrir un borrador sin tocar nada no cuenta como cambio: no salta el aviso de salir ni se guarda una copia en el navegador. Lo que se guarda en el borrador es lo que se publica: si en el borrador se apaga "Available on menu", el plato deja de verse al publicarlo.

"Save as new draft", desde la ficha de un plato publicado, crea el borrador y guarda en él lo que tiene el formulario en ese momento, precio incluido; lo mismo hace el aviso que sale al abandonar la página con cambios. Un plato nuevo guardado como borrador conserva todos sus campos, y su dirección es una provisional hasta que se publica. Si el guardado falla, lo editado sigue guardado en el navegador y el formulario enseña el motivo. Al restaurar esos cambios, el panel comprueba que sus imágenes siguen en el almacenamiento: las que ya no existen se quedan fuera, y un aviso dice cuántas son para volver a subirlas.

Un borrador y sus duplicados usan los mismos archivos de imagen que el plato del que salen. Por eso quitar una imagen en el panel solo la quita del formulario, y al guardar, del plato o del borrador que se edita: el archivo se queda en el almacenamiento, y el plato publicado sigue enseñando su imagen aunque se quite en un borrador o se cancele la edición.

Borrar un plato o un borrador sí borra sus archivos, pero solo los que ya no usa nada: ningún otro plato o borrador (imagen principal o galería) y ningún mensaje del chat que enseñó ese plato. Borrar un borrador, por tanto, nunca toca las fotos del plato publicado. Si el almacenamiento falla, el plato se borra igual y el fallo queda en el registro.

Mientras es borrador, un plato no aparece en ninguna parte de la tienda: su dirección da la página de "no encontrado", y no sale en el mapa del sitio, en la portada ni entre los platos relacionados. Tampoco se puede añadir al carrito ni pagar. Lo mismo vale para un plato de una categoría en borrador.

La página de "no encontrado" de un plato sale en el idioma de la página, también el título de la pestaña, y responde 404 con la marca `noindex`. Para eso la ficha de un plato no tiene estado de carga por encima: la tienda decide si el plato existe antes de enviar nada. Una dirección que no corresponde a ninguna página responde 404 en el idioma de su prefijo, `/es` o `/en`; una sin prefijo se redirige antes a uno de los dos.

Un plato marcado como no disponible conserva su página, con un aviso, pero no se puede añadir al carrito. Si ya estaba en un carrito, el pago se rechaza sin cobrar y la página de pago lo explica en el idioma del cliente.

En la portada se destacan algunos platos, con un orden que se decide desde el panel.

Las etiquetas de cada plato se guardan como identificadores (`sin-gluten`, `gluten-free`) y la tienda las muestra como texto: «Sin gluten», «Gluten-free». Un plato con descuento lleva una etiqueta ámbar pequeña con el porcentaje o el importe, la misma en la carta, en la portada, en la ficha del plato y en las tarjetas del chat. La tienda habla de «carta» en español; la ruta sigue siendo `/menu`.

## Pedir

```
carrito  →  pago  →  recogida o reparto  →  seguimiento
```

El carrito funciona **sin tener cuenta**. Se guarda contra una clave de invitado, así que alguien puede llenarlo y registrarse después sin perder lo que había puesto.

Al pagar se elige entre recoger en el local o pedir a domicilio, y se puede programar la hora. Si es reparto, la dirección se busca con autocompletado y el sistema comprueba en qué zona cae.

El dueño puede apagar la recogida o el reparto desde el panel, pero no los dos a la vez. La página de pago solo ofrece los que están encendidos, también al retomar un pago a medias, y el servidor rechaza la cotización y el pago de uno apagado. Si se apaga a mitad de un pago, la página explica el rechazo en el idioma del cliente.

El pedido recibe un número corto y correlativo, del tipo 412, y la pantalla y el correo de después de pagar dicen «Recibimos tu pedido», y a partir de ahí el cliente sigue su estado desde su cuenta. Cada cambio de estado queda registrado con su fecha. El cliente ve de ese historial el tipo de cada cambio y su fecha; las notas del personal y el motivo escrito en un cambio manual se quedan en el panel.

### Comprobantes

Un pedido puede emitir **boleta o factura**, que son los dos comprobantes que se usan en Perú. La boleta admite DNI opcional; la factura pide RUC, razón social y dirección fiscal. Cada tipo lleva su propia serie y su numeración.

El panel tiene un interruptor para cada uno. La página de pago solo ofrece los que están encendidos, con el único que quede ya elegido, también al retomar un pago a medias, y el servidor rechaza el pago con uno apagado. Con los dos apagados, el pago no tiene paso de comprobante y el pedido sale sin él: sin serie, sin número y sin PDF, ni en la confirmación ni en el correo, y sin gastar ningún número de la serie.

## La billetera

El pago se hace con un saldo interno. Cada cliente puede tener una billetera por moneda, y el dueño es quien recarga o ajusta el saldo desde el panel.

El dueño puede apagar el pago con billetera desde el panel. Hoy es el único método de pago, así que con la billetera apagada la tienda no cobra pedidos: el paso de pago lo explica y no deja avanzar, y el servidor rechaza el pago.

Con la moneda doble apagada, el cliente paga con la billetera de la moneda de la tienda. El saldo de la otra moneda se conserva y el panel lo sigue viendo y moviendo, pero la tienda no lo usa mientras la moneda doble siga apagada.

Todo movimiento queda registrado: saldo inicial, recarga, ajuste, compra o devolución, con su importe y el saldo que quedó después. Si se cancela un pedido, la devolución entra como un movimiento más.

El cobro está detrás de una interfaz, así que añadir una pasarela de pago externa más adelante no obliga a tocar la lógica de pedidos.

### El saldo de prueba de una cuenta nueva

Para que cualquiera pueda probar un pedido sin pedirle una recarga al dueño, **cada cuenta nueva recibe un saldo de prueba, una sola vez**: S/ 200 en la billetera en soles y US$ 80 en la de dólares. Son dos saldos independientes, sin conversión entre monedas. No es dinero real, y el pago, la billetera y los términos de uso lo dicen.

- **Cuándo se recibe.** En el momento en que nace el perfil de la cuenta: al confirmar el código de 6 dígitos en un registro con correo, al volver de Google por primera vez, o en el primer acceso de un usuario que se registró antes y todavía no tenía perfil. El perfil y el saldo se escriben en una misma transacción, así que una cuenta lo recibe una vez aunque el registro se repita, el formulario sincronice el perfil dos veces o haya dos pestañas abiertas. Si el abono falla no se crea el perfil, y el siguiente intento lo completa.
- **Quién no lo recibe.** Las cuentas que ya tenían perfil. Iniciar sesión, vincular otra identidad, consultar la billetera, cambiar de moneda o de idioma no añaden saldo, y borrar el historial de movimientos tampoco lo vuelve a dar. Una cuenta que el dueño borra y que se registra otra vez sí lo recibe, porque es una cuenta nueva.
- **Cómo se ve.** Cada moneda tiene un movimiento «Saldo inicial de prueba», sin autor y sin aviso al personal. En el panel, el tipo se llama «Initial balance».
- **Quién lo cambia.** Los dos importes se editan en Ajustes, en «Payments & Orders», en la tarjeta «Starting Test Balance», solo el dueño. Van de 0 a 99 999,99 con 2 decimales. Un cambio vale para las cuentas que se creen después y no toca las que ya recibieron su saldo. Un 0 deja esa moneda sin saldo ni movimiento, y con los dos en 0 la función queda apagada. El abono no depende de los interruptores de la billetera: con el pago apagado o la tienda en una sola moneda, la cuenta recibe las dos monedas igual.
- **Lo que suma.** El escritorio del panel cuenta este saldo con el resto de lo que hay en las billeteras.

### Mi billetera

El área de la cuenta tiene una página de billetera, `/account/wallet` (`/cuenta/billetera` en español), con su entrada «Mi billetera» después de «Mis pedidos» en el menú lateral, en el menú de usuario y en el menú del móvil. Exige sesión, como las demás páginas de la cuenta.

- Enseña el saldo de cada moneda, o solo el de la moneda de la tienda cuando la moneda doble está apagada. Una billetera que todavía no existe sale en 0 y la página no la crea.
- Lista los movimientos de 20 en 20, con `?page=`: la fecha y la hora de Lima, el tipo, el importe con su signo y el saldo después. No enseña la nota, la referencia ni quién hizo el movimiento.
- Dice siempre que el saldo forma parte de la demostración y no es dinero real, y avisa cuando el dueño apagó el pago con billetera.

Al terminar el registro, la pantalla de éxito dice cuánto saldo de prueba recibió la cuenta, con los importes que se abonaron de verdad, espera 5 segundos y tiene un botón «Continuar». Una cuenta nueva de Google ve el mismo aviso encima del formulario de completar el perfil. Con los dos importes en 0 no hay aviso.

## Reservas

El cliente elige fecha, hora y número de personas, sobre franjas horarias que el negocio configura desde el panel: los días que abre, el horario, el intervalo entre franjas y las pausas. La reserva pasa por cuatro estados: pendiente, confirmada, completada o cancelada. Una reserva nace pendiente, así que al enviarla el formulario, el chat y Sage dicen «Solicitud recibida», y solo se habla de confirmación cuando el personal la confirma.

Se reserva desde el formulario de la página, desde el formulario del chat o hablándole a Sage. En los tres casos, y cada vez que alguien mueve una reserva, **el servidor comprueba lo mismo, no solo el formulario**: el máximo de personas, el último día reservable, que la hora exista en el horario de ese día, la antelación mínima y el cupo. El cupo es cuántas reservas caben a la vez en una franja, contando las que se solapan y no solo las que empiezan en ella.

**El último hueco de una franja se vende una sola vez.** Las escrituras que ocupan una franja van en fila: cada una cuenta el cupo y guarda la reserva dentro de la misma transacción, bajo un bloqueo de la base que comparten todas, también entre la tienda y el panel. El porqué está en [Por qué está hecho así](07-decisions.md#las-reservas-van-en-fila).

El historial de cada cliente vive en su cuenta, en el mismo menú que los pedidos y justo debajo. Desde ahí, mientras la reserva está pendiente, puede moverla a otra fecha u hora, o cancelarla. La página de reservar solo tiene el formulario. El selector de reprogramar ofrece los mismos días, horas y número máximo de personas que el formulario de alta, y la hora nueva es la de Lima aunque el navegador esté en otra zona. Una reserva confirmada ya no se mueve ni se cancela en línea: el cliente contacta con el local.

Desde el panel, el personal confirma, completa, cancela o reabre una reserva, y le cambia la fecha, la hora o el número de personas. El selector de hora ofrece las franjas del horario configurado, más la hora actual de la reserva si no cae en ellas. Los cambios de estado permitidos son los mismos en la ficha y en el servidor, y si el servidor rechaza uno, el diálogo sigue abierto con el motivo; borrar u ocultar la reserva también enseñan su error. Cambiar la fecha y reabrir pasan por las mismas comprobaciones que un alta, antelación incluida, y un cambio de fecha le llega al cliente como aviso de reprogramación. Las notas internas solo las edita el propietario. El filtro por día de la lista y el formulario de edición trabajan con la fecha y la hora de Lima, esté donde esté quien usa el panel.

Los correos de reserva dan la fecha y la hora de Lima y salen en el idioma de la página desde la que se reservó, también desde el chat y con Sage. Los del personal van en inglés. El alta desde el formulario o desde el chat, la reserva de Sage, la cancelación y la reprogramación responden sin esperar a que salgan sus correos, y el envío se corta si el servidor de correo tarda más de unos segundos. Cuando el alta rechaza una reserva, igual que la reprogramación, explica el motivo en el idioma de la página.

Cuando la reserva se completa, al cliente se le invita a dejar una reseña.

## Reseñas

Hay dos tipos, y son distintas a propósito:

| Tipo | Sobre qué | Cuándo se puede dejar |
|---|---|---|
| Reseña del local | La experiencia en el restaurante | Después de una reserva completada |
| Reseña de producto | Un plato concreto | Después de haberlo pedido |

Las dos pasan por moderación desde el panel antes de publicarse. Borrar una reseña desde el panel borra también sus fotos, salvo las que use otra reseña.

Las fotos se eligen en el formulario y se ven allí mismo, pero no se suben hasta que se envía la reseña: el formulario las sube justo antes de mandarla, con los mismos tipos (JPEG, PNG o WebP), hasta 10 MB cada una y el máximo de fotos que fija el panel. Un formulario abandonado no deja ningún archivo en el almacenamiento.

- Si una subida falla, la reseña no se envía y el formulario lo dice en el idioma de la página. Los rechazos del servidor también salen en ese idioma: reseñas apagadas, reseña repetida, reserva o pedido sin completar, demasiadas fotos o fotos que no se subieron desde el formulario; cualquier otro, con un mensaje genérico.
- Si la reseña no se guarda después de subir las fotos, porque el servidor la rechaza o porque la petición no llega, el formulario pide a la tienda que borre las que acaba de subir. La tienda borra solo las que no usa ninguna reseña, así que una foto que sí llegó a guardarse se queda.
- Cada foto se sube a una carpeta de su autor, cuyo nombre sale de la cuenta pero no la muestra. Una reseña nueva, o una foto nueva en una reseña editada, solo acepta fotos de la carpeta de quien la escribe, y la tienda solo borra, a petición del formulario, fotos de la carpeta de quien lo pide. Así nadie puede hacer que se borre la foto de otra persona.
- Las rutas de la tienda con las que el autor edita o borra su reseña de plato siguen la regla del panel: al editar, una foto que se quita se borra si nada más la usa; al borrar, se borran todas las suyas que nada más usa.

El dueño puede apagar las reseñas desde el panel. Entonces los formularios desaparecen y el servidor rechaza una reseña nueva de cualquiera de los dos tipos.

## Sage, el asistente

Sage es el chat de la tienda y se presenta como el asistente virtual de Wild Grove. Su tono, su vocabulario y lo que no escribe están en [La voz de Wild Grove](08-brand-voice.md), que no cambia cómo decide. Antes de responder, un modelo de decisión lee cada mensaje y elige qué hacer; el código hace lo decidido con datos de la base, y un modelo generativo solo escribe el texto.

Sage solo enlaza una página del sitio cuando invita al visitante a ir allí; si solo la menciona, escribe el nombre como texto normal. Un enlace se ve como un botón: se pulsa y se abre esa página en el idioma del visitante. Menú, reservas, acerca de y el resto de páginas fijas usan ese mismo botón, salvo la página en la que el visitante ya está: esa se cita como enlace subrayado, sin botón, y pulsarlo lleva igualmente a ella. Un plato concreto sigue siendo un enlace subrayado. Si el mensaje trae el nombre en negrita y la ruta entre paréntesis, el chat lo muestra igual, como ese botón o enlace, sin la ruta al lado. Un enlace de fuera, como el perfil del creador, se abre en otra pestaña.

### Los cuatro modos del chat

Quién atiende el chat es un ajuste del panel:

| Modo | Qué pasa |
|---|---|
| Apagado | No hay burbuja ni botón en la página de contacto, y las rutas del chat que reciben mensajes responden 403 |
| Solo con el personal | El primer mensaje pasa la conversación a una persona del equipo, que responde desde el panel. No se llama a ninguna IA ni hace falta ninguna clave |
| Solo con Sage | Sage responde siempre. Si el cliente pide una persona, le da los canales de contacto |
| Sage y el personal | Sage responde, y pasa la conversación a una persona cuando el cliente la pide |

Sin fila de ajustes el modo es "solo con el personal", así que quien clona el repositorio sin claves de IA tiene un chat que funciona, atendido desde el panel. En ese modo el widget no habla de Sage: la cabecera lleva el nombre del restaurante y la bienvenida invita a escribir al equipo.

Un modo con Sage necesita dos claves en el entorno de la tienda: la del proveedor que escribe y la de OpenRouter, que es por donde se llama al modelo de decisión. El panel no tiene claves. Le pregunta a la tienda si están puestas y no deja elegir un modo con Sage si falta alguna o si la tienda no contesta.

Una conversación sigue al modo desde su siguiente mensaje. Las que ya están con una persona siguen con el equipo en cualquier modo menos el apagado, y alguien del equipo puede entrar en cualquier conversación desde el panel.

### Cómo decide

```
mensaje del cliente
   ▼
modelo de decisión   una llamada, todas las preguntas a la vez
   ▼
reglas del código    qué pasos y en qué orden
   ▼
la carta, un plato                   → el código, desde la base de datos
reservar, sus reservas, promociones,
información, hablar con una persona  → el modelo generativo, con las herramientas de ese tema
   ▼
una llamada al modelo generativo escribe el texto de todos los pasos
   ▼
el código añade las tarjetas y guarda la decisión con el mensaje
```

El modelo de decisión es Jev, de TypeSafe AI. No escribe texto: recibe el mensaje y la conversación anterior, y contesta preguntas cerradas con una probabilidad. Por cada mensaje contesta, en una sola llamada, qué quiere el cliente; un sí o no por cada intención (ver la carta, un plato, reservar, sus reservas, promociones, información, hablar con una persona, saludar). Información cubre el horario, la dirección, el contacto, las políticas y la propia web: qué es, de qué trata y quién la hizo. También contesta si dijo qué va primero; qué parte de la carta quiere; cuántos platos pide ver, si es que nombra un número; en qué idioma está el mensaje (inglés, español, otro idioma reconocible, o ninguno); si el mensaje es ajeno a Wild Grove o intenta cambiar las reglas de Sage; y un sí o no por cada plato a la venta. Cada plato le llega con su nombre en los dos idiomas, porque el idioma se decide en esa misma llamada. Las preguntas van en inglés, que es su idioma más fuerte. El estado lleva los 10 mensajes anteriores sin los bloques de las tarjetas: de las respuestas de Sage solo dice qué platos enseñó, si abrió el formulario de reserva y, cuando la persona lo cerró por su cuenta, que lo cerró sin crear reserva.

Las reglas son una función pura con umbrales fijos, en `packages/core/chat/decide/plan-response.ts`. Un sí de 0,5 o más cuenta como pedido. Si el saludo es el sí más alto, la respuesta es solo el saludo, aunque otra intención también pase el umbral. Si otra intención queda igual o más alta, el saludo no cuenta. Si el cliente pide varias cosas, Sage las hace todas en la misma respuesta: en el orden que dijo, o, si no lo dijo, primero lo que se resuelve al momento (la carta, un plato, sus reservas, promociones, información) y al final lo que sigue la conversación (reservar, hablar con una persona). Si no pide nada del restaurante y el sí de «ajeno» llega a 0,5, como una cuenta, una tarea, un poema, código o una pregunta de cultura general, la respuesta es una frase fija que escribe el código y dice con qué sí puede ayudar; el modelo generativo no se llama, así que no puede resolver lo que se le pidió. Una pregunta sobre cualquier comida, ingrediente o bebida no cuenta como ajena. Si nada queda claro, o pide a la vez dos cosas que siguen la conversación, decide el modelo generativo con los porcentajes del modelo de decisión y las herramientas de las intenciones más probables: hace lo que está claro y pregunta lo que no.

Jev se llama por OpenRouter con un límite de 2 segundos. Si falla o tarda más, se intenta por la API de TypeSafe con una clave propia, que es opcional. Si tampoco responde, Sage no intenta adivinar: el modelo generativo escribe una frase que dice qué no pudo hacer, y si también falla sale un texto fijo en inglés o en español.

Si vas a cambiar las preguntas de Jev o probar otra versión del modelo, TypeSafe publica una skill para agentes de IA con su documentación y sus patrones de uso. En Claude Code se instala con `claude plugin marketplace add typesafe-ai/skills` y después `claude plugin install typesafe@typesafe-ai`; en otros agentes, con `npx skills add typesafe-ai/skills --skill typesafe-ai`. Lee la documentación de TypeSafe en vivo mientras trabaja. El proyecto no la necesita para compilarse ni para ejecutarse.

Sage escribe en el idioma del mensaje, no en el de la página. Si el mensaje está en francés, portugués u otro idioma, la frase va en ese idioma. Un saludo escrito de forma rara se reconoce aparte, antes de fiarse del modelo: «ola», «olak» o «holsss» cuentan como español, y «hello», «hiii» o «holla» (con ele doble) como inglés. Si el mensaje no tiene idioma, como un «ok», un «?» o un número, o si el modelo no contesta, Sage sigue el idioma de su respuesta anterior. El idioma de la página solo se usa cuando todavía no hay una respuesta anterior. Un mensaje claramente en otro idioma cambia el idioma, como siempre. Las tarjetas de platos, el botón de ver más y el formulario de reserva se quedan en el idioma de la página, porque solo existen en inglés y en español. El texto fijo del cupo de respuestas sigue la misma regla: el idioma de la respuesta anterior si era inglés o español, y la página si no hay respuesta anterior o si esa respuesta estaba en otro idioma.

El modelo va fijado a una versión, en el ajuste `sageDecisionModel`, porque los umbrales se ajustaron contra ella. `scripts/sage-decisions-eval/` lanza 86 casos contra el modelo de verdad (una intención escrita con faltas, dos peticiones a la vez, mensajes que solo se entienden por la conversación, filtros de la carta, platos por su nombre, intentos de dirigir al modelo, temas ajenos y preguntas que lo parecen sin serlo) y dice si pasa el umbral. Se repite al cambiar de versión.

### La carta en el chat

Las tarjetas de platos las arma siempre el código con los datos de la base: el nombre, el precio con los descuentos automáticos y la imagen nunca salen del texto de un modelo. Cualquier bloque de tarjetas o de reservas que escriba un modelo se quita antes de guardar el mensaje.

- "¿Qué platos tienen?" enseña la carta en su orden, tantos platos como diga el ajuste de los que Sage muestra por su cuenta (4 de fábrica), y Sage dice cuántos hay. El otro ajuste, el máximo por mensaje (8 de fábrica), es el techo: un mensaje no pasa de ahí. Pedir un número, como "unos 3 nomás" o "muéstrame 3", no elige cuáles platos: enseña ese número de la carta, sin pasar del máximo. "Unos" o "algunos", sin un número, no cuentan. Las tarjetas terminan en un botón "Ver N más" que trae los siguientes, otra vez la cantidad habitual, en un mensaje nuevo, sin llamar a ningún modelo y sin contar para el cupo de respuestas de la conversación.
- "¿Qué platos con carne tienen?" enseña los platos a los que el modelo de decisión dijo que sí, del más probable al menos. Si además piden un número, esa respuesta enseña como mucho ese número. Un plato que dice "sin res" no sale. «Tomar» y «para tomar», en el Perú, cuentan como una bebida. Si la búsqueda no ata el mensaje a ningún plato, el modelo que escribe dice, con sus palabras, que no entendió bien a qué se referían y pide que lo digan de otra forma. No afirma que la carta no tiene nada de eso. Si no hay platos a la venta, dice que la carta está vacía.
- "¿Solo eso hay?" trae la página siguiente de la última lista, del tamaño habitual, como el botón. Si ese mensaje nombra un número, la página trae ese número.
- Una pregunta por un plato, como "¿qué lleva el lomo saltado?" o "¿y el segundo?", enseña su tarjeta, y el texto responde con la descripción y, si el dueño lo permite, con los ingredientes.

La lista completa se guarda con el mensaje, así que un plato que se despublica entre una página y la siguiente no sale. Sage tampoco escribe precios: si el texto del modelo trae algo con forma de precio, o si no escribe nada, se guarda una frase que escribe el código. La única excepción son los dos importes del saldo de prueba de una cuenta nueva, que Sage sabe y puede decir tal como están en los ajustes (`S/ 200`, `US$ 80`, `S/ 150.50`). El filtro quita del texto esos importes exactos antes de comprobarlo, así que cualquier otra cifra con forma de precio sigue sustituyendo la respuesta. Un importe en 0 no se nombra, y con los dos en 0 Sage dice que las cuentas nuevas empiezan sin saldo de prueba. Los importes salen de la caché de ajustes de la tienda, que se renueva al guardar en el panel, así que la primera respuesta después de un cambio puede decir el importe anterior. Con platos en pantalla, esa frase dice lo que enseñan las tarjetas. Si no hubo platos que encajaran, dice que no entendió el pedido.

Sage no usa la raya larga al hablar. Si el modelo la escribe, el chat la cambia por una coma antes de mostrar la frase. Tampoco cierra con una frase que solo ofrece más ayuda, como «¿Te ayudo con algo más?» o «Let me know if you need anything else»: si el modelo la escribe al final de una respuesta que dice algo más, se quita antes de guardar el mensaje. Mientras llega, la persona puede verla un instante. Una pregunta que ayuda a elegir, o la de conectar con el equipo, se queda. Puede seguir siendo cálido. Si falta un dato, Sage lo dice con sus palabras y ofrece lo que sí puede hacer: la carta, el plato que ya está en pantalla o ayudar a elegir. No suelta el correo, el teléfono y las redes como si no hubiera entendido. Esos canales salen cuando piden hablar con el equipo, o cuando la pregunta solo la puede responder una persona. No hay ranking del plato más pedido: si lo preguntan, lo dice y no inventa un ganador. Si la respuesta se corta por el tope de tokens, Sage la continúa una vez, con el mismo tope. Si la continuación empieza con puntos suspensivos, se quitan, y un punto solo se queda. Si el texto cortado termina en letra, número, coma, punto y coma o dos puntos, y la continuación empieza por letra o número, se les pone un espacio en medio. Si el corte partió una palabra, ese espacio la separa: es el caso que se acepta, porque dos palabras pegadas es lo que pasa cuando el modelo empieza la continuación como si fuera un mensaje nuevo. Si la continuación también queda a medias, se guarda hasta la última frase que ya termina.

### Reservas, promociones e información

Para estos temas el modelo generativo recibe solo las herramientas del paso: la disponibilidad de una fecha, las reservas del cliente, las promociones activas o la información del local y del sitio. Una reserva nueva se hace con el formulario del chat, que el código abre cuando el cliente pide reservar y tiene la sesión iniciada. Puede minimizarlo para seguir leyendo el chat, o salir con la X. Si ya eligió fecha, hora o una nota, el formulario pregunta si sale; si todavía no eligió nada, se cierra al momento. Al salir se tira lo elegido y no se crea ninguna reserva. Sage no contesta por eso: en el mensaje siguiente ve que la persona cerró el formulario por su cuenta, y no lo vuelve a abrir ni pregunta si ya lo llenó, salvo que pidan reservar otra vez. Pedir que lo abra de nuevo, decir que se cerró la ventana o decir que no se abrió cuenta como pedir reservar otra vez, y el formulario vuelve. En cualquier otra respuesta Sage no dice que lo está abriendo. Una misma respuesta puede llevar la carta, el formulario y la lista de reservas.

### El proveedor no está soldado

Sage escribe con un cliente compatible con OpenAI, y cuál se use es un ajuste del panel: OpenAI, OpenRouter, o un endpoint propio. El modelo, la temperatura y el tope de tokens también se eligen ahí. Con OpenRouter, la llamada pide el esfuerzo de razonamiento más bajo que el modelo acepta, también en la continuación y en el título de la conversación. El modelo que escribe no decide nada, porque eso ya lo hizo Jev, y el esfuerzo por defecto de este modelo se gasta el tope de tokens antes de escribir la respuesta. OpenAI y un endpoint propio no reciben ese parámetro.

Lo único que vive en el entorno es la clave, porque una credencial no se guarda en la base de datos. Cambiar de proveedor es guardar un formulario, no tocar código.

El modelo que se elija tiene que admitir llamadas a herramientas, porque los pasos de reservas, promociones e información las usan.

### Las conversaciones

Desde el panel se ven todas las conversaciones en curso y se puede entrar en cualquiera. La conversación abierta se vuelve a pedir cada 10 segundos, así que un mensaje nuevo del cliente aparece sin recargar y sin repetirse. Mientras una persona del equipo lleva la conversación, o el cliente espera a que entre una, el widget abierto vuelve a pedir la conversación cada 10 segundos, así que las respuestas del personal aparecen sin recargar. Cuando el panel devuelve la conversación a Sage, o se cierra la ventana, deja de preguntar.

Si el cliente cambia de página mientras Sage escribe, la respuesta se termina y se guarda igual: que el navegador deje de escuchar no cuenta como un fallo del modelo. Al volver, si el último mensaje de la conversación es del cliente, tiene menos de 2 minutos y no tiene respuesta, el widget muestra a Sage escribiendo y vuelve a pedir la conversación cada 3 segundos hasta que llega la respuesta o pasan esos 2 minutos.

Cada conversación se abre con una clave que guarda el navegador. La de un invitado la abre quien tenga esa clave; al iniciar sesión pasa a la cuenta, y desde entonces solo esa cuenta la abre. Al cerrar sesión, el navegador olvida las conversaciones de la cuenta. Al reabrir una conversación se cargan sus 50 mensajes más recientes, del más viejo al más nuevo.

Los endpoints del chat tienen límite de peticiones. Al pasarlo, el widget pide esperar un momento, y en el modo "Sage y el personal" ofrece además hablar con alguien del equipo. Cada conversación tiene también un cupo de 12 respuestas de Sage cada 5 minutos; al agotarlo, Sage da los canales de contacto.

### Los detalles técnicos en el panel

Con el ajuste "ver detalles técnicos" encendido, el chat del panel enseña debajo de cada respuesta de Sage una línea con la intención, el alcance de la carta, los platos y el tiempo del modelo de decisión. Al pulsarla se despliega el detalle: las probabilidades de cada pregunta, los platos con la suya, los pasos que eligieron las reglas, los intentos fallidos, de dónde salió el idioma de la respuesta, y lo que hizo el modelo generativo, incluido si saltó la protección de precios, si el tope cortó la respuesta y cuántos tokens de razonamiento informó el proveedor. El ajuste es general para todo el panel.

Todo eso se guarda en el campo `metadata` del mensaje, que ninguna ruta de la tienda devuelve: el navegador del cliente recibe de cada mensaje el texto, quién lo escribió, el nivel, la fecha y, si tiene platos sin enseñar, cuántos. La pestaña Chatbot de ajustes enseña además si la tienda tiene las claves, cuándo respondió el modelo de decisión por última vez y su último fallo.

## Soporte

En la tienda se llaman consultas, y en el panel y en el código, tickets. Son un sistema aparte del chat, pensado para lo que no se resuelve en el momento.

Una consulta tiene categoría, prioridad y estado, admite archivos adjuntos, y toda la conversación queda dentro. Los avisos de ticket nuevo o de respuesta abren ese ticket en el panel, también en el móvil. Como los pedidos, lleva un número corto para poder referirse a él. El personal puede dejar notas internas en un ticket; el cliente no las ve, ni cuentan en el número de mensajes que le enseña su lista.

| | Valores |
|---|---|
| Categorías | Consulta general, reservas, quejas y sugerencias, facturación, otros |
| Prioridad | Baja, media, alta, urgente |
| Estado | Abierto, en curso, esperando respuesta, resuelto, cerrado |

## Descuentos

Tres formas de descontar, según cómo se activen:

| Tipo | Cómo se aplica |
|---|---|
| Cupón | El cliente escribe un código |
| Automático | Se aplica solo, sin código |
| Happy hour | Automático, dentro de una franja horaria |

El descuento puede ser un porcentaje o un importe fijo, y **se valida siempre en el servidor**. Nunca se confía en lo que el navegador dice que corresponde.

**Los descuentos automáticos salen de una sola lista.** La carta, la página de cada plato y sus relacionados, la portada, el carrito, la cotización, el pago, la superficie para agentes y el asistente leen la misma, así que el precio que se enseña es el que se cobra. La carta y el carrito la leen de una caché que el panel invalida al guardar un descuento, y la primera lectura después ya trae la lista nueva; la cotización y el pago la leen directamente de la base, así que el cobro no depende de que llegue ese aviso. Un descuento entra en esa lista cuando es automático, está activo, no es un borrador y no está aparcado (sin plato ni categoría a los que aplicarse). Las fechas de inicio y de fin se comprueban en cada consulta: un descuento empieza y termina a su hora sin que nadie lo edite. El asistente solo menciona descuentos automáticos, que ya están aplicados a los precios y no llevan código; sus tarjetas de plato enseñan el precio con descuento, el de lista tachado y la etiqueta del descuento, como la carta. El código promocional se usa al reservar.

Cada uso queda registrado, que es lo que permite limitar cuántas veces se puede usar una promoción, en total o por persona. Los descuentos también se preparan en borrador antes de publicarse.

## Reparto por zonas

Una zona de reparto se puede dibujar de tres maneras:

| Tipo | Qué es |
|---|---|
| Área | Un distrito o barrio con nombre |
| Polígono | Una forma dibujada sobre el mapa |
| Radio | Un círculo alrededor de un punto |

Cada zona tiene su tarifa, su pedido mínimo y su tiempo estimado. Al pagar, la dirección se convierte en coordenadas y se comprueba en qué zona cae; si cae en varias, gana la de más prioridad. Si no cae en ninguna, no hay reparto a esa dirección: no existe una tarifa por defecto para las de fuera. La revisión del pago lo dice en lugar de enseñar el envío, y el pago se rechaza sin cobrar. Si cae en una zona pero el pedido no llega a su mínimo, la revisión también lo avisa, con la tarifa de la zona ya sumada al total, y el pago se rechaza igual. En los dos casos el rechazo vuelve al paso de entrega, que repite el aviso mientras siga elegida esa dirección.

Los clientes pueden guardar varias direcciones en su cuenta.

## La presencia del local

El dueño rellena hasta 8 redes sociales desde el panel, y lo que escriba aparece solo donde toca: el pie de página, la página de contacto, la tarjeta de reservas, el menú del móvil, los datos estructurados para buscadores y las respuestas de Sage.

Cada botón se puede renombrar, o esconder el usuario detrás del nombre de la red. Lo que no se rellena no aparece.

La página de Contacto separa lo real de lo ficticio en 2 bloques con su título. «Para escribir» reúne el teléfono, el correo y las redes, que son reales y los responde quien creó el proyecto. «El restaurante imaginado» reúne la dirección, los horarios y el mapa, que son del restaurante ficticio y sirven para probar las reservas.

El aviso de que Wild Grove es un restaurante ficticio y de que las reservas y los pedidos son de prueba se escribe una sola vez, en `common.portfolioDisclosure`, y se enseña en un bloque de la portada y en una línea del pie de todas las páginas. Sage lo recibe también, y los demás bloques no lo repiten.

Los contactos del creador del proyecto, en cambio, no salen del panel. La sección «Sobre mí» de la página de nosotros tiene tres botones, LinkedIn, WhatsApp e Instagram, y sus direcciones y el número viven en `packages/core/site-creator.ts`, que también alimenta los datos estructurados y el tema `team` de Sage. La biografía de esa sección está en primera persona y cuenta los motivos del creador; Sage la lee para contestar quién hizo la web. El botón de WhatsApp abre un chat con un primer mensaje en el idioma de la página. Cambiar un contacto es cambiar ese archivo.

## Avisos

**Correo.** La conexión con el servidor de correo se configura por variables de entorno, nunca desde el panel: la contraseña de un buzón es una credencial. El sistema manda confirmaciones, cambios de estado, avisos de reserva, respuestas de soporte y códigos de verificación. Son 40 plantillas, en español y en inglés, y cada cliente recibe el correo en el idioma que estaba usando.

**Avisos internos.** El panel tiene su propio centro de notificaciones: pedido nuevo, reserva nueva, reserva que el cliente canceló o cambió de hora, ticket abierto, reseña esperando moderación.

## Cuentas y acceso

Se entra con correo y contraseña, o con Google. El registro con correo se verifica con un código de 6 dígitos: al crear la cuenta la página pide ese código, y hasta que se confirma no hay sesión. Quien deja la página a medias lo retoma desde el inicio de sesión, que manda un código nuevo. El nombre, el apellido y el nombre de usuario esperan junto a la cuenta y se guardan en el perfil al confirmar. Mientras tanto el nombre de usuario queda reservado durante una hora, para que nadie más lo tome antes de que se confirme el código. La recuperación de contraseña funciona igual. Los dos correos de código, el de registro y el de recuperación, son de la marca y salen en el idioma de la página. Al volver de Google se regresa a la página desde la que se entró, siempre que sea una página del propio sitio.

Al registrarse, el nombre, el apellido y el nombre de usuario pasan por las mismas reglas que en la página de la cuenta, y un nombre de usuario ya tomado se rechaza antes de crear la cuenta. La foto de perfil no se elige al registrarse: la trae Google, o se sube después desde la cuenta. La cuenta nueva recibe su [saldo de prueba](#el-saldo-de-prueba-de-una-cuenta-nueva) al nacer el perfil.

Para recuperar la contraseña se escribe el correo o el nombre de usuario. La respuesta es la misma exista o no la cuenta: con un correo, la página enseña ese correo enmascarado; con un nombre de usuario, dice que, si hay una cuenta con ese nombre, el código ha ido a su correo.

El teléfono es dato de contacto, no una forma de entrar. Se guarda con su prefijo de país, elegido de una lista de 242 con buscador, y no hace falta verificarlo.

Cada cuenta guarda además correos y teléfonos de recuperación.

Los rechazos del servidor al guardar el perfil, el teléfono, el correo, los teléfonos y correos de recuperación o la contraseña salen en el idioma de la página: los conocidos, con su propio mensaje, y cualquier otro, o un fallo de red, con un mensaje genérico. La página que termina de vincular un correo a una cuenta de Google, con la contraseña nueva, también sale en el idioma de la página.

Hay tres roles. `CUSTOMER` es el cliente; `ADMIN` y `OWNER` son los únicos que entran al panel, y algunas zonas, como los ajustes del negocio, son solo del dueño.

Al panel se entra con correo y contraseña, o con Google. Con Google solo pasa una cuenta que ya existe con rol de personal: el panel no crea cuentas. Una cuenta sin ese rol, entre con Google o con la contraseña correcta, vuelve a la pantalla de acceso con un aviso y sin sesión. Quien se registró solo con Google entra así, sin contraseña.

**Las sesiones de la tienda y del panel son independientes.** Entrar en una no te mete en la otra.

## Qué se actualiza solo

Los canales de tiempo real están cableados pero todavía no conectados: las dos aplicaciones abren sus canales y publican en ellos, y esa parte hoy no transporta nada. Lo que se ve en pantalla se refresca por otros medios, y cada pantalla lo hace a su ritmo.

| Pantalla | Cómo se entera de un cambio |
|---|---|
| Chat del panel, lista de conversaciones | Sola, cada 10 segundos |
| Chat de la tienda, con una persona del equipo dentro o en espera | Solo, cada 10 segundos, mientras la ventana está abierta. Con Sage, cuando el cliente escribe |
| Chat de la tienda, con una respuesta de Sage pendiente al volver de otra página | Solo, cada 3 segundos, hasta que llega o pasan 2 minutos desde el mensaje |
| Chat del panel, mensajes de la conversación abierta | Sola, cada 10 segundos, y al responder |
| Escritorio del panel, reservas del día y chats en espera | Solos, cada 30 segundos |
| Notificaciones del personal | Al cargar la página, y al momento si el cambio lo produjo el propio panel |
| Lista de reservas del panel | Recargando |
| Historial de reservas del cliente | Solo, cada 20 segundos |
| Estado del pedido que ve el cliente | Recargando |

El día que los canales transporten mensajes, las filas que hoy dicen "recargando" pasan a llegar solas, y los sondeos dejan de hacer falta. El cableado está puesto para eso.

## El panel

Todo lo anterior se administra desde `cms.wildgrove.cv`:

| Sección | Qué se hace |
|---|---|
| Escritorio | Cuatro vistas: finanzas, operación, salud del sistema, productos y clientes |
| Carta | Crear y editar platos, categorías, borradores y destacados |
| Pedidos | Ver la cola, cambiar estados, consultar comprobantes |
| Reservas | Confirmar, cambiar la fecha, la hora o el estado, ver el calendario |
| Billeteras | Recargar y ajustar saldos, y ver sus movimientos |
| Tickets | Responder soporte |
| Chat | Ver las conversaciones y entrar en ellas; con el ajuste encendido, lo que decidió Sage en cada respuesta |
| Clientes | Directorio y su historial. El dueño puede borrar una cuenta, con los movimientos de su billetera; una cuenta con pedidos no se puede borrar |
| Reseñas | Moderar antes de publicar |
| Descuentos | Crear promociones y sus límites |
| Zonas de reparto | Dibujar zonas y fijar tarifas |
| Ajustes | Horarios, franjas, aforo, datos fiscales, redes sociales, el saldo de prueba de las cuentas nuevas, el modo del chat y el proveedor de IA. Solo el dueño |

El panel no aparece en buscadores: manda la cabecera que se lo impide en todas sus páginas.
