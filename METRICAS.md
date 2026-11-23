# Métricas: cantidades y momentos de venta

La sección **Métricas** está en el menú lateral, debajo de Semana. Permite analizar qué productos se venden y en qué momentos, usando las cantidades de todas las ventas vigentes del navegador. Los importes y los indicadores de pedidos no forman parte de esta sección.

## Usarla

1. Entrá a **Métricas**. La primera consulta usa los últimos 30 días, incluido hoy.
2. Elegí **Período**: Hoy, Esta semana, Últimos 7 días, Últimos 30 días, Este mes, Todo el historial o Fechas personalizadas.
3. Si querés, elegí categoría y presentación, o escribí un nombre/código Grido.
4. En **Filtrar por día de semana y franja horaria**, podés elegir un día y horas específicas.
5. Tocá **Aplicar filtros**. El encabezado de resultados muestra las fechas y criterios aplicados. Si cambiaste un control pero todavía no aplicaste, se indica «Hay cambios sin aplicar».
6. **Restablecer filtros** vuelve a los últimos 30 días y a todo el catálogo.

Las consultas funcionan con caja abierta o cerrada. Elegir fechas/filtros y navegar por los gráficos no guarda cambios en los datos. Volver a abrir la sección restablece sus controles; los filtros no se incorporan al respaldo.

## Qué mide cada gráfico

| Vista | Cálculo |
| --- | --- |
| Cantidad vendida | Suma de las cantidades cobradas de las líneas que cumplen los filtros. |
| Productos distintos | Productos diferentes que aparecen en esas líneas; caja y unidad conservan su identidad. |
| Día más fuerte | Día con mayor valor según el modo elegido: promedio calendario o acumulado. Los empates se indican. |
| Hora más fuerte | Franja de una hora con más cantidad acumulada; los empates se indican. |
| Días de la semana | Suma por lunes, martes, etc., o promedio por ocurrencias calendario del día. |
| Horas del día | Cantidad acumulada en cada una de las 24 franjas horarias. |
| Evolución | Cantidades del período con intervalos sin ventas en cero. Agrupa por día hasta 62 días; por semana hasta 366; por mes hasta 1.096; por año para períodos más largos. |
| Productos más vendidos | Ranking por cantidad. Podés mostrar los primeros 5, 10, 20 o 50. El desplegable de detalle contiene todos los productos y su participación porcentual. |
| Categorías más vendidas | Primeras 10 categorías por cantidad, con participación sobre el total filtrado. El detalle incluye todas. |
| Mapa de días y horas | Cruce de 7 días × 24 horas. Color más oscuro significa mayor cantidad; cada celda tiene su detalle. |

Los gráficos de horas y evolución también tienen tablas desplegables con los valores exactos. Las etiquetas y descripciones de los gráficos están disponibles para lectores de pantalla; en pantallas pequeñas las vistas anchas se desplazan dentro de su tarjeta.

## Caja, unidad y tamaños diferentes

**Se cuentan presentaciones vendidas**. Vender 4 cajas y 4 individuales suma 8 presentaciones. Una caja de 10 y una de 20 cuentan una cada una. Para una comparación homogénea, usá **Por unidad** o **Por caja**; esta última reúne caja principal y segunda caja.

Las presentaciones especiales, como Pack, aparecen con Todas las presentaciones. Se usa primero la presentación configurada del producto actual. Para productos antiguos sin presentación se reconocen rótulos habituales de caja/unidad en el nombre/código histórico, igual que en el filtro visual de Venta. Esto no modifica productos ni infiere contenido físico.

Las conversiones de unidades, cajas equivalentes, packs y kilos teóricos siguen disponibles en **Semana**, con las cantidades y capacidades configuradas allí.

## Fechas, filtros y promedios

- Las fechas y horas usan el `timeZone` del environment del comercio; en el ejemplo es Argentina. Desde/Hasta incluyen el día local completo, aunque en UTC corresponda a otra fecha.
- Esta semana significa lunes a hoy, independientemente de cuándo se haya realizado el cierre semanal operativo. Los últimos 7/30 días incluyen hoy.
- Todo el historial comienza en la primera venta vigente guardada y llega hasta hoy; también incluye registros posteriores si el equipo los guardó con una fecha futura.
- La hora inicial se incluye y la final queda fuera. **18:00 a 24:00** incluye las horas 18 a 23 del mismo día. El inicio debe ser menor que el fin.
- El filtro de categoría usa el nombre registrado en cada línea al vender. Las categorías antiguas siguen disponibles aunque ya no estén en el catálogo actual. En una venta con varias categorías solo se suman las líneas que coinciden.
- La búsqueda acepta varias palabras sin importar mayúsculas o tildes. Consulta nombres y códigos históricos y actuales. Combina sus condiciones con los demás filtros.
- El ranking agrupa por ID de producto: renombrar un producto no lo duplica. Muestra el nombre/código de su venta más reciente dentro del resultado. Productos con el mismo nombre y diferente ID siguen separados.
- Productos retirados o inactivos mantienen sus cantidades históricas. Las anulaciones se excluyen completas, incluso si se hicieron después de cerrar la caja o semana.

El **promedio calendario**, modo inicial de Días de la semana, divide las cantidades de cada día por cuántas veces ese día aparece en las fechas seleccionadas. Por ejemplo, si hay cuatro lunes y se vendieron 20 presentaciones entre ellos, muestra 5. Incluye lunes sin ventas. El sistema no deduce si el comercio estaba cerrado. Esto permite comparar períodos con distinta cantidad de lunes, domingos, etc.

Las semanas, meses o años de los extremos del período pueden ser parciales. Los detalles de evolución muestran el inicio del intervalo; un intervalo semanal puede comenzar antes de Desde, pero solo incluye las cantidades de las fechas filtradas.

## Datos existentes y verificación

La sección consulta todos los registros históricos, además del turno/semana en curso. El adaptador recorre ventas con un cursor de IndexedDB y conserva solo acumulados, sin cargar el historial completo en el caché de caja. Catálogo e historial se leen dentro de la misma transacción de solo lectura. Cambiar de consulta o salir cancela la anterior; los resultados anteriores no pisan una consulta más nueva.

No agrega almacenes, índices ni migraciones. Se mantiene **IndexedDB 4**, el respaldo JSON versión 1, el mismo nombre de base y las mismas dependencias. Los registros, contadores, auditoría, precios y snapshots financieros no se modifican. El mecanismo existente de notificaciones entre pestañas refresca las métricas al cobrar, anular o editar el catálogo.

Verificación: **204 pruebas automatizadas**, build y recorrido en Chromium. Incluye 5.000 ventas cerradas fuera del caché activo, rangos locales y offsets, promedios con ceros, filtros combinados, igualdad entre acumulados de gráficos, ambas cajas, productos retirados, cancelación de consultas, preservación de registros, anulación desde otra pestaña, recarga, escritorio/teléfono y compatibilidad con los filtros de Venta y el cierre de 78 mm.

Commit sugerido: `feat: add quantity metrics with historical charts and filters`
