# Importación de datos 2026 (25/09/2026)

Origen: planillas `Registro_<FED>` de cada FED en Drive (hojas REGISTRO, CAPACITACIONES y PERFIL).
Es la misma información que consolida el `[MASTER] - Tablero Coordinador - Región 1`, más lo que el master no trae
(horarios de Jorge Pérez, links de fotos de Macarena Duarte Buschiazzo, DD.JJ. de horarios y 2 filas con fechas mal tipeadas).

| | Cantidad |
|---|---|
| Acciones importadas (`agenda_items`, estado realizada) | 1446 |
| Encuentros de clubes/talleres/prácticas (`agenda_encuentros`) | 429 (318 vinculados a su acción) |
| Acciones con horario | 130 |
| DD.JJ. de horarios cargadas (`feds.ddjj`) | 7 FEDs |

Cada fila importada tiene `origen = 'planilla'` y `origen_ref = '<FED>:R<fila>'` (acciones) o `'<FED>:C<fila>'` (encuentros),
así se puede identificar la fila original y reimportar sin duplicar.

## Correcciones aplicadas
- Fechas tipeadas como texto: `25--08-2026` (Andrés Guzmán, fila 118 → 25/08/2026) y `16-04/2026` (Jorge Pérez → 16/04/2026).
- Ninguna fecha anterior a 2026.
- Lugares que no son escuelas (jefaturas, "Feria de Ciencias") se guardan en `lugar`.

## Filas no importadas
- 43 filas vacías de plantilla (sólo fecha o sólo FED/distrito, sin acción, escuela ni detalle).
- 1 encuentro sin fecha ni escuela (Andrés Guzmán, CAPACITACIONES fila 28, "Club de Tecnología").
- 12 filas sin tipo de acción, para completar a mano en la app si corresponde:

| FED | Fila | Fecha | Escuela / lugar | Detalle |
|---|---|---|---|---|
| Andrés Guzmán | 61 | 07/05 | Jefatura Distrital Brandsen | jafatura distrital entrega de tablet |
| Andrés Guzmán | 118 | 17/08 | — | FERIADO |
| Daniela Cortes | 44 | 09/04 | DTE | Sincrónico de LIGA DE RADIOS ESCOLARES |
| Jorge Pérez | 21, 22 | 04/09 | EP N° 22 Berisso | — |
| Jorge Pérez | 23 | 03/09 | EP N° 22 Berisso | — |
| Jorge Pérez | 24 | 03/09 | JI N° 910 Berisso | — |
| Jorge Pérez | 63 | 04/08 | ES Berisso | Desbloquear y revisar ADM-2019 |
| Jorge Pérez | 64 | 04/08 | DTE | Trabajo administrativo |
| Macarena Duarte Buschiazzo | 12, 13 | 17/09 | DTE | JORNADAS DE EDUCACION DIGITAL |
| Macarena Duarte Buschiazzo | 150 | 27/05 | DTE | En contexto de paro con total adhesión, realizo tarea virtual… |
