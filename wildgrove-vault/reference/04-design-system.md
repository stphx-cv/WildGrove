---
title: design-system
updated: 2026-10-03
status: current
---

# Sistema de diseño

La identidad visual del proyecto: verde bosque y ámbar cálido, espacio generoso, y movimiento discreto.

Los valores concretos viven en `packages/ui/styles/tokens.css`. Este documento explica cómo está montado y por qué.

## Un solo sitio para los tokens

Los colores, las sombras, los redondeos y las tipografías están en un único archivo dentro del paquete compartido. Las dos aplicaciones lo importan al principio de su hoja de estilos:

```css
@import "tailwindcss";
@import "@wildgrove/ui/styles/tokens.css";
```

Editar un token dentro de la hoja de estilos de una aplicación es un error, aunque funcione. En cuanto se hace, la tienda y el panel empiezan a separarse y nadie se da cuenta hasta que un botón se ve distinto en cada sitio.

## La paleta

| | Claro | Oscuro |
|---|---|---|
| Fondo | `#E9EEE4` | `#0E1A12` |
| Superficie | `#F3F6F0` | `#162019` |
| Superficie elevada | | `#1E2D22` |
| Primario | `#3A5A40` verde bosque | `#5A8A60` |
| Secundario | `#A8C5A0` verde salvia | |
| Acento | `#A26A31` ámbar | `#D4944A` |
| Acento al pasar | `#885624` | `#E5A55B` |
| Texto | `#1A1A18` | `#EEF1EC` |
| Texto apagado | `#566650` | `#8FA98C` |
| Borde | `#CDD4C7` | verde salvia al 12% |

El verde es la marca y el ámbar es la acción. Todo lo que el usuario debe pulsar es ámbar, y nada más lo es: si algo es ámbar, se pulsa.

## El contraste del botón primario

**El texto de un botón llega a 4,5:1 contra su fondo**, el mínimo de WCAG AA para texto normal. El botón primario lleva texto blanco sobre ámbar, y los dos ámbar del tema claro están elegidos para eso: 4,52:1 en reposo y 6,17:1 al pasar el ratón. Tienen el mismo tono que los ámbar del tema oscuro, con menos luz.

**El botón primario usa esos dos ámbar también en el tema oscuro.** Los ámbar de oscuro tienen otro trabajo: son el color de textos, precios e iconos sobre fondo oscuro, donde dan 6,92:1 y 8,39:1. Con texto blanco encima se quedarían en 2,58:1 y 2,13:1, y ningún ámbar llega a la vez a 4,5:1 con texto blanco y a 4,5:1 como texto sobre el fondo oscuro. Por eso, en oscuro, el fondo del botón y el texto ámbar son colores distintos.

Lo mismo vale para cualquier fondo ámbar sólido con texto blanco, en la tienda y en el panel: la insignia del carrito, el selector de moneda, una etiqueta de descuento o el botón de volver al inicio de la página de "no encontrado" usan los ámbar del tema claro en los dos temas.

Las plantillas de correo y el PDF del pedido escriben sus colores a mano, porque no leen los tokens, pero usan los mismos valores: `#A26A31` para el ámbar y `#885624` donde el texto es pequeño o blanco sobre ámbar, como el código del correo de restablecer la contraseña o la etiqueta del tipo de comprobante en el PDF.

## La capa de las fotos de cabecera

Todas las fotos de cabecera (la portada, las páginas de carta, reservas, Nosotros y Contacto, y la página de acceso) llevan la misma capa verde, `HeroOverlay`, en `packages/ui/HeroOverlay.tsx`. Es un degradado que deja más claro el centro, donde está la comida, y más oscuro en los bordes: 75 % arriba, 66 % en el centro y 85 % abajo. En la página de acceso, a partir del ancho `lg`, el degradado va de izquierda a derecha porque la foto está al lado del formulario.

Los valores se eligieron midiendo el contraste: con la capa puesta, el título y la descripción de cada cabecera llegan a 4,5:1 contra el 1 % más claro de su foto, en español e inglés, a 1280 y a 375 de ancho. La etiqueta pequeña que va encima del título va en blanco, la descripción de la portada también y la de la página de acceso en blanco al 90 %, para que ningún texto de cabecera quede por debajo de 4,5:1 con la capa más clara. Una capa más clara que esta deja de cumplirlo en alguna foto, y esa foto necesita la capa más oscura.

## El modo oscuro no es un filtro

No se genera invirtiendo el modo claro. Tiene sus propios valores, y el cambio más visible es que **las sombras se convierten en resplandores**.

```
claro    →  sombra hacia abajo, como papel sobre una mesa
oscuro   →  resplandor verde alrededor, como luz propia
```

Una sombra oscura sobre un fondo oscuro no se ve. El resplandor hace el mismo trabajo de separar una tarjeta del fondo, y encaja con una carta de restaurante mejor que un borde gris.

El tema se elige entre claro, oscuro y el del sistema, y por defecto sigue al sistema. El menú de ajustes de la tienda tiene un botón para cada uno, en el orden claro, sistema y oscuro, y el botón de la cabecera del panel y del menú del móvil los recorre en ese mismo orden, de modo que quien eligió claro u oscuro puede volver a seguir al sistema.

Los gráficos del panel dibujan con estilos en línea y no pueden usar clases `dark:`. Toman sus colores de las variables `--wg-chart-surface`, `--wg-chart-border`, `--wg-chart-muted`, `--wg-chart-text` y `--wg-chart-accent` de `packages/ui/styles/tokens.css`, que cambian con el tema.

## Tipografía

Dos familias, con papeles separados:

| | Fuente | Para qué |
|---|---|---|
| Display | Playfair Display, serif | Títulos. Es la que pone el tono de restaurante |
| Cuerpo | DM Sans, sans-serif | Todo lo demás. Es la que se lee |

Los tamaños crecen por tramos desde el móvil hasta el escritorio. Un título grande en el portátil sería ilegible en un teléfono si no se escalara.

## Los componentes

Los componentes compartidos viven en `packages/ui`. Lo que importa de ellos no son sus clases, que están en el código, sino las reglas que siguen.

**Los botones tienen tres niveles.** Primario en ámbar relleno para la acción principal, secundario con borde verde para la alternativa, y fantasma sin fondo para lo terciario. Una pantalla no debería tener dos botones primarios compitiendo.

**Todo lo que responde al ratón se mueve poco.** Un botón crece un 2% al pasar por encima y se hunde un 2% al pulsarlo. Una tarjeta sube un píxel. Son cantidades pequeñas a propósito: se notan sin llamar la atención.

**Las etiquetas de los platos tienen color propio.** Vegano en verde, sin gluten en ámbar, picante en rojo, ecológico en lima, especial del chef en violeta, popular en rosa y novedad en cian. Cada una con su versión para fondo oscuro. El color sale del identificador con el que se guarda la etiqueta (`sin-gluten`, `gluten-free`).

**Las etiquetas se leen como texto, no como identificador.** Las 5 vistas de la tienda que las pintan (carta, portada, ficha del plato, platos relacionados y tarjetas del chat) muestran `sin-gluten` como «Sin gluten» y `gluten-free` como «Gluten-free», sin forzar mayúsculas. La conversión es `dishTagLabel`, en `packages/core/dish-tag-label.ts`: cambia los guiones por espacios salvo en los compuestos ingleses (`gluten-free`, `high-protein`) y tiene una tabla corta para las etiquetas en español que no se leen bien así (`alto-proteína` es «Alto en proteína»). El panel conserva su vista, que enseña el identificador.

**La etiqueta de descuento es una sola.** `DiscountBadge` (`wildgrove-web/components/currency/DiscountBadge.tsx`) es una etiqueta ámbar pequeña, con texto blanco, sin sombra y sin mayúsculas forzadas, y la usan la carta, la portada, la ficha del plato y las tarjetas del chat. Es el ámbar de [El contraste del botón primario](#el-contraste-del-botón-primario), con 4,52:1 en los 2 temas.

**Los formularios marcan el error con un anillo rojo**, no cambiando el texto de sitio. Un campo que se mueve al fallar desplaza todo lo que tiene debajo.

**Un desplegable del panel ofrece la fila vacía solo si el campo es opcional.** En un filtro esa fila es "todos"; en un campo obligatorio, como la prioridad de un ticket o el estado de una reserva, no aparece, porque elegirla dejaría el campo sin valor.

**Los controles no son los del sistema operativo.** El interruptor, la casilla, el botón de opción y el área de texto están escritos en el paquete compartido, así que se ven igual en las dos aplicaciones y en los dos temas. La casilla lleva su propio tick dibujado y su estado intermedio; el área de texto crece con el contenido hasta un tope y lleva una esquina para arrastrar que funciona con ratón, con el dedo y con el teclado.

**Los iconos son propios y no hay emojis en la interfaz.** Viven en `packages/ui/icons`, un archivo por icono, y se importan siempre desde el índice de esa carpeta (`@wildgrove/ui/icons`). El paquete tiene 156 componentes, y ni la tienda ni el panel dibujan un icono por su cuenta. Los iconos de línea (la gran mayoría) comparten una base que fija la cuadrícula de 24, el trazo de 1,5, las puntas redondeadas y el color: toman el del texto que los rodea, así que no necesitan una versión para el tema oscuro. Cada uso puede pedir otro grosor con `strokeWidth`: la tienda y el panel lo hacen donde el diseño lleva un trazo de 1,75, 2 o 2,5, y cada uso conserva el que tenía aunque el mismo dibujo aparezca con grosores distintos. Los rellenos de la cuadrícula de 20 (estrellas de valoración, usuario, chincheta, casa) tienen su propia base, y los dibujos con otra cuadrícula (12, 16, 18, 32), con colores propios o con relleno y trazo mezclados escriben su `<svg>` dentro de su archivo. El logo de Google conserva sus cuatro colores y la etiqueta de precio rellena lleva un punto blanco fijo: son los únicos dos que no siguen el color del texto. Hay también un indicador de carga, `Spinner`, que la tienda y el panel usan en todos sus botones con espera. Donde la web presenta a Sage, en la portada, en nosotros y en la tarjeta de chat de contacto, va su símbolo sobre la misma placa clara del chat, y las hojas decorativas de la página 404 y de la cabecera de la cuenta también son la hoja de Sage. El símbolo de Sage es una hoja de salvia con el nervio calado y tiene dos variantes: la completa, con una segunda hoja detrás, para tamaños grandes, y la compacta, más gruesa y sin la hoja de atrás, para 24 píxeles o menos. En la cabecera del chat y en el botón flotante que lo abre va dentro de una placa clara de esquinas redondeadas, crema en el tema claro y verde salvia en el oscuro. El botón flotante es una píldora verde con esa placa y el nombre «Sage». Al pasar el cursor crece un 2% en 300 ms, como el resto de botones. El mismo símbolo existe como archivo en `public/svg/sage_mark.svg` para usarlo fuera de React. Los logos de redes sociales (LinkedIn, X, WhatsApp y los demás) salen de `SocialIcon`, en `packages/ui/social`. Un icono cuyo dibujo cambia según un estado se escribe como dos componentes y la pantalla elige cuál pintar, como la flecha de la galería de fotos de una reseña o el chevron del selector de horas.

## Cómo se añade un icono

Antes de dibujar uno, busca en el índice de `packages/ui/icons` si ya existe. Si existe, impórtalo. Si no, crea un archivo con su nombre:

- **Elige la base.** `LineIcon` para un icono de línea en cuadrícula de 24, con el trazo de 1,5 y las puntas redondeadas. `SolidIcon` para un relleno en cuadrícula de 20. Si el dibujo usa otra cuadrícula, lleva colores propios o mezcla relleno y trazo, escribe el `<svg>` en el propio archivo con su `viewBox`.
- **Nómbralo por lo que dibuja**, en inglés y terminado en `Icon`: `MapPinIcon`, `CheckCircleIcon`. Si ya hay un dibujo parecido, el nombre dice en qué se diferencia (`StarSolidIcon` y `StarOutlineIcon`, `CheckIcon` y `CheckCompactIcon`), nunca un número. El archivo se llama igual que el componente.
- **Recibe las props de un `<svg>`**: `export function MapPinIcon(props: IconProps)`. El uso decide `className`, `strokeWidth` y lo demás. Sin colores propios: el dibujo usa `currentColor`, y el color y el tamaño los pone quien lo usa con clases de Tailwind.
- **El grosor por defecto es 1,5.** Un uso que necesite otro lo pasa con `strokeWidth`, no se crea otro componente por eso.
- **Un icono sin nombre es decoración**, y la base lo oculta a los lectores de pantalla. Si el icono es lo único que dice qué hace un botón, el uso le pasa `aria-label` y deja de ocultarse.
- **Expórtalo desde `index.ts`**, en orden alfabético. Ningún archivo de la carpeta usa estado, efectos ni `"use client"`, así que se puede importar desde componentes del servidor y del cliente.

No se escribe un `<svg>` dentro de una pantalla, ni en la tienda ni en el panel. `scripts/icons-inventory.mjs`, sin argumentos, lista los que queden en `wildgrove-web/app` y `wildgrove-web/components`, y con `--dir` lista los de otras carpetas, como `wildgrove-cms/app` y `wildgrove-cms/components`. Con `--compare` comprueba contra una foto de partida que un icono movido dibuja lo mismo que antes.

## Los detalles que casi no se ven

Aquí está la parte del sistema que cuesta más de hacer y menos se nota, que suele ser buena señal.

**Las imágenes aparecen con un fundido en su primera carga.** Un `<FadeInImage>` en lugar de una imagen normal: mientras se descarga está a cero opacidad, y cuando termina entra suave. Las que ya están en caché salen al instante, y las imágenes prioritarias nunca se funden, porque retrasar la imagen principal empeora la métrica de carga.

**Las barras de desplazamiento están diseñadas.** Pulgar redondeado en verde bosque, que se llena al pasar por encima y se pone ámbar al arrastrarlo. Van en el paquete compartido, así que la tienda y el panel tienen la misma. Las flechitas de Windows están ocultas.

En dos sitios la barra se esconde a propósito: las pestañas de categoría en el móvil, que se deslizan con el dedo, y el campo de escribir del chat.

**El movimiento se desactiva si el sistema lo pide.** Con la reducción de movimiento activada, las entradas animadas (`animate-fade-up`, `animate-fade-in` y lo que lleva `data-animate`) aparecen quietas y ya visibles, porque todas empiezan invisibles y una guarda que solo parase la animación las dejaría ocultas. Lo mismo hacen el fundido de las imágenes, las casillas y los anillos de la burbuja del chat. El aviso que ofrece cambiar de idioma, que no usa esas clases, solo anima su entrada cuando el sistema no pide reducir el movimiento. Las guardas de las entradas viven en la hoja de estilos de la tienda, fuera de las capas de Tailwind, porque la animación la ponen utilidades y solo una regla fuera de capa gana sobre ellas.

**El chat, el carrito, el menú del móvil y el detalle de un pedido se usan con el teclado.** La burbuja del chat se abre con Intro o con Espacio. El carrito, el menú del móvil y el cajón del detalle de un pedido siguen montados cuando están cerrados, para poder animar la salida, pero inertes: nada de dentro recibe el foco ni lo lee un lector de pantalla. Al abrirse, el foco entra en ellos y no sale mientras estén abiertos; Escape los cierra, y el foco vuelve al botón que los abrió. En los formularios de acceso, de la cuenta, de reservas, de reprogramar, de pago, de reseñas, de tickets y de completar el perfil, cada etiqueta está asociada a su campo, así que el lector de pantalla anuncia la etiqueta y no el texto de ejemplo. El teléfono de la cuenta y el de recuperación, que no tienen etiqueta propia, se anuncian con el título de su sección, y el campo para renombrar una reserva, con "Nombre de la reserva". Las estrellas de una reseña se anuncian como grupo con su etiqueta, y cada estrella con su número. Los nombres que solo oye el lector de pantalla, como los botones de cantidad del carrito, los del calendario, las horas y las personas de las reservas, los de la galería de un plato o el del prefijo del teléfono, salen en el idioma de la página. El prefijo del teléfono es un componente compartido y en el panel sigue en inglés, como el resto del panel.

**El foco del teclado siempre se ve.** Contorno ámbar de dos píxeles, separado del elemento, en todo lo que se pueda enfocar: `#C17F3A` en el tema claro y `#D4944A` en el oscuro. Nunca se quita. El del tema claro está escrito con su valor en lugar de usar el token del acento: el acento es oscuro para que el texto blanco de los botones se lea, y el contorno usa un ámbar más claro.

## Movimiento

| Animación | Cuándo |
|---|---|
| Entrada desde abajo | Lo que aparece al bajar por la página |
| Fundido | Imágenes y cambios de estado |
| Flotación | Elementos decorativos |
| Brillo | Esqueletos de carga |
| Despliegue desde la esquina | El menú de ajustes del encabezado: crece desde el botón en 150 ms y se encoge de vuelta en 100 ms |

Las listas entran escalonadas: cada elemento espera cien milisegundos más que el anterior, así que la fila se dibuja sola en lugar de aparecer de golpe.

Lo que aparece al bajar usa un observador de intersección. La animación se dispara cuando el elemento entra en pantalla, no al cargar la página.

## Las reglas

- **Solo clases de Tailwind.** Nada de CSS en línea.
- **Toda clase de color tiene su pareja para modo oscuro.** No se escribe una sin la otra. La excepción es el fondo ámbar con texto blanco, que es el mismo en los dos temas (ver [El contraste del botón primario](#el-contraste-del-botón-primario)).
- **Las imágenes usan el componente de Next.js**, nunca la etiqueta de HTML.
- **Móvil primero.** Se escribe para la pantalla pequeña y se amplía hacia arriba.
- **Los tokens se editan en el paquete compartido**, nunca en una aplicación.

Estas reglas están también en [Convenciones de código](../rules/02-code-conventions.md), porque son las que hay que comprobar en cada cambio.
