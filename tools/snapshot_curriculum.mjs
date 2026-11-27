// 예비본 만들기: 수정 페이지 지금 내용 → curriculum/data.json
// (평소엔 api/curriculum.js가 자동으로 받아 오고, 그게 안 될 때만 화면이 이 파일을 씀)
//   node tools/snapshot_curriculum.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { transform, GAS_SITE_URL } = require('../api/_cx_transform.js');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'curriculum', 'data.json');
const r = await fetch(GAS_SITE_URL, { redirect: 'follow' });
if (!r.ok) throw new Error('수정 페이지 응답 ' + r.status);
const d = transform(await r.json());
fs.writeFileSync(out, JSON.stringify(d));
console.log('lines', d.lines.length, 'records', Object.keys(d.records).length, 'KB', Math.round(fs.statSync(out).size / 1024));
