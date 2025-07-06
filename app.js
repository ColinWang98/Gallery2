async function loadModels() {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) throw new Error('Failed to load models');
    const models = await response.json();
    const grid = document.getElementById('modelGrid');
    grid.innerHTML = '';
    models.forEach(model => {
      const card = document.createElement('div');
      card.className = 'model-card';
      card.innerHTML = `
        <a href="/viewer.html?model=${model.id}" class="block">
          <div class="card-image">
            <img src="/thumbnails/${model.id}.jpg" alt="${model.title}" onerror="this.src='/thumbnails/placeholder.jpg'">
            <div class="card-overlay">
              <div class="card-actions">
                <button class="card-action-btn">查看3D <i class="fas fa-cube"></i></button>
                <button class="card-action-btn">收藏 <i class="fas fa-heart"></i></button>
              </div>
            </div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${model.title}</h3>
            <div class="card-author">
              <div class="author-avatar">
                <img src="/images/avatar-${model.authorId}.jpg" alt="${model.author}">
              </div>
              <span class="author-name">${model.author}</span>
            </div>
            <div class="card-stats">
              <span class="stat-item"><i class="fas fa-eye"></i> ${model.views}</span>
              <span class="stat-item"><i class="fas fa-heart"></i> ${model.likes}</span>
            </div>
          </div>
        </a>
      `;
      grid.appendChild(card);
    });
    new Masonry(grid, {
      itemSelector: '.model-card',
      percentPosition: true,
      gutter: 20
    });
  } catch (error) {
    console.error('Error loading models:', error);
    alert('无法加载模型');
  }
}

document.querySelectorAll('.category-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('.category-item.active').classList.remove('active');
    item.classList.add('active');
    loadModels(); // 根据分类过滤
  });
});

loadModels();