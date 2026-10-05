---
title: brand-voice
updated: 2026-10-03
status: current
---

# La voz de Wild Grove

Cómo escribe Wild Grove. Vale para cualquier texto que lea una persona que visita el sitio: los catálogos de la tienda, el texto escrito en el código, los correos, lo que dice Sage y los nombres y descripciones de la carta. Las reglas de formato de la documentación están en [Cómo escribir aquí](../rules/01-how-to-write-here.md), y valen también para este texto: sin rayas largas, sin frases de efecto al final de un párrafo y sin la construcción «no es X, es Y».

## Cómo suena

Cálida, tranquila, concreta y neutral. Habla de comida y de lo que se puede hacer en la web antes que de «experiencias». Una frase dice qué hay, qué se puede hacer o qué pasó, y se detiene ahí.

| Se escribe | No se escribe |
|---|---|
| «Elige fecha y hora y envía tu solicitud.» | «Vive una experiencia gastronómica inolvidable.» |
| «Papas nativas con salsa de ají amarillo, huevo y aceitunas.» | «Una explosión de sabores que celebra la tradición.» |
| «Por ahora no hay platos publicados.» | «Algo delicioso está en camino.» |

## El trato

Tuteo, y nunca se da por hecho el género de quien lee. Los recursos son tres:

- **Reformular la frase.** «Qué gusto verte de nuevo», no «Bienvenido de vuelta».
- **Hablar de la acción.** «¿Es tu primera vez aquí?», no «¿Nuevo en Wild Grove?».
- **Usar un sustantivo sin género.** «Personas», «quien recibe», «quien reserva».

Nada de arrobas, equis ni barras (`amigo/a`). Las palabras que describen una cosa y no a quien lee no se tocan: «reserva confirmada», «pedido listo», «cuenta conectada».

El inglés no tiene este problema, pero sigue el mismo tono.

## El español

Peruano sin jerga. Las palabras de la cocina peruana se escriben como se dicen en Lima: palta, choclo, culantro, ají, zapallo loche, sánguche, camu camu. El resto es español neutro, y las expresiones coloquiales de Lima se reservan para cuando el texto las necesita de verdad, como «se te antoja».

El nombre del plato se queda como lo escribe la carta. El inglés usa la palabra inglesa del ingrediente: culantro en español, cilantro en inglés.

## El vocabulario

| Español | English | No se usa |
|---|---|---|
| Carta | Menu | Menú, salvo en la ruta `/menu` y en los menús de la interfaz («menú de navegación»). En Lima «el menú» suele ser el almuerzo del día a precio fijo |
| Consulta | Inquiry | Ticket, ticket de soporte |
| Solicitud de reserva, mientras está pendiente | Reservation request | Reserva confirmada para algo que no lo está |
| Reserva confirmada, solo en ese estado | Confirmed reservation | |
| Personas | Guests | Invitados, comensales, huéspedes |
| Billetera, saldo de prueba | Wallet, test balance | Monedero, billetera digital, wallet |
| Asistente virtual | Virtual assistant | Anfitrión IA, AI host |
| Nosotros | About | Acerca de |
| Sobre mí | About me | |
| Cuenta, Mi cuenta | Account, My account | |
| Equipo | Team | Personal, agente |
| Pedido | Order | |
| Reservar una mesa | Reserve a table | Reservar mi mesa, asegurar tu lugar |

Las rutas conservan su nombre (`/menu`, `/contact/tickets/...`) aunque el texto diga otra cosa. El modelo de datos, el panel y las rutas de la API siguen llamando `Ticket` a la consulta, y el número de la consulta sigue siendo `#WG-0001`, porque el código lo usa para buscarla.

## Las mayúsculas

**En español, mayúscula solo en la inicial** de botones, menús, títulos y etiquetas: «Reservar una mesa», «Mi billetera», «Política de privacidad». Los nombres propios no cambian: Wild Grove, Sage, Lima, Miraflores, Perú, Google, WhatsApp, Instagram, LinkedIn, ISIL, InsForge. Tampoco las siglas ni los nombres de documento que son un nombre propio (DNI, RUC, IGV, MIT).

**El inglés conserva su estilo.** Los botones y los títulos van con mayúscula en cada palabra importante, como se escribe en inglés.

## Lo ficticio y lo real

| Es ficticio | Es real |
|---|---|
| El restaurante, su dirección (Miraflores, sin un sitio concreto) y sus horarios | El teléfono, el correo y las redes |
| Las reservas, los pedidos, los pagos y la billetera | El creador del sitio y el código |
| Las reseñas, si las hay, son de la demo | El mensaje que se envía por Contacto, que lee el creador |

- Una frase sobre el comedor no promete nada que exija un local abierto: mesas guardadas, atención a cada restricción alimentaria, un tiempo de respuesta, una visita sin reserva.
- Una frase sobre la web solo dice lo que la web hace.
- Los datos reales y los ficticios no se mezclan en el mismo bloque. La página de Contacto y el pie los separan con su título.

## Lo que no se escribe

Estas son las expresiones y los patrones que la guía excluye. Una búsqueda de ellas en el catálogo, en el texto escrito en el código y en los correos tiene que salir vacía.

**Frases que hablan de cómo se escribió el proyecto.** «Sin discurso», «sin narrativa de chef legendaria», «no hay una leyenda detrás de la marca», «es parte de la demo, pero funciona de verdad», «comer bien no requiere postureo». La web habla del comedor y de lo que se puede hacer en ella.

**Superlativos sin dato.** «Único», «perfecto», «inolvidable», «experiencia gastronómica única», «experiencia gastronómica personalizada», «crear la experiencia perfecta», «Donde la naturaleza se encuentra con la mesa», «Tu historia gastronómica comienza aquí».

**Plazos de respuesta.** «24-48 horas», «respuestas instantáneas», «confirmaremos tu mesa en minutos». El sitio no promete cuánto tarda nadie.

**Promesas de servicio.** «Visitas sin reserva bienvenidas», «nos adaptamos a todas las restricciones alimentarias», «siempre mantenemos mesas para visitas sin reserva».

**Saludos con género y palabras de otro mundo.** «Bienvenido», «Bienvenido de vuelta», «Queridos por nuestros invitados», «invitados», «huéspedes», «anfitrión IA».

**Lenguaje interno.** «Ticket», «owner», «la base de datos está ocupada». Si el mensaje tiene que explicar un fallo, dice qué pasó y qué hacer.

**Fórmulas de relleno.** «Sé el primero en compartir tu opinión», «dulces sin culpa que demuestran que lo saludable puede ser indulgente», «¿Perdido en el bosque?», «¿Listo para visitarnos?», «¿Estás seguro de que deseas…?» (se explica qué pasa al confirmar), «Algo delicioso está en camino».

**Palabras de la carta que no se pueden sostener.** «Orgánico», «especial del chef» y «de temporada» no se escriben en una etiqueta ni en una descripción, porque el sitio no puede demostrarlas.

En inglés valen los mismos patrones: «Welcome to», «unforgettable», «a thoughtful dining experience», «Ready to visit?», «within 24-48 hours», «instant answers», «ticket», «AI host», «guilt-free», «Lost in the forest?».

## El aviso de la demo

Un solo texto, escrito una vez en el catálogo (`common`), que se muestra en 2 sitios:

| Dónde | Cómo |
|---|---|
| La portada | Un bloque visible debajo de la descripción de la cabecera |
| El pie de todas las páginas | Una línea |

Español:

> Wild Grove es un restaurante ficticio creado como proyecto de portafolio. Las reservas y los pedidos son de prueba.

Inglés:

> Wild Grove is a fictional restaurant created as a portfolio project. Reservations and orders are for testing.

Los demás bloques no repiten que la web es una demo. Solo lo dicen donde hace falta para entender una acción concreta: el saldo de prueba al pagar, o la reserva como solicitud. Sage recibe el mismo texto como su aviso.

## Las etiquetas y las descripciones de los platos

Se aplican a la carta que se edita desde el panel.

- **La etiqueta se guarda como identificador y se muestra como texto.** `sin-gluten` se lee «Sin gluten» y `gluten-free` se lee «Gluten-free». El filtro dietético de Sage, los colores de las etiquetas y la superficie para agentes leen el identificador tal cual.
- **Una descripción dice lo que lleva el plato y cómo se sirve.** Usa solo lo que el plato ya declara: ingredientes, preparación y acompañamiento. No añade procedencias, certificaciones ni ingredientes.
- **Una lista de adjetivos no es una descripción.** Se prefiere un verbo concreto («saltados al wok») a una cadena de calificativos.
- **El español y el inglés dicen lo mismo,** cada uno con sus palabras.

## Sage

Sage se presenta como **el asistente virtual de Wild Grove**. Habla con el mismo tono que el resto de la web:

- Tutea, y escribe en español natural de Lima sin jerga.
- Responde breve y nombra platos y acciones reales.
- Hace una pregunta solo cuando ayuda a elegir.
- No elogia cada mensaje ni se despide con una fórmula de atención al cliente.
- Cita las páginas por el nombre que ve quien lee: Carta, Reservas, Nosotros, Contacto, Mi cuenta.
- Sus mensajes fijos dicen qué pasó y qué hacer, y no inventan una causa.

Esto no toca cómo decide Sage: el modelo de decisión, sus reglas, el idioma de la respuesta, el filtro de precios y la excepción del saldo de prueba siguen como están descritos en [Qué hace el producto](03-features.md).

## Cómo se revisa un texto

1. Se escribe en los 2 idiomas a la vez, frase a frase.
2. Se busca en el texto nuevo cada expresión de «Lo que no se escribe».
3. Se compara que las 2 versiones prometan lo mismo y lleven los mismos marcadores (`{amount}`, `<strong>`).
4. Se lee la frase entera como la leería quien llega por primera vez, y se quita la que no le sirve para nada.
