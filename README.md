# Agenda Territorial DTE

Agenda de trabajo del equipo de Facilitadores de Educación Digital (FED) de la Región 1 y de la coordinación (CED), de la Dirección de Tecnología Educativa.
Reúne la agenda de visitas y acciones, el buscador y la ficha de escuelas, el mapa, los reclamos de conectividad, los cronogramas, los comunicados del CED, las fotos y las planillas PVE.

Next.js 16 (App Router, acciones del servidor), React 19, Tailwind 4, Supabase (base y autenticación) y Vercel. Gestor de paquetes: pnpm.

> Esta versión de Next.js cambió APIs y convenciones: antes de escribir código, leer la guía correspondiente en `node_modules/next/dist/docs/`.

## Cómo está armada

- `app/page.tsx`: la aplicación es una sola página con secciones (agenda, tablero, escuelas, mapa, reclamos, cronogramas, comunicados…).
- `app/actions.ts`: todas las acciones del servidor. Cada una exige sesión y toma el perfil de la sesión, nunca del navegador. Los permisos por rol están en `lib/permisos.ts`.
- `lib/`: reglas de negocio puras, con sus pruebas en `tests/`. `components/app/`: pantallas.
- `lib/ayuda/`: la ayuda (`temas.ts`) y las novedades (`novedades.ts`). Cada cambio visible para el equipo se documenta ahí en el mismo cambio (ver `CLAUDE.md`).
- `app/api/cron/*`: tareas programadas (fotos y cronogramas, de madrugada; ver `vercel.json`).

## Roles

- **FED**: ve y edita lo suyo (su agenda, sus escuelas, sus acciones).
- **Coordinación (CED)**: ve todo el equipo y edita jefaturas, escuelas y comunicados.
- **Administración**: perfil FED con permisos de administración (usuarios, feriados, sincronización).

La base solo se accede desde el servidor con la clave de servicio: las tablas tienen seguridad por fila activada y sin políticas.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Dirección del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo en el servidor) |
| `CRON_SECRET` | Secreto con el que Vercel autoriza las tareas programadas |
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY` | Cuenta técnica de Google que lee el consolidado y las carpetas de fotos |

## Desarrollo

```bash
pnpm install
pnpm dev          # servidor local en http://localhost:3000
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm build        # compila (los errores de tipos frenan el deploy)
```

Antes de subir un cambio se corren lint, tipos, pruebas y build.

## Base de datos y migraciones

Las migraciones están en `supabase/migrations/` (una por cambio, con comentario de qué hace y por qué). Se aplican sobre el proyecto de Supabase y el archivo se sube al repo en el mismo cambio.
Por limitaciones de la herramienta de administración, los `drop policy` y similares a veces hay que ejecutarlos a mano en el SQL Editor; en ese caso se deja anotado en el archivo.
El historial de la base y la carpeta no coinciden del todo (los números de versión son distintos y hay migraciones aplicadas sin archivo y archivos sin registro): ver `docs/migraciones.md`.
El mismo proyecto de Supabase aloja otras aplicaciones (`bitacora_pp`, `portal_escuelas`): no tocar sus esquemas sin revisar cada una.

## Publicar y volver atrás

1. Rama con el cambio y vista previa de Vercel (debe quedar READY).
2. Pull request y squash a `main`; Vercel despliega a producción.
3. Para volver atrás: `git revert <commit del squash>` y subirlo a `main`. Los cambios de base de datos son aditivos siempre que se puede.

Más contexto de trabajo: `AGENTS.md` y `CLAUDE.md`. Importación inicial de datos: `docs/importacion-2026.md`.
