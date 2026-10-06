---
title: security
updated: 2026-10-06
status: current
---

# Seguridad

Si encuentras una vulnerabilidad en Wild Grove, gracias por avisar. Este documento explica cómo hacerlo y qué puedes esperar después.

Wild Grove es un proyecto de portafolio que mantiene una sola persona. El restaurante es ficticio, los pedidos y las reservas son de prueba, y el saldo de las billeteras no es dinero real. Aun así, la tienda está en línea, la usan personas reales y sus cuentas guardan datos personales, así que un fallo de seguridad se trata en serio.

## Qué cubre

| Parte | Dónde |
|---|---|
| La tienda | [www.wildgrove.cv](https://www.wildgrove.cv) |
| El panel de administración | [cms.wildgrove.cv](https://cms.wildgrove.cv) |
| La superficie para agentes: la API, el texto en Markdown y la herramienta MCP | Bajo [www.wildgrove.cv](https://www.wildgrove.cv) |
| El código de este repositorio | Esta rama, `production` |

Solo tiene soporte la última versión publicada, que es la que está en producción. Un fallo que solo existe en una versión anterior ya está resuelto o se resuelve en la siguiente.

## Cómo avisar

Usa el **aviso privado de GitHub**: en la pestaña *Security* del repositorio, *Report a vulnerability*, o directamente en [este enlace](https://github.com/stphx-cv/wildgrove/security/advisories/new). El aviso solo lo ve el propietario del repositorio.

**No abras un issue público** ni lo cuentes en otro sitio hasta que esté resuelto. Un issue lo lee cualquiera, también quien quiera aprovechar el fallo antes de que se arregle.

Para que se pueda reproducir, el aviso debería incluir:

- Qué parte falla: la tienda, el panel, la API o una ruta concreta.
- Los pasos para reproducirlo, con las peticiones o las capturas que hagan falta.
- Qué permite hacer: leer datos de otra cuenta, cambiar algo sin permiso, saltarse un pago.

## Qué esperar

| Cuándo | Qué |
|---|---|
| En 7 días como mucho | Una respuesta que confirma que el aviso llegó y se está mirando |
| En 30 días como mucho | La valoración: si el fallo es real, qué gravedad tiene y qué se va a hacer |

Si el fallo es real, el arreglo sale en una versión normal del proyecto. Cuando esté en producción se te avisa por el mismo hilo, y si quieres, se te menciona en el aviso de seguridad que se publique.

## Cómo probar

Puedes probar contra la web en producción, siempre que lo hagas de buena fe y con estas reglas:

- Usa solo cuentas tuyas. Crear una es gratis y trae un saldo de prueba para hacer pedidos.
- No leas, cambies ni borres datos de otras personas. Si un fallo te da acceso a ellos, para en cuanto lo compruebes y avisa.
- No satures el servidor: nada de ataques de denegación de servicio ni de escáneres automáticos que lancen miles de peticiones.
- No intentes engañar a las personas que usan la web ni a quien la mantiene.

Si sigues estas reglas, no tendrás ninguna reclamación por haber probado. Si prefieres no tocar producción, el [README](README.md) explica cómo levantar una copia en tu máquina.

## Qué queda fuera

- Los fallos de servicios de terceros, como InsForge o Google. Esos se comunican a su propio proyecto.
- Los ataques de denegación de servicio por volumen.
- La ingeniería social contra personas.
- Los avisos que solo dicen que falta una cabecera o una opción de configuración, sin una forma concreta de aprovecharlo.
