const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const FRONTEND_ROOT = path.join(ROOT, 'frontend');
const IMAGE_ROOT = path.join(ROOT, 'data', 'images');
const VIDEO_ROOT = path.join(ROOT, 'data', 'videos');
const imageTasks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'annotations', 'image_tasks.json'), 'utf8'));
const imageTask = imageTasks[0];
const state = {
  session: {
    id: 'demo-session-001',
    childName: '乐乐小朋友',
    status: '进行中',
    completed: 1,
    total: 4,
  },
  imageAnswers: [],
};


const videoAnalysis = {
  emotion: '开心', confidence: 0.87,
  features: ['嘴角上扬，形成自然笑容', '眉部舒展，眼睛轻微眯起', '表情保持稳定，持续约 6 秒'],
  durationSeconds: 6,
  explanation: '嘴角上扬、眉部舒展，整体面部动作符合开心表达。',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1000000) reject(new Error('payload too large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}

function report() {
  const answered = state.imageAnswers.length;
  const correct = state.imageAnswers.filter(item => item.isCorrect).length;
  const imageScore = answered ? Math.round((correct / answered) * 100) : 90;
  return {
    sessionId: state.session.id,
    scores: { imageChoice: imageScore, imageMulti: 80, video: 82, explanation: 82 },
    overall: Number(((imageScore + 80 + 82 + 82) / 4).toFixed(1)),
    conclusion: '整体情绪识别能力较好！',
    insights: [
      { title: '开心表情', detail: `识别正确率最高 · ${imageScore}%` },
      { title: '眼睛线索', detail: '能注意到眉眼的变化' },
      { title: '继续探索', detail: '试着观察更多情绪吧' },
    ],
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'expression-norms-api', version: '1.0.0' });
  if (req.method === 'GET' && url.pathname === '/api/session') return sendJson(res, 200, state.session);
  if (req.method === 'GET' && url.pathname === '/api/tasks/image') return sendJson(res, 200, { tasks: imageTasks, total: imageTasks.length, maxScore: 20 });
  if (req.method === 'GET' && url.pathname === '/api/video/sample') return sendJson(res, 200, videoAnalysis);
  if (req.method === 'GET' && url.pathname === '/api/report') return sendJson(res, 200, report());
  if (req.method === 'POST' && url.pathname === '/api/answers/image') {
    try {
      const body = await readJson(req);
      const task = imageTasks.find(item => item.id === body.taskId) || imageTask;
      if (!task.options.some(item => item.id === body.optionId)) return sendJson(res, 400, { error: 'invalid optionId' });
      const isCorrect = body.optionId === task.correctOption;
      const score = isCorrect ? task.points : 0;
      state.imageAnswers.push({ taskId: task.id, optionId: body.optionId, isCorrect, score, answeredAt: new Date().toISOString() });
      return sendJson(res, 200, { taskId: task.id, optionId: body.optionId, isCorrect, score, points: task.points, feedback: isCorrect ? '答对啦！这张图片符合目标情绪。' : '再观察一下眼睛、眉毛和嘴角的变化吧。' });
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/video/analyze') return sendJson(res, 200, { ...videoAnalysis, source: 'demo-model', fileName: (await readJson(req).catch(() => ({}))).fileName || null });
  if (req.method === 'POST' && url.pathname === '/api/session/reset') { state.imageAnswers = []; return sendJson(res, 200, { ...state.session, completed: 1 }); }
  return sendJson(res, 404, { error: 'API route not found' });
}

function serveStatic(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const root = requested.startsWith('/images/') ? IMAGE_ROOT : requested.startsWith('/videos/') ? VIDEO_ROOT : FRONTEND_ROOT;
  const relative = requested.startsWith('/images/') ? requested.slice('/images'.length) : requested.startsWith('/videos/') ? requested.slice('/videos'.length) : requested;
  const filePath = path.resolve(root, '.' + relative);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(res, 404, { error: 'Not found' });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' };
  res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  serveStatic(res, url.pathname);
});

server.listen(PORT, () => console.log(`Expression Norms web app running at http://localhost:${PORT}`));
