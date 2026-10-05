---
title: decisions
updated: 2026-10-04
status: current
---

# Por qué está hecho así

Las decisiones que dieron forma al proyecto, con la alternativa que se descartó en cada una. Están agrupadas por tema, no por fecha.

No están todas. Las que solo hablan de dónde está alojado el proyecto no se publican, y las que se echaron atrás más tarde tampoco, porque contar una decisión que ya no está vigente confunde más de lo que explica.

---

## El stack

**Next.js con App Router.** Los componentes de servidor permiten leer la base de datos mientras se renderiza la página, sin montar una API solo para la primera carga. Para un sitio que tiene que salir en buscadores y cargar rápido en móvil, eso decide.

**Prisma, no el cliente del backend directamente.** Un esquema declarado, migraciones versionadas y tipos generados. Y sobre todo, independencia: cuando el backend cambió de proveedor, la capa de datos no se tocó.

**InsForge autoalojado.** El proyecto empezó sobre un servicio gestionado y se movió a InsForge, que es de código abierto y se puede alojar donde uno quiera. El motivo fue no quedar atado a un proveedor que puede cambiar precios o cerrar.

**La verificación por SMS se quitó entera.** Durante un tiempo el registro con teléfono mandaba un código por SMS, con Telnyx. Se eliminó: un restaurante no necesita demostrar que un número existe, necesita poder llamar a quien reservó. El teléfono pasó a ser dato de contacto y desapareció un proveedor externo, una tabla, unas rutas y un coste por mensaje.

La lección no es que Telnyx fuera mala elección, sino que la función no hacía falta. Quitar algo que funciona cuesta más que construirlo.

**SMTP propio para el correo, no un servicio transaccional.** Los servicios de correo transaccional son más cómodos, pero cobran por volumen y atan el dominio a su reputación. Con SMTP el coste es fijo y el dominio es propio.

**El proveedor de IA tampoco está soldado.** Sage habla con un cliente compatible con OpenAI, y cuál se use es un ajuste del panel. La razón es la misma que con los pagos: el proveedor de modelos es la parte del sistema que más rápido cambia de precio y de calidad.

**El historial de migraciones empieza en el esquema completo.** La primera migración, `0_init`, crea las 30 tablas de una vez, y las siguientes añaden sobre ella. Las 43 migraciones que había antes no podían construir el esquema desde una base vacía: 20 modelos no se creaban en ninguna, y 4 tablas que el esquema ya no tenía sí se creaban. Se descartó escribir las que faltaban y colocarlas al principio, porque obligaba a inventar un orden que nunca existió y varias de las siguientes habrían fallado sobre tablas ya correctas. En producción, `0_init` se marcó como aplicada sin ejecutarla, después de comprobar que el esquema real coincidía con el del repositorio.

---

## El dinero

Es la parte donde más cuidado se puso, porque un error aquí se nota en la cuenta de alguien.

**La billetera en lugar de una pasarela de pago.** Se podía haber esperado a integrar una pasarela para lanzar. En lugar de eso se hizo un saldo interno que el dueño recarga, y el sistema quedó completo y usable sin depender de la aprobación de nadie.

**El cobro llama a una interfaz, no a un proveedor concreto.** Hoy solo hay una implementación, la billetera, pero la lógica de pedidos nunca la nombra: pide cobrar y quien cobre es cosa del registro de proveedores. Añadir una pasarela más adelante es escribir una implementación nueva, no tocar los pedidos.

**Cada movimiento puede llevar clave de idempotencia.** Si la misma operación llega dos veces, por un reintento de red o un doble clic, la segunda choca con esa clave y no se aplica. Sin esto, un cliente con mala conexión paga dos veces el mismo pedido.

**Los dos precios se escriben a mano, no se convierten.** Un plato tiene precio en soles y en dólares, fijados por separado. La conversión automática habría dado precios como 8,37, y un precio de carta redondeado vende mejor.

**Boleta y factura, con sus series.** Son los dos comprobantes que se usan en Perú y funcionan distinto: la boleta admite DNI opcional, la factura exige RUC, razón social y dirección fiscal. Meterlos desde el principio evitó tener que reabrir el modelo de pedidos después.

---

## El cobro y el pedido se escriben juntos

Cobrar, devolver o volver a cobrar mueve dinero y cambia un pedido. Si las dos escrituras van por separado, lo que pase entre ellas (una caída del proceso, una segunda pestaña, un reintento) deja un cargo sin pedido o un pedido sin cargo.

**El proveedor de pago cobra dentro de la transacción de quien lo llama.** `OrderService` abre la transacción, escribe el pedido y le pasa esa transacción a la interfaz de pago, que sigue sin saber que detrás está la billetera. Si algo falla, se deshace todo junto. Se descartaron 3 alternativas:

- **Cobrar y, si el pedido falla, devolver.** Entre el cobro y la devolución queda una ventana en la que una caída deja el cargo sin pedido y sin devolver.
- **Que `OrderService` llame directamente a la billetera.** Es el cambio más corto, y rompe la regla de que la lógica de pedidos no nombra al proveedor.
- **Bloquear el pedido y dejar que el proveedor abra su propia transacción.** Cada operación ocuparía 2 conexiones a la vez, y el cobro confirmaría antes que el pedido.

**El estado de un pedido se escribe con una condición.** Cancelar, cambiar de estado, el cambio manual del panel y reactivar solo escriben si el pedido sigue en un estado desde el que esa operación vale. Si dos operaciones se cruzan, PostgreSQL hace esperar a la segunda, que al volver a evaluar la condición no encuentra ninguna fila y falla sin mover dinero. Es el mismo patrón con que la billetera cobra solo si el saldo sigue alcanzando. Se descartó `SELECT ... FOR UPDATE`, que da la misma garantía pero Prisma no lo expresa.

**Un pago se devuelve una vez porque su clave sale del pago, no de la llamada.** La clave del reembolso se forma con el pedido y la hora en que se pagó. Dos cancelaciones del mismo pago generan la misma clave y la segunda choca. Reactivar renueva esa hora, así que el ciclo siguiente tiene sus propias claves. Una clave por pedido habría bloqueado el segundo reembolso legítimo, el que llega después de reactivar.

**Pagar retira las líneas del carrito como condición para crear el pedido.** Dentro de la transacción, lo primero es retirar exactamente las líneas que se cotizaron. Si dos pestañas pagan el mismo carrito, la segunda espera, no encuentra nada que retirar y se deshace sin cobrar. La clave del pago no puede resolver ese caso, porque cada pestaña tiene la suya.

**La clave del pago dura lo que dura el intento.** La página de pago la crea al abrirse y la conserva tras un error o una caída de la red. Si el reintento llega con una clave que ya llevó a un pedido, la tienda responde con ese pedido en lugar de cobrar otra vez. Solo se estrena otra clave cuando el servidor dice que la usada pertenece a otra cosa.

---

## El saldo de prueba nace con la cuenta

Una cuenta nueva empezaba con las billeteras en cero, y como la billetera es el único método de pago, nadie podía probar un pedido sin pedirle una recarga al dueño. Cada cuenta nueva recibe ahora un saldo de prueba, una sola vez, y los importes los fija el dueño en el panel.

**El abono va en la misma transacción que crea el perfil.** El perfil de un usuario lo puede crear una sola transacción, porque su clave primaria se lo impide a las demás. Con el abono dentro de esa transacción, el perfil existe si y solo si el saldo se abonó. Eso da a la vez cuatro garantías: el saldo se da una vez aunque el registro se repita o haya dos pestañas abiertas, nunca se da a medias, nunca llega a una cuenta que ya existía, y lo que se haga después con el historial no lo vuelve a habilitar. Si dos altas simultáneas chocan, la que pierde se deshace entera y sigue como una actualización del perfil que creó la otra.

Se descartaron 4 alternativas:

- **Una marca en el perfil que se comprueba en cada sincronización.** Da la misma garantía con más piezas: habría que marcar todos los perfiles que ya existen, y cada sincronización tendría que reclamar la marca con una escritura condicional.
- **Mirar si ya hay un movimiento de saldo inicial.** El dueño puede borrar el historial, y entonces la cuenta lo recibiría otra vez.
- **Abonar cuando el saldo es cero.** Una cuenta que gastó su saldo volvería a recibirlo.
- **Abonar al consultar la billetera o al pagar.** Llegaría también a las cuentas que ya existen.

Lo que se acepta a cambio: un usuario que se registró antes y todavía no tenía perfil recibe el saldo cuando el perfil nace, porque para la tienda es una cuenta nueva.

**Un tipo de movimiento propio, `INITIAL_BALANCE`.** `RECHARGE` y los ajustes significan que el movimiento lo hizo el dueño: el panel y la tienda lo enseñarían como una recarga, el autor quedaría vacío donde se espera uno y la recarga avisa a todo el personal.

**Borrar una cuenta borra los movimientos de su billetera.** Con el saldo inicial toda cuenta nueva nace con movimientos, y la clave foránea de `WalletTransaction` los protege con `ON DELETE RESTRICT`, así que ninguna se podría borrar desde el panel. Se descartó cambiar esa clave a `CASCADE`, porque es una migración que modifica una restricción en producción para servir a una sola ruta, y borrar solo los movimientos del saldo inicial, porque una cuenta con una única recarga manual seguiría sin poder borrarse. Una cuenta con pedidos sigue protegida por la clave de `Order`, y la transacción se deshace entera.

**Sage dice los dos importes, y solo esos.** La regla de no escribir cifras de dinero tiene una excepción acotada: los importes del saldo de prueba, tal como salen de los ajustes. El filtro de precios quita del texto esas dos cadenas exactas antes de comprobarlo, de modo que `S/ 2000` o `S/ 200.50` siguen contando como precio. Se descartó permitir cualquier importe que empiece por `S/` o `US$` mientras Sage hable del saldo, porque dejaría pasar un precio inventado en la misma respuesta.

---

## Las reservas van en fila

Contar el cupo de una franja y guardar la reserva son dos sentencias. Si dos peticiones cuentan antes de que ninguna escriba, las dos ven la última mesa libre.

**Toda escritura que ocupa una franja pasa por una sola función**, `occupyReservationSlot` en `packages/core/reservation-occupy.ts`. Abre una transacción, toma un bloqueo consultivo de PostgreSQL que se suelta solo al terminarla, cuenta el cupo dentro de esa misma transacción y escribe solo si queda sitio. La usan el alta desde la tienda, el formulario del chat, Sage, la reprogramación del cliente y el cambio de fecha o la reapertura desde el panel. Cancelar libera sitio y no pasa por ella.

**Una sola clave de bloqueo para todas las reservas, no una por día o por franja.** Lo que ocupa una reserva es una duración global que puede pasar de un día, así que dos reservas de fechas distintas pueden competir por las mismas mesas. Las reservas llegan de pocas en pocas por minuto, y ponerlas en fila no se nota.

**La cuenta va por la transacción, y dentro de cada proceso las escrituras esperan turno antes de abrirla.** Cada proceso abre por defecto 2 conexiones a la base, y una petición que espera el bloqueo retiene la suya mientras espera. Si la cuenta fuera por fuera de la transacción, o si varias peticiones del mismo proceso esperaran el bloqueo a la vez, el proceso se quedaría sin conexión para nada más. Con el turno, cada proceso tiene como mucho una conexión esperando el bloqueo.

**La espera tiene límite.** La transacción espera como mucho 5 segundos a una conexión y dura como mucho 15. Dentro, PostgreSQL deja de esperar el bloqueo a los 10 segundos, antes de que Prisma deshaga la transacción por su cuenta, y esa escritura se contesta como franja ocupada en lugar de con un error del servidor.

Se descartaron 3 alternativas:

- **Transacciones `SERIALIZABLE` con reintento.** PostgreSQL abortaría una de las dos reservas que chocan, y cada uno de los 5 caminos que escriben tendría que reintentar y traducir el aborto. La garantía solo vale si todos usan ese nivel. El bloqueo da lo mismo con una espera en lugar de un aborto.
- **La actualización condicional de la billetera.** Actualiza una fila solo si el saldo sigue alcanzando, y el cupo de una franja no vive en ninguna fila: sale de contar las reservas que se solapan.
- **Una tabla de franjas con su contador.** Necesita una migración y no expresa franjas que se solapan.

---

## Los datos no se borran

**Un pedido nunca se elimina, se oculta.** El cliente puede quitarlo de su vista y el personal puede sacarlo de la cola, pero la fila sigue ahí. Un pedido es un registro con comprobante fiscal detrás; borrarlo es romper la contabilidad.

Lo mismo con las reservas. Y una fila oculta deja de contar en el escritorio, porque si no, los totales dejarían de cuadrar con lo que se ve en pantalla.

**Un pedido guarda una copia de lo que compró.** El nombre del plato, el precio antes y después del descuento, la zona de reparto. Sin esas copias, subirle el precio a un plato reescribiría pedidos del año pasado.

**Lo que se retira se archiva.** Hubo un bot de ventas por WhatsApp que se dejó de usar. En lugar de borrarlo, se archivó con su documentación, fuera de este repositorio. Borrar código que funcionó tira también el contexto de por qué se hizo.

---

## Cómo está partido

**El panel salió a su propia aplicación.** Antes era una sección dentro de la tienda, bajo `/admin`. Ahora es una aplicación aparte en su propio dominio.

La razón principal es que un cambio en el panel no debería poder tumbar la tienda pública, y sesiones separadas son una barrera más real que una comprobación de rol dentro de la misma aplicación. El coste fue tener que resolver la invalidación de caché entre dos despliegues, que está explicado en [Arquitectura](01-architecture.md).

**Las reseñas de local y de producto son tablas distintas.** Se podía haber hecho una sola tabla con un campo de tipo. Pero una opinión sobre una cena y una opinión sobre un plato no comparten ni los campos, ni el momento en que se piden, ni quién puede dejarlas. Unificarlas habría dejado la mitad de las columnas vacías en cada fila.

**Los dos idiomas van en la misma fila, con rutas traducidas.** La misma página es `/es/reservas` y `/en/reservations`, y en la carta lo que cambia es el `slug` del plato, no la ruta. La alternativa era una tabla de traducciones aparte, que habría metido una unión en la consulta más frecuente del sitio.

**El panel acepta Google, pero solo de cuentas que ya son de personal.** El botón de la pantalla de acceso lleva a Google, y al volver el panel busca el perfil de esa cuenta: si existe con rol `ADMIN` u `OWNER` abre la sesión, y si no, la rechaza sin dejar ninguna cookie. No crea ni modifica nada, porque el retorno de la tienda sí crea el perfil de quien llega, y en el panel eso habría dado de alta a cualquiera con una cuenta de Google. El rol se decide en la base de datos, no en Google: quitarle el rol a una cuenta le quita el acceso al panel por los dos caminos. Como el backend vincula Google a la cuenta que ya tiene ese correo, quien se registró solo con Google entra sin contraseña y quien la tiene entra por cualquiera de las dos vías.

La alternativa era dejar el panel solo con correo y contraseña, que es la superficie más estrecha. Obligaba a quien se registró con Google a crear antes una contraseña desde la tienda, y la pantalla de acceso no podía decirle por qué fallaba. También se descartó reutilizar el retorno de la tienda: crea perfiles, avisa a los administradores de un cliente nuevo y devuelve a una dirección que no es la del panel.

---

## El contenido del portafolio

**El contenido narrativo sale del panel, no del código.** Un portafolio con textos de relleno no demuestra nada. Si la carta, los horarios y los datos del local se editan desde el panel, lo que se enseña es el sistema funcionando, no una maqueta.

La excepción son las páginas de "sobre el creador" y las preguntas frecuentes de contacto, que sí están en el código. Esas hablan del autor, no del restaurante ficticio, y meterlas en el panel habría mezclado dos cosas distintas.

---

## Ninguna credencial vive en la base de datos

La conexión con el servidor de correo se configuraba desde el panel, y quedaba guardada en una columna. Eso significaba una contraseña en texto plano dentro de Postgres, que además el endpoint de ajustes devolvía entera a cualquier usuario con rol de administrador.

Se movió al entorno, donde viven las demás claves. La comodidad que se pierde es real: cambiar de proveedor de correo ahora exige volver a desplegar. Se aceptó porque una credencial filtrada no se arregla con un despliegue.

La regla quedó escrita en [Convenciones de código](../rules/02-code-conventions.md) en lugar de aquí, porque un documento de decisiones se lee para entender el pasado y una convención se lee antes de escribir código.

## La seguridad de las dependencias

**La política vive en el repositorio, no en la máquina de cada uno.** El archivo `.npmrc` de la raíz aplica a cada clon y a cada compilación en el servidor:

- Ningún script de dependencia se ejecuta al instalar.
- Solo se instalan versiones publicadas hace siete días o más.
- No se aceptan dependencias desde repositorios de git.

Los ataques reales contra el registro de paquetes han funcionado siempre igual: comprometer la cuenta de alguien, publicar una versión con código malicioso, y que ese código se ejecute solo con instalar. Esas tres líneas cortan las dos vías.

La política vive en el repositorio y no en la configuración personal de cada uno, así que también protege al servidor de compilación, que no ve la configuración de nadie.

**Cuando un aviso llega por una dependencia de otro paquete, se fuerza la versión corregida en vez de bajar el paquete.** Es lo que hace el bloque `overrides` del `package.json` de la raíz con `deepmerge-ts` y `mysql2`. Las dos llegan con la herramienta de Prisma (su configuración y su conector de MySQL, que el proyecto no usa), y Prisma 7.10 fija versiones con avisos altos. `npm audit fix --force` proponía bajar Prisma a la 6, que deshace el paso a Prisma 7. Con las dos versiones forzadas, la herramienta genera el cliente, valida el esquema y aplica todas las migraciones igual que antes. Esas dos líneas se quitan en cuanto una versión estable de Prisma traiga por sí sola `deepmerge-ts` 8 y `mysql2` 3.23.1 o posteriores: basta con borrarlas, regenerar el lockfile y comprobar que `npm audit` sigue limpio.

En el mismo bloque, `@types/google.maps` sigue a la versión de `@vis.gl/react-google-maps`, que pide los tipos de Google Maps de una versión mínima. Se suben juntos.

**TypeScript 7, con una copia de la 5.9 solo para el lint.** TypeScript solo revisa tipos: el JavaScript que se sirve lo genera el compilador de Next.js, así que cambiar de versión no cambia lo que llega al navegador. La 7 es un compilador nativo y revisa cada aplicación en alrededor de un segundo, frente a 7 u 8 con la 5.9. A cambio ya no trae la interfaz de JavaScript que usa `typescript-eslint` para leer el código, y `typescript-eslint` solo acepta TypeScript anterior a la 6.1. npm lo resuelve instalando la 7 en cada espacio de trabajo, que es la que usan `next build` y `tsc`, y la 5.9 en la raíz, que es la que carga el lint. Cuando `typescript-eslint` acepte la 7, esa segunda copia desaparece sola al regenerar el lockfile.

Desde la 6, TypeScript no carga por su cuenta los tipos de `@types/*`, así que cada `tsconfig.json` los declara en `types`.

**ESLint se queda en la 9.** `eslint-config-next` trae `eslint-plugin-react`, `eslint-plugin-import` y `eslint-plugin-jsx-a11y`, y las 3, en su última versión, declaran ESLint 9 como máximo. Forzar la 10 instala complementos que no la admiten. Se sube cuando esos complementos acepten la 10.

---

## La política de seguridad de contenido bloquea

Las dos aplicaciones mandan una cabecera `Content-Security-Policy` que el navegador aplica: cualquier script, imagen, conexión o iframe que no venga de un origen de la lista se bloquea. Si alguien consigue meter HTML en una página, no puede cargar código de otro sitio ni mandar datos a otro servidor.

La lista tiene 3 partes:

- El propio sitio y el backend. El origen del backend sale de `NEXT_PUBLIC_INSFORGE_URL`, la misma variable que usa el cliente del navegador, así que un clon que apunta a otro InsForge recibe una política que lo permite sin tocar la configuración.
- Google Maps, con los orígenes de la guía de CSP que Google publica para su API de JavaScript: el mapa, sus marcadores, el autocompletado de direcciones y el mapa incrustado de la página de contacto. Esa guía también pide `'unsafe-eval'`.
- Las fotos de perfil de Google y GitHub.

**Los scripts en línea siguen permitidos.** Next.js mete código en línea en cada página para arrancarla, y quitar `'unsafe-inline'` exige un nonce distinto en cada petición. Con nonce ninguna página puede generarse de antemano: todas se renderizan en cada visita, también las que hoy se sirven ya hechas, como la carta. Se aceptó `'unsafe-inline'` porque la política sigue cortando las cargas y las conexiones a otros orígenes, que es el camino por el que un ataque saca datos.

**Un origen nuevo se añade antes que la función que lo usa.** En este modo, un servicio externo que no está en la lista falla en producción sin que nadie lo vea en el servidor. Antes de activarla, la política pasó un tiempo en modo solo informe, y en septiembre de 2026 se recorrieron la tienda y el panel hasta que ninguna página la incumplía.

## No hay aviso de cookies

La tienda no tiene analítica, ni publicidad, ni ningún script que rastree a quien la visita. Usa cookies solo para mantener la sesión iniciada y recordar el idioma, y lo demás (el carrito sin cuenta, la moneda, el tema) lo guarda en el almacenamiento del navegador. Un aviso de cookies, en ese caso, pide permiso para algo que no pasa.

Hubo uno. Sus botones guardaban una marca en el navegador que nada leía, y su texto contradecía la política de privacidad. Se quitó. Si algún día entra un rastreador, el aviso vuelve con una función real: bloquearlo hasta que la persona acepte.

## Las aplicaciones viven donde viven los datos

Durante un tiempo las dos aplicaciones se sirvieron desde una plataforma de terceros mientras la base de datos estaba en el servidor del proyecto. Para que aquella plataforma pudiera leerla, **la base tenía que aceptar conexiones desde el internet público**. Juntarlas en la misma máquina es lo que permite cerrar esa puerta, y esa fue la razón de mover las aplicaciones, no el ahorro ni la velocidad.

Lo que se acepta a cambio está escrito sin adornos en [Arquitectura](01-architecture.md): una caída de esa máquina se lleva el sitio entero, y las páginas se generan en un solo sitio en lugar de en una red repartida por el mundo.

## Se compila fuera del servidor

La máquina tiene 2 procesadores, ninguna memoria de intercambio, y en ella corre la base de datos.

**Compilar ahí era posible y se descartó.** Un contenedor con la memoria acotada convierte quedarse sin memoria en un fallo del despliegue en lugar de en una elección del núcleo, así que el riesgo era manejable. Pierde por tres cosas concretas: gasta los dos procesadores durante más de un minuto en la misma máquina que atiende el tráfico, obliga a guardar el árbol de dependencias y las cachés de construcción en el mismo disco que los datos, y no deja memoria para tener arrancadas a la vez la versión que sirve y la que entra, que es lo que permite comprobar antes de cambiar el tráfico.

Compilar fuera exige resolver que **la compilación lee la base de datos**: las páginas de los platos consultan cuáles existen para generar sus rutas. Se resuelve dándole una base desechable que se crea y se destruye con cada compilación. Lo compilado sale con la carta vacía, y el despliegue la llena contra la base real antes de que nadie lo vea.

Eso tiene un efecto secundario que vale por sí solo: **cada compilación prueba las migraciones sobre una base limpia** con la misma imagen del migrador que se publica para el despliegue, antes de que lleguen a producción.

**La caché de imágenes optimizadas sobrevive al despliegue; la de páginas, no.** Las imágenes se optimizan en el propio servidor, sobre 2 procesadores, en 7 anchos y 2 formatos. Su caché va en un volumen que comparten las dos versiones de cada aplicación, porque está indexada por la imagen de origen y sus parámetros, no por la compilación: si se perdiera en cada despliegue, el servidor volvería a generar todos los tamaños. La caché de páginas se queda dentro de cada versión a propósito, porque una compilación nueva tiene que invalidarla.

## La compilación no guarda caché entre ejecuciones

Cada compilación empieza en una máquina limpia e instala las dependencias desde el registro de npm. Dentro de una misma compilación se instalan una sola vez: el migrador y la imagen de la aplicación comparten esa capa.

**Se probó guardar las capas en el registro de paquetes del repositorio y se quitó el mismo día**, el 2026-09-28. Medido en integración continua:

| | Tiempo |
|---|---|
| Instalar las dependencias con `npm ci` | ~25 s |
| Descargar esas mismas dependencias ya instaladas desde la caché, 570 MB | Entre 11 y 33 s |
| Subir la caché cuando cambian las dependencias o el esquema | 47 s más en esa compilación |

La compilación de Next.js necesita el árbol de dependencias entero, así que la caché solo cambiaba instalar por descargar. Una versión normal tardaba lo mismo con caché y sin ella, una que cambiaba dependencias tardaba casi un minuto más, y la caché ocupaba más de 1 GB en el registro. Hacía falta además un constructor aparte con su propia imagen fijada. Sin caché, además, el trabajo que publica imágenes no restaura nada de una ejecución anterior.

**Si algún día se vuelve a plantear**, lo que merece guardarse es algo caro de recrear y barato de descargar. `node_modules` es lo contrario.

## El HTML no se cachea en el borde

Las páginas públicas se sirven también en markdown a quien lo pide con la cabecera `Accept`, y eso lo decide el proxy de la propia aplicación, que corre antes de que nada consulte una caché.

Una caché intermedia que guarde el HTML de una dirección puede devolvérselo a quien pidió markdown de esa misma dirección, porque el borde no distingue las dos peticiones. Por eso **el HTML no se cachea arriba**, y la ruta que optimiza imágenes tampoco: negocia el formato con la misma cabecera y tiene el mismo problema.

Los archivos estáticos con huella en el nombre sí se cachean, y con eso vuelve buena parte de lo que aporta una red de distribución.

**Si algún día se quiere cachear el HTML arriba, lo primero que hay que resolver es qué pasa con `Accept`**, no al revés.

## Las fotos de una reseña se suben al enviarla

Subir cada foto al elegirla deja el archivo en el almacenamiento aunque la reseña nunca se envíe. Por eso el formulario las guarda en el navegador, con su vista previa, y las sube justo antes de mandar la reseña.

Se descartaron dos alternativas:

- **Mandar las fotos a la tienda junto con la reseña**, en la misma petición. Resuelve lo de los huérfanos de golpe, pero una reseña con 3 fotos de 10 MB es una petición de 30 MB, y cada capa por la que pasa tiene su propio límite de tamaño.
- **Subirlas al elegirlas y barrer los huérfanos cada cierto tiempo.** Necesita un proceso programado que hoy no existe, y mientras no pasa el barrido los archivos siguen ahí.

Lo que se acepta a cambio: entre la subida y la reseña hay una ventana. Si la reseña se rechaza o su petición falla, el formulario pide a la tienda que borre lo que acaba de subir, y la tienda borra solo lo que no usa ninguna reseña, porque solo ella puede comprobarlo. Para que nadie pueda pedir el borrado de una foto ajena, cada foto se sube a una carpeta de su autor y la tienda solo borra de la carpeta de quien lo pide. Si el navegador se cierra justo en ese momento, alguna foto puede quedar sin usar.

## Sage decide antes de escribir

Sage empezó con un solo modelo generativo que decidía, buscaba y redactaba en la misma llamada, y eso fallaba de formas que el cliente veía. Pedir "platos con carne" dependía de que la palabra apareciera en la descripción, "¿qué platos tienen?" enseñaba 6 tarjetas sin decir que había más, y "¿solo eso hay?" volvía a enseñar las mismas 6.

**Delante del modelo generativo hay un modelo de decisión.** Jev no escribe texto: contesta preguntas cerradas con una probabilidad, todas en una llamada de medio segundo. Con esas probabilidades decide una función pura del código, con umbrales fijos, y el código hace lo decidido con datos de la base. El modelo generativo solo redacta, en una sola llamada, con las herramientas del paso que le toca.

Se descartaron dos alternativas:

- **Mejorar las instrucciones del modelo generativo.** Cada arreglo en el prompt es una petición que el modelo puede ignorar, y no hay forma de comprobar de antemano que no lo hará.
- **Usar el mismo modelo generativo como clasificador.** Devuelve texto que hay que interpretar, sin una probabilidad con la que poner un umbral, y es otra llamada lenta y cara antes de la respuesta.

Lo que se gana es que la decisión se puede medir. `scripts/sage-decisions-eval/` lanza 86 casos reales contra el modelo y dice si las reglas eligen el camino correcto; los umbrales salen de ahí, y se vuelven a medir al cambiar de versión. Las tarjetas las arma siempre el código, así que el nombre y el precio de un plato nunca salen del texto de un modelo.

**Un saludo mal escrito se queda en saludo cuando es el sí más alto.** «Hoals» y «hols» también pasan el umbral de horario, porque se parecen a la palabra inglesa *hours*. Si el saludo es el sí más alto, la respuesta es solo el saludo. Si otra intención queda igual o por encima, el saludo se deja fuera y se atiende esa petición: «hola, ¿a qué hora abren?» sigue yendo al horario. Reescribir la palabra por parecido con «hola» se descartó, porque «hora» está a dos cambios de «hola» y el mismo corrector convertiría una pregunta de horario en un saludo.

**Un mensaje ajeno a Wild Grove lo rechaza el código, no el modelo que escribe.** La regla de rechazar temas ajenos vivía solo en el prompt, y el modelo a veces la saltaba: a «¿cuánto es 15 por 12?» contestaba la cuenta con una disculpa. Jev contesta ahora si el mensaje es ajeno, y cuando no hay nada del restaurante que hacer la respuesta es una frase fija. Se eligió así porque una regla en un prompt se cumple casi siempre, y una frase que escribe el código, siempre. Lo que se pierde es variedad en esa respuesta, y en un rechazo no hace falta. Un mensaje que mezcla algo ajeno con algo del restaurante sigue yendo al modelo que escribe, con la regla del prompt.

**Si el modelo de decisión no responde, Sage se disculpa; no vuelve al flujo anterior.** Hay una segunda vía, la API de TypeSafe con su propia clave, y si también falla el cliente recibe una frase que dice qué no se pudo hacer. Volver al flujo anterior significaría mantener y probar dos caminos de respuesta, y el de respaldo sería justo el que fallaba de las formas que este arregla. Un fallo que se ve se arregla: la pestaña Chatbot enseña el último, y el chat del panel lo marca en cada respuesta.

**El chat tiene un modo, no dos interruptores.** Apagado, solo con el personal, solo con Sage o con los dos. Un interruptor para el chat y otro para la IA darían 4 combinaciones, y una de ellas, el chat apagado con la IA encendida, no significa nada. El modo por defecto es el que no necesita ninguna clave, porque el repositorio es público y quien lo clona no tiene las del proyecto.

## El modelo que escribe razona lo mínimo

El modelo puesto en producción, `z-ai/glm-5.3-flash`, tiene el razonamiento obligatorio y el esfuerzo por defecto en el máximo. OpenRouter cuenta esos tokens contra el tope de la llamada. Con el tope de 600, medido el 2026-09-28 sobre las mismas 10 conversaciones, pasar el parámetro vacío dejó una mediana de 7,0 s en el modelo que escribe, 1 continuación y 2 respuestas vacías que el código reemplazó. Pedir esfuerzo `none`, o `enabled: false`, contestó 400 en las 16 llamadas: el modelo no deja apagar el razonamiento. El esfuerzo `low` no cortó ninguna de las 16 respuestas, cumplió el encargo en 14 frente a 13 de la configuración de hoy, y la mediana bajó a 6,0 s. Se quedó esa.

Un ajuste del panel para el razonamiento se descartó porque haría falta una migración y hoy solo hay un valor que sirva. Cambiar de modelo lo decide el propietario desde el panel.

**El tope de tokens es de 1600, no de 600.** El esfuerzo `low` no siempre se cumple. El 2026-09-28 una primera respuesta en producción razonó 579 tokens con el tope de 600, se cortó a mitad de palabra y la continuación empezó con puntos suspensivos. En las pruebas de esos días hubo respuestas de 600, 608 y 751 tokens de razonamiento. Una respuesta de Sage son como mucho 150 palabras, unos 250 tokens, así que 1600 cubre el peor caso visto con margen. El tope no alarga las respuestas, porque las limita el prompt, y no encarece las normales, porque se paga lo que se genera. Lo que cambia es que, cuando el modelo razona de más, la respuesta tarda más en vez de cortarse. La continuación tiene el mismo tope que la primera ronda, y el título de la conversación pasó de 30 a 300: un tope pequeño se gasta entero razonando antes de la primera palabra. Una base que seguía en 600 pasa a 1600 con la migración. Una que alguien ya cambió conserva su valor.

## El texto tiene una guía, y las etiquetas siguen siendo identificadores

El texto de la tienda, los correos, lo que dice Sage y las descripciones de la carta se escriben contra [La voz de Wild Grove](08-brand-voice.md), una guía corta con el tono, el vocabulario, las mayúsculas y la lista de lo que no se escribe. Una guía aparte, y no un apartado del sistema de diseño, porque se consulta en otros momentos: al escribir un texto, un correo o el prompt de Sage, no al elegir un color.

**Español e inglés se escriben a la vez, zona por zona.** Una pasada por idioma deja que los 2 catálogos acaben prometiendo cosas distintas. Cada zona de la web se reescribe en los 2 idiomas, frase a frase, y un guion comprueba al final que tienen las mismas claves y los mismos marcadores.

**La reserva y el pedido dicen el estado que tienen.** Una reserva nace pendiente, y decir «¡Reserva confirmada!» al enviarla prometía algo que todavía no había pasado. El formulario, el chat, Sage y el correo dicen «solicitud recibida», y solo la reserva confirmada por el personal dice «confirmada».

**Las etiquetas de los platos se guardan como identificador y se muestran como texto.** La alternativa era guardar en la base «Sin gluten» en lugar de `sin-gluten`. Se descartó porque el filtro dietético de Sage, los colores de las etiquetas y la superficie para agentes comparan el identificador, y habrían dejado de encontrar los platos. Convertirlo al mostrarlo cuesta una función y no toca ningún dato.

**El aviso de la demo se escribe una vez.** Estaba repartido en 11 cadenas que decían cada una a su manera que Wild Grove es una demostración, y el pie de página no lo llevaba. Ahora hay un texto en el catálogo, un bloque en la portada y una línea en el pie de todas las páginas. Los demás bloques solo lo dicen donde hace falta para entender una acción, como el saldo de prueba al pagar.

## Medir antes de optimizar

Las dos decisiones que más cuesta tomar son las de no hacer algo. Estas dos salieron de volver a medir.

**Una optimización aprobada que no se llegó a construir.** Un análisis identificó que el panel tardaba entre 600 y 1.100 milisegundos en comprobar la sesión, y lo atribuyó a dos llamadas que hace en cada petición. La solución diseñada era verificar el token en local y consultar solo cada cinco minutos.

Al medir otra vez, esas dos llamadas costaban unos 4 milisegundos. Lo caro era el arranque en frío y la distancia física. Construir la optimización habría cambiado 4 milisegundos por un retraso de hasta cinco minutos en detectar una sesión revocada, justo en la comprobación que protege el panel.

No se construyó. El diseño quedó escrito por si una medición futura dice otra cosa.

**Las funciones se quedan cerca de la base de datos, no del usuario.** Se podía haberlas movido a un servidor más cercano a Perú, lo que habría bajado el salto del navegador de unos 150 a unos 40 milisegundos. Pero cada llamada a la base de datos habría subido de 7 a unos 120.

Una petición hace el salto del navegador una vez y el de la base de datos varias. Estar cerca de los datos gana.

La consecuencia de aceptar eso es que los 150 milisegundos son un suelo que ningún cambio de código baja, y por eso el trabajo de velocidad se centró en quitar peticiones del camino de un clic, no en hacer cada una más barata.

**Un solo sistema de caché en el panel.** Había diecisiete formas distintas de pedir datos, una por página, cada una tirando lo que había cargado al navegar y volviéndolo a pedir al regresar. Ahora todas pasan por el mismo sitio.
