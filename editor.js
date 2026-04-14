/**
 * AiClawBox 编辑器核心功能
 * 实现右键菜单、增删改移、数据联动、保存更新
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        STORAGE_KEY: 'aiclawbox_editor_data',
        BACKUP_KEY: 'aiclawbox_editor_backup',
        MAX_BACKUP: 5
    };

    // ==================== 状态管理 ====================
    const state = {
        isEditMode: false,
        currentData: null,
        originalData: null,
        selectedCategory: null,
        selectedItem: null
    };

    // ==================== 工具函数 ====================
    const utils = {
        // 生成唯一ID
        generateId() {
            return 'tab_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 8);
        },

        // 深拷贝
        deepClone(obj) {
            return JSON.parse(JSON.stringify(obj));
        },

        // 防抖
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        // 转义HTML
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // 处理图片路径
        processImagePath(iconPath) {
            if (!iconPath) return 'https://img.amz123.com/upload/index_icon/20210824/empty.png';
            
            // 如果是本地路径（tupian/开头）
            if (iconPath.startsWith('tupian/')) {
                const fileName = iconPath.split('/').pop();
                const imageData = localStorage.getItem(`img_${fileName}`);
                if (imageData) {
                    return imageData; // 返回base64数据
                }
            }
            
            // 否则返回原路径
            return iconPath;
        },

        // 显示提示
        showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `editor-toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        },

        // 确认对话框
        confirm(message) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'editor-overlay show';

                const dialog = document.createElement('div');
                dialog.className = 'editor-confirm show';
                dialog.innerHTML = `
                    <div class="editor-confirm-title">确认操作</div>
                    <div class="editor-confirm-message">${message}</div>
                    <div class="editor-confirm-actions">
                        <button class="editor-btn editor-btn-secondary" id="confirmCancel">取消</button>
                        <button class="editor-btn editor-btn-danger" id="confirmOk">确定</button>
                    </div>
                `;

                document.body.appendChild(overlay);
                document.body.appendChild(dialog);

                const cleanup = () => {
                    overlay.remove();
                    dialog.remove();
                };

                dialog.querySelector('#confirmCancel').onclick = () => {
                    cleanup();
                    resolve(false);
                };

                dialog.querySelector('#confirmOk').onclick = () => {
                    cleanup();
                    resolve(true);
                };

                overlay.onclick = () => {
                    cleanup();
                    resolve(false);
                };
            });
        }
    };

    // ==================== 数据管理 ====================
    const dataManager = {
        // 从页面提取数据
        extractFromPage() {
            const categories = [];
            const menuItems = document.querySelectorAll('#amz-peg-menu > li');
            
            menuItems.forEach((menuItem, index) => {
                const tabId = menuItem.getAttribute('data-id');
                const categoryName = menuItem.querySelector('.amz-peg-menu-item').textContent.trim();
                
                const tabContent = document.querySelector(`#${tabId}`);
                if (!tabContent) return;

                const items = [];
                const itemElements = tabContent.querySelectorAll('ul.amz-show > li.amz-item');
                
                itemElements.forEach((item) => {
                    const link = item.querySelector('a');
                    const titleEl = item.querySelector('.amz-item-title');
                    const introEl = item.querySelector('.amz-item-intro');
                    const imgEl = item.querySelector('.amz-item-logo img');
                    
                    if (link && titleEl) {
                        items.push({
                            title: titleEl.textContent.trim(),
                            url: link.getAttribute('href'),
                            description: introEl ? introEl.getAttribute('title') || introEl.textContent.trim() : '',
                            icon: imgEl ? imgEl.getAttribute('data-raw-src') || imgEl.getAttribute('src') : ''
                        });
                    }
                });

                categories.push({
                    id: tabId,
                    name: categoryName,
                    items: items
                });
            });

            return { categories };
        },

        // 保存到 LocalStorage
        save(data) {
            try {
                // 备份当前数据
                this.backup();
                
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
                utils.showToast('保存成功！', 'success');
                return true;
            } catch (e) {
                console.error('保存失败:', e);
                utils.showToast('保存失败！', 'error');
                return false;
            }
        },

        // 从 LocalStorage 加载
        load() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('加载失败:', e);
                return null;
            }
        },

        // 备份数据
        backup() {
            try {
                const current = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (!current) return;

                const backups = JSON.parse(localStorage.getItem(CONFIG.BACKUP_KEY) || '[]');
                backups.unshift({
                    data: current,
                    time: Date.now()
                });

                // 只保留最近5个备份
                if (backups.length > CONFIG.MAX_BACKUP) {
                    backups.pop();
                }

                localStorage.setItem(CONFIG.BACKUP_KEY, JSON.stringify(backups));
            } catch (e) {
                console.error('备份失败:', e);
            }
        },

        // 清除数据
        clear() {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            utils.showToast('已恢复默认数据！', 'success');
        }
    };

    // ==================== 右键菜单 ====================
    const contextMenu = {
        element: null,

        init() {
            this.create();
            this.bindEvents();
        },

        create() {
            this.element = document.createElement('div');
            this.element.className = 'editor-context-menu';
            this.element.innerHTML = `
                <div class="editor-context-menu-item" data-action="edit">📝 进入编辑模式</div>
                <div class="editor-context-menu-item" data-action="reset">🔄 恢复默认数据</div>
            `;
            document.body.appendChild(this.element);
        },

        bindEvents() {
            // 右键事件 - 只在特定区域触发
            document.addEventListener('contextmenu', (e) => {
                // 检查是否在目标区域
                if (this.isInTriggerArea(e)) {
                    e.preventDefault();
                    this.show(e.clientX, e.clientY);
                }
            });

            // 点击其他地方关闭
            document.addEventListener('click', (e) => {
                if (!this.element.contains(e.target)) {
                    this.hide();
                }
            });

            // 菜单项点击
            this.element.addEventListener('click', (e) => {
                const item = e.target.closest('.editor-context-menu-item');
                if (!item) return;

                const action = item.getAttribute('data-action');
                this.handleAction(action);
                this.hide();
            });
        },

        // 检查是否在触发区域（"AiClawBox，轻松养龙虾"文字前面）
        isInTriggerArea(e) {
            // 查找包含"AiClawBox，轻松养龙虾"文字的元素
            const targetText = 'AiClawBox，轻松养龙虾';
            const elements = document.querySelectorAll('.amz-intro-title, .amz-site-text');
            
            for (const el of elements) {
                if (el.textContent.includes(targetText)) {
                    const rect = el.getBoundingClientRect();
                    
                    // 定义触发区域：元素左侧50px范围内
                    const triggerArea = {
                        left: rect.left - 50,
                        right: rect.left,
                        top: rect.top - 10,
                        bottom: rect.bottom + 10
                    };
                    
                    // 检查点击是否在触发区域内
                    if (e.clientX >= triggerArea.left && 
                        e.clientX <= triggerArea.right &&
                        e.clientY >= triggerArea.top && 
                        e.clientY <= triggerArea.bottom) {
                        return true;
                    }
                }
            }
            
            return false;
        },

        show(x, y) {
            // 确保菜单不超出屏幕
            const rect = this.element.getBoundingClientRect();
            const maxX = window.innerWidth - 160;
            const maxY = window.innerHeight - 100;

            this.element.style.left = Math.min(x, maxX) + 'px';
            this.element.style.top = Math.min(y, maxY) + 'px';
            this.element.classList.add('show');

            // 更新菜单内容
            this.updateMenu();
        },

        hide() {
            this.element.classList.remove('show');
        },

        updateMenu() {
            const editItem = this.element.querySelector('[data-action="edit"]');
            if (state.isEditMode) {
                editItem.textContent = '✖️ 退出编辑模式';
            } else {
                editItem.textContent = '📝 进入编辑模式';
            }
        },

        handleAction(action) {
            switch (action) {
                case 'edit':
                    if (state.isEditMode) {
                        editorPanel.hide();
                    } else {
                        editorPanel.show();
                    }
                    break;
                case 'reset':
                    this.resetData();
                    break;
            }
        },

        async resetData() {
            const confirmed = await utils.confirm('确定要恢复默认数据吗？这将清除所有自定义修改。');
            if (confirmed) {
                dataManager.clear();
                location.reload();
            }
        }
    };

    // ==================== 编辑面板 ====================
    const editorPanel = {
        element: null,
        overlay: null,

        init() {
            this.create();
            this.bindEvents();
        },

        create() {
            // 创建遮罩
            this.overlay = document.createElement('div');
            this.overlay.className = 'editor-overlay';
            document.body.appendChild(this.overlay);

            // 创建面板
            this.element = document.createElement('div');
            this.element.className = 'editor-panel';
            this.element.innerHTML = `
                <div class="editor-panel-header">
                    <div class="editor-panel-title">编辑导航</div>
                    <button class="editor-panel-close" title="关闭">×</button>
                </div>
                <div class="editor-panel-body">
                    <div class="editor-form">
                        <button class="editor-btn editor-btn-success" id="addCategoryBtn">+ 添加分类</button>
                    </div>
                    <div id="categoriesList"></div>
                </div>
                <div class="editor-panel-footer">
                    <button class="editor-btn editor-btn-secondary" id="cancelBtn">取消</button>
                    <button class="editor-btn editor-btn-primary" id="saveBtn">保存并退出</button>
                </div>
            `;
            document.body.appendChild(this.element);
        },

        bindEvents() {
            // 关闭按钮
            this.element.querySelector('.editor-panel-close').onclick = () => this.hide();

            // 遮罩点击
            this.overlay.onclick = () => this.hide();

            // 添加分类
            this.element.querySelector('#addCategoryBtn').onclick = () => this.addCategory();

            // 取消
            this.element.querySelector('#cancelBtn').onclick = () => this.hide();

            // 保存
            this.element.querySelector('#saveBtn').onclick = () => this.save();
        },

        show() {
            state.isEditMode = true;
            state.originalData = dataManager.extractFromPage();
            state.currentData = utils.deepClone(state.originalData);

            this.render();
            this.element.classList.add('show');
            this.overlay.classList.add('show');
        },

        hide() {
            state.isEditMode = false;
            this.element.classList.remove('show');
            this.overlay.classList.remove('show');
        },

        render() {
            const container = this.element.querySelector('#categoriesList');
            container.innerHTML = '';

            state.currentData.categories.forEach((category, catIndex) => {
                const categoryEl = document.createElement('div');
                categoryEl.className = 'editor-category';
                categoryEl.innerHTML = `
                    <div class="editor-category-header">
                        <div class="editor-category-name">${utils.escapeHtml(category.name)}</div>
                        <div class="editor-category-actions">
                            <button class="editor-btn editor-btn-sm editor-btn-primary" data-action="addItem" data-cat="${catIndex}">+ 添加</button>
                            <button class="editor-btn editor-btn-sm editor-btn-warning" data-action="editCategory" data-cat="${catIndex}">编辑</button>
                            <button class="editor-btn editor-btn-sm editor-btn-secondary" data-action="moveUpCategory" data-cat="${catIndex}">↑</button>
                            <button class="editor-btn editor-btn-sm editor-btn-secondary" data-action="moveDownCategory" data-cat="${catIndex}">↓</button>
                            <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="deleteCategory" data-cat="${catIndex}">删除</button>
                        </div>
                    </div>
                    <div class="editor-category-items" id="items-${catIndex}"></div>
                `;

                const itemsContainer = categoryEl.querySelector(`#items-${catIndex}`);
                category.items.forEach((item, itemIndex) => {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'editor-item';
                    itemEl.draggable = true;
                    itemEl.dataset.catIndex = catIndex;
                    itemEl.dataset.itemIndex = itemIndex;
                    itemEl.innerHTML = `
                        <div class="editor-item-info">
                            <div class="editor-item-title">${utils.escapeHtml(item.title)}</div>
                            <div class="editor-item-url">${utils.escapeHtml(item.url)}</div>
                        </div>
                        <div class="editor-item-actions">
                            <button class="editor-btn editor-btn-sm editor-btn-warning" data-action="editItem" data-cat="${catIndex}" data-item="${itemIndex}">编辑</button>
                            <button class="editor-btn editor-btn-sm editor-btn-secondary" data-action="moveUpItem" data-cat="${catIndex}" data-item="${itemIndex}">↑</button>
                            <button class="editor-btn editor-btn-sm editor-btn-secondary" data-action="moveDownItem" data-cat="${catIndex}" data-item="${itemIndex}">↓</button>
                            <button class="editor-btn editor-btn-sm editor-btn-danger" data-action="deleteItem" data-cat="${catIndex}" data-item="${itemIndex}">删除</button>
                        </div>
                    `;
                    itemsContainer.appendChild(itemEl);
                });

                container.appendChild(categoryEl);
            });

            // 绑定事件
            this.bindDynamicEvents();
            this.bindDragEvents();
        },

        bindDynamicEvents() {
            const container = this.element.querySelector('#categoriesList');

            container.onclick = (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;

                const action = btn.getAttribute('data-action');
                const catIndex = parseInt(btn.getAttribute('data-cat'));
                const itemIndex = parseInt(btn.getAttribute('data-item'));

                switch (action) {
                    case 'addItem':
                        this.addItem(catIndex);
                        break;
                    case 'editCategory':
                        this.editCategory(catIndex);
                        break;
                    case 'moveUpCategory':
                        this.moveCategory(catIndex, -1);
                        break;
                    case 'moveDownCategory':
                        this.moveCategory(catIndex, 1);
                        break;
                    case 'deleteCategory':
                        this.deleteCategory(catIndex);
                        break;
                    case 'editItem':
                        this.editItem(catIndex, itemIndex);
                        break;
                    case 'moveUpItem':
                        this.moveItem(catIndex, itemIndex, -1);
                        break;
                    case 'moveDownItem':
                        this.moveItem(catIndex, itemIndex, 1);
                        break;
                    case 'deleteItem':
                        this.deleteItem(catIndex, itemIndex);
                        break;
                }
            };
        },

        bindDragEvents() {
            const items = this.element.querySelectorAll('.editor-item');
            
            items.forEach(item => {
                item.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        catIndex: parseInt(item.dataset.catIndex),
                        itemIndex: parseInt(item.dataset.itemIndex)
                    }));
                    item.classList.add('dragging');
                };

                item.ondragend = () => {
                    item.classList.remove('dragging');
                };

                item.ondragover = (e) => {
                    e.preventDefault();
                };

                item.ondrop = (e) => {
                    e.preventDefault();
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const targetCatIndex = parseInt(item.dataset.catIndex);
                    const targetItemIndex = parseInt(item.dataset.itemIndex);

                    if (data.catIndex === targetCatIndex) {
                        // 同分类内移动
                        const items = state.currentData.categories[data.catIndex].items;
                        const [movedItem] = items.splice(data.itemIndex, 1);
                        items.splice(targetItemIndex, 0, movedItem);
                        this.render();
                    }
                };
            });
        },

        // 添加分类
        addCategory() {
            modal.show('添加分类', {
                name: ''
            }, (data) => {
                state.currentData.categories.push({
                    id: utils.generateId(),
                    name: data.name,
                    items: []
                });
                this.render();
            });
        },

        // 编辑分类
        editCategory(catIndex) {
            const category = state.currentData.categories[catIndex];
            modal.show('编辑分类', {
                name: category.name
            }, (data) => {
                category.name = data.name;
                this.render();
            });
        },

        // 移动分类
        moveCategory(catIndex, direction) {
            const newIndex = catIndex + direction;
            if (newIndex < 0 || newIndex >= state.currentData.categories.length) return;

            const categories = state.currentData.categories;
            [categories[catIndex], categories[newIndex]] = [categories[newIndex], categories[catIndex]];
            this.render();
        },

        // 删除分类
        async deleteCategory(catIndex) {
            const category = state.currentData.categories[catIndex];
            const confirmed = await utils.confirm(`确定要删除分类"${category.name}"吗？该分类下的所有项目也将被删除。`);
            if (confirmed) {
                state.currentData.categories.splice(catIndex, 1);
                this.render();
            }
        },

        // 添加项目
        addItem(catIndex) {
            modal.show('添加项目', {
                title: '',
                url: '',
                description: '',
                icon: ''
            }, (data) => {
                state.currentData.categories[catIndex].items.push({
                    title: data.title,
                    url: data.url,
                    description: data.description,
                    icon: data.icon
                });
                this.render();
            });
        },

        // 编辑项目
        editItem(catIndex, itemIndex) {
            const item = state.currentData.categories[catIndex].items[itemIndex];
            modal.show('编辑项目', {
                title: item.title,
                url: item.url,
                description: item.description,
                icon: item.icon
            }, (data) => {
                Object.assign(item, data);
                this.render();
            });
        },

        // 移动项目
        moveItem(catIndex, itemIndex, direction) {
            const items = state.currentData.categories[catIndex].items;
            const newIndex = itemIndex + direction;
            if (newIndex < 0 || newIndex >= items.length) return;

            [items[itemIndex], items[newIndex]] = [items[newIndex], items[itemIndex]];
            this.render();
        },

        // 删除项目
        async deleteItem(catIndex, itemIndex) {
            const item = state.currentData.categories[catIndex].items[itemIndex];
            const confirmed = await utils.confirm(`确定要删除项目"${item.title}"吗？`);
            if (confirmed) {
                state.currentData.categories[catIndex].items.splice(itemIndex, 1);
                this.render();
            }
        },

        // 保存
        save() {
            if (dataManager.save(state.currentData)) {
                pageRenderer.render(state.currentData);
                this.hide();
            }
        }
    };

    // ==================== 模态框 ====================
    const modal = {
        element: null,

        init() {
            this.create();
        },

        create() {
            this.element = document.createElement('div');
            this.element.className = 'editor-modal';
            document.body.appendChild(this.element);
        },

        show(title, data, onSave) {
            const isCategory = Object.keys(data).length === 1;
            
            this.element.innerHTML = `
                <div class="editor-modal-content">
                    <div class="editor-modal-header">
                        <div class="editor-modal-title">${title}</div>
                    </div>
                    <div class="editor-modal-body">
                        <div class="editor-form">
                            <div class="editor-form-group">
                                <label class="editor-form-label">名称 *</label>
                                <input type="text" class="editor-form-input" id="modalName" value="${utils.escapeHtml(data.name || '')}" required>
                            </div>
                            ${!isCategory ? `
                                <div class="editor-form-group">
                                    <label class="editor-form-label">链接 *</label>
                                    <input type="url" class="editor-form-input" id="modalUrl" value="${utils.escapeHtml(data.url || '')}" required>
                                </div>
                                <div class="editor-form-group">
                                    <label class="editor-form-label">描述</label>
                                    <textarea class="editor-form-textarea" id="modalDescription">${utils.escapeHtml(data.description || '')}</textarea>
                                </div>
                                <div class="editor-form-group">
                                    <label class="editor-form-label">图标</label>
                                    <div class="editor-icon-upload">
                                        <input type="url" class="editor-form-input" id="modalIcon" value="${utils.escapeHtml(data.icon || '')}" placeholder="输入图片URL或上传本地图片">
                                        <input type="file" id="modalIconFile" accept="image/*" style="display: none;">
                                        <button type="button" class="editor-btn editor-btn-sm editor-btn-primary" id="uploadIconBtn">上传图片</button>
                                    </div>
                                    <div class="editor-icon-preview" id="iconPreview" style="margin-top: 10px; ${data.icon ? '' : 'display: none;'}">
                                        <img src="${utils.escapeHtml(data.icon || '')}" style="max-width: 100px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="editor-modal-footer">
                        <button class="editor-btn editor-btn-secondary" id="modalCancel">取消</button>
                        <button class="editor-btn editor-btn-primary" id="modalSave">保存</button>
                    </div>
                </div>
            `;

            this.element.classList.add('show');

            // 绑定事件
            this.element.querySelector('#modalCancel').onclick = () => this.hide();
            
            // 图片上传功能
            if (!isCategory) {
                const iconInput = this.element.querySelector('#modalIcon');
                const iconFile = this.element.querySelector('#modalIconFile');
                const uploadBtn = this.element.querySelector('#uploadIconBtn');
                const iconPreview = this.element.querySelector('#iconPreview');
                
                // 点击上传按钮
                uploadBtn.onclick = () => iconFile.click();
                
                // 选择文件后处理
                iconFile.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    // 检查文件类型
                    if (!file.type.startsWith('image/')) {
                        utils.showToast('请选择图片文件！', 'warning');
                        return;
                    }
                    
                    // 检查文件大小（限制2MB）
                    if (file.size > 2 * 1024 * 1024) {
                        utils.showToast('图片大小不能超过2MB！', 'warning');
                        return;
                    }
                    
                    // 生成文件名（使用时间戳）
                    const ext = file.name.split('.').pop();
                    const fileName = `icon_${Date.now()}.${ext}`;
                    
                    // 使用本地路径
                    const localPath = `tupian/${fileName}`;
                    
                    // 读取文件并保存
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        // 保存到LocalStorage（临时方案）
                        try {
                            const imageData = event.target.result;
                            localStorage.setItem(`img_${fileName}`, imageData);
                            
                            // 设置路径
                            iconInput.value = localPath;
                            
                            // 显示预览
                            iconPreview.style.display = 'block';
                            iconPreview.innerHTML = `<img src="${imageData}" style="max-width: 100px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">`;
                            
                            utils.showToast('图片已上传！', 'success');
                        } catch (err) {
                            utils.showToast('图片保存失败！', 'error');
                        }
                    };
                    reader.readAsDataURL(file);
                };
                
                // URL输入时更新预览
                iconInput.oninput = () => {
                    const url = iconInput.value.trim();
                    if (url) {
                        // 检查是否是本地图片
                        if (url.startsWith('tupian/')) {
                            const fileName = url.split('/').pop();
                            const imageData = localStorage.getItem(`img_${fileName}`);
                            if (imageData) {
                                iconPreview.style.display = 'block';
                                iconPreview.innerHTML = `<img src="${imageData}" style="max-width: 100px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">`;
                            }
                        } else {
                            iconPreview.style.display = 'block';
                            iconPreview.innerHTML = `<img src="${url}" style="max-width: 100px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;" onerror="this.parentElement.style.display='none'">`;
                        }
                    } else {
                        iconPreview.style.display = 'none';
                    }
                };
            }
            
            this.element.querySelector('#modalSave').onclick = () => {
                const result = {
                    name: this.element.querySelector('#modalName').value.trim()
                };

                if (!result.name) {
                    utils.showToast('名称不能为空！', 'warning');
                    return;
                }

                if (!isCategory) {
                    result.url = this.element.querySelector('#modalUrl').value.trim();
                    result.description = this.element.querySelector('#modalDescription').value.trim();
                    result.icon = this.element.querySelector('#modalIcon').value.trim();

                    if (!result.url) {
                        utils.showToast('链接不能为空！', 'warning');
                        return;
                    }
                }

                onSave(result);
                this.hide();
            };

            // 点击遮罩关闭
            this.element.onclick = (e) => {
                if (e.target === this.element) {
                    this.hide();
                }
            };
        },

        hide() {
            this.element.classList.remove('show');
        }
    };

    // ==================== 页面渲染器 ====================
    const pageRenderer = {
        render(data) {
            // 更新顶部导航菜单
            this.updateTopMenu(data);
            
            // 更新内容区域
            this.updateContent(data);
            
            utils.showToast('页面已更新！', 'success');
        },

        updateTopMenu(data) {
            const menu = document.querySelector('#amz-peg-menu');
            if (!menu) return;

            menu.innerHTML = '';
            data.categories.forEach((category, index) => {
                const li = document.createElement('li');
                li.setAttribute('data-sdk-index', index);
                li.setAttribute('data-id', category.id);
                li.setAttribute('data-anchor-status', '0');
                li.setAttribute('data-anchor-name', '');
                li.setAttribute('data-focus', index === 0 ? 'true' : 'false');
                
                li.innerHTML = `
                    <div class="amz-peg-menu-contain" title="${utils.escapeHtml(category.name)}">
                        <span data-sdk-report="1" class="amz-peg-menu-item">${utils.escapeHtml(category.name)}</span>
                    </div>
                `;
                
                menu.appendChild(li);
            });
        },

        updateContent(data) {
            const previewContent = document.querySelector('.amz-preview-content');
            if (!previewContent) return;

            previewContent.innerHTML = '';
            data.categories.forEach((category) => {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `
                    <div class="amz-tab-wrapper" data-target-id="${category.id.slice(4)}" id="${category.id}" style="">
                        <div class="amz-tab">
                            <div class="el-scrollbar" style="max-width: 90vw; flex-shrink: 0;">
                                <div class="el-scrollbar__wrap el-scrollbar__wrap--hidden-default">
                                    <div class="el-scrollbar__view" style="">
                                        <div class="amz-tab-nav" data-style="0" id="">
                                            <span class="amz-tab-item" data-font-bold="true" data-sdk-report="1" data-sdk-position="2" data-sdk-index="${utils.escapeHtml(category.name)}-0" style="color: rgb(60, 60, 60);">${utils.escapeHtml(category.name)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <ul class="amz-show common-style item" data-columns="6" id="normal-top" data-style="2" data-sdk-position="${utils.escapeHtml(category.name)}" style="position: relative;"></ul>
                    </div>
                `;

                const ul = wrapper.querySelector('ul.amz-show');
                category.items.forEach((item, itemIndex) => {
                    const li = document.createElement('li');
                    li.setAttribute('data-hidden', 'false');
                    li.setAttribute('class', 'amz-item');
                    li.setAttribute('data-style', '2');
                    li.setAttribute('data-sdk-index', itemIndex);
                    li.setAttribute('data-sdk-partner-id', '0');
                    li.setAttribute('data-sdk-pinned', '0');
                    
                    li.innerHTML = `
                        <a href="${utils.escapeHtml(item.url)}" target="_blank" data-sdk-report="1" click-action="1" click-image="" rel="nofollow" class="amz-item-2" style="padding: 10px 16px;">
                            <div class="amz-item-logo">
                                <img src="${utils.processImagePath(item.icon)}" alt="${utils.escapeHtml(item.title)}-图标">
                            </div>
                            <div class="amz-intro">
                                <p class="amz-item-title" style="color: rgb(68, 68, 68);">${utils.escapeHtml(item.title)}</p>
                                <p class="amz-item-intro description" title="${utils.escapeHtml(item.description)}">${utils.escapeHtml(item.description)}</p>
                            </div>
                        </a>
                    `;
                    
                    ul.appendChild(li);
                });

                previewContent.appendChild(wrapper.firstElementChild);
            });
        }
    };

    // ==================== 初始化 ====================
    function init() {
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEditor);
        } else {
            initEditor();
        }
    }

    function initEditor() {
        // 初始化各模块
        contextMenu.init();
        editorPanel.init();
        modal.init();

        // 检查是否有保存的数据
        const savedData = dataManager.load();
        if (savedData) {
            pageRenderer.render(savedData);
        }

        console.log('AiClawBox 编辑器已加载');
    }

    // 启动
    init();

})();
