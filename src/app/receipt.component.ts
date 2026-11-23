import { Component, computed, input } from '@angular/core';
import { Sale } from './core/models';
import { receiptView } from './core/receipt';
@Component({selector:'app-receipt',standalone:true,template:`
@let r = receipt();
<h2 class="receipt-store">{{r.storeName}}</h2>
<h3 class="receipt-order">Pedido nro. {{r.orderNumber}}</h3>
<div class="receipt-meta"><span>Fecha: {{r.date}}</span><span [title]="r.sessionId">Turno: {{r.sessionCode}}</span><span>Pago: {{r.payment}}</span></div>
<p class="receipt-id">S: {{r.id}}</p>
@if(r.cancellation;as a){<div class="receipt-cancelled"><strong>VENTA ANULADA</strong><br>{{a.reason}}<br>{{a.at}}</div>}
<table class="receipt-items"><colgroup><col class="receipt-col-quantity"><col class="receipt-col-name"><col class="receipt-col-vat"><col class="receipt-col-price"><col class="receipt-col-amount"></colgroup><thead><tr><th>UNDS.</th><th>DESCRIPCIÓN</th><th>IVA</th><th>PRECIO</th><th>IMPORTE</th></tr></thead><tbody>@for(i of r.items;track $index){<tr><td>{{i.quantity}}</td><td>{{i.name}}</td><td>{{i.vat}}</td><td>{{i.price}}</td><td>{{i.amount}}</td></tr>}</tbody></table>
<div class="receipt-total"><strong>{{r.cancellation?'TOTAL ANULADO':'TOTAL'}}</strong><strong>{{r.total}}</strong></div>
@if(sale().payment==='CASH'){<div class="receipt-cash"><span>Recibido: {{r.received}}</span><span>Vuelto: {{r.change}}</span></div>}
<p class="receipt-footer">*** Documento no válido como factura ***</p>
`})
export class ReceiptComponent {
 readonly sale=input.required<Sale>();readonly storeName=input.required<string>();readonly timeZone=input.required<string>();
 readonly receipt=computed(()=>receiptView(this.sale(),this.storeName(),this.timeZone()));
}
