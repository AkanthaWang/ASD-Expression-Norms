const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const PYTHON_EXECUTABLE = process.env.PYTHON || (fs.existsSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe')) ? path.join(ROOT, '.venv', 'Scripts', 'python.exe') : 'python');
const FRONTEND_ROOT = path.join(ROOT, 'frontend');
const IMAGE_ROOT = path.join(ROOT, 'data', 'images');
const VIDEO_FILES = {
  'happy-1.mp4': path.join(ROOT, 'data', 'videos', 'happy', 'happy_1.mp4'),
  'sad-1.mp4': path.join(ROOT, 'data', 'videos', 'sad', 'sad_1.mp4'),
  'fear-1.mp4': path.join(ROOT, 'data', 'videos', 'fear', 'fear_1.mp4'),
};
const IMAGE_TASK_COUNT = 12;
const VIDEO_TASK_COUNT = 3;
const SINGLE_IMAGE_POINTS = 1;
const MULTI_IMAGE_POINTS = 2;
const VIDEO_POINTS = 4;
const VIDEO_TASKS = {
  'video-q1': { fileName: 'happy-1.mp4', target: '开心' },
  'video-q2': { fileName: 'sad-1.mp4', target: '难过' },
  'video-q3': { fileName: 'fear-1.mp4', target: '害怕' },
};
const state = {
  session: {
    id: 'demo-session-001',
    childName: '乐乐小朋友',
    status: '进行中',
    completed: 0,
    total: IMAGE_TASK_COUNT + VIDEO_TASK_COUNT,
  },
  imageAnswers: [],
  videoAnswers: [],
};

const singleSpecs = [
  ['开心', '下面哪张图片是开心的？', ['happy1.jpg', 'sad1.jpg']],
  ['悲伤', '下面哪张图片更能体现悲伤情绪？', ['happy2.jpg', 'sad2.jpg']],
  ['恐惧', '下面哪张图片更能体现恐惧情绪？', ['fear1.jpg', 'happy3.jpg']],
  ['悲伤', '哪一张图片表现出悲伤情绪？', ['sad3.jpg', 'happy4.jpg']],
  ['恐惧', '哪一张图片表现出恐惧情绪？', ['happy5.jpg', 'fear2.jpg']],
  ['悲伤', '哪一张图片表现出低落情绪？', ['happy6.jpg', 'sad4.jpg']],
];
const multiSpecs = [
  ['开心', '在这 3 张图片中，哪一张表达了快乐？', ['happy7.jpg', 'sad5.jpg', 'fear3.jpg']],
  ['悲伤', '在这 3 张图片中，哪一张表达了悲伤？', ['happy8.jpg', 'sad6.jpg', 'happy9.jpg']],
  ['开心', '从 3 张图片中找出自然微笑的表情。', ['happy10.jpg', 'sad7.jpg', 'sad8.jpg']],
  ['悲伤', '从 3 张图片中找出悲伤的表情。', ['happy11.jpg', 'sad9.jpg', 'happy12.jpg']],
  ['开心', '从 3 张图片中找出自然微笑的表情。', ['happy13.jpg', 'sad10.jpg', 'sad11.jpg']],
  ['悲伤', '从 3 张图片中找出悲伤的表情。', ['happy14.jpg', 'sad12.jpg', 'happy15.jpg']],
];
function emotionFromFile(fileName) {
  if (/^happy\d+\./.test(fileName)) return '开心';
  if (/^sad\d+\./.test(fileName)) return '悲伤';
  if (/^fear\d+\./.test(fileName)) return '恐惧';
  throw new Error(`Unknown image emotion: ${fileName}`);
}
function buildImageOptions(fileNames) {
  return fileNames.map((fileName, index) => {
    const emotion = emotionFromFile(fileName);
    return { id: String.fromCharCode(65 + index), label: String.fromCharCode(65 + index), emotion, imageUrl: `/images/${fileName}`, url: `/images/${fileName}`, alt: `${emotion}表情图片` };
  });
}
function buildImageTask([emotion, prompt, files], index, mode, points) {
  const targetFile = files.find(file => emotionFromFile(file) === emotion);
  const correctIndex = files.indexOf(targetFile);
  const options = buildImageOptions(files);
  return { id: `image-${mode}-${index + 1}`, type: mode === 'single' ? 'single-choice' : 'multi-choice', mode, points, emotion, target: emotion, prompt, reason: '重点观察眼睛、眉毛、嘴角和整体面部张力。', correctOption: String.fromCharCode(65 + correctIndex), options };
}
const imageTasks = [
  ...singleSpecs.map((spec, index) => buildImageTask(spec, index, 'single', SINGLE_IMAGE_POINTS)),
  ...multiSpecs.map((spec, index) => buildImageTask(spec, index, 'multi', MULTI_IMAGE_POINTS)),
];

function videoAnalysis(task = VIDEO_TASKS['video-q1']) {
  return {
    emotion: task.target,
    confidence: 0.87,
    targetEmotion: task.target,
    isMatch: true,
    features: ['嘴角、眉眼等动作变化与目标情绪相符', '面部动作保持稳定', '系统在后台完成本题分析'],
    durationSeconds: 6,
    explanation: `捕捉到的面部动作模式与目标“${task.target}”情绪表达相符。`,
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 4_000_000) reject(new Error('payload too large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}

function riskBand(score) {
  if (score <= 17) return { label: '高关注 / ASD 一致表现区', explanation: '面部情绪加工或情境归因存在较明显困难。建议进行完整发育、语言和 ASD 专业评估，本结果不可直接诊断。' };
  if (score <= 22) return { label: '潜在风险区', explanation: '表现处于边界范围。应结合年龄、语言水平、分项差异、施测状态和家庭/园所观察，必要时在 6–12 个月后使用平行题复测。' };
  return { label: '低风险 / 典型表现区', explanation: '在本任务中的表现较好，但不能排除 ASD，也不能证明儿童在真实社交情境中没有困难。' };
}

function updateSessionProgress() {
  state.session.completed = state.imageAnswers.length + state.videoAnswers.length;
  state.session.status = state.session.completed === state.session.total ? '已完成' : '进行中';
}

function upsertAnswer(collection, answer) {
  const index = collection.findIndex(item => item.taskId === answer.taskId);
  if (index >= 0) collection[index] = answer;
  else collection.push(answer);
}

function analyzeCapturedFrames(task, frames) {
  if (!Array.isArray(frames) || frames.length === 0) return Promise.reject(new Error('未收到摄像头采集画面'));
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_EXECUTABLE, ['-m', 'video_emotion_model.frame_cli'], { cwd: ROOT, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => reject(new Error(`无法启动摄像头情绪模型：${error.message}`)));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(stderr.trim() || `摄像头情绪模型退出，状态码 ${code}`));
      try {
        const jsonLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
        resolve(JSON.parse(jsonLine));
      } catch (error) {
        reject(new Error(`无法读取摄像头情绪模型结果：${error.message}`));
      }
    });
    child.stdin.end(JSON.stringify({ frames, targetEmotion: task.target }));
  });
}
function report() {
  const imageScore = state.imageAnswers
    .filter(item => item.isCorrect)
    .reduce((total, item) => total + item.points, 0);
  const videoScore = state.videoAnswers
    .filter(item => item.isCorrect)
    .reduce((total, item) => total + item.points, 0);
  const overall = imageScore + videoScore;
  const band = riskBand(overall);
  const details = {
    images: state.imageAnswers.map(answer => {
      const task = imageTasks.find(item => item.id === answer.taskId);
      return { taskId: answer.taskId, taskType: answer.type, target: task?.target, selectedOption: answer.optionId, isCorrect: answer.isCorrect, score: answer.isCorrect ? answer.points : 0, maxScore: answer.points };
    }),
    videos: state.videoAnswers.map(answer => {
      const task = VIDEO_TASKS[answer.taskId];
      return { taskId: answer.taskId, target: task?.target, capturedEmotion: answer.emotion, isMatch: answer.isCorrect, score: answer.isCorrect ? answer.points : 0, maxScore: VIDEO_POINTS };
    }),
  };
  return {
    sessionId: state.session.id,
    scores: { image: imageScore, video: videoScore, total: overall },
    overall,
    total: 30,
    risk: band,
    conclusion: band.label,
    insights: [
      { title: '图片情绪识别', detail: `${imageScore} / 18 分` },
      { title: '视频表情任务', detail: `${videoScore} / 12 分` },
    ],
    details,
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'expression-norms-api', version: '1.0.0' });
  if (req.method === 'GET' && url.pathname === '/api/session') {
    return sendJson(res, 200, state.session);
  }
  if (req.method === 'GET' && url.pathname === '/api/tasks/image') return sendJson(res, 200, { version: 'demo-2.1', total: imageTasks.length, tasks: imageTasks });
  if (req.method === 'GET' && url.pathname === '/api/video/sample') return sendJson(res, 200, videoAnalysis());
  if (req.method === 'GET' && url.pathname === '/api/report') {
    if (state.session.completed < state.session.total) {
      return sendJson(res, 409, { error: '请完成全部图片和视频测试后再生成最终报告' });
    }
    return sendJson(res, 200, report());
  }
  if (req.method === 'POST' && url.pathname === '/api/answers/image') {
    try {
      const body = await readJson(req);
      const taskId = body.taskId;
      const task = imageTasks.find(item => item.id === taskId);
      if (!task || !task.options.some(option => option.id === body.optionId)) return sendJson(res, 400, { error: 'invalid image task or option' });
      const type = task.mode;
      const points = task.points;
      const isCorrect = body.optionId === task.correctOption;
      const answer = { taskId, type, optionId: body.optionId, isCorrect, points, answeredAt: new Date().toISOString() };
      upsertAnswer(state.imageAnswers, answer);
      updateSessionProgress();
      return sendJson(res, 200, { taskId, optionId: body.optionId, isCorrect, score: isCorrect ? points : 0, feedback: isCorrect ? '判断正确。' : '再观察一下嘴角、眉眼和整体面部张力。' });
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/video/analyze') {
    const body = await readJson(req).catch(() => ({}));
    const task = VIDEO_TASKS[body.taskId];
    if (!task) return sendJson(res, 400, { error: 'invalid video task' });
    let analysis;
    try {
      analysis = await analyzeCapturedFrames(task, body.frames);
    } catch (error) {
      return sendJson(res, 422, { error: error.message });
    }
    const isCorrect = analysis.isMatch === true;
    upsertAnswer(state.videoAnswers, { taskId: body.taskId, isCorrect, points: VIDEO_POINTS, emotion: analysis.emotion, target: task.target, answeredAt: new Date().toISOString() });
    updateSessionProgress();
    return sendJson(res, 200, { ...analysis, isCorrect, score: isCorrect ? VIDEO_POINTS : 0, source: analysis.source || 'opencv-deepface', fileName: task.fileName });
  }
  if (req.method === 'POST' && url.pathname === '/api/session/reset') {
    state.imageAnswers = [];
    state.videoAnswers = [];
    updateSessionProgress();
    return sendJson(res, 200, state.session);
  }
  return sendJson(res, 404, { error: 'API route not found' });
}

function serveVideo(req, res, pathname) {
  const fileName = path.basename(pathname);
  const filePath = VIDEO_FILES[fileName];
  if (!filePath || !fs.existsSync(filePath)) return sendJson(res, 404, { error: 'Video not found' });

  const size = fs.statSync(filePath).size;
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    return fs.createReadStream(filePath).pipe(res);
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }
  res.writeHead(206, {
    'Content-Type': 'video/mp4',
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Accept-Ranges': 'bytes',
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

function serveStatic(res, pathname) {
  const isImage = pathname.startsWith('/images/');
  const root = isImage ? IMAGE_ROOT : FRONTEND_ROOT;
  const relative = isImage ? pathname.slice('/images/'.length) : (pathname === '/' ? 'index.html' : pathname.slice(1));
  const filePath = path.resolve(root, relative);
  if ((filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(res, 404, { error: 'Not found' });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  if (url.pathname.startsWith('/media/videos/')) return serveVideo(req, res, url.pathname);
  serveStatic(res, url.pathname);
});

server.listen(PORT, () => console.log(`Expression Norms web app running at http://localhost:${PORT}`));
