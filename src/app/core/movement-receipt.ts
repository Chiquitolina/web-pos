import { Data, Movement, Session } from './models';
import { receiptDate } from './receipt';

function validateMovement(movement:Movement):void {
 if(!movement||typeof movement.id!=='string'||!movement.id||!['IN','OUT'].includes(movement.type)||!Number.isSafeInteger(movement.amount)||movement.amount<=0||typeof movement.reason!=='string'||!movement.reason.trim()||typeof movement.at!=='string'||!Number.isFinite(Date.parse(movement.at)))throw Error('Revisá tipo, importe y motivo del movimiento');
}

export function recordCashMovement(data:Data,sessionId:string,movement:Movement):Movement {
 const session=data.sessions.find(s=>s.id===sessionId&&!s.closing);
 if(!session)throw Error('Abrí caja para registrar ingresos o retiros');
 validateMovement(movement);
 if(session.movements.some(m=>m.id===movement.id))throw Error('El movimiento ya fue registrado');
 const saved={...movement,reason:movement.reason.trim()};session.movements.push(saved);return saved;
}

// Reprints always use the saved movement's timestamp and ID, even after closing.
export function movementReceiptView(session:Session,movementId:string,storeName:string,timeZone:string) {
 const index=session.movements.findIndex(m=>m.id===movementId),movement=session.movements[index];
 if(!movement)throw Error('Movimiento no encontrado en este turno');
 validateMovement(movement);
 return {storeName,sessionId:session.id,id:movement.id,number:index+1,type:movement.type,
  title:movement.type==='OUT'?'RETIRO DE EFECTIVO':'INGRESO DE EFECTIVO',
  amount:movement.amount,date:receiptDate(movement.at,timeZone),reason:movement.reason,
  signatureLabel:movement.type==='OUT'?'Recibió':'Entregó'};
}
export type MovementReceiptView=ReturnType<typeof movementReceiptView>;
