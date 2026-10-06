# Heladería POS — V1 Angular

Boceto funcional, sin backend, para una caja y un navegador. Angular standalone + TypeScript + IndexedDB. Catálogo de ejemplo; reemplazar precios antes de operar.

## Instalación

Node.js 22.12 o superior (se verificó con Node 24). Descomprimir y abrir terminal en la carpeta del proyecto:

```bash
npm ci
npm start
```

Abrir http://localhost:4200. Para verificar:

```bash
npm test
npm run build
```

## Primer recorrido

1. Productos: configurar precios, agregar productos y desactivar ejemplos que no correspondan.
2. Caja: ingresar fondo inicial y abrir.
3. Venta: agregar productos, elegir efectivo / Mercado Pago / tarjeta y cobrar. En efectivo ingresar recibido; el vuelto no es ingreso de caja.
4. El ticket se muestra después de guardar. Imprimir abre el diálogo del navegador; elegir térmica de 80 mm. Se puede reimprimir desde Historial.
5. Caja: registrar retiros e ingresos con motivo. Al finalizar contar el efectivo físico, incluyendo el fondo inicial, y guardar cierre.
6. Cierres: revisar cantidades por producto, importe vendido, medios de pago y diferencia.
7. Respaldo: exportar JSON y guardarlo fuera del navegador. Para restaurar, cerrar primero la caja actual. Importar reemplaza todo; no fusiona datos.

Los tickets son comprobantes internos, sin integración fiscal. Mercado Pago y tarjeta son registros manuales de pago, sin conexión con proveedores.

## Modelo y reglas

- `Product`: catálogo editable, precio en centavos y activo/inactivo.
- `Sale`: número correlativo local, sesión de caja, fecha, medio de pago y detalle con nombre/precio históricos.
- `Session`: apertura, fondo inicial y movimientos; una sola abierta.
- `Closing`: snapshot definitivo con ventas, cantidades, importes por producto, pagos, esperado, contado y diferencia.
- Efectivo esperado = fondo inicial + ventas en efectivo + ingresos − retiros.
- El cierre guarda totales reales por producto, no cantidad × precio actual. Soporta precios distintos durante la jornada.
- Ventas y cierre se guardan dentro de transacciones IndexedDB. Se vuelve a comprobar caja abierta y precio activo al cobrar.
- El servicio lee el último estado dentro de cada transacción para evitar sobrescrituras entre pestañas; la interfaz no refresca otras pestañas automáticamente. Operar una sola pestaña.

## Estructura

`src/app/core/models.ts`: contratos y catálogo inicial.
`src/app/core/domain.ts`: dinero, cierre y validación de respaldos.
`src/app/core/storage.service.ts`: adaptador de persistencia. Cambiar aquí cuando se agregue API/SQLite; no escribir almacenamiento desde la UI.
`src/app/app.component.*`: primera interfaz con seis secciones. Próximo refactor: componentes por feature y fachada POS; se deja centralizada en este boceto para que sea fácil recorrerlo.
`tests/domain.test.ts`: cálculos de caja, snapshots y validación.

La persistencia usa un documento por transacción, simple para V1. Antes de crecer a grandes históricos separar productos, ventas y sesiones en object stores con índices. No hay stock, usuarios, permisos, descuentos, pagos mixtos, devolución/anulación ni sincronización en esta etapa.

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

Después: extraer features, búsqueda y atajos, conteo por denominaciones, anulaciones auditadas y pagos mixtos; luego persistencia por entidades y backend local. Integración de merma: agregar receta/gramos teóricos a productos, sin modificar los precios o datos de ventas históricas.

Fuentes oficiales: https://angular.dev/tools/cli/environments · https://angular.dev/tools/cli/deployment · https://angular.dev/ecosystem/service-workers

Commit sugerido: `feat: bootstrap angular ice-cream pos with indexeddb and cash closings`
