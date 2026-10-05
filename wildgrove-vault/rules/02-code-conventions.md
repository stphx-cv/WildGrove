---
title: code-conventions
updated: 2026-09-20
status: current
---

# Convenciones de código

Reglas que aplican a cualquier cambio en este repositorio, sin importar en qué estés trabajando. Están aquí y en ningún otro sitio: `AGENTS.md` apunta a este archivo en vez de repetirlo.

## El monorepo

El repositorio tiene dos aplicaciones y tres paquetes compartidos:

```
wildgrove-web/     la tienda pública
wildgrove-cms/     el panel de administración
packages/db/       el esquema de Prisma y el cliente
packages/core/     toda la lógica de negocio
packages/ui/       componentes y tokens de diseño compartidos
```

- **`npm ci` se ejecuta en la raíz**, nunca dentro de una app. Hay un solo `package-lock.json`. Después, `npm run db:generate`: los scripts de instalación están apagados, así que el cliente de Prisma nunca se genera como efecto secundario de instalar.
- Compila con `npm run build` (turbo, todos los espacios de trabajo) o `npm run build -w wildgrove-web`.
- **El código compartido sube a `packages/`, nunca cruza de una app a la otra.** Un solo esquema de Prisma, un solo `OrderService`, un solo `WalletService`.
- **`packages/core` nunca importa desde una app.** Las rutas `@/...` no existen ahí.
- **Solo `wildgrove-web` ejecuta `prisma migrate deploy`.** Si el CMS también lo hiciera, dos despliegues simultáneos competirían por el mismo bloqueo de migración.

## La política de dependencias

El `.npmrc` de la raíz es la defensa de este proyecto contra un paquete comprometido, y aplica a cada clon y a cada compilación en el servidor. No es opcional y no se relaja para ir más rápido.

| Ajuste | Qué impide |
|---|---|
| `ignore-scripts=true` | Que un paquete ejecute código solo con instalarlo. Ese es el mecanismo por el que se han propagado los ataques reales a npm |
| `min-release-age=7` | Instalar una versión recién publicada. Una versión comprometida se detecta y se retira en horas; esperar siete días significa que nunca llega |
| `allow-git=none` | Instalar desde un repositorio de git arbitrario |

Para tomar un arreglo de seguridad más joven que siete días: `npm update <paquete> --min-release-age=0`, y después revisa el diff del lockfile.

**Cualquier cambio en `package-lock.json` se revisa antes de commitearlo.** En `git diff package-lock.json` no debe aparecer ningún `resolved` fuera de `https://registry.npmjs.org/` ni ningún `"hasInstallScript": true` nuevo. Un paquete nuevo con script de instalación se explica en el archivo de la versión o se revierte.

`npm audit` se ejecuta en toda sesión que toque dependencias. Los arreglos que caben dentro de los rangos ya declarados entran con `npm update`. Subir una versión mayor es una decisión aparte y se deja escrita.

## Rutas y acceso

- Las rutas públicas viven bajo `/[locale]/`. Usa los ayudantes de next-intl; nunca escribas un idioma a mano en una ruta.
- **El CMS exige `role = ADMIN | OWNER` en todas sus rutas excepto `/login`.** Esto no se relaja nunca, por ninguna razón. Ver [Qué nunca hacer](03-never-do.md).

## Datos

- **El menú siempre sale de la base de datos.** Nunca se escriben platos en el código.
- Las consultas de lista de Prisma usan `select`. Nunca un `findMany()` sin proyección.
- La moneda principal es **PEN**; el dólar es secundario.
- La zona horaria es Lima, Perú (UTC-5, sin horario de verano).

## Interfaz

- Las imágenes usan `<Image>` de Next.js, nunca `<img>`.
- Por defecto se usa `<FadeInImage>` (`packages/ui/FadeInImage.tsx`), para que la primera carga aparezca con un fundido. Un `<Image>` pelado solo para imágenes con `priority`, o cuando quien la llama ya anima la opacidad.
- Los estilos son clases de Tailwind. Nada de CSS en línea.
- **Las etiquetas no llevan flechas decorativas.** Ni `→` detrás de un enlace o un botón ("Ver todo", no "Ver todo →"), ni `←` delante de uno que vuelve atrás. Una flecha que significa algo sí vale: un rango, un antes y después, una tendencia.
- **Los controles de formulario salen de `packages/ui`.** Interruptores, casillas, botones de opción y áreas de texto ya están escritos ahí. Escribir otro a mano es garantizar que dentro de un año haya dos que se ven distinto.
- Las tablas y listas del panel usan `React.memo`, `useCallback` y `useMemo`.

## Secretos

- **Ninguna credencial vive en la base de datos.** Ni contraseñas de correo, ni claves de API, ni tokens. Van en variables de entorno. Una columna con una contraseña la leen el endpoint que la devuelve, la copia de seguridad y cualquiera con acceso a Postgres.
- **El proveedor de IA se llama solo desde el servidor.** La clave nunca llega al navegador.
- El código lee las claves de `.env.local`, que no se commitea. Ninguna clave se escribe a mano en el código.
- Las variables `NEXT_PUBLIC_*` **no son secretas**: Next.js las incrusta en el JavaScript que llega al navegador. Nunca pongas ahí nada que deba quedar oculto.

## Al terminar

Después de un trabajo con sustancia, actualiza los documentos de `wildgrove-vault/reference/` que describan lo que cambiaste, con su `updated` y su `status`. Ver [Cómo escribir aquí](01-how-to-write-here.md).
