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
    manager.getLocation=cb=>cb(null); await assert.rejects(locate(),/не передал местоположение/);
    manager.isLocationAvailable=false; await assert.rejects(locate(),/недоступна геолокация/);
    assert.throws(()=>coordinatesToPlace(100,50));
  } finally { Object.defineProperty(globalThis,'window',old ?? {value:undefined,configurable:true}); }
});

test('permission granted without a GPS fix uses browser provider; refusal never does', async t => {
  let browserCalls=0;
  const manager={isInited:true,isLocationAvailable:true,isAccessRequested:true,isAccessGranted:true,
    getLocation(cb:(v:any)=>void){cb(null);},openSettings(){}};
  replaceGlobal(t,'window',{Telegram:{WebApp:{initData:'test',isVersionAtLeast:()=>true,LocationManager:manager}}} as any);
  replaceGlobal(t,'navigator',{geolocation:{getCurrentPosition(cb:any){browserCalls++;cb({coords:{latitude:53.2,longitude:50.1}});}}} as any);
  assert.equal((await locate()).timezone,'Europe/Samara'); assert.equal(browserCalls,1);
  manager.isAccessGranted=false;
  await assert.rejects(locate(),(e:any)=>e.settings === true && /не дал доступ/.test(e.message));
  assert.equal(browserCalls,1);
});
test('slow permission prompt times out honestly and ignores late coordinates', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let callback:any;
  const manager={isInited:true,isLocationAvailable:true,isAccessRequested:false,isAccessGranted:false,getLocation(cb:any){callback=cb;}};
  replaceGlobal(t,'window',{Telegram:{WebApp:{initData:'test',isVersionAtLeast:()=>true,LocationManager:manager}}} as any);
  const pending=locate();
  const assertion=assert.rejects(pending,/Не дождались/);
  t.mock.timers.tick(60_001); await assertion;
  callback({latitude:53.2,longitude:50.1});
});

function replaceGlobal(t: { after: (fn: () => void) => void }, key: string, value: unknown) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(()=>Object.defineProperty(globalThis,key,descriptor ?? {value:undefined,configurable:true}));
}

test('closing location request stops timeout and ignores a late native answer', async t => {
  t.mock.timers.enable({apis:['setTimeout']}); let callback:any;
  replaceGlobal(t,'window',{Telegram:{WebApp:{initData:'test',isVersionAtLeast:()=>true,LocationManager:{isInited:true,isLocationAvailable:true,isAccessGranted:true,getLocation(cb:any){callback=cb;}}}}});
  replaceGlobal(t,'navigator',{geolocation:{getCurrentPosition(){assert.fail('Must not request browser location after closing');}}});
  const controller=new AbortController(); const pending=locate(controller.signal);
  const rejected=assert.rejects(pending,/отменено/); controller.abort(); await rejected;
  callback(null); t.mock.timers.tick(60001);
});
