/**
 * 图片加载兜底脚本
 * 处理 IntersectionObserver 懒加载未覆盖的图片
 */
(function() {
    'use strict';

    function fixImages() {
        var lazyImages = document.querySelectorAll('img[data-raw-src]');
        var fixed = 0;

        lazyImages.forEach(function(img) {
            var realSrc = img.getAttribute('data-raw-src');
            // 只处理尚未加载的图片（src 仍为占位图且未被 IntersectionObserver 处理）
            if (realSrc && realSrc !== img.src && !img.dataset.loaded) {
                // 检查图片是否在视口内（IntersectionObserver 应已处理）
                // 此处仅作为兜底：如果图片已进入视口但未加载，则直接设置
                var rect = img.getBoundingClientRect();
                var inViewport = rect.top < window.innerHeight + 500 && rect.bottom > -500;
                if (inViewport) {
                    img.src = realSrc;
                    img.dataset.loaded = '1';
                    fixed++;
                }
            }
        });

        if (fixed > 0) {
            console.log('兜底修复了', fixed, '张图片');
        }
    }

    // 延迟执行，优先让 IntersectionObserver 处理
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(fixImages, 2000);
        });
    } else {
        setTimeout(fixImages, 2000);
    }

    // 5秒后再次检查
    setTimeout(fixImages, 5000);

    // 监听 DOM 变化，处理动态添加的图片
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            var hasNewImages = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeName === 'IMG' && node.getAttribute('data-raw-src') && !node.dataset.loaded) {
                            hasNewImages = true;
                        }
                        if (node.querySelectorAll) {
                            var imgs = node.querySelectorAll('img[data-raw-src]');
                            if (imgs.length > 0) hasNewImages = true;
                        }
                    });
                }
            });
            if (hasNewImages) {
                setTimeout(fixImages, 100);
            }
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }

})();
