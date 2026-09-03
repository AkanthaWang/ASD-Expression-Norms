const screens = ['home', 'image', 'video', 'result', 'report'];
const api = async (url, options) => {
  try {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.info('演示模式：接口不可用', error.message);
    return null;
  }
};

let selectedEmotion = '开心';
let imageTaskIndex = 0;
let cameraStream = null;
const imageResults = [];
let videoAssessment = null;
const imageTasks = [
  { mode: 'single', prompt: '下面哪张图片是开心的？', target: '开心', reason: '重点观察嘴角是否上扬、眼睛是否舒展。', candidates: [
    { id: 'A', emotion: '开心', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=700&q=85', alt: '微笑的人物' },
    { id: 'B', emotion: '悲伤', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=85', alt: '悲伤的人物' }
  ]},
  { mode: 'multi', prompt: '在这些图片中，哪一张表达了快乐？', target: '开心', reason: '快乐通常表现为嘴角上扬、面部肌肉放松。', candidates: [
    { id: 'A', emotion: '中性', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=85', alt: '平静的人物' },
    { id: 'B', emotion: '开心', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=85', alt: '开心的人物' },
    { id: 'C', emotion: '惊讶', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=500&q=85', alt: '惊讶的人物' },
    { id: 'D', emotion: '愤怒', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=85', alt: '严肃的人物' }
  ]},
  { mode: 'single', prompt: '下面哪张图片更能体现惊讶情绪？', target: '惊讶', reason: '惊讶时眉毛上扬、眼睛睁大，嘴巴可能张开。', candidates: [
    { id: 'A', emotion: '惊讶', url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=700&q=85', alt: '惊讶的人物' },
    { id: 'B', emotion: '中性', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=85', alt: '中性的人物' }
  ]}
];

function updateScoreSummary() {
  const singles = imageResults.filter(item => item.mode === 'single');
  const multis = imageResults.filter(item => item.mode === 'multi');
  const imageScore = imageResults.length ? Math.round(imageResults.filter(item => item.correct).length / imageResults.length * 100) : 0;
  const singleScore = singles.length ? Math.round(singles.filter(item => item.correct).length / singles.length * 100) : 0;
  const multiScore = multis.length ? Math.round(multis.filter(item => item.correct).length / multis.length * 100) : 0;
  const videoScore = videoAssessment ? Math.round((videoAssessment.confidence || 0) * 100) : 0;
  const explanationScore = videoAssessment ? Math.min(100, 70 + (videoAssessment.features?.length || 0) * 5) : 0;
  const overall = Math.round((imageScore + videoScore + explanationScore) / 3);
  document.getElementById('result-score').innerHTML = `${overall}<small>%</small>`;
  document.getElementById('report-score').textContent = `${overall}%`;
  document.getElementById('image-single-score').textContent = `${singleScore}%`;
  document.getElementById('image-multi-score').textContent = `${multiScore}%`;
  document.getElementById('video-score').textContent = videoAssessment ? `${videoScore}%` : '--';
  document.getElementById('explanation-score').textContent = videoAssessment ? `${explanationScore}%` : '--';
  document.getElementById('report-breakdown').textContent = `图像任务 ${imageScore}% · 视频任务 ${videoScore || '--'}%`;
}
function renderImageTask() {
  const task = imageTasks[imageTaskIndex];
  document.getElementById('image-progress').textContent = `${imageTaskIndex + 1} / ${imageTasks.length}`;
  document.getElementById('image-progress-fill').style.width = `${((imageTaskIndex + 1) / imageTasks.length) * 100}%`;
  document.getElementById('image-index').textContent = imageTaskIndex + 1;
  document.getElementById('image-prompt').textContent = task.prompt;
  const candidates = document.getElementById('image-candidates');
  candidates.className = `image-candidates ${task.mode === 'multi' ? 'multi' : 'single'}`;
  candidates.innerHTML = task.candidates.map(candidate => `<button class="image-candidate" data-option="${candidate.id}" aria-label="选项 ${candidate.id}"><img src="${candidate.url}" alt="${candidate.alt}" /><span>${candidate.id}</span></button>`).join('');
  selectedEmotion = '';
}
if (window.lucide) window.lucide.createIcons();

function showScreen(name) {
  screens.forEach(screen => document.getElementById(`screen-${screen}`).classList.toggle('active', screen === name));
  document.querySelectorAll('.nav-link').forEach(link => {
    const destination = link.dataset.screen;
    link.classList.toggle('active', destination === name || (destination === 'image' && name === 'image') || (destination === 'video' && name === 'video'));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.screen)));
document.getElementById('image-candidates').addEventListener('click', event => {
  const candidate = event.target.closest('.image-candidate');
  if (!candidate) return;
  document.querySelectorAll('.image-candidate').forEach(item => item.classList.remove('selected'));
  candidate.classList.add('selected');
  selectedEmotion = candidate.dataset.option;
});

document.querySelectorAll('.emotion-option').forEach(button => button.addEventListener('click', () => {
  const group = button.closest('.answer-panel, .video-answers');
  group.querySelectorAll('.emotion-option').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  selectedEmotion = button.dataset.emotion;
}));

document.getElementById('confirm-image').addEventListener('click', async () => {
  const button = document.getElementById('confirm-image');
  button.disabled = true;
  button.textContent = '正在分析…';
  const task = imageTasks[imageTaskIndex];
  const result = await api('/api/answers/image', {
    method: 'POST',
    body: JSON.stringify({ taskId: `image-q${imageTaskIndex + 1}`, optionId: selectedEmotion === task.candidates.find(candidate => candidate.emotion === task.target)?.id ? 'A' : 'B' })
  });
  const isCorrect = selectedEmotion === task.candidates.find(candidate => candidate.emotion === task.target)?.id;
  imageResults.push({ mode: task.mode, emotion: task.target, correct: isCorrect });
  updateScoreSummary();
  document.getElementById('image-feedback').textContent = isCorrect ? `判断正确！${task.reason}` : `再观察一下。${task.reason}`;
  if (imageTaskIndex < imageTasks.length - 1) {
    imageTaskIndex += 1;
    renderImageTask();
    button.disabled = false;
    button.textContent = '确定并继续　→';
    return;
  }
  document.getElementById('result-score').innerHTML = '85<small>%</small>';
  document.getElementById('report-score').textContent = '85%';
  button.disabled = false;
  button.textContent = '确定并继续　→';
  showScreen('result');
});
document.getElementById('confirm-video').addEventListener('click', async () => {
  const button = document.getElementById('confirm-video');
  const state = document.getElementById('video-state');
  const resultPanel = document.getElementById('video-result');
  const feed = document.getElementById('camera-feed');
  const placeholder = document.getElementById('camera-placeholder');
  const badge = document.getElementById('camera-badge');
  button.disabled = true;
  state.textContent = '正在请求摄像头权限…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持摄像头访问');
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    feed.srcObject = cameraStream;
    placeholder.hidden = true;
    badge.textContent = '摄像头已开启';
    badge.classList.add('active');
    state.textContent = '正在观察表情变化…';
    document.getElementById('camera-preview').classList.add('analyzing');
    await new Promise(resolve => setTimeout(resolve, 1200));
    const result = await api('/api/video/analyze', { method: 'POST', body: JSON.stringify({ fileName: 'camera-session' }) });
    const analysis = result || { emotion: '开心', confidence: 0.87, features: ['嘴角上扬，形成自然笑容', '眉部舒展，眼睛轻微眯起', '表情保持稳定，持续约 6 秒'], explanation: '嘴角上扬、眉部舒展，整体面部动作符合开心表达。' };
    videoAssessment = analysis;
    updateScoreSummary();
    document.getElementById('video-emotion').textContent = analysis.emotion;
    document.getElementById('video-confidence').textContent = `${Math.round((analysis.confidence || 0) * 100)}% 置信度`;
    document.getElementById('video-features').innerHTML = (analysis.features || []).map(feature => `<li>${feature}</li>`).join('');
    document.getElementById('video-explanation').textContent = analysis.explanation || '面部动作模式与该情绪表达相符。';
    document.getElementById('video-timeline').textContent = '0–2 秒：表情逐渐形成；2–6 秒：情绪保持稳定；整体未发现明显情绪转折。';
    state.textContent = '分析完成';
    resultPanel.hidden = false;
    button.disabled = false;
    button.textContent = '重新分析　→';
    document.getElementById('camera-preview').classList.remove('analyzing');
  } catch (error) {
    state.textContent = `无法开启摄像头：${error.message}`;
    button.disabled = false;
    button.textContent = '重试并开启摄像头　→';
    document.getElementById('camera-preview').classList.remove('analyzing');
  }
});
document.getElementById('print-report').addEventListener('click', () => window.print());

async function hydrate() {
  renderImageTask();
  const session = await api('/api/session');
  if (session) document.querySelector('.api-status').innerHTML = `<i></i> 数据已同步 · ${session.completed}/${session.total}`;
  const report = await api('/api/report');
  if (report) {
    document.getElementById('result-score').innerHTML = `${Math.round(report.overall)}<small>%</small>`;
    document.getElementById('report-score').textContent = `${Math.round(report.overall)}%`;
  }
}

hydrate();
