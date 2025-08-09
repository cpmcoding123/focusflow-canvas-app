// FocusFlow — ADHD-friendly calendar for Canvas
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// State
let tasks = JSON.parse(localStorage.getItem('ff_tasks')||'[]');
let opts = JSON.parse(localStorage.getItem('ff_opts')||'{"minutes":25,"nudge":10}');
let focusId = null;
let timer = {remaining: opts.minutes*60, running:false, interval:null};
let weekStart = startOfWeek(new Date());

function startOfWeek(d){
  const x = new Date(d); const day = x.getDay(); // 0=Sun
  const diff = (day===0? -6 : 1) - day; // Monday start
  x.setDate(x.getDate()+diff);
  x.setHours(0,0,0,0);
  return x;
}
function fmtDate(d){ return new Date(d).toLocaleString([], {weekday:'short', month:'short', day:'numeric'}); }
function fmtTime(d){ return new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function uid(){ return Math.random().toString(36).slice(2); }
function save(){ localStorage.setItem('ff_tasks', JSON.stringify(tasks)); }
function saveOpts(){ localStorage.setItem('ff_opts', JSON.stringify(opts)); }

function render(){
  // Week label
  const end = new Date(weekStart); end.setDate(end.getDate()+6);
  $('#weekLabel').textContent = `${fmtDate(weekStart)} – ${fmtDate(end)}`;
  // Grid
  const grid = $('#grid'); grid.innerHTML='';
  for(let i=0;i<7;i++){
    const day = new Date(weekStart); day.setDate(day.getDate()+i);
    const cell = document.createElement('div'); cell.className='cell';
    const h = document.createElement('h3'); h.textContent = day.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'});
    cell.appendChild(h);
    const slice = tasks.filter(t=> sameDay(new Date(t.when), day) && passFilter(t) && matchesSearch(t));
    slice.sort((a,b)=> new Date(a.when)-new Date(b.when));
    for(const t of slice){
      const div = document.createElement('div'); div.className='chip'; div.title = `${t.title} • ${fmtTime(t.when)}`;
      div.textContent = `• ${fmtTime(t.when)} ${t.title}`;
      div.addEventListener('click',()=>selectFocus(t.id));
      cell.appendChild(div);
    }
    grid.appendChild(cell);
  }
  // Do Next list
  const next = $('#nextList'); next.innerHTML='';
  const ordered = tasks.slice().sort((a,b)=> priorityRank(a.priority)-priorityRank(b.priority) || new Date(a.when)-new Date(b.when));
  for(const t of ordered.slice(0,12)){
    const row = document.createElement('div'); row.className='task';
    const left = document.createElement('div');
    const title = document.createElement('div'); title.textContent = t.title;
    const meta = document.createElement('div'); meta.className='meta'; meta.innerHTML = `
      <span class="badge ${t.priority}">${t.priority.toUpperCase()}</span>
      <span>${new Date(t.when).toLocaleDateString()} ${fmtTime(t.when)}</span>
      <span>${t.category || 'General'}</span>
      <span>~${t.estimate||1} × 25m</span>
    `;
    left.appendChild(title); left.appendChild(meta);
    const right = document.createElement('div'); right.className='row';
    const fbtn = document.createElement('button'); fbtn.className='ghost'; fbtn.textContent='Focus'; fbtn.onclick=()=>selectFocus(t.id);
    const dbtn = document.createElement('button'); dbtn.className='ghost'; dbtn.textContent='✓'; dbtn.title='Done'; dbtn.onclick=()=>complete(t.id);
    const rbtn = document.createElement('button'); rbtn.className='ghost'; rbtn.textContent='🗑'; rbtn.title='Delete'; rbtn.onclick=()=>remove(t.id);
    right.append(fbtn,dbtn,rbtn);
    row.append(left,right);
    next.appendChild(row);
  }
}

function priorityRank(p){ return p==='now'?0:p==='next'?1:2; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function passFilter(t){
  const v = $('#filter').value;
  return v==='all' || t.priority===v;
}
function matchesSearch(t){
  const q = ($('#search').value||'').toLowerCase();
  return !q || [t.title, t.category, t.priority].filter(Boolean).some(x=>x.toLowerCase().includes(q));
}

// Add task
$('#btnAdd').addEventListener('click', ()=>{
  const title = $('#taskTitle').value.trim();
  const when = $('#taskWhen').value;
  if(!title || !when){ alert('Title and date/time, please.'); return; }
  const task = {
    id: uid(),
    title,
    when: new Date(when).toISOString(),
    priority: $('#taskPriority').value,
    category: $('#taskCategory').value.trim(),
    estimate: +$('#taskEstimate').value||1,
    repeat: $('#taskRepeat').checked
  };
  tasks.push(task); save();
  maybeScheduleNudge(task);
  clearForm(); render();
});
$('#btnClear').addEventListener('click', clearForm);
function clearForm(){ $('#taskTitle').value=''; $('#taskWhen').value=''; $('#taskCategory').value=''; $('#taskEstimate').value=1; $('#taskRepeat').checked=false; }

function selectFocus(id){
  focusId = id;
  const t = tasks.find(x=>x.id===id);
  $('#focusTitle').textContent = t ? t.title : 'Pick a task and hit Focus Mode.';
}

// Complete & repeat
function complete(id){
  const i = tasks.findIndex(x=>x.id===id);
  if(i<0) return;
  const t = tasks[i];
  if(t.repeat){
    const next = new Date(t.when); next.setDate(next.getDate()+7);
    t.when = next.toISOString();
  }else{
    tasks.splice(i,1);
  }
  save(); render();
}
function remove(id){
  tasks = tasks.filter(x=>x.id!==id); save(); render();
}

// Focus timer
function setTimerMinutes(mins){
  timer.remaining = Math.max(60, mins*60);
  $('#timer').textContent = pretty(timer.remaining);
}
function pretty(s){ const m = Math.floor(s/60).toString().padStart(2,'0'); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${m}:${sec}`; }

let tickHandle = null;
function startTimer(){
  if(timer.running){ pauseTimer(); return; }
  timer.running = true;
  $('#btnStart').textContent='Pause';
  tickHandle = setInterval(()=>{
    timer.remaining--;
    $('#timer').textContent = pretty(timer.remaining);
    if(timer.remaining<=0){ clearInterval(tickHandle); timer.running=false; $('#btnStart').textContent='Start'; notify('Focus complete!','Nice work — take a short break.'); }
  },1000);
}
function pauseTimer(){
  timer.running=false;
  $('#btnStart').textContent='Start';
  clearInterval(tickHandle);
}
function resetTimer(){
  pauseTimer();
  setTimerMinutes(opts.minutes);
}
$('#btnStart').addEventListener('click', startTimer);
$('#btnReset').addEventListener('click', resetTimer);
document.addEventListener('keydown',(e)=>{
  if(e.code==='Space'){ e.preventDefault(); startTimer(); }
  if(e.key==='n' || e.key==='N'){ $('#taskTitle').focus(); }
});

// Week nav
$('#prevWeek').addEventListener('click',()=>{ weekStart.setDate(weekStart.getDate()-7); render(); });
$('#nextWeek').addEventListener('click',()=>{ weekStart.setDate(weekStart.getDate()+7); render(); });
$('#filter').addEventListener('change',render);
$('#search').addEventListener('input', render);

// Settings
const dlg = $('#settings');
$('#btnSettings').addEventListener('click', ()=>{
  $('#optMinutes').value = opts.minutes;
  $('#optNudge').value = opts.nudge;
  dlg.showModal();
});
$('#saveSettings').addEventListener('click', (e)=>{
  e.preventDefault();
  opts.minutes = Math.max(5, Math.min(60, +$('#optMinutes').value||25));
  opts.nudge = Math.max(0, Math.min(120, +$('#optNudge').value||10));
  saveOpts();
  setTimerMinutes(opts.minutes);
  dlg.close();
});

// Export ICS
$('#btnExport').addEventListener('click', ()=>{
  const ics = toICS(tasks);
  const blob = new Blob([ics], {type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='focusflow.ics'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
});

function toICS(items){
  const pad = n=> String(n).padStart(2,'0');
  const fmt = (d)=>{
    const x = new Date(d);
    return `${x.getUTCFullYear()}${pad(x.getUTCMonth()+1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
  }
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FocusFlow//EN'
  ];
  for(const t of items){
    const dtstart = fmt(t.when);
    const dtend = fmt(new Date(new Date(t.when).getTime() + (t.estimate||1)*25*60*1000));
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${t.id}@focusflow`);
    lines.push(`DTSTAMP:${fmt(new Date())}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${escapeICS(t.title)}`);
    lines.push(`CATEGORIES:${escapeICS(t.category||'General')}`);
    if(t.repeat){ lines.push('RRULE:FREQ=WEEKLY'); }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function escapeICS(s){ return (s||'').replace(/[,;]/g, '\\,'); }

// Notifications & nudges
function canNotify(){ return 'Notification' in window; }
async function notify(title, body){
  if(!canNotify()) return;
  if(Notification.permission==='default'){ await Notification.requestPermission(); }
  if(Notification.permission==='granted'){
    new Notification(title, { body });
  }
}
function maybeScheduleNudge(task){
  // Simple foreground check loop
  const check = ()=>{
    const now = Date.now();
    const when = new Date(task.when).getTime();
    const minsUntil = Math.floor((when - now)/60000);
    if(minsUntil===opts.nudge){ notify('Heads up','You have "'+task.title+'" soon.'); }
  };
  setTimeout(check, 30*1000); // cheap safeguard
}
setInterval(()=>{
  // overdue nudges
  const now = Date.now();
  for(const t of tasks){
    const when = new Date(t.when).getTime();
    if(when<now && (now-when)<5*60*1000){
      notify('Overdue started', t.title);
    }
  }
}, 60000);

// Canvas integration (optional)
$('#btnSync').addEventListener('click', async ()=>{
  const base = $('#canvasBaseUrl').value.trim().replace(/\/$/,'');
  const token = $('#canvasToken').value.trim();
  const status = $('#canvasStatus');
  if(!base || !token){ status.textContent='Base URL and token are required.'; return; }
  status.textContent='Syncing…';
  const start = new Date(); const end = new Date(); end.setDate(end.getDate()+14);
  const url = `${base}/api/v1/planner/items?start_date=${start.toISOString()}&end_date=${end.toISOString()}`;
  try{
    const items = await fetchAll(url, token);
    const assigns = items.filter(i=> i.plannable && i.plannable_type==='assignment');
    let added = 0;
    for(const a of assigns){
      const title = (a.plannable && a.plannable.title) || (a.assignment && a.assignment.name) || 'Assignment';
      const when = (a.plannable && a.plannable.due_at) || a.due_at;
      if(!when) continue;
      if(tasks.some(t=> t.title===title && t.when===when)) continue;
      tasks.push({ id: uid(), title, when, priority: 'next', category: 'Canvas', estimate: 1, repeat: false });
      added++;
    }
    save(); render();
    status.textContent = `Imported ${added} upcoming assignment(s).`;
  }catch(e){
    console.error(e);
    status.textContent = 'Error syncing. Check URL/token and CORS (use in iframe/https).';
  }
});

async function fetchAll(url, token){
  let results = [];
  let nextUrl = url;
  while(nextUrl){
    const res = await fetch(nextUrl, { headers: { 'Authorization': 'Bearer '+token } });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    results = results.concat(data);
    // parse Link header for next
    const link = res.headers.get('Link');
    const next = link && link.split(',').map(s=>s.trim()).find(s=>s.endsWith('rel="next"'));
    nextUrl = next ? next.slice(1,next.indexOf('>')) : null;
  }
  return results;
}

// Init
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
setTimerMinutes(opts.minutes);
render();

// Focus Mode button
$('#btnFocus').addEventListener('click',()=>{
  const t = tasks.slice().sort((a,b)=> priorityRank(a.priority)-priorityRank(b.priority) || new Date(a.when)-new Date(b.when))[0];
  if(!t){ alert('No tasks yet. Add one!'); return; }
  selectFocus(t.id);
  notify('Focus Mode','Heads down for '+opts.minutes+' minutes.');
});
