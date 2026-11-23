# Actualizar: tickets cortos siempre verticales

Corrige el cálculo que hacía aparecer algunos tickets de tarjeta (y otros comprobantes cortos) en horizontal. Se conserva el ancho de **78 mm**, con altura mínima de **82 mm**. Si el contenido necesita más largo, se usa su altura real redondeada al milímetro siguiente.

## Aplicar solo este arreglo a tu versión instalada

1. Detené el servidor de desarrollo si está abierto.
2. Del paquete, copiá **src/app/core/receipt-print.ts** a la misma ruta de tu proyecto y reemplazá el archivo completo. La firma de las funciones existentes se conserva.
3. Desde la carpeta del proyecto, en PowerShell:

```powershell
npm.cmd run build
```

4. Publicá el nuevo contenido de **dist/heladeria-pos/browser** en el mismo sitio que ya usás. Si usás desarrollo local, iniciá con **npm.cmd start**.
5. Cerrá las otras pestañas del sistema y abrilo de nuevo para cargar el build actualizado.

No requiere reinstalar paquetes, cambiar environments, importar productos ni limpiar IndexedDB. Se pueden reimprimir tickets históricos con el formato corregido. Los botones y el atajo de impresión usan el mismo cálculo.

El cambio evita solicitar una hoja más ancha que alta. El tamaño físico **Roll Paper 80 × 297 mm** que aparece en las fotos pertenece al controlador de la impresora: si mantiene ese largo fijo, puede seguir habiendo papel en blanco aunque el ticket ya esté vertical. La app solicita el largo necesario, pero no puede cambiar las preferencias del controlador ni ordenar el corte físico directamente.

Verificado: **207 pruebas** y build; comparación en Chromium de PDF con tamaño CSS y de rollo de 80 × 297 mm. Incluye efectivo, tarjeta, Mercado Pago, reimpresión, tickets largos/anulados, pantalla angosta, movimientos y cierres. El contenido y todos los registros guardados se conservan. La impresión física en tu Epson queda por confirmar.

Commit sugerido: `fix: keep short thermal receipts in portrait orientation`

## Funcionalidades de la versión base


Agrega **Métricas** al menú lateral, con gráficos de cantidades por día, hora, evolución del período, productos, categorías y mapa día × hora. Incluye filtros y comparación de días por promedio calendario o acumulado. Conserva los filtros/buscador de Venta, las dos cajas por familia, Semana/CSV, datos existentes y los tres tickets. El uso está en **METRICAS.md** y **PRODUCTOS_BASE.md**.

## Sobre tu proyecto actual

1. Desde la app, guardá un respaldo JSON.
2. Detené el servidor de desarrollo con Ctrl+C si está abierto.
3. Reemplazá **src/app/** completo y **src/styles.css** por los del paquete. Reemplazar solo indexed-db.ts no incorpora la interfaz nueva.
4. Conservá tus archivos de **src/environments/**, especialmente `dbName`, `storeName` y `timeZone`.
5. Desde la carpeta del proyecto, en PowerShell:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

Si ya tenías las dependencias instaladas no hace falta volver a instalarlas: esta entrega no agrega paquetes. Para una carpeta nueva, ejecutá antes `npm.cmd ci`. Los comandos con `.cmd` evitan el bloqueo de `npm.ps1` por la política de PowerShell. En Linux/macOS se usa `npm` sin `.cmd`.

## Actualizar Netlify o tu VPS

El build queda en **dist/heladeria-pos/browser**. Publicá el contenido completo de esa carpeta en el mismo sitio de Netlify o directorio de Nginx que ya usás. El build incluido usa los environments del ejemplo; volvé a compilar si tu configuración es distinta.

Cerrá las otras pestañas del sistema y volvé a abrirlo. Si la aplicación estaba instalada o usa service worker, cerrar todas las pestañas permite tomar la versión nueva.

## Usar los filtros y la búsqueda

Para los gráficos, entrá a **Métricas**: por defecto muestra los últimos 30 días. Elegí período, categoría, presentación o nombre/código y tocá **Aplicar filtros**. Dentro de los filtros adicionales podés elegir día de semana y franja horaria. **Todo el historial** incluye turnos y semanas cerrados. Las anulaciones se excluyen y los cambios desde otras pestañas actualizan el resultado.

Métricas mide cantidades de presentaciones; una caja vendida cuenta 1 aunque traiga 10 o 20 unidades. Podés separar Por unidad / Por caja. Las equivalencias físicas continúan en Semana. No requiere importar de nuevo ni cerrar la caja para consultar.

### En Venta

No requiere migración ni volver a importar productos. En Venta, elegí categoría con las flechas o el desplegable y tocá **Todos**, **Por unidad** o **Por caja**. Se recuerda el filtro por categoría durante la sesión de pantalla; recargar lo reinicia. Las presentaciones especiales, como Pack, quedan en Todos.

El campo **Buscar producto por nombre** consulta todo el catálogo activo, independiente de la categoría o filtro elegidos. Acepta nombres sin tildes y códigos Grido. Revisá la presentación y el precio antes de seleccionar; se agrega directamente al pedido. ↑/↓ y Enter permiten elegir con teclado; Escape cierra. Con caja cerrada solo permite consultar.

Para productos anteriores sin presentación se usan sus rótulos habituales solo como ayuda visual del filtro. No se crean vínculos ni se calculan capacidades desde los nombres. Para definir Caja principal / Segunda caja / Unidad explícitamente, usá la ficha o la vinculación de productos existentes.

## Configurar una caja de 20 y otra de 10

En **Productos → Editar**, conservá **Unidades de la caja principal = 20**. Activá **Venta por segunda caja**, ingresá **10** en su tamaño, completá su nombre/código/precio y guardá. Si el producto de caja x10 ya existía, usá **Vincular producto ya cargado** debajo de la ficha y elegilo como segunda caja para mantener su ID e historia.

La caja principal sigue definiendo la referencia de packs. Con 20 unidades principales y un pack de 6 cajas principales: 1 caja de 20 + 1 de 10 + 2 individuales = 32 unidades = 1,6 cajas principales = 0,266667 packs equivalentes. Las filas originales conservan sus cantidades reales y precios.

La conversión usa la configuración actual y recalcula ventas previas de los productos vinculados. Si se había usado un solo producto para ambos tamaños, las ventas no contienen el dato necesario para separarlos automáticamente. Usá productos distintos para registrar cada tamaño desde esta actualización.

El CSV conserva las 35 columnas anteriores y agrega unidades_por_caja_presentacion al final. Catálogo y respaldo llevan el tamaño de la segunda caja; la auditoría registra sus cambios.

La segunda caja es opcional. Las familias anteriores con Caja/Unidad siguen funcionando. Se mantiene **IndexedDB 4 y JSON versión 1**, sin dependencias nuevas y sin limpiar datos.

## Conservación de datos

- Se mantiene IndexedDB **4**. No se baja a 3 ni se borra la base. Desde versiones 1, 2 o 3 se conserva la migración automática a 4.
- Conservá el **mismo navegador, dominio, protocolo, puerto y dbName** para ver los datos locales existentes.
- No borres datos del sitio. Si aparece «requested version (3) is less than existing version (4)», se está ejecutando el código viejo: reemplazá src/app completo, reiniciá el servidor y recargá.
- Los productos existentes aparecen inicialmente por separado si todavía no están agrupados. Usá **Productos → Agrupar productos existentes**, elegí Caja principal, Segunda caja y Unidad según corresponda y guardá. Los que ya estaban agrupados aparecen juntos automáticamente.
- No hace falta exportar/importar el catálogo para agrupar productos del mismo equipo; la nueva acción conserva sus IDs directamente.
- Ventas, movimientos, semanas, cierres, auditoría, gramajes y reimpresiones se conservan. Los respaldos JSON anteriores continúan siendo compatibles.

Verificación: **204 pruebas automatizadas**, build y recorrido en navegador con una base existente y ventas anteriores. Incluye lectura de 5.000 ventas cerradas fuera del caché activo, cantidades y promedios, fechas/horas locales, filtros combinados, ambas cajas, productos retirados, conservación exacta de registros al consultar, anulación desde otra pestaña, recarga y escritorio/teléfono. Los tres tickets conservan sus estilos y motor de impresión de 78 mm; se reimprimió un cierre en el recorrido. La impresión física depende del equipo y controlador.

Commit sugerido: `feat: add quantity metrics with historical charts and filters`
