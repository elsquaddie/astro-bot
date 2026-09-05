import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RemindersContext } from '../src/application/reminders';
import { ReminderContent } from '../src/components/ReminderSheet';
import type { SavedPlan } from '../src/domain/types';
const plan:SavedPlan={place:{name:'Самара',latitude:53.2,longitude:50.1,timezone:'Europe/Samara'},leadMinutes:60,event:{id:'moon-Mars:2026-09-07',kind:'conjunction',title:'Луна рядом с Марсом',subtitle:'',description:'',equipment:'',equipmentDetail:'',peak:'2099-09-07T01:10:00Z',best:'2099-09-07T01:10:00Z',start:'2099-09-07T00:00:00Z',end:'2099-09-07T02:00:00Z',altitude:37,azimuth:100,source:''}};
function render(available:boolean) {
 const record={id:'saved',plan,status:'pending',dueAt:Date.parse(plan.event.best)-3600000};
 const service={inside:true,available,records:[record],deliveryTest:null,error:'',loading:false,refresh:async()=>{},save:async()=>record,cancel:async()=>{},testDelivery:async()=>{}};
 return renderToStaticMarkup(createElement(RemindersContext.Provider,{value:service},createElement(ReminderContent,{plan,saved:true,onClose(){},onSave:()=>true})));
}
test('saved reminder prominently confirms the due time and never repeats the save action',()=>{
 const html=render(true);
 assert.match(html,/Напоминание сохранено/); assert.match(html,/Бот напомнит 7 сентября в 04:10/);
 assert.match(html,/Изменить время/); assert.doesNotMatch(html,/Сохранить время|Когда написать\?|Подключаем/);
 assert.doesNotMatch(html,/Проверить статус/); assert.match(html,/Отправить тестовое сообщение/);
});
test('paused delivery keeps the saved plan visible without promising a message',()=>{
 const html=render(false); assert.match(html,/Автоматическая доставка сейчас приостановлена/); assert.doesNotMatch(html,/Бот напомнит|Когда написать\?/);
});
