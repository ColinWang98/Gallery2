import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateThumbnail(jsonPath, outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=swiftshader',
      '--ignore-gpu-blacklist',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 256, height: 341 });

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found: ${jsonPath}`);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const jsonData = JSON.parse(jsonContent);
  
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js"></script>
    <style>
      body { 
        margin: 0; 
        overflow: hidden;
        background-color: #4f46e5;
      }
      canvas { 
        display: block; 
      }
    </style>
  </head>
  <body>
    <canvas id="canvas"></canvas>
    <script>
      let renderComplete = false;
      let renderAttempts = 0;
      const maxRenderAttempts = 10;
      
      // 渲染完成回调
      function onRenderComplete() {
        renderComplete = true;
      }
      
      // 渲染场景
      function renderScene() {
        if (!renderComplete && renderAttempts < maxRenderAttempts) {
          renderer.render(scene, camera);
          renderAttempts++;
          setTimeout(renderScene, 100);  // 每100ms尝试渲染一次
        } else {
          onRenderComplete();
        }
      }
      
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 256/341, 0.1, 1000);  // 调整FOV为45度
        const renderer = new THREE.WebGLRenderer({ 
          canvas: document.getElementById('canvas'),
          antialias: true,
          preserveDrawingBuffer: true,
          alpha: true
        });
        
        renderer.setSize(256, 341);
        renderer.setClearColor(0x4f46e5, 1);
        renderer.setPixelRatio(2);  // 提高渲染质量
        
        // 增强光照
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);  // 增加环境光强度
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);  // 增加方向光强度
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);
        
        // 添加多个方向的光源
        const lights = [
          { pos: [1, 1, 1], intensity: 1.2 },
          { pos: [-1, 1, -1], intensity: 0.8 },
          { pos: [0, -1, 0], intensity: 0.6 }
        ];
        
        lights.forEach(light => {
          const dirLight = new THREE.DirectionalLight(0xffffff, light.intensity);
          dirLight.position.set(...light.pos).normalize();
          scene.add(dirLight);
        });
        
        // 解析JSON数据
        const lines = ${jsonContent}.lines || [];
        
        // 创建线条对象
        const lineObjects = [];
        for (let line of lines) {
          const color = line.color ? 
            new THREE.Color(line.color.r, line.color.g, line.color.b) : 
            new THREE.Color(1, 1, 1);
          
          const points = (line.points || []).map(p => 
            new THREE.Vector3(p.x, p.y, p.z)
          );
          
          if (points.length < 2) continue;
          
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ 
            color, 
            linewidth: 2,
            transparent: true,
            opacity: 1
          });
          const lineObj = new THREE.Line(geometry, material);
          scene.add(lineObj);
          lineObjects.push(lineObj);
        }

        // 计算相机位置
        const box = new THREE.Box3();
        lineObjects.forEach(obj => {
          obj.geometry.computeBoundingBox();
          box.union(obj.geometry.boundingBox);
        });
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const fov = camera.fov * (Math.PI / 180);
        let distance = maxDim / (2 * Math.tan(fov / 2));
        distance = Math.max(distance * 1.1, 0.2);  // 调整相机距离
        
        camera.position.set(center.x, center.y, center.z + distance);
        camera.lookAt(center);
        
        // 开始渲染循环
        renderScene();
        
      } catch (err) {
        console.error('渲染错误:', err);
        onRenderComplete();  // 确保在错误时也能继续
      }
    </script>
  </body>
  </html>
  `;
  
  const tempHtml = path.join(__dirname, 'temp.html');
  fs.writeFileSync(tempHtml, htmlContent);

  // 添加监听器等待渲染完成
  await page.exposeFunction('onRenderComplete', () => {});
  
  await page.goto(`file://${tempHtml}`, {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  
  // 等待渲染完成
  await page.waitForFunction('renderComplete === true', { timeout: 5000 })
    .catch(() => console.log('渲染可能未完成，继续执行'));
  
  // 增加额外等待时间
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 截图
  const canvas = await page.$('#canvas');
  await canvas.screenshot({
    path: outputPath,
    omitBackground: false,  // 保留背景色
    type: 'png',
    quality: 100
  });
  
  console.log(`缩略图已保存: ${outputPath}`);
  
  // 清理
  fs.unlinkSync(tempHtml);
  await browser.close();
}

async function generateAllThumbnails() {
  const modelDir = path.join(__dirname, 'models');
  const thumbDir = path.join(__dirname, 'public', 'thumbnails');
  
  if (!fs.existsSync(modelDir)) {
    console.error(`模型目录不存在: ${modelDir}`);
    return;
  }
  
  // 确保缩略图目录存在
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }
  
  const files = fs.readdirSync(modelDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('模型目录中没有找到JSON文件');
    return;
  }
  
  for (const jsonFile of files) {
    const jsonPath = path.join(modelDir, jsonFile);
    const modelName = path.parse(jsonFile).name;
    const outputPath = path.join(thumbDir, `${modelName}.png`);
    
    try {
      console.log(`正在生成缩略图: ${jsonFile}`);
      await generateThumbnail(jsonPath, outputPath);
      console.log(`成功生成: ${outputPath}`);
    } catch (err) {
      console.error(`生成缩略图时出错 (${jsonFile}): ${err.message}`);
    }
  }
}

// 执行生成
generateAllThumbnails().catch(console.error);