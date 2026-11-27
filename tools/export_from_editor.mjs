// 커리큘럼 수정 페이지에서 지금 내용을 읽기만 해서 내보냄(시트에 쓰지 않음). 결과는 curriculum-dept-draft/data/site_export.json
// 커리큘럼 수정 웹앱에서 지금 내용을 읽기만 함(load). 시트에 쓰지 않음
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Projects/claude-animation-base/package.json');
const puppeteer = require('puppeteer-core');
const URL_ = 'https://script.google.com/macros/s/AKfycbw7Sz2qMarWhGdmZ1G-9zlaUSRZOTG_o1UlFNaFCRpfN5De78arjCYS2Yvv9HfZYm0/exec';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 });
let f = null;
for (let i = 0; i < 60 && !f; i++) { for (const x of p.frames()) { try { if (await x.$('#app')) { f = x; break; } } catch (_) {} } if (!f) await sleep(500); }
const d = await f.evaluate(() => new Promise((ok, no) => google.script.run.withSuccessHandler(ok).withFailureHandler(e => no(String(e && e.message || e))).load()));
fs.writeFileSync(process.argv[2] || 'D:/Projects/curriculum-dept-draft/data/site_export.json', JSON.stringify(d));
const recs = Object.values(d.records);
console.log('keys', Object.keys(d), 'lines', d.lines.length, 'records', recs.length, 'KB', Math.round(JSON.stringify(d).length / 1024));
console.log('status', JSON.stringify(recs.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})));
console.log('line0 keys', Object.keys(d.lines[0]), 'row keys', [...new Set(d.lines.flatMap(l => (l.rows || []).concat(l.extra || []).flatMap(r => Object.keys(r))))]);
console.log('record keys', Object.keys(recs[0]));
await b.close();
