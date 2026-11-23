# Heladería POS — V1 Angular

Esta revisión corrige la impresión horizontal de los tickets cortos. Mantiene **78 mm de ancho**, aplica **82 mm de alto mínimo** y conserva el largo automático para comprobantes más largos. El mismo cálculo se usa en efectivo, tarjeta, Mercado Pago, reimpresiones, movimientos y cierres.

La corrección está completa en **src/app/core/receipt-print.ts** y puede aplicarse copiando solo ese archivo. Ver **ACTUALIZAR.md**. No cambia registros, esquema, environment ni dependencias.

Verificación de la corrección: **207 pruebas**, build y reproducción de impresión en Chromium. Antes, el ticket de tarjeta de una línea pedía 78 × 73 mm y el rollo se giraba a 297 × 80 mm; con la corrección pide 78 × 82 mm y el rollo conserva 80 × 297 mm en vertical. Se comprobaron efectivo, tarjeta, Mercado Pago, ticket largo, anulado, pantalla angosta, cierre, movimiento y conservación exacta de la base al reimprimir. La Epson física no está disponible en este entorno.

Versión actual: **Métricas de cantidades en el menú lateral**, con gráficos por día de semana, hora, evolución del período, productos, categorías y mapa día × hora. Incluye filtros de fechas, categoría, presentación, producto, día de semana y franja horaria. Conserva los filtros/buscador de Venta, las familias con dos cajas y unidad, las equivalencias de Semana/CSV y los tres tickets de 78 mm. Ver [METRICAS.md](METRICAS.md), [PRODUCTOS_BASE.md](PRODUCTOS_BASE.md) y [ACTUALIZAR.md](ACTUALIZAR.md).

Boceto funcional, sin backend, para una caja y un navegador. Angular standalone + TypeScript + IndexedDB. Catálogo de ejemplo; reemplazar precios antes de operar.

## Instalación

Node.js 22.12 o superior (se verificó con Node 24). Descomprimir y abrir terminal en la carpeta del proyecto:

En PowerShell:

```powershell
npm.cmd ci
npm.cmd start
```

En Linux/macOS, usar `npm` sin `.cmd`. Si actualizás una instalación existente, seguí ACTUALIZAR.md y conservá tus environments.

Abrir http://localhost:4200. Para verificar:

```powershell
npm.cmd test
npm.cmd run build
```

## Primer recorrido

1. Productos: elegir categoría y usar **Nuevo producto**, **Agrupar productos existentes** o **Editar**. Caja y Unidad se configuran juntas en una ficha.
2. Caja: ingresar fondo inicial y abrir.
3. Venta: elegir categoría con las flechas o el desplegable y filtrar Todos / Por unidad / Por caja. El buscador encuentra productos de todo el catálogo activo y agrega el resultado elegido al pedido. Elegir efectivo / Mercado Pago / tarjeta y cobrar. En efectivo ingresar recibido; el vuelto no es ingreso de caja.
4. El ticket se muestra después de guardar. Imprimir abre el diálogo del navegador; elegir térmica compatible con papel de 78 mm. Se puede reimprimir desde Historial.
5. Caja: registrar retiros e ingresos con motivo. Al finalizar contar el efectivo físico, incluyendo el fondo inicial, y guardar cierre.
6. Cierres: revisar cantidades por producto, importe vendido, medios de pago y diferencia.
7. Métricas: elegir el período y tocar **Aplicar filtros**. Comparar días, horas, productos y categorías por cantidades; incluye todo el historial guardado y descuenta las anulaciones.
8. Respaldo: exportar JSON y guardarlo fuera del navegador. Para restaurar, cerrar primero la caja actual. Importar reemplaza todo; no fusiona datos.

Los tickets son comprobantes internos, sin integración fiscal. Mercado Pago y tarjeta son registros manuales de pago, sin conexión con proveedores.

## Buscar y filtrar en Venta

Cada categoría tiene tres botones con cantidades: **Todos**, **Por unidad** y **Por caja**. Por caja incluye la principal y la segunda; las tarjetas identifican su tamaño cuando está configurado. El filtro elegido se recuerda por categoría durante el uso de la pantalla y se reinicia al recargar. Cambiar filtros no vacía el pedido ni escribe datos.

**Buscar producto por nombre** recorre todas las categorías y presentaciones activas, aunque el filtro visual sea otro. Acepta también el código Grido, varias palabras y nombres sin tildes. El selector muestra nombre, categoría, presentación, código y precio. Elegir un resultado agrega ese producto exacto al pedido y muestra su categoría/presentación. No suma cajas y unidades como si fueran un mismo producto.

Con teclado, ↑/↓ elige, Enter agrega y Escape cierra los resultados. Si hay varias coincidencias sin ninguna seleccionada, el primer Enter marca la primera y el segundo la agrega. Se muestran hasta 20 resultados; escribí más para precisar la búsqueda. La cruz limpia el texto. Con caja cerrada se puede buscar y consultar precios, pero no agregar ni cobrar.

La presentación configurada en la familia tiene prioridad. Para productos antiguos sin presentación, se reconocen rótulos habituales como «x UNIDAD», «caja» o un sufijo «x 10» únicamente para el filtro visual. Esto no crea familias ni infiere capacidades físicas para Semana; las equivalencias siguen usando las cantidades configuradas. Una presentación especial como Pack se encuentra en Todos y en la búsqueda.

Verificación de los filtros (versión anterior): **184 pruebas automatizadas**, build y recorrido en Chromium con IndexedDB 4 y ventas previas. Incluye filtros por categoría, ambas cajas, búsqueda global, teclado, nombres repetidos, cambios desde otra pestaña, precios/IDs exactos al cobrar, caja cerrada, respaldo/recarga, escritorio/teléfono, equivalencias semanales y los tres tickets. No se modificaron esquema, dependencias, environments ni los componentes de impresión.

Commit sugerido: `feat: filter sale products by presentation and add searchable selector`

## Modelo y reglas

- `Product`: catálogo editable, precio en centavos y activo/inactivo.
- `Sale`: número correlativo local, sesión de caja, fecha, medio de pago y detalle con nombre/precio históricos.
- `Session`: apertura, fondo inicial y movimientos; una sola abierta.
- `Closing`: snapshot definitivo con ventas, cantidades, importes por producto, pagos, esperado, contado y diferencia.
- Efectivo esperado = fondo inicial + ventas en efectivo + ingresos − retiros.
- El cierre guarda totales reales por producto, no cantidad × precio actual. Soporta precios distintos durante la jornada.
- Ventas y cierre se guardan dentro de transacciones IndexedDB. Se vuelve a comprobar caja abierta y precio activo al cobrar.
- El servicio lee los registros actuales dentro de cada transacción para evitar sobrescrituras entre pestañas; BroadcastChannel avisa a las otras pestañas del mismo sitio para refrescar. Una sola pestaña de caja simplifica la operación.

## Estructura

`src/app/core/models.ts`: contratos y catálogo inicial.
`src/app/core/domain.ts`: dinero, cierre y validación de respaldos.
`src/app/core/storage.service.ts`: adaptador de persistencia. Cambiar aquí cuando se agregue API/SQLite; no escribir almacenamiento desde la UI.
`src/app/app.component.*`: interfaz con nueve secciones y componentes de catálogo, tickets y métricas.
`src/app/metrics.component.ts`: filtros, indicadores de cantidades y gráficos de Métricas.
`src/app/core/metrics.ts`: acumulador de cantidades del historial, fechas/horas locales y promedios calendario.
`src/app/quantity-chart.component.ts`: gráficos accesibles en HTML/SVG, sin dependencias adicionales.
`tests/domain.test.ts`: cálculos de caja, snapshots y validación.

La persistencia usa registros individuales en IndexedDB, con índices para ventas e historial paginado. Hay anulaciones auditadas; no hay stock, usuarios, permisos, descuentos, pagos mixtos, reintegros automáticos ni sincronización entre equipos.

## Métricas de cantidades

Entrá a **Métricas** en el menú lateral. Muestra cantidad vendida, productos distintos, día y hora más fuertes; gráficos de días de semana y horas, evolución por período, rankings de productos/categorías y un mapa de 7 × 24 franjas. Los gráficos miden cantidades, sin indicadores de facturación, pedidos o ticket promedio.

Por defecto consulta los últimos 30 días. Podés usar Hoy, Esta semana (lunes a hoy), Últimos 7 días, Este mes, Todo el historial o fechas personalizadas. Filtra por categoría histórica, presentación y nombre/código; los filtros adicionales permiten elegir día de semana y franja horaria. Usá **Aplicar filtros**. Los días se pueden comparar por acumulado o por promedio de ocurrencias calendario, incluidos días sin ventas.

Una caja cuenta como una presentación, independientemente de su tamaño; la unidad cuenta como una presentación. El filtro Por caja reúne ambos tamaños. Las conversiones físicas a unidades/cajas/packs siguen en Semana. Métricas consulta también ventas antiguas fuera del turno/semana activos, incluye productos retirados que se hayan vendido y excluye las ventas anuladas. Se actualiza con los cambios de otras pestañas.

La consulta recorre el historial con un cursor dentro de una transacción de solo lectura; no carga todas las ventas en el caché de la caja ni modifica registros. Mantiene IndexedDB 4, JSON 1, environments y dependencias. Uso y reglas de cálculo en **METRICAS.md**.

Verificado en esta entrega: **204 pruebas automatizadas**, build y recorrido en Chromium con historial cerrado, filtros combinados, zonas horarias, gráficos, promedios, productos retirados, anulación desde otra pestaña, recarga y escritorio/teléfono. Se comprobó conservación exacta de los registros al consultar y reimpresión del cierre en 78 mm.

Commit sugerido: `feat: add quantity metrics with historical charts and filters`

## Environments

Producción: `src/environments/environment.ts`.
Desarrollo: `src/environments/environment.development.ts`, reemplazado por Angular con la configuración development.

Configurar `storeName` (cabecera y ticket), `dbName` (nombre de la base IndexedDB) y `timeZone`. Se usa moneda ARS y formato es-AR. No requiere `.env`, API ni credenciales. El environment se compila en el navegador: jamás poner secretos.

Se separan las bases `heladeria-pos-dev-v1` y `heladeria-pos-v1` para no mezclar pruebas con operación. Cambiar dbName crea otra base; exportar/importar si querés migrar. Cambiar dominio, puerto, protocolo, navegador o equipo también cambia el almacenamiento disponible.

## Deploy estático con Nginx (VPS Ubuntu)

No se desplegó automáticamente. Configuración para dominio raíz:

```bash
npm ci
npm run build
```

Publicar **el contenido** de `dist/heladeria-pos/browser/` en `/var/www/heladeria-pos/`. El archivo `deploy/nginx.conf` muestra la configuración. Sustituir el dominio por el propio. Ejecutar `sudo nginx -t` y luego `sudo systemctl reload nginx`. Configurar DNS y HTTPS con el procedimiento de Certbot que ya usás.

Es una app estática: no necesita PM2 ni Node en producción. No subir `node_modules` ni el código fuente al directorio público. En hosting estático, carpeta de publicación: `dist/heladeria-pos/browser`. Para subdirectorio reconstruir con `npx ng build --base-href /caja/` y adaptar Nginx.

Actualizar todos los archivos del build juntos, preferiblemente con un directorio de versión y cambio de enlace simbólico. No borrar la base del navegador para actualizar. La configuración Nginx evita cachear index y manifiestos, y permite caché larga para bundles con hash.

## Operación sin Internet

El build de producción incluye Angular Service Worker. Tras la primera carga completa y registro por HTTPS (o localhost), mantiene los recursos de la aplicación para recargar offline. IndexedDB guarda los datos sin red. En desarrollo `npm start` no habilita ese caché: debe continuar encendido el servidor local.

Para probar producción local:

```bash
npm run build
npx http-server dist/heladeria-pos/browser -p 8080 -c-1
```

Abrir http://localhost:8080; esperar registro del service worker, cerrar y abrir, desconectar red y recargar. Probar venta, cierre y restauración con datos de ensayo antes de usar en una jornada real. La prueba offline y la impresión física dependen del navegador/equipo y no se verificaron en este entorno.

La base no se guarda en el VPS. Una segunda PC tendrá otra base. Para una V2 con dos cajas hace falta una fuente de datos compartida y conciliación; el JSON no es sincronización. No usar incógnito y mantener respaldos diarios externos.

## Validación y próximos pasos

Esta entrega incluye build y tests de dominio; no equivale a validación operativa ni fiscal. Primer piloto: una jornada de prueba, corte de red, reinicio, precio cambiado a mitad del día, cierre con diferencia y restauración del JSON.

Después: extraer features, búsqueda y atajos, pagos mixtos y backend compartido entre equipos. Integración de merma: agregar receta/gramos teóricos a productos, sin modificar los precios o datos de ventas históricas.

Fuentes oficiales: https://angular.dev/tools/cli/environments · https://angular.dev/tools/cli/deployment · https://angular.dev/ecosystem/service-workers

Commit sugerido: `feat: bootstrap angular ice-cream pos with indexeddb and cash closings`

## Actualización: conteo de billetes

Apertura y cierre se calculan a partir de cantidades de billetes: $20.000, $10.000, $2.000, $1.000, $500, $200, $100, $50, $20 y $10. Se muestra subtotal por fila y total automático. El cierre muestra en vivo esperado, diferencia, faltante/sobrante/balanceado. Cantidades vacías equivalen a cero; se rechazan negativos, fracciones y valores fuera del rango seguro. Se permite abrir/cerrar con cero efectivo.

El desglose se guarda en `Session.openingCount` y `Closing.cashCount`, también en backups. Los cierres históricos y respaldos V1 sin desglose siguen funcionando; no se inventa un conteo para ellos. Desplegar sobre la misma dirección y mantener dbName conserva datos locales. Guardar backup antes de actualizar. Los borradores de conteo no se conservan al recargar hasta confirmar apertura/cierre.

En Cierres, desplegar «Conteo de billetes» para consultar apertura y cierre. Solo incluye las denominaciones solicitadas; no incluye monedas ni otros importes.

Commit: `feat: add denomination counts to cash opening and closing`

## Actualización: categorías de productos

Nueva sección «Categorías» para guardar nombres y consultar cuántos productos tiene cada categoría. En «Productos», la categoría se selecciona desde un desplegable. Nombres vacíos y duplicados (aunque cambie mayúsculas o espaciado) se rechazan. Las categorías se guardan en IndexedDB y se incluyen en los respaldos JSON, incluso si todavía no tienen productos.

Se mantiene la versión de datos V1: al abrir datos anteriores, el catálogo se deriva de las categorías que ya tenían los productos, incluidos los inactivos. No se borran productos, ventas ni cierres. La actualización del esquema persiste la migración al abrir la aplicación. Respaldos V1 antiguos sin catálogo se restauran con la misma conversión.

Commit: `feat: manage product categories and select them from dropdown`

## Actualización: seguimiento semanal y CSV

La sección «Semana» maneja períodos manuales independientes de las cajas diarias. Primera vez: elegir fecha inicial (por defecto lunes de esta semana en Argentina) y tocar «Iniciar semana». Incluye ventas guardadas desde esa fecha; las anteriores permanecen en Historial, fuera del seguimiento semanal. El acumulado se actualiza con cada venta, incluso si todavía no se cerró la caja diaria.

Muestra número de ventas, unidades, facturación, ticket promedio, importes por medio de pago, cantidades/importes por producto y categoría y ventas por día. Un ticket con múltiples categorías cuenta en cada una; no sumar esos conteos para calcular tickets generales. Las unidades de productos distintos tampoco representan kg o bochas equivalentes.

«Cerrar semana y descargar CSV» guarda un snapshot con los IDs de ventas y todas las tablas, descarga el CSV y abre el próximo período inmediatamente. No hay cierre automático los domingos ni duración obligatoria de siete días. El cierre semanal no cierra la caja diaria. Ventas posteriores pertenecen al período nuevo; los cierres anteriores se consultan y descargan desde la misma sección. Semanas sin ventas también pueden cerrarse.

CSV UTF-8 con BOM, separador punto y coma, importes ARS con coma decimal y sin separadores de miles. Columna `tipo`: GENERAL, PAGO, PRODUCTO, CATEGORIA, DIA. Incluye inicio/fin, unidades, tickets, importe y medio de pago donde aplica. Para conciliar total, comparar cada sección separadamente: sumarlas todas duplicaría datos. IDs, nombres y categorías se conservan; nombres con caracteres de fórmula se neutralizan al exportar. Fechas diarias en Argentina (UTC−3); inicio/fin como timestamps ISO UTC.

Se conserva `Item.category` al cobrar para que cambios posteriores en el catálogo no alteren el resumen. Ventas V1 anteriores sin esa información se completan una vez con la categoría del catálogo actual; si no existe el producto se indica «Sin categoría histórica». No es posible recuperar la categoría original si había cambiado antes de esta actualización.

Los períodos y snapshots se guardan en `Data.weeks`; cada venta asignada conserva `weekId`. Backups incluyen esas relaciones y la importación verifica que los resúmenes concilien. Respaldos anteriores siguen funcionando. La pertenencia al período se guarda transaccionalmente al cobrar, incluso si otra pestaña cierra la semana simultáneamente. Operar desde una sola pestaña continúa siendo lo recomendado.

Commit: `feat: add weekly sales tracking and closing csv export`

## Actualización: navegación de categorías en Venta

Venta muestra una categoría por vez. Las flechas izquierda/derecha cambian de categoría y, al llegar al extremo, vuelven a la otra punta. La cabecera muestra nombre, posición y cantidad de productos activos. El carrito se conserva al navegar. Solo se recorren categorías que tienen productos activos; con una sola categoría las flechas quedan deshabilitadas. Sin productos activos se muestra un mensaje. Si la categoría seleccionada deja de tener productos activos, se muestra la primera disponible.

No cambia el formato de datos, persistencia ni cálculo de ventas. Se verificó la compilación Angular.

Commit: `feat: navigate pos products by category with arrows`

## Actualización: catálogo por categoría

«Productos» tiene un selector de categoría común al formulario y la tabla. Solo lista productos de la categoría seleccionada, incluidos inactivos para poder reactivarlos. Los productos nuevos se crean en esa misma categoría y aparecen en la tabla al guardarse; la selección se mantiene. Sin selección válida se toma la primera disponible. Categorías vacías muestran un mensaje; sin categorías, crear una desde «Categorías». Este selector es independiente de las flechas de la pantalla de Venta.

Validación: build Angular de producción. No cambian modelos, persistencia ni reglas de cálculo.

Commit: `feat: filter product catalog and creation by selected category`

## Actualización: anulación de ventas

Historial incluye estado «Vigente / ANULADA» y botón «Anular venta». Requiere motivo y confirmación. La venta se conserva completa con `cancellation.at` y `cancellation.reason`; no se borra ni se renumera. Una venta ya anulada no se vuelve a anular. El ticket también muestra la anulación.

Los totales vigentes excluyen las ventas anuladas: unidades, facturación, productos, categorías, medios de pago, días y efectivo esperado de una caja abierta. El cierre de una caja o semana posterior a la anulación ya guarda el neto. Si se anula después del cierre, se conserva el snapshot original y se muestra el neto/ajuste junto al original. El efectivo contado y la diferencia registrados en el cierre original no se reescriben. El CSV semanal descargado nuevamente refleja el neto actual e incluye filas CIERRE_ORIGINAL y ANULACION con motivo y fecha. Un CSV que ya descargaste no cambia: descargarlo otra vez.

La anulación modifica el registro; no ejecuta reembolsos en Mercado Pago/tarjeta. En una caja abierta el efectivo esperado disminuye al anular una venta en efectivo: si ya se cobró, corresponde devolverlo físicamente; no registrar además un retiro por ese mismo reintegro en esa caja porque se descontaría dos veces. Si se devuelve desde una caja nueva una venta de una caja cerrada, registrar el retiro real en la caja nueva, además de anular el ticket original.

Los respaldos incluyen anulaciones y su validación reconstruye cada snapshot según el estado al momento del cierre. Para preservar el orden de eventos, una anulación posterior queda fechada después del cierre asociado, incluso si ambas acciones suceden en el mismo milisegundo. Esta V1 sigue sin usuarios o permisos: cualquiera con acceso a la app puede anular una venta, con motivo y confirmación. No se agregó ningún botón para limpiar pruebas.

Commit: `feat: add audited sale cancellations and net cash and weekly totals`

## Actualización: edición, eliminación y nombres Grido

Productos y categorías tienen un nombre visible y un nombre/código Grido. En Venta y tickets se usa el visible. Los nombres Grido se muestran en administración y se incluyen en las ventas nuevas, sus reportes semanales y CSV (producto_grido / categoria_grido). Esto prepara la identificación para conciliación; no conecta ni sincroniza con Grido.

Productos: «Editar» carga nombre visible, nombre/código Grido, categoría y precio en el formulario. Elegir categoría con el selector superior. «Guardar cambios» conserva el ID. «Eliminar» pide confirmación y quita el producto del catálogo, manteniendo su registro archivado para conservar ventas y cierres. Activo/inactivo sigue disponible para cambios temporales.

Categorías: «Editar» permite modificar ambos nombres y actualiza la categoría de los productos del catálogo. «Eliminar» abre un diálogo: si hay productos, elegir una categoría a la que moverlos; no permite dejarlos sin categoría. Las categorías eliminadas se archivan.

Datos anteriores mantienen su nombre visible. El nombre Grido inicial de las categorías es el mismo que el visible; en productos sin ese campo se muestra el nombre visible hasta editarlo. No se inventan códigos Grido en las ventas históricas; sus columnas Grido pueden estar vacías. Respaldos anteriores se migran sin borrar datos. La lista compatible `categories` continúa siendo nombres visibles; `categoryDetails` contiene IDs estables, ambos nombres y archivo de eliminaciones.

Ventas y snapshots ya guardados no cambian al editar/eliminar el catálogo. Los reportes agrupan por identidad de producto, categoría histórica y códigos históricos; si cambian esos códigos durante una semana puede haber más de una fila del mismo producto, manteniendo cantidades/importes conciliados. Si cambia el precio de un producto que está en el carrito, se debe vaciar y rehacer esa venta antes de cobrar.

Commit: `feat: manage catalog names and grido mappings with safe edits and deletion`

## Actualización: IndexedDB por entidades e historial paginado

Se mantiene el mismo `dbName`; la versión interna de IndexedDB pasa de 1 a 2. El formato del respaldo JSON sigue siendo `version: 1` para aceptar respaldos anteriores. No cambiar `dbName`, dominio, protocolo ni puerto al publicar una actualización.

Stores: `products`, `categories`, `sales`, `sessions`, `weeks` y `meta`. Cada entidad tiene su propio registro; `meta` contiene secuencia de tickets, conteos y total vigente. Índices de ventas: `byNumber` único, `bySession`, `byWeek`, `byAt` y `byCancellationAt`. Cobrar guarda solamente la venta nueva y sus metadatos; editar un producto guarda ese producto. Todo ocurre dentro de una transacción, incluidos los números correlativos y las anulaciones.

La migración toma el antiguo `state/data`, valida y normaliza los datos, escribe los registros nuevos y elimina `state` en la misma transacción. Si falla, se revierte toda la actualización y permanece el documento original. Antes de actualizar, exportar JSON desde la versión anterior. Cerrar otras pestañas de la app: una conexión antigua abierta puede bloquear el cambio de versión. No volver a desplegar una versión antigua de la app sobre una base ya migrada.

Historial muestra 25 tickets por página, ordenados del número más alto al más bajo, incluidas las anulaciones. Los contadores generales no se calculan a partir de la página visible. Se leen páginas mediante cursor del índice de número. En páginas muy lejanas el cursor salta los registros anteriores; no es paginación remota.

La vista mantiene el catálogo, cajas y snapshots semanales, las ventas de la caja/semana abiertas y el historial de anulaciones. Los reportes cerrados usan sus snapshots originales y descuentan anulaciones posteriores, sin cargar todas las ventas históricas vigentes. Si una semana permanece abierta durante meses o hay muchas anulaciones, esa parte de la vista también crece. Esta mejora evita reescribir el histórico completo al cobrar; no elimina la cuota de disco del navegador.

Exportar JSON lee todas las entidades, incluidas ventas de todas las páginas; nunca usa la caché parcial de la interfaz. Restaurar valida el respaldo y reemplaza todo en una transacción. No hay límite artificial de 50 MiB en la importación; exportar/importar archivos grandes sigue dependiendo de la RAM y almacenamiento disponibles. Mantener respaldos externos diarios.

Verificación: 42 pruebas de dominio y persistencia usando `fake-indexeddb`, más build Angular de producción. Se verifican migración/rollback, respaldos antiguos, paginación, concurrencia de dos conexiones, cierres y anulaciones con caché parcial. En una prueba con 10.000 ventas históricas, cobrar no hace `getAll` de ventas y escribe solo venta + meta. Es una prueba funcional de acceso, no una medición de rendimiento del navegador. La interacción visual, el almacenamiento real del navegador y el funcionamiento offline deben probarse en el equipo de caja.

Actualizar siguiendo `ACTUALIZAR.md`. Se agrega `fake-indexeddb` como dependencia de desarrollo para las pruebas.

Commit: `feat: normalize indexeddb storage and paginate sales history`


## Actualización: ticket térmico y ventas por turno/día

El ticket reproduce la estructura de la referencia Grido para papel de 78 mm: cabecera, número de pedido, fecha/hora, turno, pago, ID interno, tabla UNDS./DESCRIPCIÓN/IVA/PRECIO/IMPORTE y total. Usa los datos de la venta guardada, también al reimprimir; editar el catálogo no cambia un ticket anterior. «Pedido nro.» es `Sale.number`, el número correlativo visible del pedido. `S:` es `Sale.id` completo; Turno muestra los primeros ocho caracteres del ID real de la caja, sin inventar una secuencia externa de Grido. El environment define nombre y zona horaria; no hay fechas, precios ni números de ejemplo en la plantilla.

Productos permite configurar IVA % opcional. El precio cargado es final: no se agrega IVA al total. Se conserva la tasa en cada venta nueva; ventas antiguas sin tasa muestran «—». El ticket continúa siendo un comprobante interno no válido como factura.

Caja muestra ventas del turno abierto, total vigente, unidades, anulaciones, medios de pago y detalle por producto sin cerrar la caja. Venta muestra un resumen y acceso a los tickets del turno. Cierres conserva los cierres guardados.

Historial abre en Turno actual. Permite Un turno (abierto o cerrado), Un día y Todo el historial. Un día usa 00:00–24:00 en Argentina y puede incluir varias cajas; un turno puede cruzar medianoche. Totales y anulaciones abarcan todas las páginas del filtro y excluyen anuladas del importe vigente. La lista mantiene sus registros y acciones de reimpresión/anulación. Los filtros de turno y día usan los índices existentes; esta actualización conserva IndexedDB versión 2 y respaldos JSON versión 1.

La app define papel de 78 mm, margen de página cero y largo automático desde CSS; el diálogo sigue permitiendo elegir la impresora. El navegador/controlador pueden sobreescribir esas medidas. Se comprobó el recorrido en Chromium y el formato imprimible, junto con 55 pruebas y build de producción. La impresora física, su controlador/cola y el modo offline se verifican en el equipo de caja. No se agregan dependencias de navegador al proyecto.

Actualizar siguiendo `ACTUALIZAR.md`, con respaldo previo y conservando tu environment/`dbName`.

Commit: `feat: add thermal receipts, shift history and product catalog transfer`


## Actualización: exportar/importar productos y categorías juntos

En Respaldo, «Transferir productos y categorías a otra heladería» tiene Exportar productos y categorías e Importar productos y categorías. El archivo `heladeria-productos-categorias-FECHA.json` lleva productos no eliminados (activos e inactivos), nombres visibles/Grido, precios finales en centavos, IVA opcional y todas las categorías disponibles con ambos nombres, incluidas categorías vacías. No lleva ventas, números de pedidos, aperturas, movimientos, cierres ni semanas. Los archivos exportados por la versión anterior siguen siendo compatibles aunque su nombre empiece por `heladeria-productos-`.

Importar **reemplaza todo el catálogo de productos y categorías** por el contenido del archivo, después de confirmar. Aplica nombres, precios, IVA y estado activo del archivo. Los productos y categorías ausentes se quitan del catálogo; no se combinan con los de destino. El orden y las categorías vacías corresponden al archivo. Un archivo con ambos catálogos vacíos deja el catálogo vacío. Conviene guardar primero un respaldo completo para recuperar un catálogo anterior si hiciera falta.

Las ventas, cajas, cierres, semanas y secuencia de tickets no cambian. Para mantener sus referencias históricas, los productos y categorías retirados se archivan internamente y dejan de aparecer en administración, Venta y futuras exportaciones de catálogo. Un respaldo completo conserva esos registros históricos. Los tickets antiguos conservan nombres/precios de la venta original.

Las coincidencias únicas conservan IDs locales. Los nuevos productos y los casos con coincidencias locales ambiguas reciben IDs nuevos; los IDs de otra heladería no pisan productos diferentes. Reimportar el mismo archivo mantiene estable el catálogo. La validación y la escritura son una sola operación: un archivo inválido no reemplaza parcialmente los datos.

Puede importarse con caja abierta. Al terminar se vacía el carrito y se cancela la edición de producto para cobrar con los datos nuevos. El respaldo completo sigue disponible como una operación distinta.

Verificación: 59 pruebas, build y recorrido de navegador: reemplazo con datos de destino, cancelación de confirmación, ausencia de duplicados al reimportar, retiro de categorías/productos faltantes, categorías vacías y conservación de ventas y tickets anteriores.

Commit: `fix: replace products and categories together when importing catalog`

## Actualización: impresión en papel de 78 mm sin márgenes de página

El ticket usa 78 mm de ancho y queda centrado. Se eliminaron los márgenes de página de 4 mm y el padding exterior. Vista previa y papel comparten tipografía y espaciado; los espacios entre título, datos, productos y total son parte del diseño, no márgenes de página.

Antes de abrir Imprimir, se mide una copia del contenido a 78 mm y se calcula el largo de papel. Se excluyen los botones y se mide todo el ticket aunque la ventana sea estrecha o esté scrolleada. Se redondea el largo hacia arriba al milímetro siguiente para evitar cortes. `beforeprint` actualiza también el formato al imprimir con Ctrl+P mientras el ticket está abierto. La medición temporal se elimina inmediatamente y no modifica ventas ni respaldos.

La app declara ambas dimensiones mediante `@page { size: 78mm LARGOmm; margin: 0; }`. No usa `size: 78mm auto`, que es inválido. No exige ajustar márgenes manualmente desde la app; el navegador, preferencias previas de escala/papel y el controlador pueden sobreescribir el formato. Seleccionar impresora y confirmar el diálogo sigue correspondiendo al navegador. El ancho imprimible real y los bordes que admite la térmica requieren comprobación en el equipo.

Se verificaron build, 55 pruebas de dominio y PDF generado en Chromium con prioridad al tamaño CSS: tickets cortos, largos, anulados y pantalla móvil; ancho de 78 mm, largo automático, una sola hoja y contenido sin desborde. La impresora física no se verificó.

Commit: `fix: fit thermal receipts to 78mm paper with zero page margins`


## Actualización: productos semanales agrupados por categoría

En Semana se conserva la tabla «Ventas por categoría» y se agrega «Productos por categoría»: cada categoría muestra sus productos, unidades, importes vendidos y subtotal. El mismo detalle aparece en el período en curso, los cierres semanales anteriores y el resumen original guardado al cierre.

El detalle usa las categorías y los nombres/códigos históricos de cada venta; editar, borrar o reemplazar el catálogo actual no cambia el historial. Códigos Grido históricos distintos mantienen sus grupos identificados. Las ventas anuladas se descuentan del detalle vigente; el cierre original conserva su snapshot. No cambia el formato CSV ni requiere migración de datos.

Verificado: 61 pruebas, build de producción y recorrido en Chromium de semana abierta, historial cerrado, snapshot original, categorías históricas tras reemplazar el catálogo, anulaciones y vistas de escritorio/móvil.

Commit sugerido: `feat: group weekly sales products by category`


## Nombre de la heladería

Los environments incluidos usan `storeName: "GRIDO"`, tanto para la cabecera de la app como para el ticket. En una instalación existente, cambiar ese campo en ambos environments y recompilar, conservando el `dbName` actual.

Commit sugerido: `fix: use GRIDO as store display name`


## Actualización: bochas y kilos teóricos consumidos

## Configurar consumo teórico en Productos

En cada producto, editar y guardar estos campos:

| Producto | Bochas por unidad | Gramos por unidad |
| --- | --- | --- |
| Helado de 1 bocha | 1 | 80, automático |
| Helado de 2 bochas | 2 | 160, automático |
| Helado de 3 bochas | 3 | 240, automático |
| Helado de 1 kg | Dejar vacío | 1000 |
| Helado de 1/2 kg | Dejar vacío | 500 |
| Helado de 1/4 kg | Dejar vacío | 250 |

Cada bocha equivale a 80 g. Si se configura bochas, el gramaje se calcula y queda de solo lectura; borrar el número de bochas permite ingresar gramos manualmente. Los campos funcionan en cualquier categoría y cada producto puede tener su gramaje. Vacío = desconocido; cero = sin consumo de helado.

En Semana, «Helado x Bocha» suma las bochas contenidas en los productos vendidos, las multiplica por 80 g y muestra los kilos. «Helado x Kilo» suma la cantidad vendida por los gramos configurados y divide por 1000. La misma regla se aplica a cualquier categoría con gramaje. Ejemplo: 10 helados de 1 bocha + 5 de 2 + 2 de 3 = 26 bochas = 2080 g = 2,08 kg. Dos kilos + tres medios + cuatro cuartos = 4,5 kg.

Se configura una vez en Productos. Al cobrar se toma automáticamente la configuración actual, sin pedir gramos al cajero. El dato queda registrado para conservar el historial si después se edita o reemplaza el catálogo. No modifica precios ni tickets. Las anulaciones descuentan bochas/gramos del resumen vigente; el resumen original del cierre se conserva.

Las ventas antiguas sin gramaje registrado se recalculan para el resumen semanal usando la configuración actual del mismo ID de producto. La pantalla indica cuántas unidades se recalcularon. Si todavía falta configuración o ya no existe ese ID en el catálogo, se conserva el aviso de consumo sin calcular o subtotal parcial. No se interpreta vacío como cero ni se estima a partir del nombre. Los productos de ejemplo de instalaciones nuevas incluyen gramajes básicos; un catálogo existente debe configurarse manualmente. La vista recalculada no reescribe ventas ni cierres originales. Si se cambia otra vez la configuración actual, el consumo estimado de las ventas sin gramaje se actualiza; las ventas que ya tenían gramaje mantienen el que se registró al cobrarlas. El resumen original guardado al cierre muestra sus datos originales. Los respaldos antiguos siguen siendo compatibles, sin cambiar `dbName` ni la versión interna de IndexedDB. Exportar/importar productos y categorías también transporta esta configuración; importar un archivo antiguo sin gramajes deja esos campos vacíos.

Verificado: 67 pruebas, build de producción y recorrido de navegador de configuración, cobro, resumen semanal, CSV, cierres/anulaciones, respaldo y recarga.

Commit sugerido: `fix: recalculate weekly consumption for sales without recorded grams`


## Actualización: recálculo de ventas anteriores sin gramaje

Configurar gramos/bochas en Productos ahora actualiza automáticamente el consumo de ventas anteriores sin ese dato, en Semana y el historial semanal vigente. Usa el ID del mismo producto y conserva su nombre/categoría histórica. No hace falta volver a vender ni ejecutar scripts.

Las unidades recalculadas quedan identificadas en pantalla y en la columna `unidades_recalculadas` del CSV. Las cantidades e importes originales se conservan, las anulaciones se descuentan y las filas compatibles se combinan sin duplicados. Las ventas que sí tenían gramaje mantienen su valor registrado. El cierre original y los datos exportados en el respaldo completo permanecen intactos; es un cálculo de vista.

Ejemplo de la captura: 10 helados de 2 bochas + 4 de 1 + 3 de 3 = 33 bochas × 80 g = 2640 g = 2,64 kg.

Verificado: 72 pruebas, build y recorrido en Chromium de recálculo al editar, mezcla de ventas antiguas/nuevas, CSV, cierres, anulaciones, respaldo y recarga.

Commit sugerido: `fix: recalculate weekly consumption for sales without recorded grams`


## Actualización: registro privado de precios

## Acceso privado al historial de precios

El historial no aparece en el menú. Se abre haciendo **cinco clics seguidos en el título GRIDO**, con menos de cuatro segundos entre clics, y escribiendo la contraseña predeterminada **`mermeladacasco`**. No se pide configurar una clave la primera vez. La contraseña distingue mayúsculas y no se muestra como pista en la pantalla. Al salir, cambiar de sección o recargar, el acceso vuelve a bloquearse.

Se registran cambios desde esta actualización: fecha/hora del equipo, producto e ID, nombre/código Grido, categoría, precio anterior/nuevo y origen. Incluye altas y bajas, importaciones de catálogo y restauraciones. Guardar sin cambiar ningún campo no crea un registro. Editar nombre, código Grido, categoría, precio, gramaje, bochas, IVA o estado activo/inactivo registra el valor anterior y nuevo de cada campo. Se ve en «Control de productos»; expandir «Ver detalle» debajo del registro. Un cambio de categoría realizado desde Categorías queda identificado con ese origen. El registro y el cambio de precio se guardan en la misma transacción: si uno falla se revierte todo. Las distintas pestañas conservan la secuencia y se muestran 25 registros por página. Los cambios se registran aunque nadie abra el acceso privado. No hay un botón para borrar o editar esos registros.

El respaldo JSON completo incluye `priceAudit`. Restaurarlo conserva la auditoría ya existente en ese equipo, combina registros del archivo sin duplicar IDs y agrega un evento de restauración, además de los precios que cambien. Un registro diferente con el mismo ID se rechaza. Importar/exportar solo productos y categorías no transporta auditoría: el destino registra sus propios cambios. La contraseña no se exporta como un dato del respaldo.

**Alcance:** la contraseña limita el acceso a esta pantalla y el registro es local. No identifica empleados, no bloquea la edición de precios y no cifra los datos ni el respaldo JSON. Alguien con acceso técnico al navegador puede inspeccionar o alterar el almacenamiento, el código, el control de acceso o el reloj. Para identificar responsables y proteger registros frente a manipulación hace falta autenticación y almacenamiento en un servidor. Guardar respaldos fuera del equipo permite conservar evidencias que no dependan solo de ese navegador. El código contiene la verificación de la contraseña predeterminada; ocultar la entrada no es una garantía frente a alguien que inspeccione la aplicación.

La actualización conserva ventas, cajas, cierres, semanas, catálogo y gramajes; agrega el almacén `priceAudit` y migra IndexedDB de 2 a 3 sin reinicializar datos. Mantener `dbName`, dominio y navegador. Cerrar pestañas anteriores durante la actualización. Los scripts manuales que exigían `db.version === 2` deben actualizarse a 3. El script de limpieza de pruebas de abajo conserva este registro de precios.

Verificado: 85 pruebas, build Angular de producción y recorrido en Chromium.

Commit sugerido: `feat: audit product additions deletions and all field edits`


## Registro de todas las operaciones sobre productos

El acceso privado (cinco clics seguidos en GRIDO, contraseña `mermeladacasco`) muestra «Control de productos». Registra altas, bajas y ediciones de nombre visible, código Grido, categoría, precio, gramos, bochas, IVA y estado activo/inactivo. Cada operación tiene fecha/hora, producto, ID y origen. Expandir «Ver detalle» para ver cada valor anterior y nuevo. Las altas/bajas conservan los campos del producto que se agregó o quitó; una edición sin cambio de precio también queda registrada. Guardar todos los campos iguales no agrega un registro.

Cambios desde Productos, importaciones y restauraciones usan la misma auditoría transaccional. Si un cambio en Categorías reasigna productos, cada producto afectado queda registrado con origen Categorías. Los registros anteriores de precios siguen siendo válidos aunque no tengan el nuevo detalle. Los respaldos completos transportan el detalle y restaurarlos conserva la auditoría local; no se modifica la versión 3 de IndexedDB ni el nombre de la base. No se reconstruyen ediciones de versiones anteriores que nunca se registraron.

Verificado: 89 pruebas, build y recorrido en Chromium de acceso oculto, contraseña, altas, edición de varios campos, cambio de categoría, desactivación, baja, detalle expandido, respaldo y recarga.

Commit sugerido: `feat: audit product additions deletions and all field edits`


## Actualización: impresión del cierre de turno

## Ticket de cierre de turno de 78 mm

Al confirmar «Guardar cierre e imprimir», primero se guarda el cierre definitivo; después se abre la vista del ticket y el diálogo de impresión del navegador. Elegir la impresora y confirmar sigue siendo necesario. Cancelar la impresión o un error de impresora no deshace el cierre. Desde Cierres → «Reimprimir cierre de turno» se puede volver a imprimir sin crear otro cierre ni otra venta. También se puede volver a usar «Imprimir cierre» desde la vista previa.

El ticket usa 78 mm de ancho, margen de página cero, largo automático y fuente Arial de 9,5 pt, con cabecera de 14 pt y títulos de sección de 10 pt. Incluye:

- Nombre de la heladería y el ID del turno.
- Fecha/hora de apertura y cierre en la zona horaria del environment, duración e instante de impresión.
- Pedidos emitidos, vigentes y anulados al cierre, rango de números, importe anulado, venta neta, unidades y ticket promedio vigente.
- Cantidad de pedidos e importe neto por Efectivo, Tarjeta y Mercado Pago.
- Fondo inicial, ventas en efectivo, otros ingresos, retiros/egresos, efectivo esperado, contado y diferencia (faltante o sobrante).
- Cada ingreso/retiro con fecha/hora, motivo e importe.
- Productos vendidos al cierre, sus cantidades e importe acumulado real, incluyendo ventas a diferentes precios.
- Pedidos anulados antes del cierre con número, fecha/hora, motivo e importe.
- Si hubo anulaciones posteriores: se muestran aparte con ajuste y ventas vigentes actuales. Los importes, conteo y productos del cierre original se conservan arriba.
- Espacios para responsable y firma.

**No incluye desglose de billetes en el ticket.** El formulario actual para contar efectivo al cerrar se conserva. «Tarjeta» agrupa débito/crédito, porque el sistema guarda actualmente un único medio `CARD`; no se inventa un desglose que no está registrado.

La reimpresión consulta todos los pedidos de ese turno por el índice de sesiones, incluso después de recargar o si no están en la página actual del Historial. No usa el catálogo actual para reconstruir los importes vendidos. Los cierres anteriores también pueden reimprimirse con sus registros originales. No se cambia el esquema 3 de IndexedDB ni se requiere migración de datos. El ticket de venta sigue usando su formato habitual y el mismo motor de impresión de 78 mm.

Verificado: 94 pruebas, build y recorrido en Chromium de guardado antes de imprimir, cierre automático, reimpresión, turno sin ventas, cancelaciones antes/después, recarga y recuperación tras un error simulado de impresión. Impresión virtual de 78 mm revisada con contenido largo de 70 productos, pantalla estrecha y ticket de venta de regresión. La impresora/controlador físicos requieren comprobación en el equipo real.

Commit sugerido: `feat: print audited shift closing receipts on 78mm paper`



## Comprobantes de ingresos y retiros de efectivo

Los comprobantes se incorporaron sobre `heladeria-pos-v1 (4).zip` y se mantienen en esta entrega junto con los productos base y sus presentaciones.

En **Caja**, elegir Ingreso o Retiro / egreso, completar el importe y motivo y tocar **Registrar e imprimir comprobante**. Primero se guarda el movimiento; después se muestra su ticket y se abre la impresión. Si el guardado falla, no se abre la impresión y el formulario conserva importe y motivo. Si la impresión falla o se cancela, el movimiento ya guardado permanece: usar Imprimir comprobante o Reimprimir comprobante, sin volver a registrar el dinero.

El comprobante contiene:

- Nombre del local y título **INGRESO DE EFECTIVO** o **RETIRO DE EFECTIVO**.
- Monto, fecha y hora originales del movimiento en la zona horaria del environment.
- Motivo, número de movimiento dentro del turno, ID del turno e ID del movimiento.
- Espacio para indicar quién entregó/recibió el dinero y su firma manual.

Usa el rollo de **78 mm**, margen de página cero, tipografía de 10 puntos y altura adaptada al contenido. No lleva desglose de billetes. El nombre del local usa `storeName` y la fecha/hora usa `timeZone`, igual que los otros tickets. Los límites físicos de la impresora/controlador siguen dependiendo del equipo.

### Reimprimir

- **Turno abierto:** Caja → junto a cada movimiento → **Reimprimir comprobante**.
- **Turno cerrado:** Cierres → **Ingresos y retiros del turno** → **Reimprimir comprobante**.
- También pueden reimprimirse movimientos anteriores a esta mejora, porque ya tenían monto, motivo, fecha e ID guardados.

La reimpresión conserva la fecha y hora del movimiento original. No agrega movimientos, no vuelve a sumar/restar dinero y no modifica ventas ni numeración de pedidos. Los movimientos siguen sumándose/restándose una sola vez al efectivo esperado y aparecen en el ticket de cierre como antes.

Los comprobantes mantienen sus datos originales. La entrega actual con productos base migra a **IndexedDB 4**, conservando el mismo `dbName` y respaldos JSON versión 1. Conservar el origen del sitio (dominio, protocolo y puerto) y el nombre de la base al publicar.

Verificado: **102 pruebas automatizadas**, build y recorrido en Chromium: ingreso/retiro, guardado antes de imprimir, importes decimales, validación de entradas, reversión por error de escritura, conservación del formulario ante error, fallo de impresión y reintento, reimpresión del mismo registro, recarga, movimientos de turnos cerrados, motivo extenso y escapado de HTML, respaldo y comprobantes de venta/cierre. La impresión virtual revisada tiene 78 mm de ancho, altura variable y una sola página, tanto con motivo corto como extenso y en pantalla móvil. La impresora física requiere comprobación en el equipo real.

Commit sugerido: `feat: print cash income and withdrawal receipts`


## Productos base con activación de caja/unidad

Crear una sola ficha «Bombón Escocés» y activar/desactivar Caja o Unidad desde sus casillas. Se puede guardar primero solo la base, sin presentaciones. Desactivar oculta el producto de Venta y conserva sus datos e historial; reactivar reutiliza su ID. Cada presentación mantiene nombre, código Grido, precio y gramaje propios. La documentación vigente de este flujo está en [PRODUCTOS_BASE.md](PRODUCTOS_BASE.md). Incluye los comprobantes de movimientos y el ticket de cierre.

Verificación actual: 129 pruebas, build y revisión en navegador.

Commit sugerido: `feat: manage box and unit activation from base products`


## Catálogo simplificado vigente

Productos muestra una única lista por categoría y búsqueda por nombre/código. Nuevo producto abre una ficha con Caja/Unidad o Venta simple. Agrupar productos existentes reúne directamente sus IDs con nombre, código y precio originales; admite agregar la segunda presentación después. Editar permite activar/desactivar y cambiar datos. Más opciones permite separar sin borrar productos o archivarlos conservando su historia. Se retiraron los paneles de administración avanzada y asignación masiva de la pantalla.

No cambia el esquema IndexedDB 4 ni agrega dependencias. Verificado: 140 pruebas, build y recorrido en Chromium de migración, catálogo, ventas, Semana/CSV, auditoría, respaldo y tickets.

Commit sugerido: `feat: simplify product catalog with unified box and unit sheets`


## Equivalencia semanal en cajas

Productos → Editar → Unidades que trae una caja permite configurar la capacidad de cada familia, compartida por Caja y Unidad. También se puede modificar desde la edición de un producto individual vinculado. Semana conserva el detalle real vendido y agrega **Cajas totales**: 4 cajas + 4 unidades de una caja de 8 = 4,5 cajas. Cada familia tiene una separación breve arriba/abajo. El cálculo usa las ventas ya existentes y la configuración actual; las anulaciones se descuentan, los snapshots originales y precios no cambian. Sin capacidad no se supone una; las presentaciones desconocidas se identifican como equivalencia parcial.

El CSV conserva las 25 columnas previas, agrega 7 columnas de equivalencia al final y filas FAMILIA. Catálogo y respaldo incluyen la capacidad; los cambios quedan auditados. Se mantiene IndexedDB 4 y JSON versión 1, sin dependencias nuevas. Verificado: 153 pruebas, build y recorrido en navegador con datos existentes, escritorio/teléfono, recálculo, CSV, transferencia entre perfiles, respaldo/restauración y los tres tickets. Ver PRODUCTOS_BASE.md y ACTUALIZAR.md.

Commit sugerido: `feat: show weekly box equivalents and separate product families`


## Packs y equivalencias de la familia

En Productos → Editar → Equivalencias de la familia se configuran unidades por caja y cajas por pack. Se comparten entre Caja y Unidad y se muestran también al agrupar o editar una presentación individual. La vista previa indica 1 pack = 6 cajas = 48 unidades si configurás 8 y 6.

Semana y CSV recalculan automáticamente lo ya vendido: 4 cajas + 4 unidades equivalen a 36 unidades, 4,5 cajas y 0,75 packs. Los factores son propios de cada familia. Se usa la configuración actual, con anulaciones descontadas y sin reescribir ventas ni snapshots de cierre. Packs es una equivalencia de consumo, sin redondeo a una orden de compra. Sin el factor de pack, la conversión anterior a cajas sigue funcionando.

El CSV conserva las primeras 32 columnas y agrega unidades_totales_equivalentes, cajas_por_pack y packs_equivalentes. Catálogo y respaldo transportan los factores y la auditoría registra cambios. Se mantiene IndexedDB 4, JSON versión 1 y las mismas dependencias.

Verificado: 165 pruebas automatizadas, build y recorrido en navegador de base existente, semana actual/cerrada, recálculo, CSV, anulación/snapshot original, formularios, configuración parcial, auditoría, transferencia/restauración, recarga, escritorio/teléfono y los tres tickets de 78 mm.

Commit sugerido: `feat: add family pack factors and weekly unit box pack equivalents`


## Segunda caja con tamaño independiente

Productos → Editar permite activar una segunda caja con nombre/código/precio y cantidad de unidades propios. La caja principal conserva la capacidad de referencia para packs. También se puede vincular un producto de caja ya existente, manteniendo su ID e historia, o editar la capacidad desde la presentación individual.

Semana cuenta las unidades reales: 1 caja de 20 + 1 de 10 + 2 individuales = 32 unidades; equivale a 1,6 cajas principales de 20. Un pack de 6 cajas principales contiene 120 unidades. Las filas conservan lo cobrado, mientras el pie muestra equivalentes con la configuración actual. Las anulaciones descuentan el tamaño correspondiente; los snapshots financieros no se reescriben. Si se había registrado todo con un único SKU, no se puede inferir automáticamente qué tamaño se vendió en cada pedido.

CSV agrega unidades_por_caja_presentacion como columna 36 y mantiene las anteriores. Catálogo, respaldo y auditoría incluyen el tamaño; las familias anteriores siguen funcionando en IndexedDB 4/JSON 1, sin dependencias nuevas.

Verificado: 177 pruebas, build y navegador con datos existentes, ventas anteriores vinculadas, tres presentaciones, activación/edición, cálculo mixto de 20/10, venta, CSV, anulación/snapshot original, auditoría, transferencia/restauración, recarga, escritorio/teléfono y los tres tickets.

Commit sugerido: `feat: support a second box size per product family`
