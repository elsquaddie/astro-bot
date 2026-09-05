import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinatesToPlace, locate } from '../src/domain/locations.ts';
test('native Telegram location initializes before requesting and resolves timezone', async () => {
  const old = Object.getOwnPropertyDescriptor(globalThis,'window');
  const calls:string[]=[];
  const manager={ isInited:false,isLocationAvailable:true,init(cb:()=>void){calls.push('init');cb();},getLocation(cb:(v:any)=>void){calls.push('location');cb({latitude:53.1959,longitude:50.1002});} };
  Object.defineProperty(globalThis,'window',{value:{Telegram:{WebApp:{initData:'present',isVersionAtLeast:()=>true,LocationManager:manager}}},configurable:true});
  try {
    assert.equal((await locate()).timezone,'Europe/Samara'); assert.deepEqual(calls,['init','location']);
    manager.getLocation=cb=>cb(null); await assert.rejects(locate(),/Доступ к месту/);
    manager.isLocationAvailable=false; await assert.rejects(locate(),/недоступна геолокация/);
    assert.throws(()=>coordinatesToPlace(100,50));
  } finally { Object.defineProperty(globalThis,'window',old ?? {value:undefined,configurable:true}); }
});
