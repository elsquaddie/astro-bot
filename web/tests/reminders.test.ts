import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { calculateEvents } from '../src/domain/astronomy.ts';
import { viewingGuide } from '../src/domain/viewing.ts';
// @ts-expect-error Worker modules
import { telegramUser } from '../telegram-server/auth.mjs';
// @ts-expect-error Worker modules
import { dispatch, dispatcherReady } from '../telegram-server/queue.mjs';
// @ts-expect-error Worker modules
import { canonicalPlan, reminderApi } from '../telegram-server/reminders.mjs';
const place = { name: 'Самара', latitude: 53.1959, longitude: 50.1002, timezone: 'Europe/Samara' };
const token = 'unit-test-token';
function signed(user = 123, stamp = Date.now()) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(stamp/1000)), user: JSON.stringify({ id: user, first_name: 'Test' }) });
  const key = createHmac('sha256','WebAppData').update(token).digest();
  const check = [...params].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  params.set('hash',createHmac('sha256',key).update(check).digest('hex')); return params.toString();
}
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_unusual_thor.sql',import.meta.url),'utf8'));
  return { raw: db, prepare(sql: string) {
    const statement = db.prepare(sql); let values: any[] = [];
    return { bind(...args: any[]) { values = args; return this; }, async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; }, async run() { return statement.run(...values); } };
  } };
}
const environment = () => ({ DB: database(), BOT_TOKEN: token, REMINDER_DISPATCH_SECRET: 'unit-dispatch', TELEGRAM_APP_URL: 'https://sky.example/' });
test('Telegram auth rejects tampering, duplicates, expired and future sessions', async () => {
  assert.equal(await telegramUser(signed(),token),123);
  for (const value of [signed().replace('Test','Forged'), signed()+'&user={}', signed(123,Date.now()-7200000), signed(123,Date.now()+120000), ''])
    await assert.rejects(telegramUser(value,token));
});
test('canonical event ignores forged dates, chat IDs and text', () => {
  const now = new Date('2026-09-04T12:00:00Z');
  const event = calculateEvents(place,now,30).find(e => Date.parse(e.best)>+now+86400000)!;
  const result = canonicalPlan({ place,eventId:event.id,leadMinutes:60,chat_id:999,event:{title:'Forged',best:'2099-01-01'} },+now);
  assert.equal(result.plan.event.title,event.title); assert.equal(result.dueAt,Date.parse(result.plan.event.best)-3600000);
  assert.throws(() => canonicalPlan({place,eventId:'moon-nonsense:2026-09-06',leadMinutes:60},+now));
  assert.throws(() => canonicalPlan(null,+now));
});
test('API persists, isolates users, updates same event and cancels only owner', async () => {
  const env=environment();
  await dispatch(env);
  const event=calculateEvents(place,new Date(),30).find(e=>Date.parse(e.best)>Date.now()+86400000)!;
  const request=(user:number,body?:any)=>new Request('https://sky.example/api/reminders',{method:body?'POST':'GET',headers:{'X-Telegram-Init-Data':signed(user)},body:body?JSON.stringify(body):undefined});
  const input={place,eventId:event.id,leadMinutes:60,chat_id:999};
  const saved=await reminderApi(request(123,input),env);
  assert.equal(env.DB.raw.prepare('SELECT user_id FROM reminders').get()?.user_id,123);
  assert.equal((await reminderApi(request(456),env)).reminders.length,0);
  assert.equal((await reminderApi(request(123,{...input,leadMinutes:15}),env)).id,saved.id);
  await assert.rejects(reminderApi(request(456,{action:'cancel',id:saved.id}),env));
  await reminderApi(request(123,{action:'cancel',id:saved.id}),env);
  assert.equal((await reminderApi(request(123),env)).reminders[0].status,'cancelled');
});
function queued(env:any,now:number,id='one') {
  const event=calculateEvents(place,new Date(now),5)[0];
  env.DB.raw.prepare("INSERT INTO reminders (id,user_id,event_key,payload,due_at,end_at,status,retry_at,created_at) VALUES (?,123,?,?,?,?,'pending',?,?)")
    .run(id,id,JSON.stringify({event,place,leadMinutes:60}),now,now+86400000,now,now);
}
test('concurrent dispatchers claim once and report healthy only after heartbeat', async () => {
  const env=environment(), now=Date.now(); queued(env,now); let messages=0;
  assert.equal(await dispatcherReady(env,now),false);
  const send=async (_url:string, options:any)=>{ messages++; assert.equal(JSON.parse(options.body).chat_id,123); return Response.json({ok:true,result:{message_id:10}}); };
  await Promise.all([dispatch(env,now,send),dispatch(env,now,send)]);
  assert.equal(messages,1); assert.equal(env.DB.raw.prepare('SELECT status FROM reminders').get()?.status,'sent');
  assert.equal(await dispatcherReady(env,now),true); assert.equal(await dispatcherReady(env,now+3600001),false);
});
test('ambiguous delivery never blindly resends; Telegram rate limits retry', async () => {
  const env=environment(),now=Date.now(); queued(env,now);
  await dispatch(env,now,async()=>{throw new Error('connection lost');});
  assert.equal(env.DB.raw.prepare('SELECT status FROM reminders').get()?.status,'uncertain');
  queued(env,now,'two');
  await dispatch(env,now,async()=>Response.json({ok:false,error_code:429,parameters:{retry_after:120}}));
  const row=env.DB.raw.prepare("SELECT status,retry_at FROM reminders WHERE id='two'").get();
  assert.equal(row?.status,'pending'); assert.equal(row?.retry_at,now+120000);
  await dispatch(env,now+120000,async()=>Response.json({ok:false,error_code:403}));
  assert.equal(env.DB.raw.prepare("SELECT status FROM reminders WHERE id='two'").get()?.status,'failed');
});
test('guide translates height to a physical reference and identifies Mars beside Moon', () => {
  const guide=viewingGuide({altitude:37,azimuth:182,kind:'conjunction',id:'moon-Mars:2026-09-05'});
  assert.match(guide.elevation,/4 кулака/); assert.match(guide.compass,/182°/); assert.match(guide.target,/Марс/);
  assert.match(viewingGuide({altitude:85,azimuth:0,kind:'moon-phase',id:'x'}).elevation,/над головой/);
});
test('stale claims remain uncertain and ended observations never send', async () => {
  const env=environment(),now=Date.now(); queued(env,now,'stale'); queued(env,now,'ended');
  env.DB.raw.prepare("UPDATE reminders SET status='sending',claimed_at=? WHERE id='stale'").run(now-600000);
  env.DB.raw.prepare("UPDATE reminders SET end_at=? WHERE id='ended'").run(now-1);
  await dispatch(env,now,async()=>{assert.fail('Must not send');});
  assert.equal(env.DB.raw.prepare("SELECT status FROM reminders WHERE id='stale'").get()?.status,'uncertain');
  assert.equal(env.DB.raw.prepare("SELECT status FROM reminders WHERE id='ended'").get()?.status,'expired');
});
test('moving a reminder after due selection prevents an early atomic claim', async () => {
  const env=environment(),now=Date.now(); queued(env,now);
  const prepare=env.DB.prepare.bind(env.DB);
  env.DB.prepare=(sql:string)=>{
    const statement=prepare(sql);
    if (sql.startsWith('SELECT id FROM reminders')) {
      const all=statement.all.bind(statement);
      statement.all=async()=>{ const result=await all(); env.DB.raw.prepare('UPDATE reminders SET retry_at=?').run(now+3600000); return result; };
    }
    return statement;
  };
  await dispatch(env,now,async()=>{assert.fail('Rescheduled reminder must not send');});
  assert.equal(env.DB.raw.prepare('SELECT status FROM reminders').get()?.status,'pending');
});
test('active reminders remain visible after more than 200 historical reminders', async () => {
  const env=environment(),now=Date.now(); queued(env,now-100000,'active');
  for(let i=0;i<205;i++) queued(env,now,String(i));
  env.DB.raw.prepare("UPDATE reminders SET status='sent' WHERE id!='active'").run();
  const result=await reminderApi(new Request('https://sky.example/api/reminders',{headers:{'X-Telegram-Init-Data':signed()}}),env);
  assert.equal(result.reminders.length,200); assert.equal(result.reminders[0].id,'active');
});
