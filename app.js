const modal = document.getElementById('editorModal');
const modelInput = document.getElementById('editorModel');
const keyInput = document.getElementById('editorKey');
const baseInput = document.getElementById('editorBase');
const titleEl = document.getElementById('editorTitle');
const statusEl = document.getElementById('statusText');
const taskInput = document.getElementById('taskInput');
const taskRunBtn = document.getElementById('taskRun');
const drawer = document.getElementById('outputDrawer');
const drawerTitle = document.getElementById('drawerTitle');
const drawerBody = document.getElementById('drawerBody');
const drawerClose = document.getElementById('drawerClose');

let currentAgent = null;
const fullOutputs = {}; // agentId -> full text(用于抽屉展开)

function setStatus(text, kind = 'info') {
  statusEl.textContent = text;
  statusEl.style.color = kind === 'error' ? '#ff7c7c' : '#c0ffc0';
}

function maskKey(key) {
  if (!key) return '未设置';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '****' + key.slice(-4);
}

function renderAgent(agentId, data) {
  const ws = document.querySelector(`.employee[data-agent="${agentId}"]`);
  if (!ws) return;
  ws.querySelector('[data-field="model"]').textContent = data.model || '未设置';
  const keyEl = ws.querySelector('[data-field="apiKey"]');
  keyEl.textContent = maskKey(data.apiKey);
  keyEl.classList.toggle('has-value', Boolean(data.apiKey));
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();
    for (const [agentId, data] of Object.entries(config.agents)) {
      renderAgent(agentId, data);
    }
    setStatus(`已加载配置 · ${Object.keys(config.agents).length} 个员工就位`);
    return config;
  } catch (err) {
    setStatus(`加载配置失败: ${err.message}`, 'error');
    throw err;
  }
}

async function saveAgent(agentId, payload) {
  const res = await fetch(`/api/config/${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'save failed');
  }
  return res.json();
}

function openEditor(agentId, current) {
  currentAgent = agentId;
  const roleName = document.querySelector(`.employee[data-agent="${agentId}"] .nameplate`)
    .textContent;
  titleEl.textContent = `编辑工牌 · ${roleName}`;
  modelInput.value = current.model || '';
  keyInput.value = current.apiKey || '';
  baseInput.value = current.baseURL || '';
  modal.hidden = false;
  setTimeout(() => modelInput.focus(), 0);
}

function closeEditor() {
  modal.hidden = true;
  currentAgent = null;
}

// ----- 工牌点击 -----
document.querySelectorAll('.badge').forEach((badge) => {
  badge.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ws = badge.closest('.employee');
    const agentId = ws.dataset.agent;
    const config = await loadConfig();
    openEditor(agentId, config.agents[agentId]);
  });
  badge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      badge.click();
    }
  });
});

document.getElementById('editorCancel').addEventListener('click', closeEditor);

document.getElementById('editorSave').addEventListener('click', async () => {
  if (!currentAgent) return;
  const payload = {
    model: modelInput.value.trim(),
    apiKey: keyInput.value.trim(),
    baseURL: baseInput.value.trim(),
  };
  try {
    const { agent } = await saveAgent(currentAgent, payload);
    renderAgent(currentAgent, agent);
    setStatus(`已保存 ${currentAgent} 的配置到 config.json`);
    closeEditor();
  } catch (err) {
    setStatus(`保存失败: ${err.message}`, 'error');
  }
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeEditor();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modal.hidden) closeEditor();
    else if (!drawer.hidden) hideDrawer();
  }
});

// ----- 气泡 + 抽屉 -----
function getBubble(agentId) {
  return document.querySelector(`.employee[data-agent="${agentId}"] [data-bubble]`);
}

function getEmployee(agentId) {
  return document.querySelector(`.employee[data-agent="${agentId}"]`);
}

function setThinking(agentId) {
  const b = getBubble(agentId);
  b.hidden = false;
  b.classList.add('thinking');
  b.textContent = '思考中';
  getEmployee(agentId).classList.add('active');
}

function appendDelta(agentId, chunk) {
  const b = getBubble(agentId);
  b.classList.remove('thinking');
  fullOutputs[agentId] = (fullOutputs[agentId] || '') + chunk;
  // 气泡只显示前 180 字符,完整版进抽屉
  b.textContent = truncate(fullOutputs[agentId], 180);
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

function finishAgent(agentId) {
  getEmployee(agentId).classList.remove('active');
}

function errorAgent(agentId, msg) {
  const b = getBubble(agentId);
  b.classList.remove('thinking');
  b.hidden = false;
  b.textContent = `出错:${msg}`;
  finishAgent(agentId);
}

function resetBubbles() {
  for (const id of ['frontend', 'backend', 'tester']) {
    const b = getBubble(id);
    b.hidden = true;
    b.textContent = '';
    b.classList.remove('thinking');
    fullOutputs[id] = '';
    getEmployee(id).classList.remove('active');
  }
}

function showDrawer(agentId) {
  const text = fullOutputs[agentId];
  if (!text) return;
  const roleName = getEmployee(agentId).querySelector('.nameplate').textContent;
  drawerTitle.textContent = `${roleName} · 完整输出`;
  drawerBody.textContent = text;
  drawer.hidden = false;
}

function hideDrawer() {
  drawer.hidden = true;
}

drawerClose.addEventListener('click', hideDrawer);

document.querySelectorAll('[data-bubble]').forEach((b) => {
  b.addEventListener('click', () => {
    const agentId = b.closest('.employee').dataset.agent;
    showDrawer(agentId);
  });
});

// ----- 任务流水线 (SSE) -----
let currentSSE = null;

function runTask(task) {
  if (currentSSE) {
    currentSSE.close();
    currentSSE = null;
  }
  resetBubbles();
  taskRunBtn.disabled = true;
  setStatus(`任务发起:${truncate(task, 40)}`);

  const url = `/api/run?task=${encodeURIComponent(task)}`;
  const es = new EventSource(url);
  currentSSE = es;

  es.addEventListener('start', (e) => {
    const { task } = JSON.parse(e.data);
    setStatus(`开始处理:${truncate(task, 40)}`);
  });

  es.addEventListener('agent_start', (e) => {
    const { agentId, role } = JSON.parse(e.data);
    setStatus(`${role} 开始工作...`);
    setThinking(agentId);
  });

  es.addEventListener('agent_delta', (e) => {
    const { agentId, chunk } = JSON.parse(e.data);
    appendDelta(agentId, chunk);
  });

  es.addEventListener('agent_done', (e) => {
    const { agentId } = JSON.parse(e.data);
    finishAgent(agentId);
  });

  es.addEventListener('agent_error', (e) => {
    const { agentId, error } = JSON.parse(e.data);
    errorAgent(agentId, error);
    setStatus(`${agentId} 出错: ${error}`, 'error');
  });

  es.addEventListener('end', (e) => {
    const { ok } = JSON.parse(e.data);
    es.close();
    currentSSE = null;
    taskRunBtn.disabled = false;
    setStatus(ok ? '✓ 三人协作完成,点头顶气泡查看完整输出' : '任务异常结束', ok ? 'info' : 'error');
  });

  es.onerror = (err) => {
    console.error('SSE error', err);
    es.close();
    currentSSE = null;
    taskRunBtn.disabled = false;
    setStatus('连接错误,请检查 server 控制台', 'error');
  };
}

taskRunBtn.addEventListener('click', () => {
  const task = taskInput.value.trim();
  if (!task) {
    setStatus('请先输入任务', 'error');
    return;
  }
  runTask(task);
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') taskRunBtn.click();
});

loadConfig();
