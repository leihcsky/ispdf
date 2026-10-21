# ispdf

英文单页工具：在浏览器里调整 PDF 页面尺寸（A3、A4、A5、Letter、Legal、Tabloid 或自定义宽高）。文件不上传。

这不是 PDF 压缩工具。

## 本地运行

需要 Node.js 20+。当前依赖在 Node 20.17 上可以完成安装和构建；npm 会提示部分传递依赖希望使用 Node 20.19+ 或 Node 22。

```powershell
npm install
npm run dev
```

开发地址是 http://localhost:4321/ 。

```powershell
npm run verify:pdf
npm run build
npm run preview
```

`verify:pdf` 用合成 PDF 检查页面尺寸、Fit / Fill / Stretch、旋转、CropBox、链接和失败场景。结果说明见 [docs/pdf-feasibility.md](docs/pdf-feasibility.md)。

## 部署

站点是静态文件，没有后端。构建前设置正式站点地址，canonical、Open Graph 和 sitemap 都会使用它：

```powershell
$env:PUBLIC_SITE_URL="https://ispdf.org"
npm run build
```

把 `dist/` 上传到任意静态托管。未设置 `PUBLIC_SITE_URL` 时，canonical 和 sitemap 默认使用 `https://ispdf.org`。本地开发地址仍然是 http://localhost:4321/ 。

## 处理方式

`@cantoo/pdf-lib` 在 Web Worker 中缩放页面内容并改写页面盒子。库在用户选择文件后才加载，用来读取页数；点击 Resize PDF 时在同一个 Worker 里生成新文件。源码里没有上传请求。

上限：20 MB，不限制页数。自定义边长 1–14400 pt（200 in）。

## 兼容性

已用合成样本验证文本、三种缩放、横向页、90/180/270 度旋转、CropBox 和链接矩形。密码 PDF 会报错。扫描件、复杂表单外观、动态 XFA 和超大文件尚未用真实文档验证。失败时保留已选设置，并显示可操作的英文说明，不展示堆栈。

## SEO 上线检查

- [ ] 用正式 `PUBLIC_SITE_URL` 重新构建，确认首页 Title、H1、meta description 与 `resize pdf` 的页面尺寸意图一致。
- [ ] 首页返回 200，canonical 指向正式 HTTPS 首页，没有 `noindex`。
- [ ] `robots.txt` 允许抓取，并指向正式 sitemap。
- [ ] `sitemap-index.xml` 可访问，且包含首页。
- [ ] 操作说明和 FAQ 在 HTML 正文里，不依赖额外请求。
- [ ] 桌面和手机都能完成选择、调整、下载。
- [ ] 浏览器网络面板里没有 PDF 上传请求，隐私声明与此一致。
- [ ] 配置 Google Search Console，提交 sitemap。
- [ ] 记录上线日期、目标关键词和当时的搜索结果，作为后续对比基线。
