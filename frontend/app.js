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
let videoTaskIndex = 0;
let cameraStream = null;
let cameraRecorder = null;
let cameraChunks = [];
let videoLabelTimer = null;
const SINGLE_IMAGE_POINTS = 1;
const MULTI_IMAGE_POINTS = 2;
const VIDEO_POINTS = 4;
const VIDEO_CAPTURE_WINDOW_MS = 6000;
const imageResults = [];
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
const emotionFromFile = fileName => {
  if (/^happy\d+\./.test(fileName)) return '开心';
  if (/^sad\d+\./.test(fileName)) return '悲伤';
  if (/^fear\d+\./.test(fileName)) return '恐惧';
  throw new Error(`Unknown image emotion: ${fileName}`);
};
const buildCandidates = files => files.map((fileName, index) => {
  const emotion = emotionFromFile(fileName);
  return { id: String.fromCharCode(65 + index), emotion, url: `/images/${fileName}`, alt: `${emotion}表情图片` };
});
const buildImageTask = ([target, prompt, files], index, mode, points) => ({
  id: `image-${mode}-${index + 1}`,
  mode,
  points,
  prompt,
  target,
  reason: '重点观察眼睛、眉毛、嘴角和整体面部张力。',
  // Keep the configured asset order so every test presents the requested sequence.
  candidates: buildCandidates(files),
});
const imageTasks = [
  ...singleSpecs.map((spec, index) => buildImageTask(spec, index, 'single', SINGLE_IMAGE_POINTS)),
  ...multiSpecs.map((spec, index) => buildImageTask(spec, index, 'multi', MULTI_IMAGE_POINTS)),
];
const videoTasks = [
  { id: 'video-q1', fileName: 'happy-1.mp4', target: '开心' },
  { id: 'video-q2', fileName: 'sad-1.mp4', target: '难过' },
  { id: 'video-q3', fileName: 'fear-1.mp4', target: '害怕' },
];
const videoResults = [];

const isImageComplete = () => imageResults.filter(Boolean).length >= imageTasks.length;
const isVideoComplete = () => videoResults.filter(Boolean).length >= videoTasks.length;
const isAssessmentComplete = () => isImageComplete() && isVideoComplete();
const nextIncompleteScreen = () => (isImageComplete() ? 'video' : 'image');
const formatScore = score => Number.isInteger(score) ? String(score) : score.toFixed(1);

function getRiskBand(score) {
  if (score <= 17) return { label: '高关注 / ASD 一致表现区', explanation: '面部情绪加工或情境归因可能存在较明显困难。建议进行完整发育、语言和 ASD 专业评估，本结果不可直接诊断。' };
  if (score <= 22) return { label: '潜在风险区', explanation: '表现处于边界范围，应结合年龄、语言水平、分项差异和施测状态综合判断，必要时在 6–12 个月后平行复测。' };
  return { label: '低风险 / 典型表现区', explanation: '在本任务中的表现较好，但不能排除 ASD，也不能证明儿童在真实社交情境中没有困难。' };
}

function updateReportAccess() {
  const complete = isAssessmentComplete();
  document.querySelectorAll('[data-report-access]').forEach(button => {
    button.disabled = !complete;
    button.querySelector('[data-report-label]').textContent = complete ? '查看最终报告' : '完成测试后查看报告';
  });
  const resultReportButton = document.querySelector('#screen-result [data-screen="report"]');
  if (!resultReportButton) return;
  resultReportButton.disabled = !complete;
  resultReportButton.textContent = complete ? '查看完整报告　→' : '完成全部测试后查看报告';
}

function updateScoreSummary() {
  const imageScore = imageResults.reduce((sum, item, index) => sum + (item?.correct ? imageTasks[index].points : 0), 0);
  const videoScore = videoResults.reduce((sum, item) => sum + (item?.score || 0), 0);
  const overall = imageScore + videoScore;
  const completedCount = imageResults.filter(Boolean).length + videoResults.filter(Boolean).length;
  const band = getRiskBand(overall);
  document.getElementById('result-score').innerHTML = `${formatScore(overall)}<small> / 30</small>`;
  document.getElementById('report-score').textContent = `${formatScore(overall)} / 30 分`;
  document.getElementById('image-score').textContent = `${formatScore(imageScore)} / 18 分`;
  document.getElementById('video-score').textContent = `${formatScore(videoScore)} / 12 分`;
  document.getElementById('explanation-score').textContent = `${completedCount} / 9 题`;
  document.getElementById('report-breakdown').textContent = `图片 ${formatScore(imageScore)}/18 · 视频 ${formatScore(videoScore)}/12`;
  document.getElementById('result-risk-label').textContent = band.label;
  document.getElementById('result-risk-explanation').textContent = band.explanation;
  document.getElementById('report-risk-label').textContent = band.label;
  document.getElementById('report-risk-explanation').textContent = band.explanation;
  renderItemizedScores();
}

function updateAssessmentCopy() {
  document.querySelector('#screen-result .screen-title small').textContent = '全部 15 题完成后的总分与筛查参考';
  document.querySelector('#screen-result .score-rules').innerHTML = [
    '<span>二选一图像识别</span><b>6 题 × 1 分 = 6 分</b>',
    '<span>三选一图像识别</span><b>6 题 × 2 分 = 12 分</b>',
    '<span>视频表情任务</span><b>3 题 × 4 分 = 12 分</b>',
  ].join('');
  document.querySelector('#screen-report .screen-title small').textContent = '基于 12 道图片题与 3 段视频的筛查参考结果';
  document.querySelector('#screen-report .report-info span:last-child').innerHTML = '任务类型：<b>12 图片 + 3 视频</b>';
  document.querySelector('#screen-report .report-detail-intro').textContent = '图片任务包含 6 道二选一题（每题 1 分）和 6 道三选一题（每题 2 分）；三个视频任务依次使用 happy、sad、fear 文件夹内的标准情绪素材，一致为 4 分，不一致为 0 分。';
}

function renderItemizedScores() {
  const container = document.getElementById('report-itemized-scores');
  if (!container) return;
  const imageRows = imageTasks.map((task, index) => {
    const result = imageResults[index];
    const score = result?.correct ? task.points : 0;
    const answer = result ? `选择 ${result.optionId}` : '未完成';
    const status = result ? (result.correct ? '正确' : '错误') : '待完成';
    return `<li><span class="score-item-title">图片 ${index + 1} · ${task.mode === 'single' ? '二选一' : '三选一'}</span><span>${answer} · ${status}</span><b>${score} / ${task.points} 分</b></li>`;
  }).join('');
  const videoRows = videoTasks.map((task, index) => {
    const result = videoResults[index];
    const captured = result?.emotion || '未完成';
    const status = result ? (result.correct ? '一致' : '不一致') : '待完成';
    const score = result?.score || 0;
    return `<li><span class="score-item-title">视频 ${index + 1} · 目标：${task.target}</span><span>捕捉：${captured} · ${status}</span><b>${score} / ${VIDEO_POINTS} 分</b></li>`;
  }).join('');
  container.innerHTML = `<section><h4>图片任务</h4><ul>${imageRows}</ul></section><section><h4>视频表情任务</h4><ul>${videoRows}</ul></section>`;
}
function renderImageTask() {
  const task = imageTasks[imageTaskIndex];
  const previousResult = imageResults[imageTaskIndex];
  document.getElementById('image-progress').textContent = `${imageTaskIndex + 1} / ${imageTasks.length}`;
  document.getElementById('image-progress-fill').style.width = `${((imageTaskIndex + 1) / imageTasks.length) * 100}%`;
  document.getElementById('image-index').textContent = imageTaskIndex + 1;
  const optionCount = task.candidates.length;
  const taskType = optionCount === 2 ? '二选一图像识别' : '三选一图像识别';
  document.getElementById('image-type-label').textContent = `${taskType} · 每题 ${task.points} 分`;
  document.getElementById('image-hint').textContent = `从 ${optionCount} 张候选图片中选出最符合目标情绪的一张`;
  document.getElementById('image-prompt').textContent = task.prompt;
  const candidates = document.getElementById('image-candidates');
  candidates.className = `image-candidates ${task.mode}`;
  candidates.innerHTML = task.candidates.map(candidate => `<button class="image-candidate${previousResult?.optionId === candidate.id ? ' selected' : ''}" data-option="${candidate.id}" aria-label="选项 ${candidate.id}"><img src="${candidate.url}" alt="${candidate.alt}" /><span>${candidate.id}</span></button>`).join('');
  candidates.querySelectorAll('img').forEach(image => {
    image.addEventListener('error', () => {
      image.closest('.image-candidate')?.classList.add('image-load-error');
      image.alt = '图片暂时无法加载';
      image.style.display = 'none';
    }, { once: true });
  });
  selectedEmotion = previousResult?.optionId || '';
  const confirmButton = document.getElementById('confirm-image');
  confirmButton.disabled = !selectedEmotion;
  confirmButton.textContent = previousResult ? '更新答案并继续　→' : '确定并继续　→';
  document.getElementById('previous-image').disabled = imageTaskIndex === 0;
  document.getElementById('image-feedback').textContent = '选择图片后提交，我们会说明判断依据。';
}
function renderVideoTask() {
  const task = videoTasks[videoTaskIndex];
  document.getElementById('video-progress').textContent = `${videoTaskIndex + 1} / ${videoTasks.length}`;
  document.getElementById('video-progress-fill').style.width = `${((videoTaskIndex + 1) / videoTasks.length) * 100}%`;
  const source = document.querySelector('#task-video source');
  source.src = `/media/videos/${task.fileName}`;
  const taskVideo = document.getElementById('task-video');
  taskVideo.loop = true;
  taskVideo.load();
  taskVideo.currentTime = 0;
  if (document.getElementById('screen-video').classList.contains('active')) {
    taskVideo.play().catch(() => {
      document.getElementById('video-state').textContent = '视频已就绪。请使用播放控件开始循环播放，然后开始捕捉与评分。';
    });
  }
  const previousResult = videoResults[videoTaskIndex];
  const button = document.getElementById('confirm-video');
  if (previousResult) {
    button.textContent = videoTaskIndex < videoTasks.length - 1 ? '下一段视频　→' : '查看评估结果　→';
    document.getElementById('video-state').textContent = '本题分析结果已在后台保存。视频会继续循环，点击按钮进入下一步。';
  } else {
    button.textContent = '开始捕捉并评分　→';
    document.getElementById('video-state').textContent = '视频正在循环播放。点击开始后，系统将捕捉 6 秒面部表情并评分。';
  }
}

function showTransientVideoLabel() {
  const label = document.querySelector('.task-video-box .video-label');
  if (!label) return;
  window.clearTimeout(videoLabelTimer);
  label.classList.add('is-visible');
  videoLabelTimer = window.setTimeout(() => label.classList.remove('is-visible'), 2200);
}

async function captureCameraFrames(stream) {
  const cameraFeed = document.getElementById('camera-feed');
  const placeholder = document.getElementById('camera-placeholder');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const frames = [];
  cameraFeed.srcObject = stream;
  placeholder.hidden = true;
  await cameraFeed.play();
  const deadline = performance.now() + VIDEO_CAPTURE_WINDOW_MS;
  while (performance.now() < deadline) {
    const width = Math.min(cameraFeed.videoWidth || 320, 320);
    const height = Math.round(width / Math.max((cameraFeed.videoWidth || 320) / (cameraFeed.videoHeight || 240), 1));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(cameraFeed, 0, 0, width, height);
    frames.push(canvas.toDataURL('image/jpeg', 0.68).split(',')[1]);
    await new Promise(resolve => window.setTimeout(resolve, 500));
  }
  return frames;
}

function clearCameraPreview() {
  const cameraFeed = document.getElementById('camera-feed');
  const placeholder = document.getElementById('camera-placeholder');
  if (cameraFeed) {
    cameraFeed.pause();
    cameraFeed.srcObject = null;
  }
  if (placeholder) placeholder.hidden = false;
}

if (window.lucide) window.lucide.createIcons();

function showScreen(name) {
  if ((name === 'result' || name === 'report') && !isAssessmentComplete()) {
    name = nextIncompleteScreen();
    const pendingState = name === 'image'
      ? '请先完成全部图片题，再生成最终报告。'
      : '图片任务已完成，请先完成视频分析，再生成最终报告。';
    const videoState = document.getElementById('video-state');
    if (videoState && name === 'video') videoState.textContent = pendingState;
    const imageFeedback = document.getElementById('image-feedback');
    if (imageFeedback && name === 'image') imageFeedback.textContent = pendingState;
  }
  screens.forEach(screen => document.getElementById(`screen-${screen}`).classList.toggle('active', screen === name));
  document.body.classList.toggle('is-home', name === 'home');
  document.querySelectorAll('.nav-link').forEach(link => {
    const destination = link.dataset.screen;
    link.classList.toggle('active', destination === name || (destination === 'image' && name === 'image') || (destination === 'video' && name === 'video'));
  });
  const taskVideo = document.getElementById('task-video');
  if (name === 'video') {
    showTransientVideoLabel();
    taskVideo?.play().catch(() => {});
  } else {
    taskVideo?.pause();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.screen)));
document.getElementById('image-candidates').addEventListener('click', event => {
  const candidate = event.target.closest('.image-candidate');
  if (!candidate) return;
  document.querySelectorAll('.image-candidate').forEach(item => item.classList.remove('selected'));
  candidate.classList.add('selected');
  selectedEmotion = candidate.dataset.option;
  document.getElementById('confirm-image').disabled = false;
});

document.getElementById('previous-image').addEventListener('click', () => {
  if (imageTaskIndex === 0) return;
  imageTaskIndex -= 1;
  renderImageTask();
});

document.querySelectorAll('.emotion-option').forEach(button => button.addEventListener('click', () => {
  const group = button.closest('.answer-panel, .video-answers');
  group.querySelectorAll('.emotion-option').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  selectedEmotion = button.dataset.emotion;
}));

document.getElementById('confirm-image').addEventListener('click', async () => {
  const button = document.getElementById('confirm-image');
  const task = imageTasks[imageTaskIndex];
  if (!selectedEmotion) return;
  button.disabled = true;
  button.textContent = '正在分析…';
  const result = await api('/api/answers/image', {
    method: 'POST',
    body: JSON.stringify({ taskId: task.id, optionId: selectedEmotion })
  });
  const isCorrect = selectedEmotion === task.candidates.find(candidate => candidate.emotion === task.target)?.id;
  imageResults[imageTaskIndex] = { mode: task.mode, emotion: task.target, correct: isCorrect, optionId: selectedEmotion };
  updateScoreSummary();
  document.getElementById('image-feedback').textContent = isCorrect ? `判断正确！${task.reason}` : `再观察一下。${task.reason}`;
  if (imageTaskIndex < imageTasks.length - 1) {
    imageTaskIndex += 1;
    renderImageTask();
    return;
  }
  updateReportAccess();
  button.disabled = false;
  button.textContent = '图片任务已完成';
  showScreen(isVideoComplete() ? 'result' : 'video');
});
document.getElementById('confirm-video').addEventListener('click', async () => {
  const button = document.getElementById('confirm-video');
  const task = videoTasks[videoTaskIndex];
  const state = document.getElementById('video-state');
  const taskVideo = document.getElementById('task-video');
  if (videoResults[videoTaskIndex]) {
    if (videoTaskIndex < videoTasks.length - 1) {
      videoTaskIndex += 1;
      renderVideoTask();
      return;
    }
    if (isAssessmentComplete()) showScreen('result');
    else {
      state.textContent = '视频任务已完成，请继续完成图片任务后查看最终报告。';
      document.getElementById('continue-image').hidden = false;
    }
    return;
  }
  button.disabled = true;
  state.textContent = '正在启动面部表情捕捉…';
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (cameraError) {
        throw new Error(`未能启用摄像头：${cameraError.message}`);
      }
    } else {
      throw new Error('当前浏览器不支持摄像头采集');
    }
    showTransientVideoLabel();
    state.textContent = '视频将持续循环，正在捕捉 6 秒面部表情…';
    await taskVideo.play();
    const frames = await captureCameraFrames(cameraStream);
    state.textContent = '表情捕捉完成，正在生成识别结果…';
    const analysis = await api('/api/video/analyze', { method: 'POST', body: JSON.stringify({ taskId: task.id, fileName: task.fileName, target: task.target, frames }) });
    if (!analysis) throw new Error('摄像头情绪模型未返回结果，请确认模型依赖已安装');
    const isCorrect = analysis.isCorrect ?? analysis.isMatch ?? analysis.emotion === task.target;
    const score = analysis.score ?? (isCorrect ? VIDEO_POINTS : 0);
    videoResults[videoTaskIndex] = { correct: isCorrect, emotion: analysis.emotion, confidence: analysis.confidence, score };
    updateScoreSummary();
    state.textContent = '本题分析完成，结果已在后台保存。视频会继续循环，点击下一段视频继续。';
    button.disabled = false;
    button.textContent = videoTaskIndex < videoTasks.length - 1 ? '下一段视频　→' : '查看评估结果　→';
    document.getElementById('continue-image').hidden = isImageComplete();
    updateReportAccess();
  } catch (error) {
    state.textContent = `表情分析失败：${error.message}`;
    button.disabled = false;
    button.textContent = '重新捕捉并评分　→';
  } finally {
    cameraRecorder = null;
    cameraChunks = [];
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    clearCameraPreview();
  }
});
document.getElementById('print-report').addEventListener('click', () => window.print());

async function hydrate() {
  document.body.classList.add('is-home');
  updateAssessmentCopy();
  renderImageTask();
  renderVideoTask();
  const session = await api('/api/session');
  if (session) document.querySelector('.api-status').innerHTML = `<i></i> 数据已同步 · ${session.completed}/${session.total}`;
  updateScoreSummary();
  updateReportAccess();
}

hydrate();
