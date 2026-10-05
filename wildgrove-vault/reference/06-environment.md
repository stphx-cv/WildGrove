---
title: environment
updated: 2026-10-02
status: current
---

# Variables de entorno

Si clonaste este repositorio y quieres levantarlo, esta es la página que necesitas.

## Cómo funciona

Cada aplicación trae su propio `.env.example`, con los nombres de las variables y los valores vacíos. Ninguna credencial del proyecto original viaja aquí. Cada quien usa las suyas.

```bash
cp wildgrove-web/.env.example wildgrove-web/.env.local
cp wildgrove-cms/.env.example wildgrove-cms/.env.local
```

Son dos archivos porque son dos aplicaciones de Next.js, y cada una lee el suyo. Prisma se apaña con el de la tienda, así que no hace falta un tercero.

El panel usa menos variables que la tienda: no lleva las claves de IA ni las de Upstash, porque el chat y el límite de peticiones son cosa de la tienda. Para saber si las claves de IA están puestas, el panel se lo pregunta a la tienda. El correo sí va en los dos.

Los archivos `.env.local` no se suben nunca: están en el `.gitignore` y ahí se quedan.

## Públicas y secretas

Hay dos clases de variables, y confundirlas es la forma más común de filtrar una credencial.

```
NEXT_PUBLIC_*  ───►  se incrusta en el JavaScript  ───►  el visitante puede leerla
todo lo demás  ───►  se queda en el servidor       ───►  nunca sale de ahí
```

Si pones una clave secreta en una variable `NEXT_PUBLIC_`, no vas a ver ningún error. La aplicación arranca, todo parece funcionar, y la clave queda publicada dentro del código de tu propio sitio.

Por eso cada variable de este documento lleva su etiqueta.

## Lo mínimo para arrancar

Estas siete son obligatorias. Sin ellas la aplicación no levanta.

| Variable | Qué es | De dónde sale | Etiqueta |
|---|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | La dirección de tu backend | Panel de InsForge | `pública` |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | La clave que usa el navegador | Panel de InsForge | `pública` |
| `INSFORGE_API_KEY` | La clave de administración | Panel de InsForge | `secreta` |
| `DATABASE_URL` | La conexión de la aplicación | Tu PostgreSQL | `secreta` |
| `DIRECT_URL` | La conexión de las migraciones | Tu PostgreSQL | `secreta` |
| `NEXT_PUBLIC_SITE_URL` | Dónde vive la tienda | La escribes tú | `pública` |
| `NEXT_PUBLIC_CMS_URL` | Dónde vive el panel | La escribes tú | `pública` |

Las cinco primeras salen del mismo sitio, así que en la práctica son dos servicios: un backend y su base de datos. Las dos últimas en local son `http://localhost:4680` y `http://localhost:8640`.

## Qué enciende cada credencial opcional

Con las siete de arriba ya tienes el proyecto funcionando. Todo lo demás enciende una parte concreta, y lo que no configures simplemente queda apagado.

```
sin ninguna credencial más
   └── carta · carrito · pedidos · reservas · reseñas · panel · dos idiomas
       · el chat, atendido por el personal desde el panel

SMTP_HOST + PORT + USER + PASS ─► todo el correo saliente
la clave del proveedor de IA
  + OPENROUTER_API_KEY ─────────► Sage, el asistente del chat
TYPESAFE_API_KEY ───────────────► una segunda vía para el modelo de decisión de Sage
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ► el mapa y el autocompletado de direcciones
UPSTASH_REDIS_REST_URL + TOKEN ─► el límite de peticiones
REVALIDATE_SECRET ──────────────► que la carta pública se actualice al guardar
```

## Tabla completa

| Variable | Etiqueta | Si la dejas vacía |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | `pública` | No arranca |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | `pública` | No arranca |
| `INSFORGE_API_KEY` | `secreta` | No arranca |
| `DATABASE_URL` | `secreta` | No arranca |
| `DIRECT_URL` | `secreta` | Las migraciones no corren |
| `NEXT_PUBLIC_SITE_URL` | `pública` | Los correos enlazan a un sitio que no existe |
| `NEXT_PUBLIC_CMS_URL` | `pública` | Los enlaces al panel y el retorno de Google del panel no funcionan |
| `SMTP_HOST` | `secreta` | No sale ningún correo |
| `SMTP_PORT` | `secreta` | No sale ningún correo |
| `SMTP_USER` | `secreta` | No sale ningún correo |
| `SMTP_PASS` | `secreta` | No sale ningún correo |
| `SMTP_FROM` | `secreta` | Se usa `SMTP_USER` como remitente |
| `OPENAI_API_KEY` | `secreta` | Con el proveedor OpenAI, el panel no deja elegir un modo del chat con Sage |
| `OPENROUTER_API_KEY` | `secreta` | El panel no deja elegir un modo del chat con Sage, sea cual sea el proveedor |
| `AI_PROVIDER_API_KEY` | `secreta` | Nada, si tu endpoint propio no pide clave |
| `TYPESAFE_API_KEY` | `secreta` | Si OpenRouter no responde, Sage se disculpa en vez de intentarlo por TypeSafe |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `pública` | Los formularios de dirección van sin mapa |
| `UPSTASH_REDIS_REST_URL` | `secreta` | **El límite de peticiones queda apagado** |
| `UPSTASH_REDIS_REST_TOKEN` | `secreta` | **El límite de peticiones queda apagado** |
| `REVALIDATE_SECRET` | `secreta` | La carta pública tarda 5 minutos en actualizarse |
| `NEXT_PUBLIC_APP_URL` | `pública` | Se usa `NEXT_PUBLIC_SITE_URL`. Es un nombre alternativo, no hace falta ponerla |
| `CMS_SERVER_TIMING` | `servidor` | Nada. Solo enciende medidas de diagnóstico en el panel |
| `DATABASE_SSL_CA` | `servidor` | La conexión hace lo que pida el `sslmode` de `DATABASE_URL` |
| `DATABASE_POOL_MAX` | `servidor` | Toma un valor por defecto |
| `DATABASE_POOL_IDLE_MS` | `servidor` | Toma un valor por defecto |
| `DATABASE_POOL_MAX_LIFETIME_S` | `servidor` | Toma un valor por defecto |

El resto del documento explica cada una: qué hace, de dónde se saca y qué implica dejarla vacía.

---

## El backend

El proyecto usa [InsForge](https://insforge.dev), que es de código abierto y trae base de datos, autenticación y almacenamiento de archivos en un solo servicio. Puedes autoalojarlo con Docker, que es lo que hace este proyecto, o usar su nube si solo quieres probar.

Las tres claves salen del panel de tu proyecto de InsForge.

#### `NEXT_PUBLIC_INSFORGE_URL`
`pública` · obligatoria

La dirección de tu backend. En local suele ser `http://localhost:7130`.

#### `NEXT_PUBLIC_INSFORGE_ANON_KEY`
`pública` · obligatoria

La clave que usa el navegador para hablar con el backend. Solo puede hacer lo que las reglas de acceso permitan a un usuario sin identificar, así que publicarla es seguro y está diseñada para ir en el navegador.

#### `INSFORGE_API_KEY`
`secreta` · obligatoria

La clave de administración. Se salta las reglas de acceso, así que quien la tenga puede leer y escribir cualquier cosa en tu backend. Solo se usa desde el servidor.

## La base de datos

PostgreSQL. Si autoalojas InsForge viene incluido; si prefieres usar un PostgreSQL que ya tengas, también sirve, porque el esquema es Prisma estándar.

#### `DATABASE_URL`
`secreta` · obligatoria

La conexión que usa la aplicación en funcionamiento. Lleva usuario y contraseña dentro, y su formato es `postgresql://usuario:contraseña@servidor:5432/insforge`.

**El TLS lo decide esta dirección.** Sin ningún parámetro, la aplicación conecta como conectaría `psql`: sin TLS si el servidor no lo atiende, que es el caso de un PostgreSQL recién instalado. Con `?sslmode=require`, `?sslmode=prefer` o `?sslmode=verify-ca`, la aplicación sube el modo a `verify-full`, porque un cifrado que no comprueba de quién es el certificado no protege de nada.

#### `DIRECT_URL`
`secreta` · obligatoria

La conexión que usan las migraciones. Está separada de la anterior porque las migraciones necesitan hablar con la base de datos sin pasar por un pool de conexiones.

En local las dos pueden apuntar al mismo sitio.

#### `DATABASE_SSL_CA`
`servidor` · opcional

El certificado de tu servidor de PostgreSQL, para cuando usas TLS con un certificado propio en lugar de uno emitido por una autoridad conocida. Con el certificado puesto, la conexión lo comprueba contra él y los parámetros `ssl*` de `DATABASE_URL` se ignoran.

**Si la dejas vacía:** la conexión hace lo que pida el `sslmode` de `DATABASE_URL`, y los certificados se comprueban contra las autoridades que el sistema ya conoce. En local no hace falta.

#### `DATABASE_POOL_MAX`
`servidor` · opcional

Cuántas conexiones simultáneas abre la aplicación como máximo.

Subirla tiene sentido cuando el panel va lento con varias personas dentro. Bajarla, cuando tu PostgreSQL tiene pocas conexiones disponibles.

#### `DATABASE_POOL_IDLE_MS`
`servidor` · opcional

Cuánto tiempo mantiene abierta una conexión que no se está usando, en milisegundos.

Un número bajo libera conexiones antes, pero obliga a reconectar a cada rato, y cada reconexión son varios viajes de ida y vuelta al servidor.

#### `DATABASE_POOL_MAX_LIFETIME_S`
`servidor` · opcional

Cuántos segundos vive una conexión antes de que el pool la retire y abra otra, aunque se esté usando bien.

Existe porque una conexión que no se retira nunca sobrevive a un cambio de credenciales y va acumulando estado en el servidor. Subirla tiene sentido en un proceso que vive semanas y atiende tráfico constante, porque cada reciclaje cuesta un saludo TLS. Bajarla, cuando quieres que un cambio de contraseña llegue antes a todas las conexiones abiertas.

**Las tres cifras del pool se ajustan por aplicación, en su entorno.** El panel y la tienda tienen formas de uso distintas: el panel son pocas personas navegando seguido, la tienda son muchas visitas cortas.

## Las direcciones de las dos aplicaciones

Cada aplicación necesita saber dónde está la otra, porque se enlazan entre sí.

#### `NEXT_PUBLIC_SITE_URL`
`pública` · obligatoria

La dirección de la tienda. En local, `http://localhost:4680`.

Se usa en los enlaces de los correos y en las etiquetas para buscadores.

#### `NEXT_PUBLIC_CMS_URL`
`pública` · obligatoria

La dirección del panel. En local, `http://localhost:8640`.

Es también la dirección a la que Google devuelve al personal cuando entra al panel con su cuenta. Esa dirección más `/api/auth/callback` tiene que estar en la lista `allowed_redirect_urls` de `insforge.toml`, y esa lista tiene que estar aplicada en el backend, o el botón de Google del panel no llega a arrancar.

#### `REVALIDATE_SECRET`
`secreta` · opcional

Una contraseña compartida entre las dos aplicaciones. Cuando alguien edita la carta desde el panel, el panel llama a la tienda para que tire su caché, y esta variable es lo que demuestra que la llamada viene de quien dice venir.

No sale de ningún servicio. La generas tú:

```bash
openssl rand -base64 32
```

El mismo valor va en las dos aplicaciones.

**Si la dejas vacía o no coinciden:** el panel guarda los cambios, pero la tienda sigue mostrando la carta vieja hasta que la caché caduque sola, cinco minutos después.

## El proveedor de IA y el modelo de decisión

Sage usa dos modelos. Un modelo de decisión, Jev, lee cada mensaje y elige qué hacer; un modelo generativo escribe el texto. Ver [Qué hace el producto](03-features.md#sage-el-asistente).

El modelo generativo no está atado a un proveedor. Cuál se usa, con qué modelo, a qué temperatura y con qué tope de tokens son ajustes del panel de administración. Lo único que vive en el entorno es la clave, porque una credencial no se guarda en la base de datos.

| Proveedor | Variable que lee |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Uno propio, compatible con OpenAI | `AI_PROVIDER_API_KEY` |

**Del modelo generativo solo hace falta la clave del proveedor que tengas seleccionado.** El modelo de decisión usa además `OPENROUTER_API_KEY` siempre, aunque el generativo sea de OpenAI o propio, porque se llama por la API de decisiones de OpenRouter.

#### `OPENAI_API_KEY`
`secreta` · opcional

Se saca en [platform.openai.com](https://platform.openai.com), en la sección **API keys**. Cobra por uso y hay que cargarle saldo.

#### `OPENROUTER_API_KEY`
`secreta` · opcional

Se saca en [openrouter.ai](https://openrouter.ai). Da acceso a modelos de varios proveedores con una sola cuenta, y es la clave del modelo de decisión: sin ella no se puede elegir un modo del chat con Sage.

#### `AI_PROVIDER_API_KEY`
`secreta` · opcional

La clave de tu propio endpoint compatible con OpenAI. Su dirección se escribe en el panel, no aquí.

#### `TYPESAFE_API_KEY`
`secreta` · opcional

La clave de la API propia de TypeSafe, la empresa del modelo de decisión. Es una segunda vía: se usa cuando OpenRouter falla o tarda más de 2 segundos. La consola de TypeSafe está en acceso anticipado, con lista de espera.

**Si la dejas vacía:** cuando OpenRouter no responde, Sage contesta con una frase de disculpa que dice qué no pudo hacer.

**Si faltan las claves de Sage:** el panel no deja elegir los modos "solo con Sage" ni "Sage y el personal", y el chat sigue funcionando en el modo "solo con el personal", atendido desde el panel. Es el modo con el que arranca una base recién creada. Si una clave desaparece con un modo con Sage ya elegido, Sage responde con una disculpa o con los canales de contacto, y la pestaña Chatbot de los ajustes lo señala.

El modelo generativo que elijas tiene que admitir llamadas a herramientas. Sage las usa para las reservas, las promociones y la información del local.

## El correo saliente

Cuatro variables obligatorias para que salga cualquier correo, y una opcional. Si falta alguna de las cuatro, el envío queda desactivado entero y el resto del sitio sigue funcionando.

Van en **las dos aplicaciones**, porque la tienda manda las confirmaciones y el panel manda las respuestas de soporte. Con valores distintos, los correos saldrían desde dos remitentes diferentes.

#### `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
`secretas` · obligatorias para el correo

Las da tu proveedor de correo. El puerto tiene que ser un número entre 1 y 65535, y la conexión se abre cifrada.

#### `SMTP_FROM`
`secreta` · opcional

La dirección del remitente. Si la dejas vacía se usa `SMTP_USER`.

### Comprobar que el correo funciona

Cuando el correo no sale no hay ningún error que mirar: si falta configuración, el sistema devuelve `null` y quien lo llama se calla. Para eso está este script.

```bash
node --env-file=wildgrove-web/.env.local scripts/check-smtp.mjs
```

Te dice qué está configurado, si la aplicación mandaría correo con esos valores, y se conecta y se autentica de verdad contra tu servidor.

De la contraseña solo enseña si existe y cuántos caracteres tiene, nunca su contenido, y avisa si lleva espacios al principio o al final, que es el fallo típico al copiarla desde un panel web.

Para demostrar que el correo además **llega**, pásale una dirección y manda un mensaje de prueba:

```bash
node --env-file=wildgrove-web/.env.local scripts/check-smtp.mjs tu@correo.com
```

## Google Maps

La clave sale de la [consola de Google Cloud](https://console.cloud.google.com). Creas un proyecto, habilitas **Maps JavaScript API**, **Places API (New)** y **Geocoding API**, y creas una clave. Tiene capa gratuita mensual y pide una tarjeta para activarse.

#### `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
`pública` · opcional

Dibuja el mapa, autocompleta direcciones mientras el cliente escribe y, en el panel, sitúa en el mapa la dirección de contacto. Todo eso pasa en el navegador: el servidor no llama a Google.

La clave va dentro del JavaScript de la página, así que cualquiera puede leerla. Restríngela en la consola de Google de 2 formas:

- **Por sitio web**: solo tus dominios, por ejemplo `https://www.tudominio.com/*` y el del panel.
- **Por API**: solo las 3 de arriba.

Sin la restricción por sitio web, cualquiera que la copie puede usarla desde su propio sitio y el consumo se carga a tu cuenta.

**Si la dejas vacía:** los formularios de dirección siguen funcionando, sin mapa ni autocompletado.

## Upstash

#### `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`
`secretas` · opcionales

Limitan cuántas peticiones puede hacer una misma persona a los endpoints que cuestan dinero o que se pueden atacar por fuerza bruta: el chat y el acceso.

Se sacan en [console.upstash.com](https://console.upstash.com). Creas una base de datos Redis y copias su **REST URL** y su **REST token**. La capa gratuita sobra para este uso.

**Si las dejas vacías:** el límite de peticiones queda apagado y la aplicación arranca igual, sin avisar por ningún lado. En tu máquina eso da lo mismo. En un sitio publicado significa que cualquiera puede llamar al chat sin límite, y cada llamada al chat va a un modelo que se cobra a tu cuenta.

---

## Lo que no se configura con variables

Dos cosas del proyecto se ajustan en otro sitio, y si las buscas aquí no las vas a encontrar.

**`insforge.toml`, en la raíz.** Es la configuración de la autenticación y vive en el repositorio porque no guarda ninguna credencial: qué direcciones se permiten al volver de un inicio de sesión, si hay que verificar el correo al registrarse, y qué exige una contraseña para ser válida. El archivo describe el backend de producción: lleva solo las direcciones de `www`, del dominio sin `www` y del panel, y `require_email_verification = true`. Un `config plan` contra producción tiene que decir `0 add, 0 modify, 0 remove`.

El archivo no tiene sección `[auth.smtp]`. El servidor de correo con el que InsForge manda el código de registro y el de recuperación de contraseña lleva una contraseña, y esa no puede ir en el repositorio, así que se configura a mano en el propio InsForge. Aplicar el archivo no la toca. Es un ajuste distinto de las variables `SMTP_*` de arriba, que son las de las aplicaciones.

En un InsForge propio hace falta ese servidor de correo para activar `require_email_verification`: InsForge rechaza activarla mientras no haya uno configurado, y aplicar el archivo termina con ese error. Si no quieres configurar correo, pon `require_email_verification = false` en tu copia del archivo, y el registro abre la sesión directamente. Sin correo tampoco sale el código de recuperación de contraseña. Para desarrollo no hace falta aplicar la lista de direcciones, porque una lista vacía permite cualquiera, y si prefieres tenerla, añade las de `localhost` con los puertos que uses.

**El panel de administración.** El modo del chat, el proveedor de IA y su modelo, los horarios, las franjas de reserva, el aforo, los datos fiscales y las redes sociales se editan desde la interfaz, no desde un archivo. Son ajustes del negocio, y cambiarlos no debería exigir un despliegue.

La línea que separa una cosa de la otra: **una credencial nunca se guarda en la base de datos**, así que todo lo que sea una clave o una contraseña vive en el entorno, sin excepción.

## Qué funciona sin ninguna credencial externa

Con el backend y la base de datos en marcha ya tienes la carta, el carrito, los pedidos, las reservas, las reseñas, el panel completo y los dos idiomas.

El chat también funciona, atendido por el personal desde el panel. Lo que queda apagado es el correo, Sage, los mapas y el límite de peticiones. Ninguno impide arrancar.

## Antes de publicar tu propia copia

| | Qué revisar |
|---|---|
| 1 | Que no subiste ningún archivo `.env`. En un repositorio público, un secreto queda en el historial aunque después borres el archivo |
| 2 | Que Upstash está configurado, o el chat y el acceso quedan sin límite de uso |
| 3 | Que la clave pública de Google Maps está restringida por dominio |
