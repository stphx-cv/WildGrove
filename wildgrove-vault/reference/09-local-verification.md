---
title: local-verification
updated: 2026-10-08
status: draft
---

# Cómo verificar un cambio en local

Técnicas para comprobar un cambio contra la pila local sin tocar producción. Se escribieron durante revisiones reales y no se han vuelto a ejecutar una por una al redactar este documento, así que su `status` es `draft`: comprueba el comando antes de fiarte.

## Antes de empezar

- La pila local usa un contenedor de Postgres propio. Si InsForge entra en bucle de reinicios con un error de resolución del host `postgres`, el contenedor de la base está parado: `docker start insforge-postgres-1`.
- Para la base local: `docker exec insforge-postgres-1 psql -U postgres -d insforge`. Un `psql -c` con varias sentencias es una sola transacción: si una falla, deshace también las anteriores sin avisar.
- Tras `npm run db:generate`, reinicia los servidores de desarrollo. Siguen usando el cliente de Prisma viejo y los registros fallan sin error visible.
- Detén los servidores de desarrollo antes de `npm run build` o de construir imágenes: con 13 GB de memoria la máquina se llegó a cerrar.

## Sesiones de prueba

- Hay dos cuentas locales de prueba, `customer.local@example.com` (CUSTOMER) y `owner.local@example.com` (OWNER). Su token de acceso va en la cookie `insforge_access_token` para `curl` o para el navegador.
- Para probar como ADMIN, cambia el `Profile.role` de la cuenta de cliente en la base local y restáuralo al terminar.
- Sin un token a mano, se puede firmar uno dentro del contenedor local de InsForge con su propio `JWT_SECRET`, que no sale del contenedor. Nunca contra producción.
- Las cookies se comparten entre los puertos de `localhost`: la cookie del propietario del panel también inicia sesión en la tienda. Bórrala antes de probar la tienda.

## Correo y límite de peticiones

- Para el correo, un servidor SMTPS de prueba con certificado autofirmado. `nodemailer` usa `secure: true`, así que el servidor de desarrollo necesita `NODE_EXTRA_CA_CERTS` y las variables `SMTP_*`. Una dirección que acepta la conexión y nunca contesta sirve para provocar el tiempo de espera de 10 segundos.
- Sin las variables de Upstash, el limitador de peticiones no hace nada en desarrollo. Un servidor falso de la API REST de Upstash (con `/pipeline` y la ventana deslizante por `EVALSHA`) permite probar los límites. Varía `cf-connecting-ip` en cada prueba, porque la caché efímera del proceso bloquea las claves repetidas.
- La pila local no tiene proveedor de correo ni de OAuth: no se pueden recorrer de punta a punta la verificación de correo ni el acceso con Google. Se prueban las rutas con `jiti` y un sustituto del SDK. Los códigos de recuperación están cifrados con bcrypt en `auth.email_otps`; para una cuenta desechable se reemplaza `otp_hash` por el hash de un código conocido.
- El inicio del flujo de Google sí puede ejecutarse con un proveedor falso dado de alta por la API de administración (`/api/auth/oauth/configs`) y una lista de redirecciones permitidas. Al terminar se borra la configuración.

## Código sin servidor

- **Sage:** se llama a `executeTool` con `jiti` y un sustituto de `next/cache`. Para `ai.ts`, se redirige `openai` a un cliente guionizado y `next-intl/server` a un sustituto.
- **Zona horaria:** la máquina está en Lima, así que los servidores de desarrollo esconden los errores de UTC. Ejecuta el módulo con `TZ=UTC` mediante `jiti`.
- **Carreras:** `LOCK TABLE ... IN SHARE MODE` más `pg_sleep` en `psql` sostienen una escritura mientras observas `pg_stat_activity`. Para un bloqueo consultivo: `begin; select pg_advisory_xact_lock(<clave>); select pg_sleep(<segundos>); commit;`.
- **Script de despliegue:** se ejecuta `scripts/deploy.sh` en una carpeta temporal con `COMPOSE_FILE` y `TMPDIR` apuntando ahí, y `docker` y `sudo` sustituidos en el `PATH`. Se detiene en el primer `pull` y muestra qué imágenes usaría.

## Navegador

- Para el teclado y la accesibilidad, usa Chrome headless por CDP con `Input.dispatchKeyEvent` (con `key`, `code`, `windowsVirtualKeyCode` y `text`). El panel integrado de algunas herramientas envía el `keydown` sin `key`, y Enter y Espacio no activan los botones. Los nombres accesibles salen de `Accessibility.getFullAXTree`, o de `getPartialAXTree` sobre elementos marcados con un atributo `data-ax-probe`.
- Chrome headless informa `hover: none` y Tailwind no aplica los `hover:`. Se arranca con `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`. El idioma del navegador se fija con `Emulation.setUserAgentOverride({acceptLanguage})`, porque la bandera `--lang` no basta.
- Zona horaria del navegador: `Emulation.setTimezoneOverride`.
- Acepta `Page.javascriptDialogOpening`, o el `beforeunload` de un formulario sucio del panel bloquea la navegación.
- El banner de cookies tapa el final de las páginas cortas: fija antes `wg_cookie_consent`.
- El borrador del pago en `sessionStorage` (`wg:checkoutDraft:v1`) se inyecta desde otra página, por ejemplo `/es/menu`, nunca desde `/checkout`, que lo sobrescribe al salir.
- La primera carga de la tienda después de guardar un ajuste en el panel todavía sirve el ajuste viejo (la caché revalida en segundo plano). Recarga una vez antes de juzgar. Si una compilación con caché completa de turbo deja datos viejos, invalida las etiquetas con `POST /api/revalidate`.
- Para ver el panel hay que usar una compilación de producción local, porque en desarrollo `next/image` falla con `http://localhost:7130`, que no está en `remotePatterns`.
- Para subir archivos reales por la interfaz: `Page.setInterceptFileChooserDialog` y, al abrirse el selector, `DOM.setFileInputFiles`.
- Nunca uses `pkill -f` con un patrón que aparezca literal en tu propio comando: mata el shell.

## Imágenes de Docker en local

Nunca ejecutes `docker build` desde la raíz del repositorio. La caché `.turbo` de la raíz pesa decenas de gigabytes y no está en el `Dockerfile.dockerignore` de las aplicaciones, así que copiar el contexto agota la máquina. Construye desde una copia limpia (`git archive HEAD`) con `--network=host`, y ejecuta con `--network host` y un archivo de entorno generado desde `.env.local` que borres después.
