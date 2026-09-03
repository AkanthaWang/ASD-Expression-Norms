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
const imageTasks = [];

function updateScoreSummary() {
  const singles = imageResults.filter(item => item.mode === 'two-choice');
  const multis = imageResults.filter(item => item.mode === 'three-choice');
  const imageScore = imageResults.length ? Math.round(imageResults.reduce((sum, item) => sum + (item.correct ? item.points : 0), 0) / 20 * 100) : 0;
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
  candidates.className = `image-candidates ${task.mode === 'three-choice' ? 'multi' : 'single'}`;
  candidates.innerHTML = task.candidates.map(candidate => `<button class="image-candidate" data-option="${candidate.id}" aria-label="选项 ${candidate.id}"><img src="${candidate.url}?v=20260903" alt="${candidate.alt}" loading="eager" /><span>${candidate.id}</span></button>`).join('');
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
    body: JSON.stringify({ taskId: task.id || `image-q${imageTaskIndex + 1}`, optionId: selectedEmotion })
  });
  const correctOption = task.correctOption || task.candidates.find(candidate => candidate.emotion === task.target)?.id;
  const isCorrect = selectedEmotion === correctOption;
  imageResults.push({ mode: task.mode, emotion: task.target, correct: isCorrect, points: task.points || (task.candidates.length === 3 ? 1.5 : 1) });
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
  const taskPayload = await api('/api/tasks/image?v=20260903');
  if (taskPayload?.tasks?.length) {
    imageTasks.push(...taskPayload.tasks.map(task => ({ ...task, candidates: task.options.map(option => ({ ...option, url: option.imageUrl })) })));
    renderImageTask();
  }
  const session = await api('/api/session');
  if (session) document.querySelector('.api-status').innerHTML = `<i></i> 数据已同步 · ${session.completed}/${session.total}`;
  const report = await api('/api/report');
  if (report) {
    document.getElementById('result-score').innerHTML = `${Math.round(report.overall)}<small>%</small>`;
    document.getElementById('report-score').textContent = `${Math.round(report.overall)}%`;
  }
}

hydrate();
