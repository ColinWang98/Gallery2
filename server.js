const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 8082;

app.use(express.json());

const ensureDirExists = async dirPath => {
  try { await fs.mkdir(dirPath, { recursive: true }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
};

const MODELS_DIR = '/home/ubuntu/gallery2/models';
const FEEDBACK_DIR = '/home/ubuntu/gallery2/feedback';

(async () => {
  await ensureDirExists(MODELS_DIR);
  await ensureDirExists(FEEDBACK_DIR);
})();

app.use('/models', express.static(MODELS_DIR));
app.use('/feedback', express.static(FEEDBACK_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 模型列表接口，不包含 sample-model.json
app.get('/api/models', async (req, res) => {
  try {
    const files = await fs.readdir(MODELS_DIR);
    const models = files
      .filter(f => f.endsWith('.json') && f !== 'sample-model.json')
      .map(f => f.replace('.json', ''));
    res.json(models);
  } catch (e) {
    console.error('读取模型目录失败:', e);
    res.json([]);
  }
});

app.get('/api/models/:id', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(MODELS_DIR, `${req.params.id}.json`), 'utf8');
    const d = JSON.parse(data);
    res.json({
      id: d.id || req.params.id,
      title: d.title || req.params.id,
      category: d.category || '',
      description: d.description || '',
      likes: d.likes || 0,
      views: d.views || 0,
      downloads: d.downloads || 0
    });
  } catch (e) {
    console.error('读取模型失败:', e);
    res.json({
      id: req.params.id,
      title: req.params.id,
      category: '',
      description: '',
      likes: 0,
      views: 0,
      downloads: 0
    });
  }
});

app.get('/api/feedback/:modelId', async (req, res) => {
  try {
    const filePath = path.join(FEEDBACK_DIR, `${req.params.modelId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.post('/api/feedback/:modelId', async (req, res) => {
  const modelId = req.params.modelId;
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: '评论不能为空' });
  }
  const feedback = { comment: comment.trim(), timestamp: new Date().toISOString() };
  const filePath = path.join(FEEDBACK_DIR, `${modelId}.json`);
  let all = [];
  try {
    const prev = await fs.readFile(filePath, 'utf8');
    all = JSON.parse(prev);
  } catch {}
  all.push(feedback);
  try {
    await fs.writeFile(filePath, JSON.stringify(all, null, 2));
    res.status(201).json(feedback);
  } catch (e) {
    console.error('保存评论失败:', e);
    res.status(500).json({ error: '保存失败' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Gallery2 服务已启动，运行在 http://127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
