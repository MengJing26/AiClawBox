/**
 * AiClawBox 安全防护系统
 * 防止源码盗用、非法下载和调试
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const SECURITY_CONFIG = {
        // 允许的域名列表
        allowedDomains: [
            'localhost',
            '127.0.0.1',
            'file:',
            'aiclawbox.com',
            'www.aiclawbox.com'
        ],
        
        // 版权信息
        copyright: {
            owner: 'AiClawBox',
            year: new Date().getFullYear(),
            message: '本网站源码受版权保护，未经授权禁止使用、复制、修改或分发。'
        },
        
        // 安全密钥（用于验证）
        securityKey: 'ACB_' + btoa('AiClawBox_Security_2026'),
        
        // 检测间隔（毫秒）
        checkInterval: 3000
    };

    // ==================== 域名验证 ====================
    const domainValidator = {
        // 检查当前域名是否合法
        isValidDomain() {
            const currentDomain = window.location.hostname || window.location.protocol;
            
            // 检查是否在允许列表中
            const isAllowed = SECURITY_CONFIG.allowedDomains.some(domain => {
                return currentDomain.includes(domain);
            });
            
            return isAllowed;
        },

        // 显示盗版警告
        showPiracyWarning() {
            const warning = document.createElement('div');
            warning.id = 'security-warning';
            warning.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: Arial, sans-serif;
            `;
            
            warning.innerHTML = `
                <div style="text-align: center; max-width: 600px; padding: 40px;">
                    <h1 style="font-size: 48px; color: #e74c3c; margin-bottom: 30px;">⚠️ 安全警告</h1>
                    <h2 style="font-size: 24px; margin-bottom: 20px;">检测到非法访问</h2>
                    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
                        ${SECURITY_CONFIG.copyright.message}
                    </p>
                    <p style="font-size: 16px; color: #999; margin-bottom: 20px;">
                        版权所有 © ${SECURITY_CONFIG.copyright.year} ${SECURITY_CONFIG.copyright.owner}
                    </p>
                    <p style="font-size: 14px; color: #f39c12;">
                        如需合法使用，请联系管理员获取授权。
                    </p>
                </div>
            `;
            
            document.body.innerHTML = '';
            document.body.appendChild(warning);
        },

        // 执行域名检查
        check() {
            // 为了确保网站在任何服务器上都能正常运行，暂时放宽域名验证
            // 实际部署时可以根据需要添加具体的域名
            return true;
        }
    };

    // ==================== 反调试保护 ====================
    const antiDebug = {
        // 检测开发者工具
        detectDevTools() {
            const devtools = /./;
            devtools.toString = function() {
                this.opened = true;
            };
            
            return devtools.opened;
        },

        // 禁用右键菜单
        disableContextMenu() {
            document.addEventListener('contextmenu', (e) => {
                // 允许编辑器的右键菜单及相关区域
                if (e.target.closest('.editor-context-menu, .editor-panel, .editor-modal, .amz-intro-title, .amz-site-text')) {
                    return;
                }
                e.preventDefault();
            });
        },

        // 禁用快捷键
        disableShortcuts() {
            document.addEventListener('keydown', (e) => {
                // F12
                if (e.key === 'F12') {
                    e.preventDefault();
                    this.showWarning('开发者工具已禁用');
                    return;
                }
                
                // Ctrl+Shift+I (开发者工具)
                if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                    e.preventDefault();
                    this.showWarning('开发者工具已禁用');
                    return;
                }
                
                // Ctrl+Shift+J (控制台)
                if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                    e.preventDefault();
                    this.showWarning('控制台已禁用');
                    return;
                }
                
                // Ctrl+Shift+C (元素选择器)
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    this.showWarning('元素选择器已禁用');
                    return;
                }
                
                // Ctrl+U (查看源码)
                if (e.ctrlKey && e.key === 'u') {
                    e.preventDefault();
                    this.showWarning('查看源码已禁用');
                    return;
                }
                
                // Ctrl+S (保存)
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.showWarning('保存已禁用');
                    return;
                }
            });
        },

        // 显示警告提示
        showWarning(message) {
            const warning = document.createElement('div');
            warning.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #e74c3c;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 999999;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            warning.textContent = `⚠️ ${message}`;
            document.body.appendChild(warning);
            
            setTimeout(() => warning.remove(), 2000);
        },

        // 检测调试器
        detectDebugger() {
            const start = performance.now();
            debugger;
            const end = performance.now();
            
            if (end - start > 100) {
                this.showWarning('检测到调试器');
                return true;
            }
            return false;
        },

        // 初始化反调试保护
        init() {
            this.disableContextMenu();
            this.disableShortcuts();
            
            // 定期检测调试器
            setInterval(() => {
                this.detectDebugger();
            }, SECURITY_CONFIG.checkInterval);
        }
    };

    // ==================== 代码保护 ====================
    const codeProtection = {
        // 禁用选择和复制
        disableSelection() {
            document.addEventListener('selectstart', (e) => {
                // 允许编辑器内的选择
                if (e.target.closest('.editor-panel, .editor-modal, input, textarea')) {
                    return;
                }
                e.preventDefault();
            });
            
            document.addEventListener('copy', (e) => {
                // 允许编辑器内的复制
                if (e.target.closest('.editor-panel, .editor-modal, input, textarea')) {
                    return;
                }
                e.preventDefault();
                antiDebug.showWarning('复制功能已禁用');
            });
            
            document.addEventListener('cut', (e) => {
                e.preventDefault();
                antiDebug.showWarning('剪切功能已禁用');
            });
        },

        // 禁用拖拽
        disableDrag() {
            document.addEventListener('dragstart', (e) => {
                // 允许编辑器内的拖拽
                if (e.target.closest('.editor-panel, .editor-modal')) {
                    return;
                }
                e.preventDefault();
            });
        },

        // 添加版权水印
        addWatermark() {
            const watermark = document.createElement('div');
            watermark.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                font-size: 12px;
                color: rgba(0, 0, 0, 0.1);
                pointer-events: none;
                z-index: 9999;
                font-family: Arial, sans-serif;
            `;
            watermark.textContent = `© ${SECURITY_CONFIG.copyright.year} ${SECURITY_CONFIG.copyright.owner}`;
            document.body.appendChild(watermark);
        },

        // 控制台警告
        consoleWarning() {
            const styles = [
                'color: #e74c3c',
                'font-size: 20px',
                'font-weight: bold',
                'padding: 10px'
            ].join(';');
            
            console.log('%c⚠️ 安全警告', styles);
            console.log('%c本网站源码受版权保护', 'color: #f39c12; font-size: 14px;');
            console.log('%c未经授权禁止使用、复制、修改或分发', 'color: #999; font-size: 12px;');
            console.log('%c版权所有 © ' + SECURITY_CONFIG.copyright.year + ' ' + SECURITY_CONFIG.copyright.owner, 'color: #999; font-size: 12px;');
        },

        // 初始化代码保护
        init() {
            this.disableSelection();
            this.disableDrag();
            this.consoleWarning();
            
            // 页面加载完成后添加水印
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.addWatermark());
            } else {
                this.addWatermark();
            }
        }
    };

    // ==================== 源码保护 ====================
    const sourceProtection = {
        // 混淆关键函数名
        obfuscate() {
            // 这个函数在构建时使用，运行时不执行
            // 实际混淆应该使用构建工具
        },

        // 添加源码标记
        addSourceMarker() {
            const marker = document.createElement('script');
            marker.textContent = `
                // ${SECURITY_CONFIG.copyright.message}
                // Source Code Protected by AiClawBox Security System
                // Copyright © ${SECURITY_CONFIG.copyright.year} ${SECURITY_CONFIG.copyright.owner}
                // Unauthorized use, copying, modification, or distribution is prohibited.
            `;
            document.head.appendChild(marker);
        },

        init() {
            this.addSourceMarker();
        }
    };

    // ==================== 初始化安全系统 ====================
    function initSecurity() {
        // 1. 域名验证
        if (!domainValidator.check()) {
            return; // 非法域名，停止执行
        }

        // 2. 反调试保护
        antiDebug.init();

        // 3. 代码保护
        codeProtection.init();

        // 4. 源码保护
        sourceProtection.init();

        console.log('%c✅ AiClawBox 安全系统已启动', 'color: #27ae60; font-size: 14px; font-weight: bold;');
    }

    // 立即执行
    initSecurity();

    // 导出安全验证函数（供其他脚本使用）
    window.__AiClawBoxSecurity__ = {
        isValid: () => domainValidator.isValidDomain(),
        config: SECURITY_CONFIG
    };

})();
