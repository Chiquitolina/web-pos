# Productos por familia: dos cajas y unidad

Productos muestra una ficha por familia, dentro de su categoría, con búsqueda por nombre o código Grido. Cada ficha puede tener **Caja principal, Segunda caja y Unidad**, con sus propios nombres, códigos, precios y disponibilidad. Los productos sin agrupar siguen como venta simple.

## Elegir productos al vender

En **Venta**, las flechas y el desplegable permiten elegir una categoría. Debajo están **Todos / Por unidad / Por caja**, con la cantidad de productos de cada opción. **Por caja** reúne la principal y la segunda caja; cada tarjeta identifica su presentación y tamaño configurado. El filtro se recuerda por categoría mientras usás la pantalla y se reinicia al recargar.

**Buscar producto por nombre** es un selector para todo el catálogo activo, sin importar qué categoría o filtro estás viendo. Acepta nombres sin tildes, varias palabras y códigos Grido. Cada resultado muestra nombre, categoría, presentación, código y precio. Tocarlo lo agrega directamente al pedido y muestra la categoría/presentación correspondiente. Productos con el mismo nombre conservan sus IDs, códigos y precios separados.

Con teclado, usá ↑/↓ para elegir y Enter para agregar; si hay varias coincidencias y ninguna marcada, el primer Enter marca la primera. Escape cierra y la cruz limpia. Los primeros 20 resultados se pueden precisar escribiendo más. Con caja cerrada permite consultar, sin agregar ni cobrar. Cambiar categorías o filtros no vacía el pedido.

La presentación configurada tiene prioridad sobre el nombre. Los productos antiguos sin presentación reconocen rótulos comunes de caja/unidad únicamente en el filtro visual; esto no modifica sus datos ni establece tamaños para Semana. Los productos simples sin esos rótulos se muestran por unidad. Una presentación especial, como Pack, aparece en Todos y en la búsqueda.

## Agregar una segunda caja

Ejemplo: a veces recibís cajas de 20 palitos y a veces de 10.

1. Entrá a **Productos**, seleccioná la categoría y tocá **Editar** en la familia.
2. En **Equivalencias de la familia**, dejá **Unidades de la caja principal = 20**.
3. Activá **Venta por segunda caja**.
4. En **Unidades que trae esta segunda caja**, ingresá **10**.
5. Revisá su **Nombre visible**, **Nombre / código Grido** y **Precio final**. Ejemplo: «Palito agua caja x10» y su código de proveedor.
6. Tocá **Guardar producto**.

En Venta aparecerán como botones separados la caja de 20, la caja de 10 y la unidad que tengas activadas. En Productos se administran dentro de la misma ficha. En Semana aparecen juntas, cada una identificada con su tamaño y cantidad real vendida.

Desactivar la segunda caja la oculta de Venta y conserva ID, nombre, código, precio, tamaño e historial. Reactivarla usa el mismo producto. Es opcional: las familias anteriores con una sola caja funcionan igual.

## Crear una familia nueva

1. Elegí una categoría y tocá **+ Nuevo producto**.
2. Elegí **Caja y unidad** y escribí el nombre de la familia.
3. Configurá las unidades de la caja principal y las cajas principales del pack, si las conocés.
4. Activá las opciones que vendés: Caja principal, Segunda caja y/o Unidad.
5. Si activás la segunda caja, completá su cantidad de unidades.
6. Completá los nombres, códigos y precios independientes y guardá.

Podés guardar una ficha vacía y completar sus presentaciones después. Los nombres sugeridos de las cajas nuevas incluyen su tamaño cuando lo configurás. Los nombres y códigos de productos que ya existían se conservan al abrir o renombrar la familia.

Para productos con un único precio, como una bebida o un cuarto de helado, elegí **Venta simple**. Las categorías se crean y editan desde su propia sección.

## Vincular productos que ya estaban cargados

Si ya existen «Palito caja x20», «Palito caja x10» y «Palito individual» como productos separados:

- Para una familia nueva, usá **Agrupar productos existentes**, escribí su nombre y elegí las tres posiciones.
- Para agregar la caja de 10 a una familia que ya tiene caja de 20 y unidad, tocá **Vincular producto ya cargado** debajo de su ficha. Las posiciones existentes quedan fijas; elegí el producto en **Producto de segunda caja** y completá sus unidades.

Podés vincular una sola presentación y completar las otras después. Los selectores muestran productos de la categoría y evitan usar el mismo producto en dos posiciones. Un producto de otra familia debe separarse antes de volver a agruparlo.

La vinculación conserva los IDs y los datos comerciales originales; agrega la relación de familia y, para la segunda caja, el tamaño que indicás. No crea copias ni reescribe las ventas o cierres. El resumen recalcula las ventas anteriores de esos mismos productos, incluso si se habían vendido antes de agruparlos.

**Límite de las ventas anteriores:** si se usó un único producto para cobrar indistintamente cajas de 20 y de 10, el registro no indica cuál se vendió en cada pedido. No se puede reconstruir automáticamente esa distinción a partir del nombre o precio. Para diferenciarlas se deben usar dos productos; los registros antiguos mezclados requieren revisión de sus datos de origen. La app no inventa el reparto entre tamaños.

## Unidades, cajas equivalentes y packs

La **caja principal** es la referencia para convertir el total y definir el pack. La segunda caja tiene su propio tamaño. Ejemplo:

| Presentación | Tamaño | Cantidad vendida | Unidades contenidas |
| --- | --- | --- | --- |
| Caja principal | 20 unidades | 1 | 20 |
| Segunda caja | 10 unidades | 1 | 10 |
| Unidad | 1 unidad | 2 | 2 |
| Total equivalente | — | — | 32 |

Con caja principal de 20 y pack de 6 cajas principales:

- **Unidades totales:** 1 × 20 + 1 × 10 + 2 = **32**.
- **Cajas equivalentes:** 32 ÷ 20 = **1,6 cajas principales**.
- **Packs equivalentes:** 1,6 ÷ 6 = **0,266667 packs** antes del redondeo de pantalla.

Se vendieron físicamente dos cajas de tamaños diferentes; por eso «Cajas equivalentes» usa una referencia explícita, en lugar de tratarlas como dos envases iguales. Las filas del reporte conservan las cantidades reales cobradas por cada presentación. Los packs se expresan en cajas principales: 1 pack de este ejemplo contiene 6 × 20 = 120 unidades. No se redondea el equivalente decimal a una orden de compra.

Cada familia mantiene sus factores. La caja principal y los packs se configuran en Equivalencias de la familia; la segunda caja se configura dentro de su propia sección. También podés editarla desde **Más opciones → Editar datos** de esa presentación.

La configuración se aplica automáticamente a la semana actual y a semanas cerradas, usando las relaciones por ID. Los valores se identifican como equivalencias de la **configuración actual**: editar un tamaño cambia la equivalencia derivada, sin alterar nombres/precios/cantidades guardadas de las ventas. Las anulaciones se descuentan del informe vigente y el resumen original del cierre conserva sus cantidades/importes originales.

Los tamaños aceptan enteros mayores que cero. Sin tamaño de caja principal no hay referencia para convertir a cajas/packs. Sin cajas por pack, las unidades y cajas equivalentes siguen disponibles. Una segunda caja antigua sin tamaño o una presentación desconocida queda fuera de la conversión y marca los equivalentes como parciales. No se infiere el tamaño de palabras como «x10» en el nombre.

## Otros datos, correcciones y eliminación

**IVA y consumo de helado (opcional)** permite configurar gramos y bochas por presentación. Cada bocha equivale a 80 g y el consumo teórico sigue sumándose en Semana. Cada presentación mantiene su precio y gramaje propios.

En **Editar → Más opciones**:

- **Editar datos** abre una presentación existente por separado. Si es la segunda caja, permite editar su tamaño.
- **Separar productos** deshace la agrupación, conservando productos e historial.
- **Eliminar** retira solo una presentación del catálogo.
- **Eliminar producto y sus presentaciones** retira toda la ficha y sus opciones de venta.

Las eliminaciones piden confirmación y conservan ventas y cierres. Si una familia antigua tiene varios productos asignados a una misma posición, el formulario pide revisar sus vínculos y no elige uno arbitrariamente. Cancelar, la cruz y Escape cierran el formulario sin guardar.

## CSV, catálogo, respaldo y auditoría

El CSV semanal conserva las primeras **35 columnas** de la versión anterior y agrega al final **unidades_por_caja_presentacion**, que indica el tamaño físico de cada fila de caja. La columna anterior **unidades_por_caja** sigue siendo la caja principal de referencia. Las filas FAMILIA contienen el subtotal monetario y las equivalencias; las filas PRODUCTO conservan sus cantidades e importes reales. Pantalla usa hasta 3 decimales y CSV hasta 6, con coma decimal. Las familias mantienen su separación visual breve arriba/abajo.

Exportar productos y categorías incluye los tres tipos de presentación, sus tamaños, códigos, precios, disponibilidad, gramajes y los factores de packs. Importar reemplaza el catálogo por el del archivo: los faltantes se retiran conservando ventas/cajas/semanas anteriores. Los respaldos completos transportan IDs y datos históricos.

La auditoría privada conserva sus registros y agrega los cambios del tamaño propio de la segunda caja y de la caja principal de referencia, con valores anterior/nuevo. Los archivos anteriores sin segunda caja siguen siendo compatibles. Una importación antigua sin el nuevo tamaño no lo inventa: queda sin configurar si el archivo no lo trae.

## Actualización y verificación

Se mantiene **IndexedDB 4**, el mismo dbName y el respaldo JSON versión 1. Son campos opcionales en los registros existentes; no se borra ni se reinicializa la base. Las migraciones anteriores a 4 siguen disponibles. Los tres tickets de 78 mm conservan sus formatos y reimpresión.

Verificado: **184 pruebas automatizadas**, build y recorrido en Chromium con una base existente. Esta entrega comprueba filtros por categoría, ambas cajas, selector global, teclado, nombres repetidos y cambios de disponibilidad/precio desde otra pestaña, ID/precio exactos al cobrar, caja cerrada, conservación de registros al filtrar, equivalencias semanales, respaldo, recarga, escritorio/teléfono y tickets de venta, movimiento y cierre. Las pruebas de segunda caja, CSV, anulaciones y snapshots de las entregas anteriores siguen pasando. La impresora física no se comprobó.

Commit sugerido: `feat: filter sale products by presentation and add searchable selector`
