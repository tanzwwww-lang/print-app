# 多维表格插件开发环境

这是一个基于 Base JS SDK 的多维表格插件开发环境模板，帮助开发者快速搭建和开发多维表格插件。

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm start
```

开发服务器将在 `http://localhost:3000` 启动。

### 构建生产版本
```bash
npm run build
```

## 📁 项目结构

```
print1.0/
├── public/
│   └── index.html          # HTML 模板
├── src/
│   ├── App.tsx             # 主应用组件
│   ├── App.css             # 应用样式
│   ├── index.tsx           # 应用入口
│   └── index.css           # 全局样式
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── webpack.config.js       # Webpack 配置
└── README.md              # 项目说明
```

## 🔧 技术栈

- **React 18** - 用户界面框架
- **TypeScript** - 类型安全的 JavaScript
- **Ant Design** - UI 组件库
- **Base JS SDK** - 多维表格 API 接口
- **Webpack 5** - 模块打包工具

## 📖 使用说明

### 在多维表格中使用插件

1. 打开任意多维表格
2. 点击右侧的「插件」按钮
3. 选择「自定义插件」
4. 点击「+ 新增插件」
5. 输入开发服务器地址：`http://localhost:3000`
6. 点击「确定」加载插件

### 开发自定义功能

在 `src/App.tsx` 中可以：

- 使用 `bitable.base.getActiveTable()` 获取当前表格
- 使用 `table.getFieldList()` 获取字段列表
- 使用 `table.getRecordList()` 获取记录列表
- 使用各种字段类型的 API 进行数据操作

### 示例代码

```typescript
import { bitable, FieldType } from '@lark-base-open/js-sdk';

// 获取当前表格
const table = await bitable.base.getActiveTable();

// 获取所有文本字段
const textFields = await table.getFieldListByType(FieldType.Text);

// 获取记录列表
const recordList = await table.getRecordList();
```

## 🎯 功能特性

- ✅ 完整的 TypeScript 支持
- ✅ 热重载开发环境
- ✅ Ant Design UI 组件
- ✅ Base JS SDK 集成
- ✅ 响应式设计
- ✅ 错误处理机制

## 📚 相关文档

- [Base JS SDK 文档](https://lark-base-team.github.io/js-sdk-docs/zh/)
- [多维表格插件开发指南](https://feishu.feishu.cn/docx/S1pMdbckEooVlhx53ZMcGGnMnKc)
- [React 官方文档](https://react.dev/)
- [Ant Design 组件库](https://ant.design/)

## 🤝 开发建议

1. **遵循 TypeScript 最佳实践**：充分利用类型系统提高代码质量
2. **使用字段类型限制**：在获取字段时指定具体类型以获得更好的开发体验
3. **错误处理**：始终添加 try-catch 来处理 API 调用可能的错误
4. **用户体验**：添加加载状态和友好的错误提示

## 🚀 部署

### 本地部署
开发完成后，运行 `npm run build` 生成生产版本，将 `dist` 目录部署到任何静态文件服务器。

### Replit 部署
1. 将代码推送到 GitHub
2. 在 Replit 中导入 GitHub 仓库
3. 运行项目并获取公开 URL
4. 在多维表格中使用该 URL

## 📝 许可证

MIT License

## 🆘 获取帮助

如果在开发过程中遇到问题，可以：

1. 查看 [Base JS SDK 文档](https://lark-base-team.github.io/js-sdk-docs/zh/)
2. 参考项目中的示例代码
3. 在多维表格开发者社区寻求帮助

---

**Happy Coding! 🎉**