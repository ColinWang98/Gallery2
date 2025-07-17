const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const app = express();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const PORT = process.env.PORT || 8082;

app.use(express.json());

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.xml');
  }
});

const uploadMulter = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/xml' || file.originalname.endsWith('.xml')) {
      cb(null, true);
    } else {
      cb(new Error('只支持XML文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

const ensureDirExists = async dirPath => {
  try { await fs.mkdir(dirPath, { recursive: true }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
};

const MODELS_DIR = '/home/ubuntu/gallery2/models';
const FEEDBACK_DIR = '/home/ubuntu/gallery2/feedback';
const LIKES_FILE = '/home/ubuntu/gallery2/likes.json';
const UPLOAD_DIR = '/home/ubuntu/gallery2/uploads';

(async () => {
  await ensureDirExists(MODELS_DIR);
  await ensureDirExists(FEEDBACK_DIR);
  await ensureDirExists(UPLOAD_DIR);
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

// Gallery2 路由
app.get('/gallery2/api/models', async (req, res) => {
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
    
    // 从文件名生成友好的标题
    const friendlyTitle = req.params.id
      .replace(/([A-Z])/g, ' $1') // 在大写字母前添加空格
      .replace(/^./, str => str.toUpperCase()) // 首字母大写
      .trim();
    
    res.json({
      id: req.params.id,
      title: d.title || friendlyTitle,
      category: d.category || '3D模型',
      description: d.description || `${friendlyTitle} 3D模型`,
      likes: d.likes || 0,
      views: d.views || 0,
      downloads: d.downloads || 0,
      modelId: d.modelId || req.params.id
    });
  } catch (e) {
    console.error('读取模型失败:', e);
    res.json({
      id: req.params.id,
      title: req.params.id,
      category: '错误',
      description: '模型加载失败',
      likes: 0,
      views: 0,
      downloads: 0
    });
  }
});

app.get('/gallery2/api/models/:id', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(MODELS_DIR, `${req.params.id}.json`), 'utf8');
    const d = JSON.parse(data);
    
    // 从文件名生成友好的标题
    const friendlyTitle = req.params.id
      .replace(/([A-Z])/g, ' $1') // 在大写字母前添加空格
      .replace(/^./, str => str.toUpperCase()) // 首字母大写
      .trim();
    
    res.json({
      id: req.params.id,
      title: d.title || friendlyTitle,
      category: d.category || '3D模型',
      description: d.description || `${friendlyTitle} 3D模型`,
      likes: d.likes || 0,
      views: d.views || 0,
      downloads: d.downloads || 0,
      modelId: d.modelId || req.params.id
    });
  } catch (e) {
    console.error('读取模型失败:', e);
    res.json({
      id: req.params.id,
      title: req.params.id,
      category: '错误',
      description: '模型加载失败',
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

// 点赞API
app.get('/api/likes', async (req, res) => {
  try {
    const data = await fs.readFile(LIKES_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    // 如果文件不存在，返回空对象
    res.json({});
  }
});

app.post('/api/likes', async (req, res) => {
  try {
    const likesData = req.body;
    await fs.writeFile(LIKES_FILE, JSON.stringify(likesData, null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error('保存点赞数据失败:', e);
    res.status(500).json({ error: '保存失败' });
  }
});

// Gallery2 点赞API
app.get('/gallery2/api/likes', async (req, res) => {
  try {
    const data = await fs.readFile(LIKES_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    // 如果文件不存在，返回空对象
    res.json({});
  }
});

app.post('/gallery2/api/likes', async (req, res) => {
  try {
    const likesData = req.body;
    await fs.writeFile(LIKES_FILE, JSON.stringify(likesData, null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error('保存点赞数据失败:', e);
    res.status(500).json({ error: '保存失败' });
  }
});

// XML转JSON函数
function xmlToJson(xmlContent) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlContent, { explicitArray: false }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// 解析XML中的线条数据
function parseLinesFromXml(xmlData) {
  const lines = [];
  try {
    // 兼容多种结构，优先找 MQBLine
    let lineElements = [];
    if (xmlData && xmlData.MindverseModel && xmlData.MindverseModel.MQBLine) {
      lineElements = Array.isArray(xmlData.MindverseModel.MQBLine) ? xmlData.MindverseModel.MQBLine : [xmlData.MindverseModel.MQBLine];
    } else if (xmlData.MQBLine) {
      lineElements = Array.isArray(xmlData.MQBLine) ? xmlData.MQBLine : [xmlData.MQBLine];
    }
    lineElements.forEach((lineElement, index) => {
      // 颜色
      let color = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
      if (lineElement.color) {
        const c = lineElement.color;
        if (c.r !== undefined && c.g !== undefined && c.b !== undefined && c.a !== undefined) {
          color = {
            r: parseFloat(c.r),
            g: parseFloat(c.g),
            b: parseFloat(c.b),
            a: parseFloat(c.a)
          };
        }
      }
      // 线宽
      let width = 1.0;
      if (lineElement.width !== undefined && lineElement.width !== null) {
        width = parseFloat(lineElement.width) || 1.0;
      }
      // 控制点
      let points = [];
      if (lineElement.MQBControlPoint) {
        const cps = Array.isArray(lineElement.MQBControlPoint) ? lineElement.MQBControlPoint : [lineElement.MQBControlPoint];
        cps.forEach(cp => {
          if (cp.position && cp.position.x !== undefined && cp.position.y !== undefined && cp.position.z !== undefined) {
            points.push({
              x: parseFloat(cp.position.x),
              y: parseFloat(cp.position.y),
              z: parseFloat(cp.position.z)
            });
          }
        });
      }
      lines.push({ color, width, points });
    });
  } catch (error) {
    console.error('解析XML线条数据失败:', error);
  }
  return lines;
}

function parseColor(colorStr) {
  if (!colorStr) return { r: 1, g: 1, b: 1 };
  
  // 尝试解析不同的颜色格式
  if (colorStr.startsWith('#')) {
    const hex = colorStr.substring(1);
    return {
      r: parseInt(hex.substr(0, 2), 16) / 255,
      g: parseInt(hex.substr(2, 2), 16) / 255,
      b: parseInt(hex.substr(4, 2), 16) / 255
    };
  } else if (colorStr.includes(',')) {
    const parts = colorStr.split(',').map(p => parseFloat(p.trim()));
    return {
      r: parts[0] || 1,
      g: parts[1] || 1,
      b: parts[2] || 1
    };
  }
  
  return { r: 1, g: 1, b: 1 };
}

function parsePoints(pointsData) {
  if (!pointsData) return [];
  
  const points = [];
  
  try {
    let pointElements = [];
    
    if (Array.isArray(pointsData)) {
      pointElements = pointsData;
    } else if (pointsData.point) {
      pointElements = Array.isArray(pointsData.point) ? pointsData.point : [pointsData.point];
    } else if (typeof pointsData === 'string') {
      // 尝试解析坐标字符串 "x1,y1,z1 x2,y2,z2 ..."
      const coordStrings = pointsData.trim().split(/\s+/);
      coordStrings.forEach(coordStr => {
        const coords = coordStr.split(',').map(c => parseFloat(c.trim()));
        if (coords.length >= 3) {
          points.push({ x: coords[0], y: coords[1], z: coords[2] });
        }
      });
      return points;
    }
    
    pointElements.forEach(pointElement => {
      if (pointElement.x !== undefined && pointElement.y !== undefined && pointElement.z !== undefined) {
        points.push({
          x: parseFloat(pointElement.x),
          y: parseFloat(pointElement.y),
          z: parseFloat(pointElement.z)
        });
      }
    });
    
  } catch (error) {
    console.error('解析点数据失败:', error);
  }
  
  return points;
}

// 文件上传API
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '模型名称不能为空' });
    }
    
    // 读取XML文件内容
    const xmlContent = await fs.readFile(req.file.path, 'utf8');
    
    // 转换XML为JSON
    const xmlData = await xmlToJson(xmlContent);
    
    // 解析线条数据
    const lines = parseLinesFromXml(xmlData);
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'XML文件中没有找到有效的线条数据' });
    }
    
    // 生成模型ID
    const modelId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建模型数据
    const modelData = {
      id: modelId,
      title: title,
      category: '上传模型',
      description: '',
      lines: lines,
      uploadTime: new Date().toISOString(),
      fileSize: req.file.size
    };
    
    // 保存模型文件
    const modelPath = path.join(MODELS_DIR, `${modelId}.json`);
    await fs.writeFile(modelPath, JSON.stringify(modelData, null, 2));
    
    // 删除临时上传文件
    await fs.unlink(req.file.path);
    
    res.json({
      success: true,
      modelId: modelId,
      title: title,
      linesCount: lines.length
    });
    
  } catch (error) {
    console.error('文件上传处理失败:', error);
    
    // 清理临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        console.error('清理临时文件失败:', e);
      }
    }
    
    res.status(500).json({ error: '文件处理失败: ' + error.message });
  }
});

// 分享ID与模型ID映射文件路径
const shareMapPath = path.join(__dirname, 'share_map.json');

// 保存分享ID与模型ID的映射
app.post('/api/share', (req, res) => {
  const { shareId, modelId } = req.body;
  console.log('保存分享映射:', { shareId, modelId });
  
  if (!shareId || !modelId) {
    return res.status(400).json({ error: '缺少shareId或modelId' });
  }
  
  try {
    let map = {};
    if (fs.existsSync(shareMapPath)) {
      const content = fs.readFileSync(shareMapPath, 'utf-8');
      map = JSON.parse(content);
    }
    map[shareId] = modelId;
    fs.writeFileSync(shareMapPath, JSON.stringify(map, null, 2), 'utf-8');
    console.log('分享映射保存成功:', shareMapPath, map);
    res.json({ success: true });
  } catch (error) {
    console.error('保存分享映射失败:', error);
    res.status(500).json({ error: '保存失败: ' + error.message });
  }
});

// 通过分享ID获取模型ID
app.get('/api/share/:shareId', (req, res) => {
  const shareId = req.params.shareId;
  console.log('查询分享ID:', shareId);
  
  try {
    let map = {};
    if (fs.existsSync(shareMapPath)) {
      const content = fs.readFileSync(shareMapPath, 'utf-8');
      map = JSON.parse(content);
      console.log('现有分享映射:', map);
    } else {
      console.log('分享映射文件不存在:', shareMapPath);
    }
    
    const modelId = map[shareId] || 'Cathedral';
    console.log('返回模型ID:', modelId);
    res.json({ modelId });
  } catch (error) {
    console.error('查询分享映射失败:', error);
    res.json({ modelId: 'Cathedral' });
  }
});

// Gallery2 分享API
app.post('/gallery2/api/share', (req, res) => {
  const { shareId, modelId } = req.body;
  console.log('Gallery2保存分享映射:', { shareId, modelId });
  
  if (!shareId || !modelId) {
    return res.status(400).json({ error: '缺少shareId或modelId' });
  }
  
  try {
    let map = {};
    if (fs.existsSync(shareMapPath)) {
      const content = fs.readFileSync(shareMapPath, 'utf-8');
      map = JSON.parse(content);
    }
    map[shareId] = modelId;
    fs.writeFileSync(shareMapPath, JSON.stringify(map, null, 2), 'utf-8');
    console.log('Gallery2分享映射保存成功:', shareMapPath, map);
    res.json({ success: true });
  } catch (error) {
    console.error('Gallery2保存分享映射失败:', error);
    res.status(500).json({ error: '保存失败: ' + error.message });
  }
});

app.get('/gallery2/api/share/:shareId', (req, res) => {
  const shareId = req.params.shareId;
  console.log('Gallery2查询分享ID:', shareId);
  
  try {
    let map = {};
    if (fs.existsSync(shareMapPath)) {
      const content = fs.readFileSync(shareMapPath, 'utf-8');
      map = JSON.parse(content);
      console.log('Gallery2现有分享映射:', map);
    } else {
      console.log('Gallery2分享映射文件不存在:', shareMapPath);
    }
    
    const modelId = map[shareId] || 'Cathedral';
    console.log('Gallery2返回模型ID:', modelId);
    res.json({ modelId });
  } catch (error) {
    console.error('Gallery2查询分享映射失败:', error);
    res.json({ modelId: 'Cathedral' });
  }
});

app.post('/gallery2/api/upload', uploadMulter.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('未收到文件');
    const xml = fs.readFileSync(req.file.path, 'utf-8');
    // 解析 XML
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'XML 解析失败' });
      }
      // 生成 JSON 文件名
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
      const jsonPath = path.join(__dirname, 'models', baseName + '.json');
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
      fs.unlinkSync(req.file.path); // 删除临时文件
      res.json({ success: true, filename: baseName + '.json' });
    });
  } catch (err) {
    console.error('上传出错:', err);
    res.status(500).json({ error: err.message });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
