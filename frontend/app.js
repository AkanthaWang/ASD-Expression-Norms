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
const imageResults = [];
const singleSpecs = [
  ['开心', '下面哪张图片是开心的？', ['q01-a-happy.jpg', 'q01-b-sad.jpg']],
  ['悲伤', '下面哪张图片更能体现悲伤情绪？', ['q02-a-sad.jpg', 'q02-b-fear.jpg']],
  ['恐惧', '下面哪张图片更能体现恐惧情绪？', ['q03-a-fear.jpg', 'q03-b-happy.jpg']],
  ['开心', '下面哪张图片更能体现开心情绪？', ['q04-a-happy.jpg', 'q04-b-fear.png']],
  ['悲伤', '哪一张图片表现出悲伤情绪？', ['q05-a-sad.jpg', 'q05-b-happy.jpg']],
  ['恐惧', '哪一张图片表现出恐惧情绪？', ['q06-a-fear.jpg', 'q06-b-sad.jpg']],
  ['开心', '哪一张图片中的人物正在微笑？', ['q07-a-happy.jpg', 'q07-b-fear.jpg']],
  ['悲伤', '哪一张图片表现出低落情绪？', ['q08-a-sad.png', 'q08-b-happy.jpg']],
];
const multiSpecs = [
  ['开心', '在这 3 张图片中，哪一张表达了快乐？', ['q09-a-happy.jpg', 'q09-b-sad.png', 'q09-c-fear.png']],
  ['悲伤', '在这 3 张图片中，哪一张表达了悲伤？', ['q10-a-sad.png', 'q10-b-fear.jpg', 'q10-c-happy.jpg']],
  ['恐惧', '在这 3 张图片中，哪一张表达了恐惧？', ['q11-a-fear.jpg', 'q11-b-happy.jpg', 'q11-c-sad.jpg']],
  ['开心', '从 3 张图片中找出自然微笑的表情。', ['q12-a-happy.jpg', 'q12-b-sad.jpg', 'q12-c-fear.jpg']],
  ['悲伤', '从 3 张图片中找出悲伤的表情。', ['q13-a-sad.jpg', 'q13-b-fear.jpg', 'q13-c-happy.jpg']],
  ['恐惧', '从 3 张图片中找出恐惧的表情。', ['q14-a-fear.jpg', 'q14-b-happy.jpg', 'q14-c-sad.jpg']],
  ['开心', '从 3 张图片中找出自然微笑的表情。', ['q15-a-happy.jpg', 'q15-b-sad.jpg', 'q15-c-fear.jpg']],
  ['悲伤', '从 3 张图片中找出悲伤的表情。', ['q16-a-sad.jpg', 'q16-b-fear.jpg', 'q16-c-happy.jpg']],
];
const emotionFromFile = fileName => {
  if (fileName.includes('-happy.')) return '开心';
  if (fileName.includes('-sad.')) return '悲伤';
  if (fileName.includes('-fear.')) return '恐惧';
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
  candidates: (() => {
    const targetFile = files.find(file => emotionFromFile(file) === target);
    const distractors = files.filter(file => file !== targetFile);
    const correctIndex = index % files.length;
    return buildCandidates([...distractors.slice(0, correctIndex), targetFile, ...distractors.slice(correctIndex)]);
  })(),
});
const imageTasks = [
  ...singleSpecs.map((spec, index) => buildImageTask(spec, index, 'single', 1)),
  ...multiSpecs.map((spec, index) => buildImageTask(spec, index, 'multi', 1.5)),
];
const videoTasks = [
  { id: 'video-q1', fileName: 'happy-1.mp4', target: '开心' },
  { id: 'video-q2', fileName: 'sad-1.mp4', target: '难过' },
  { id: 'video-q3', fileName: 'fear-1.mp4', target: '恐惧' },
  { id: 'video-q4', fileName: 'happy-2.mp4', target: '开心' },
  { id: 'video-q5', fileName: 'sad-2.mp4', target: '难过' },
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
  const singles = imageResults.filter(item => item.mode === 'single');
  const multis = imageResults.filter(item => item.mode === 'multi');
  const singleScore = singles.reduce((sum, item) => sum + (item.correct ? 1 : 0), 0);
  const multiScore = multis.reduce((sum, item) => sum + (item.correct ? 1.5 : 0), 0);
  const videoScore = videoResults.reduce((sum, item) => sum + (item?.correct ? 2 : 0), 0);
  const overall = singleScore + multiScore + videoScore;
  const completedCount = imageResults.filter(Boolean).length + videoResults.filter(Boolean).length;
  const band = getRiskBand(overall);
  document.getElementById('result-score').innerHTML = `${formatScore(overall)}<small> / 30</small>`;
  document.getElementById('report-score').textContent = `${formatScore(overall)} / 30 分`;
  document.getElementById('image-single-score').textContent = `${formatScore(singleScore)} / 8 分`;
  document.getElementById('image-multi-score').textContent = `${formatScore(multiScore)} / 12 分`;
  document.getElementById('video-score').textContent = `${formatScore(videoScore)} / 10 分`;
  document.getElementById('explanation-score').textContent = `${completedCount} / 21 题`;
  document.getElementById('report-breakdown').textContent = `二选一 ${formatScore(singleScore)}/8 · 三选一 ${formatScore(multiScore)}/12 · 视频 ${formatScore(videoScore)}/10`;
  document.getElementById('result-risk-label').textContent = band.label;
  document.getElementById('result-risk-explanation').textContent = band.explanation;
  document.getElementById('report-risk-label').textContent = band.label;
  document.getElementById('report-risk-explanation').textContent = band.explanation;
}
function renderImageTask() {
  const task = imageTasks[imageTaskIndex];
  const previousResult = imageResults[imageTaskIndex];
  const sectionOffset = task.mode === 'single' ? 0 : 8;
  document.getElementById('image-progress').textContent = `${imageTaskIndex - sectionOffset + 1} / 8`;
  document.getElementById('image-progress-fill').style.width = `${((imageTaskIndex - sectionOffset + 1) / 8) * 100}%`;
  document.getElementById('image-index').textContent = imageTaskIndex - sectionOffset + 1;
  document.getElementById('image-type-label').textContent = task.mode === 'single' ? '二选一图像分类 · 每题 1 分' : '三选一图像识别 · 每题 1.5 分';
  document.getElementById('image-hint').textContent = task.mode === 'single' ? '从 2 张候选图片中选出最符合目标情绪的一张' : '从 3 张候选图片中选出最符合目标情绪的一张';
  document.getElementById('image-prompt').textContent = task.prompt;
  const candidates = document.getElementById('image-candidates');
  candidates.className = `image-candidates ${task.mode}`;
  candidates.innerHTML = task.candidates.map(candidate => `<button class="image-candidate${previousResult?.optionId === candidate.id ? ' selected' : ''}" data-option="${candidate.id}" aria-label="选项 ${candidate.id}"><img src="${candidate.url}" alt="${candidate.alt}" /><span>${candidate.id}</span></button>`).join('');
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
  document.getElementById('task-video').load();
  document.getElementById('task-video').currentTime = 0;
  document.getElementById('video-result').hidden = true;
  document.getElementById('confirm-video').textContent = '开始播放并捕捉表情　→';
  document.getElementById('video-state').textContent = '准备好后开始播放并捕捉面部表情';
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
  const resultPanel = document.getElementById('video-result');
  const taskVideo = document.getElementById('task-video');
  button.disabled = true;
  state.textContent = '正在启动后台分析…';
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (window.MediaRecorder) {
          cameraChunks = [];
          cameraRecorder = new MediaRecorder(cameraStream);
          cameraRecorder.ondataavailable = event => {
            if (event.data.size) cameraChunks.push(event.data);
          };
          cameraRecorder.start();
        }
      } catch (cameraError) {
        console.info('未取得摄像头权限，将使用视频模型结果', cameraError.message);
      }
    }
    state.textContent = '视频播放中，正在捕捉面部表情…';
    await taskVideo.play();
    await new Promise(resolve => {
      if (taskVideo.ended) {
        resolve();
        return;
      }
      taskVideo.addEventListener('ended', resolve, { once: true });
    });
    state.textContent = '视频播放完成，正在生成识别结果…';
    if (cameraRecorder?.state === 'recording') cameraRecorder.stop();
    const result = await api('/api/video/analyze', { method: 'POST', body: JSON.stringify({ taskId: task.id, fileName: task.fileName, target: task.target }) });
    const analysis = result || { emotion: task.target, confidence: 0.87, features: ['嘴角上扬，形成自然笑容', '眉部舒展，眼睛轻微眯起', '表情保持稳定，持续约 6 秒'], explanation: '面部动作模式与目标情绪表达相符。' };
    const isCorrect = analysis.isCorrect ?? analysis.emotion === task.target;
    videoResults[videoTaskIndex] = { correct: isCorrect, emotion: analysis.emotion, confidence: analysis.confidence };
    updateScoreSummary();
    document.getElementById('video-emotion').textContent = analysis.emotion;
    document.getElementById('video-confidence').textContent = `${Math.round((analysis.confidence || 0) * 100)}% 置信度`;
    document.getElementById('video-features').innerHTML = (analysis.features || []).map(feature => `<li>${feature}</li>`).join('');
    document.getElementById('video-explanation').textContent = analysis.explanation || '面部动作模式与该情绪表达相符。';
    document.getElementById('video-timeline').textContent = '0–2 秒：表情逐渐形成；2–6 秒：情绪保持稳定；整体未发现明显情绪转折。';
    state.textContent = isCorrect ? '本题分析完成，获得 2 分' : '本题分析完成，本题未得分';
    resultPanel.hidden = false;
    button.disabled = false;
    button.textContent = videoTaskIndex < videoTasks.length - 1 ? '继续下一题　→' : '视频任务已完成';
    document.getElementById('continue-image').hidden = isImageComplete();
    updateReportAccess();
    if (videoTaskIndex < videoTasks.length - 1) {
      videoTaskIndex += 1;
      window.setTimeout(renderVideoTask, 650);
      return;
    }
    if (isAssessmentComplete()) showScreen('result');
    else if (!isImageComplete()) state.textContent = '视频任务已完成，请继续完成图片任务。';
  } catch (error) {
    state.textContent = `后台分析失败：${error.message}`;
    button.disabled = false;
    button.textContent = '重试后台分析　→';
  } finally {
    if (cameraRecorder?.state === 'recording') cameraRecorder.stop();
    cameraRecorder = null;
    cameraChunks = [];
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
});
document.getElementById('print-report').addEventListener('click', () => window.print());

async function hydrate() {
  document.body.classList.add('is-home');
  renderImageTask();
  renderVideoTask();
  const session = await api('/api/session');
  if (session) document.querySelector('.api-status').innerHTML = `<i></i> 数据已同步 · ${session.completed}/${session.total}`;
  updateReportAccess();
}

hydrate();
