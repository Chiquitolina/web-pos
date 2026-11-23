import { Component, input } from '@angular/core';
import { ClosingReceiptView } from './core/closing-receipt';
@Component({selector:'app-closing-receipt',standalone:true,template:`
@let r=report();
<h2 class="closing-store">{{r.storeName}}</h2><h3 class="closing-title">CIERRE DE TURNO</h3>
<p class="closing-id">Turno: {{r.sessionId}}</p>
<div class="closing-period"><div><b>Apertura:</b> {{r.openedAt}}</div><div><b>Cierre:</b> {{r.closedAt}}</div><div><b>Duración:</b> {{r.duration}}</div></div>
<h4>RESUMEN AL CIERRE</h4>
<div class="closing-line"><span>Pedidos emitidos</span><b>{{r.orders}}</b></div>
@if(r.firstOrder!==null){<div class="closing-line"><span>Números de pedido</span><b>#{{r.firstOrder}} a #{{r.lastOrder}}</b></div>}
<div class="closing-line"><span>Pedidos vigentes</span><b>{{r.validOrders}}</b></div><div class="closing-line"><span>Pedidos anulados</span><b>{{r.cancelledOrders}}</b></div>
<div class="closing-line"><span>Importe de pedidos emitidos</span><span>{{money(r.grossTotal)}}</span></div><div class="closing-line"><span>Importe anulado</span><span>{{money(r.cancelledAmount)}}</span></div>
<div class="closing-line closing-emphasis"><b>TOTAL VENDIDO</b><b>{{money(r.total)}}</b></div>
<div class="closing-line"><span>Ticket promedio vigente</span><span>{{money(r.average)}}</span></div><div class="closing-line"><span>Unidades vendidas</span><span>{{r.quantity}}</span></div>
<h4>VENTAS POR MEDIO DE PAGO</h4>
<table class="closing-payment-table"><colgroup><col style="width:46%"><col style="width:18%"><col style="width:36%"></colgroup><thead><tr><th>Medio</th><th>Pedidos</th><th>Importe</th></tr></thead><tbody>@for(p of r.payments;track p.method){<tr><td>{{p.label}}</td><td>{{p.orders}}</td><td>{{money(p.total)}}</td></tr>}</tbody></table><p class="closing-note">Tarjeta agrupa débito y crédito: el registro actual no los distingue.</p>
<h4>CONTROL DE EFECTIVO</h4><div class="closing-line"><span>Fondo inicial</span><span>{{money(r.opening)}}</span></div><div class="closing-line"><span>Ventas en efectivo</span><span>{{money(r.payments[0].total)}}</span></div><div class="closing-line"><span>Otros ingresos</span><span>{{money(r.incoming)}}</span></div><div class="closing-line"><span>Retiros / egresos</span><span>{{money(r.outgoing)}}</span></div><div class="closing-line"><b>Efectivo esperado</b><b>{{money(r.expected)}}</b></div><div class="closing-line"><b>Efectivo contado</b><b>{{money(r.counted)}}</b></div><div class="closing-line closing-emphasis"><b>{{r.difference<0?'FALTANTE':r.difference>0?'SOBRANTE':'DIFERENCIA'}}</b><b>{{money(r.difference)}}</b></div>
<h4>INGRESOS Y RETIROS</h4>@for(m of r.movements;track m.id){<div class="closing-detail"><div class="closing-line"><b>{{m.type==='IN'?'Ingreso':'Retiro / egreso'}}</b><b>{{money(m.amount)}}</b></div><div>{{m.date}}</div><div>{{m.reason}}</div></div>}@empty{<p>Sin movimientos de efectivo.</p>}
<h4>PRODUCTOS VENDIDOS AL CIERRE</h4><table class="closing-product-table"><colgroup><col style="width:54%"><col style="width:12%"><col style="width:34%"></colgroup><thead><tr><th>Producto</th><th>Cant.</th><th>Acumulado</th></tr></thead><tbody>@for(p of r.products;track p.id){<tr><td>{{p.name}}</td><td>{{p.quantity}}</td><td>{{money(p.total)}}</td></tr>}@empty{<tr><td colspan="3">Sin productos vendidos.</td></tr>}</tbody><tfoot><tr><th>Total</th><th>{{r.quantity}}</th><th>{{money(r.total)}}</th></tr></tfoot></table>
<h4>PEDIDOS ANULADOS AL CIERRE</h4>@for(v of r.cancelled;track v.id){<div class="closing-detail"><div class="closing-line"><b>Pedido #{{v.number}}</b><span>{{money(v.amount)}}</span></div><div>{{v.at}}</div><div>{{v.reason}}</div></div>}@empty{<p>Sin pedidos anulados al cierre.</p>}
@if(r.laterCancellations.length){<section class="closing-adjustments"><h4>ANULACIONES POSTERIORES</h4><p>El cierre y el conteo originales de arriba se conservan.</p>@for(v of r.laterCancellations;track v.id){<div class="closing-detail"><div class="closing-line"><b>Pedido #{{v.number}}</b><span>{{money(v.amount)}}</span></div><div>{{v.at}}</div><div>{{v.reason}}</div></div>}<div class="closing-line"><b>Ajuste posterior</b><b>−{{money(r.laterAmount)}}</b></div><div class="closing-line"><b>Venta vigente actual</b><b>{{money(r.currentTotal)}}</b></div><div class="closing-line"><span>Pedidos vigentes actuales</span><b>{{r.currentOrders}}</b></div></section>}
<p class="closing-note">Cierre original guardado. Anulados excluidos de ventas, medios de pago y productos al cierre.</p><p class="closing-note">Impreso: {{r.printedAt}}</p><p class="closing-signature">Responsable: __________________________</p><p class="closing-signature">Firma: ________________________________</p>
`})
export class ClosingReceiptComponent {
 readonly report=input.required<ClosingReceiptView>();
 money(value:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value/100);}
}
