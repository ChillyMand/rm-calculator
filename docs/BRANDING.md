# 品牌与图片资源

## 品牌层级

- 运动产品品牌：糯米饭运动
- 英文标识：`WZRICE / SPORTS`
- 主品牌：糯米饭大王 / WZRICE

计算器和支持页的页头使用“糯米饭运动”，页脚保留“糯米饭大王 / WZRICE”主品牌标识。

## 网页资源

| 文件 | 用途 | 尺寸 | 大小 |
| --- | --- | ---: | ---: |
| `rm-calculator/favicon.png` | 浏览器 favicon | 32 × 32 | 约 4 KB |
| `rm-calculator/apple-touch-icon.png` | Apple 设备主屏图标 | 180 × 180 | 约 28 KB |
| `rm-calculator/sports-logo.webp` | 页头运动品牌图标 | 128 × 128 | 约 12 KB |
| `rm-calculator/rice-king-wordmark.webp` | 页脚主品牌长版 Logo | 720 × 254 | 约 68 KB |

网页资源使用透明 PNG 或无损 WebP，在保留透明背景和品牌细节的同时降低传输体积。
页面使用 `favicon.png?v=20260926` 引用标签页图标，文件名保持为 `favicon.png`，版本参数用于在更新时绕过浏览器的 favicon 缓存。

## 更换要求

1. 页头图标应保持正方形透明画布，避免在 32–38 px 显示尺寸下变形。
2. 页脚 Logo 应裁切无效透明留白，保持长版比例。
3. 更换资源后需同时检查计算器主页与支持页。
4. 更换资源后运行 `node --test rm-calculator/test/*.test.js`。
5. 不再被 HTML 或 CSS 引用的旧品牌资源应从部署目录中删除。
