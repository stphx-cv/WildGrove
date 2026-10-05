---
title: never-do
updated: 2026-10-04
status: current
---

# Qué nunca hacer

1. **Nunca dejes un secreto en el repositorio.** Ni contraseñas, ni tokens, ni claves de API, ni cadenas de conexión, ni en el código ni en la documentación. En un repositorio público, además, un secreto subido queda en el historial aunque después borres el archivo. Lo único que se sube es `.env.example`, con los nombres y los valores vacíos.

2. **Nunca escribas en la documentación detalle privado de la infraestructura.** Ni direcciones IP, ni nombres de servidores o de contenedores, ni políticas de acceso a la base de datos, ni identificadores de claves, ni la lista de protecciones que todavía faltan por implementar. Un lector debe poder entender **cómo está construido** el proyecto sin quedarse con un mapa de **dónde golpearlo**. Si un trabajo necesita ese detalle para ejecutarse, el detalle vive fuera de este repositorio.

3. **Nunca relajes el guard de rol del CMS.** Toda ruta de `wildgrove-cms/` excepto `/login` exige `role = ADMIN | OWNER`. Si un cambio parece necesitar una excepción, lo que necesita es otro diseño.

4. **Nunca marques un documento como `current` sin haberlo verificado contra el código.** `draft` es la respuesta honesta y no cuesta nada. Un `current` equivocado es peor que no tener documento.

5. **Nunca reescribas el historial de `wildgrove-vault/versions/`.** Las versiones viejas nombran cosas viejas, y eso es correcto: registran lo que era cierto entonces. Se arregla el presente, no el registro.

6. **Nunca commitees una versión que todavía diga `commit: pending`.** Ciérrala primero, después `git add`. Ver [Cómo versionar este proyecto](04-versioning.md).

7. **Nunca borres documentación sin preguntar.** Propónlo; lo confirma el propietario.

8. **Nunca reescribas un documento entero cuando bastaba con editar una sección.**

9. **Nunca escribas una regla fuera de esta carpeta.** Ni en `AGENTS.md`, ni en `CLAUDE.md`. Esos archivos son punteros y siguen siendo punteros.

10. **Nunca ejecutes `prisma migrate deploy` desde la compilación del CMS.** Dos despliegues simultáneos competirían por el bloqueo de migración.

11. **Nunca escribas en la base de datos de producción fuera del despliegue.** Las migraciones que añaden cosas viajan solas con cada despliegue de la tienda, y así está pensado. Lo que autoriza el propietario cada vez, con copia de seguridad hecha antes, es el resto: una migración que borra una columna o una tabla, cualquier SQL suelto, y marcar una migración como aplicada sin ejecutarla. Este último es el que menos parece y el que más cuesta luego: no ejecuta nada, solo afirma que el esquema ya está al día, y si no lo está el error no se nota hasta que la siguiente migración se construye encima. Antes de marcarla, compara el esquema real contra el del repositorio y comprueba que la diferencia sale vacía. Leer la base para diagnosticar no entra aquí: consultar siempre se puede.

Lo relativo a firmar commits y a subir cambios está en [Git y GitHub](05-git-and-github.md), que es donde se lee en el momento en que hace falta.
