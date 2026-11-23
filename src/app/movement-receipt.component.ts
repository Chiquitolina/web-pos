import { Component, input } from '@angular/core';
import { MovementReceiptView } from './core/movement-receipt';

@Component({selector:'app-movement-receipt',standalone:true,template:`
@let r=report();
<h2 class="movement-store">{{r.storeName}}</h2>
<h3 class="movement-title">{{r.title}}</h3>
<p class="movement-number">Movimiento del turno #{{r.number}}</p>
<div class="movement-amount"><small>MONTO</small><strong>{{money(r.amount)}}</strong></div>
<p class="movement-date"><b>Fecha y hora:</b> {{r.date}}</p>
<section class="movement-reason"><b>Motivo</b><p>{{r.reason}}</p></section>
<div class="movement-reference"><div><b>Turno:</b> {{r.sessionId}}</div><div><b>ID movimiento:</b> {{r.id}}</div></div>
<p class="movement-signature">{{r.signatureLabel}}: __________________________</p>
<p class="movement-signature">Firma: ____________________________</p>
<p class="movement-footer">Comprobante interno de caja</p>
`})
export class MovementReceiptComponent {
 readonly report=input.required<MovementReceiptView>();
 money(value:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value/100);}
}
