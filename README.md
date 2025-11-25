

------

------

# 📚 AI Chat Assistant

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js) ![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript) ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma) ![TailwindCSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css)

A full-stack AI chat application built with Next.js 14+ and LangChain, featuring multimodal conversations, PDF document analysis, and web search capabilities.

[English](#english) | [中文](#chinese)

<a name="english"></a>

------

## ENGLISH VERSION

### ✨ Key Features

#### 🤖 Intelligent Conversation System

- **Multimodal Support**: Text + Image mixed input, supporting GPT-4 Vision, Claude 3, and other vision models 
- **Streaming Response**: Real-time streaming output via Server-Sent Events (SSE) for enhanced user experience
- **Multi-Model Switching**: Support for all AI models on OpenRouter platform (GPT-4, Claude, Gemini, etc.)
- **Context Management**: Smart conversation history management with multi-turn dialogue support

#### 📄 PDF Intelligent Analysis (RAG)

- **Document Parsing**: Automatic extraction of PDF text content and page information
- **Vector Retrieval**: Semantic search based on Embeddings for precise content location 
- **Smart Q&A**:
  - Query rewriting (standardization + expansion/decomposition strategies)
  - Dynamic threshold adjustment (0.6 → 0.4 → uniform sampling)
  - Multiple fallback mechanisms ensuring retrieval success rate
- **Source Tracing**: Answers annotated with specific page numbers and relevance scores

#### 🌐 Web Search Functionality

- **Real-time Search**: Integrated Bocha Search API for latest web information 
- **Citation Sources**: Automatic extraction and formatting of search results into citation cards
- **Multimodal Web Search**: Support for image + text web searches

#### 👤 User System

- **Authentication**: Email + password login via NextAuth.js
- **Session Management**:
  - Auto-generated conversation titles (AI-based)
  - Paginated conversation list loading
  - Support for rename and delete operations
- **Message Persistence**: All conversation records saved to PostgreSQL database

#### 🎨 Modern UI

- **Responsive Design**: Perfect adaptation for desktop and mobile
- **Dark Mode**: Light/dark theme switching support
- **Markdown Rendering**: Complete support for code highlighting, tables, lists, etc.
- **Animation Effects**: Smooth interactions with message fade-ins, loading animations, etc.

------

### 🏗️ Technical Architecture

#### Frontend Stack

```
Next.js 15 (App Router)
├── React 18 (Server + Client Components)
├── TailwindCSS 3 (Atomic CSS)
├── Shadcn/ui (High-quality component library)
└── React Markdown (Markdown rendering)
```

#### Backend Stack

```
Next.js API Routes
├── NextAuth.js (Authentication)
├── Prisma ORM (Database operations)
├── PostgreSQL (Relational database)
├── LangChain (AI framework)
│   ├── ChatOpenAI (Model invocation)
│   ├── Agent (Web search)
│   └── Vector Store (Vector retrieval)
└── OpenRouter API (Multi-model aggregation platform)
```

#### AI Capabilities

- **Model Support**: GPT-4, Claude 3.5, Gemini Pro, DeepSeek, etc. 
- **RAG Technology**: Document vectorization + semantic retrieval
- **Agent Framework**: Tool invocation via LangChain Agent
- **Streaming Output**: Token-level streaming response support

------

### 📦 Project Structure

```
AI-ASSISTANT11/
├── ai-chat-app/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Authentication
│   │   │   │   ├── [...nextauth]/route.js    # NextAuth config
│   │   │   │   └── register/route.js         # User registration
│   │   │   ├── chat/route.js                 # Regular chat
│   │   │   ├── chat-pdf/route.js             # PDF chat (RAG)
│   │   │   ├── chat-web-search/route.js      # Web search
│   │   │   ├── conversations/                # Session management
│   │   │   ├── messages/                     # Message operations
│   │   │   ├── pdf/                          # PDF file management
│   │   │   ├── upload/route.js               # Image upload
│   │   │   └── user/profile/route.js         # User info
│   │   ├── components/               # React components
│   │   │   └── chat/                 # Chat components
│   │   │       ├── ChatLayout.js     # Main layout
│   │   │       ├── Sidebar.js        # Sidebar
│   │   │       ├── ChatArea.js       # Chat area
│   │   │       ├── InputArea.js      # Input box
│   │   │       └── MessageItem.js    # Message item
│   │   ├── login/page.js             # Login page
│   │   ├── register/page.js          # Registration page
│   │   ├── profile/page.js           # Profile page
│   │   ├── layout.js                 # Root layout
│   │   ├── page.js                   # Home page
│   │   └── globals.css               # Global styles
│   ├── lib/                          # Utility libraries
│   │   ├── hooks/                    # Custom hooks
│   │   ├── langchain/                # LangChain config
│   │   ├── rag/                      # RAG retrieval logic
│   │   ├── prisma.js                 # Prisma client
│   │   └── api-client.js             # API wrapper
│   ├── prisma/                       # Database
│   │   ├── schema.prisma             # Data model definition
│   │   └── migrations/               # Migration files
│   ├── public/                       # Static assets
│   │   └── uploads/                  # User uploads
│   ├── .env.local                    # Environment variables
│   ├── next.config.mjs               # Next.js config
│   ├── tailwind.config.js            # Tailwind config
│   └── package.json                  # Dependencies
```

------

### 🚀 Quick Start

#### Requirements

- Node.js 18.17 or higher
- PostgreSQL 14+ database
- OpenRouter API Key ([Register here](https://openrouter.ai/))

#### Installation

1. **Clone the project**

```
git clone <repository-url>
cd AI-ASSISTANT11/ai-chat-app
```

1. **Install dependencies**

```
npm install
# or
pnpm install
```

1. **Configure environment variables**

Create `.env.local` file:

```
# Database connection (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/ai_chat"

# NextAuth configuration
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# OpenRouter API (AI models)
OPENAI_API_KEY="sk-or-v1-xxxxx"  # Get from https://openrouter.ai/

# Application config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

1. **Initialize database**

```
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) View database
npx prisma studio
```

1. **Start development server**

```

npm run dev
```

Visit [http://localhost:3000](http://localhost:3000/) 🎉

------

### 📊 Database Models

```
model User {
  id           String         @id @default(cuid())
  email        String         @unique
  name         String?
  passwordHash String
  role         String         @default("user")
  conversations Conversation[]
  pdfs         PDF[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

model Conversation {
  id        String    @id @default(cuid())
  userId    String
  title     String
  model     String
  messages  Message[]
  user      User      @relation(fields: [userId], references: [id])
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String       // "user" | "assistant"
  content        String       @db.Text
  images         String[]     // Image URL array
  tokensUsed     Int?
  isWebSearch    Boolean      @default(false)
  citations      Json?        // Web search citation sources
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())
}

model PDF {
  id           String          @id @default(cuid())
  userId       String
  name         String
  fileName     String
  filePath     String
  size         Int
  status       String          @default("processing")  // processing | ready | failed
  totalPages   Int?
  totalChunks  Int             @default(0)
  processedAt  DateTime?
  errorMessage String?
  user         User            @relation(fields: [userId], references: [id])
  chunks       DocumentChunk[]
  createdAt    DateTime        @default(now())
}

model DocumentChunk {
  id         String   @id @default(cuid())
  pdfId      String
  content    String   @db.Text
  embedding  Float[]  // Vector embeddings
  chunkIndex Int
  pageNumber Int?
  pdf        PDF      @relation(fields: [pdfId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
}
```

------

### 🎯 API Documentation

#### Authentication

| Endpoint             | Method | Description         |
| -------------------- | ------ | ------------------- |
| `/api/auth/register` | POST   | User registration   |
| `/api/auth/signin`   | POST   | User login          |
| `/api/auth/signout`  | POST   | User logout         |
| `/api/auth/session`  | GET    | Get current session |

#### Chat

| Endpoint               | Method | Description                       |
| ---------------------- | ------ | --------------------------------- |
| `/api/chat`            | POST   | Regular chat (with image support) |
| `/api/chat-pdf`        | POST   | PDF document chat (RAG)           |
| `/api/chat-web-search` | POST   | Web search chat                   |

#### Session Management

| Endpoint                          | Method | Description                 |
| --------------------------------- | ------ | --------------------------- |
| `/api/conversations`              | GET    | Get conversation list       |
| `/api/conversations`              | POST   | Create new conversation     |
| `/api/conversations/:id`          | PATCH  | Update conversation         |
| `/api/conversations/:id`          | DELETE | Delete conversation         |
| `/api/conversations/:id/messages` | GET    | Get conversation messages   |
| `/api/conversations/:id/title`    | POST   | Generate conversation title |

#### PDF Management

| Endpoint          | Method | Description             |
| ----------------- | ------ | ----------------------- |
| `/api/pdf/upload` | POST   | Upload PDF file         |
| `/api/pdf/list`   | GET    | Get PDF list            |
| `/api/pdf/delete` | DELETE | Delete PDF file         |
| `/api/pdf/status` | GET    | Query processing status |

------

### 🐳 Docker Deployment

#### 1. Build image

```

docker build -t ai-chat-app .
```

#### 2. Using Docker Compose

```
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ai_chat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/ai_chat
      NEXTAUTH_SECRET: your_secret
      OPENAI_API_KEY: sk-or-v1-xxxxx
    depends_on:
      - postgres
    volumes:
      - ./public/uploads:/app/public/uploads

volumes:
  postgres_data:
```

Start services:

```

docker-compose up -d
```

------

### 🔒 Security Features

-  **Password Encryption**: bcryptjs password hashing (10 rounds of salting)
-  **JWT Session**: NextAuth.js JWT-based stateless authentication
-  **CSRF Protection**: Built-in CSRF token verification
-  **Permission Verification**: All API endpoints verify user identity and resource ownership
-  **SQL Injection Protection**: Prisma ORM parameterized queries
-  **XSS Protection**: React auto-escaping + DOMPurify sanitization

------

### 📈 Performance Optimization

- ⚡ **Server Components**: Reduced client-side JavaScript bundle size
- ⚡ **Streaming Response**: SSE real-time output, reduced time to first byte
- ⚡ **Image Optimization**: Next.js Image component auto-optimization
- ⚡ **Code Splitting**: Dynamic imports reduce initial load time
- ⚡ **Database Indexing**: Key fields indexed for faster queries
- ⚡ **Vector Retrieval Optimization**: pgvector extension accelerates similarity search

------

### 🛠️ Development Guide

#### Adding New AI Models

```
// lib/models.js
export const AI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4 Omni', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  // Add new model
  { id: 'your-model-id', name: 'Model Name', provider: 'Provider' }
];
```

#### Custom System Prompts

```
// app/api/chat/route.js
const systemMessage = {
  role: 'system',
  content: `You are a professional AI assistant...
  
  ## Core Capabilities
  - Natural conversation
  - Knowledge Q&A
  - Code generation
  
  ## Answer Principles
  1. Accuracy first
  2. Structured output
  3. Friendly tone`
};
```

------

### 🧪 Testing

```
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Code coverage
npm run test:coverage
```

------

### 📝 Changelog

#### v1.0.0 (2025-11-15)

- ✨ Initial release
- ✨ Multimodal conversation support (text + images)
- ✨ RAG technology integration for PDF intelligent Q&A
- ✨ Web search functionality (Bocha API)
- ✨ Complete user authentication system
- ✨ Session management and message persistence

------

### 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

------

### 📄 License

This project is licensed under the MIT License - see [LICENSE](https://monica.im/home/chat/Claude 4.5 Sonnet/LICENSE) file for details

------

### 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React full-stack framework
- [LangChain](https://js.langchain.com/) - AI application development framework
- [OpenRouter](https://openrouter.ai/) - Multi-model aggregation platform
- [Prisma](https://www.prisma.io/) - Modern ORM
- [Shadcn/ui](https://ui.shadcn.com/) - High-quality component library

------

- ## 📧 Contact

  - **Author**: lishixian2011
  - **Email**: [lishixian2011@gmail.com](mailto:your.email@example.com)
  - **GitHub**: [@lishixian2011](https://github.com/lishixian2011)
  - **LinkedIn**: [Your Profile](https://linkedin.com/in/yourprofile)

------

<div align="center">

**If this project helps you, please give it a ⭐️ Star!**



# 📚 AI Chat Assistant - 智能对话助手

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js) ![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript) ![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma) ![TailwindCSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css)

基于 Next.js 14+ 和 LangChain 构建的全栈 AI 聊天应用，支持多模态对话、PDF 文档分析和联网搜索功能。

[English](#english) | [中文](#chinese)

<a name="chinese"></a>

------

## 中文版本

### ✨ 核心特性

#### 🤖 智能对话系统

- **多模态支持**：文本 + 图片混合输入，支持 GPT-4 Vision、Claude 3 等视觉模型 
- **流式响应**：Server-Sent Events (SSE) 实时流式输出，提升用户体验
- **多模型切换**：支持 OpenRouter 平台的所有 AI 模型（GPT-4、Claude、Gemini 等）
- **上下文管理**：智能会话历史管理，支持多轮对话

#### 📄 PDF 智能分析（RAG）

- **文档解析**：自动提取 PDF 文本内容和页码信息
- **向量检索**：基于 Embeddings 的语义搜索，精准定位相关内容 
- **智能问答**：
  - 查询重写（标准化 + 扩展/分解策略）
  - 动态阈值调整（0.6 → 0.4 → 均匀采样）
  - 多重回退机制确保检索成功率
- **来源追溯**：回答时标注具体页码和相关度评分

#### 🌐 联网搜索功能

- **实时搜索**：集成博查搜索 API，获取最新网络信息 
- **引用来源**：自动提取搜索结果并格式化为引用卡片
- **多模态联网**：支持图片 + 文本的联网搜索

#### 👤 用户系统

- **身份认证**：NextAuth.js 实现邮箱 + 密码登录
- **会话管理**：
  - 自动生成会话标题（基于 AI）
  - 会话列表分页加载
  - 支持重命名、删除操作
- **消息持久化**：所有对话记录保存到 PostgreSQL 数据库

#### 🎨 现代化 UI

- **响应式设计**：完美适配桌面端和移动端
- **暗色模式**：支持亮色/暗色主题切换
- **Markdown 渲染**：代码高亮、表格、列表等完整支持
- **动画效果**：消息淡入、加载动画等流畅交互

------

### 🏗️ 技术架构

#### 前端技术栈

```
Next.js 15 (App Router)
├── React 18 (服务端组件 + 客户端组件)
├── TailwindCSS 3 (原子化 CSS)
├── Shadcn/ui (高质量组件库)
└── React Markdown (Markdown 渲染)
```

#### 后端技术栈

```
Next.js API Routes
├── NextAuth.js (身份认证)
├── Prisma ORM (数据库操作)
├── PostgreSQL (关系型数据库)
├── LangChain (AI 框架)
│   ├── ChatOpenAI (模型调用)
│   ├── Agent (联网搜索)
│   └── Vector Store (向量检索)
└── OpenRouter API (多模型聚合平台)
```

#### AI 能力

- **模型支持**：GPT-4、Claude 3.5、Gemini Pro、DeepSeek 等 
- **RAG 技术**：文档向量化 + 语义检索
- **Agent 框架**：LangChain Agent 实现工具调用
- **流式输出**：支持 Token 级别的流式响应

------

### 📦 项目结构

```
AI-ASSISTANT11/
├── ai-chat-app/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API 路由
│   │   │   ├── auth/                 # 认证相关
│   │   │   │   ├── [...nextauth]/route.js    # NextAuth 配置
│   │   │   │   └── register/route.js         # 用户注册
│   │   │   ├── chat/route.js                 # 普通聊天
│   │   │   ├── chat-pdf/route.js             # PDF 对话（RAG）
│   │   │   ├── chat-web-search/route.js      # 联网搜索
│   │   │   ├── conversations/                # 会话管理
│   │   │   ├── messages/                     # 消息操作
│   │   │   ├── pdf/                          # PDF 文件管理
│   │   │   ├── upload/route.js               # 图片上传
│   │   │   └── user/profile/route.js         # 用户信息
│   │   ├── components/               # React 组件
│   │   │   └── chat/                 # 聊天相关组件
│   │   │       ├── ChatLayout.js     # 主布局
│   │   │       ├── Sidebar.js        # 侧边栏
│   │   │       ├── ChatArea.js       # 聊天区域
│   │   │       ├── InputArea.js      # 输入框
│   │   │       └── MessageItem.js    # 消息项
│   │   ├── login/page.js             # 登录页
│   │   ├── register/page.js          # 注册页
│   │   ├── profile/page.js           # 个人中心
│   │   ├── layout.js                 # 根布局
│   │   ├── page.js                   # 主页
│   │   └── globals.css               # 全局样式
│   ├── lib/                          # 工具库
│   │   ├── hooks/                    # 自定义 Hooks
│   │   ├── langchain/                # LangChain 配置
│   │   ├── rag/                      # RAG 检索逻辑
│   │   ├── prisma.js                 # Prisma 客户端
│   │   └── api-client.js             # API 封装
│   ├── prisma/                       # 数据库
│   │   ├── schema.prisma             # 数据模型定义
│   │   └── migrations/               # 迁移文件
│   ├── public/                       # 静态资源
│   │   └── uploads/                  # 用户上传文件
│   ├── .env.local                    # 环境变量
│   ├── next.config.mjs               # Next.js 配置
│   ├── tailwind.config.js            # Tailwind 配置
│   └── package.json                  # 依赖管理
```

------

### 🚀 快速开始

#### 环境要求

- Node.js 18.17 或更高版本
- PostgreSQL 14+ 数据库
- OpenRouter API Key（[注册获取](https://openrouter.ai/)）

#### 安装步骤

1. **克隆项目**

```
git clone <repository-url>
cd AI-ASSISTANT11/ai-chat-app
```

1. **安装依赖**

```
npm install
# 或
pnpm install
```

1. **配置环境变量**

创建 `.env.local` 文件：

```
# 数据库连接（PostgreSQL）
DATABASE_URL="postgresql://username:password@localhost:5432/ai_chat"

# NextAuth 配置
NEXTAUTH_SECRET="your-secret-key-here"  # 运行 openssl rand -base64 32 生成
NEXTAUTH_URL="http://localhost:3000"

# OpenRouter API（AI 模型）
OPENAI_API_KEY="sk-or-v1-xxxxx"  # 从 https://openrouter.ai/ 获取

# 应用配置
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

1. **初始化数据库**

```
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# （可选）查看数据库
npx prisma studio
```

1. **启动开发服务器**

```
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000/) 🎉

------

### 📊 数据库模型

```
model User {
  id           String         @id @default(cuid())
  email        String         @unique
  name         String?
  passwordHash String
  role         String         @default("user")
  conversations Conversation[]
  pdfs         PDF[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

model Conversation {
  id        String    @id @default(cuid())
  userId    String
  title     String
  model     String
  messages  Message[]
  user      User      @relation(fields: [userId], references: [id])
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String       // "user" | "assistant"
  content        String       @db.Text
  images         String[]     // 图片 URL 数组
  tokensUsed     Int?
  isWebSearch    Boolean      @default(false)
  citations      Json?        // 联网搜索引用来源
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())
}

model PDF {
  id           String          @id @default(cuid())
  userId       String
  name         String
  fileName     String
  filePath     String
  size         Int
  status       String          @default("processing")  // processing | ready | failed
  totalPages   Int?
  totalChunks  Int             @default(0)
  processedAt  DateTime?
  errorMessage String?
  user         User            @relation(fields: [userId], references: [id])
  chunks       DocumentChunk[]
  createdAt    DateTime        @default(now())
}

model DocumentChunk {
  id         String   @id @default(cuid())
  pdfId      String
  content    String   @db.Text
  embedding  Float[]  // 向量 Embeddings
  chunkIndex Int
  pageNumber Int?
  pdf        PDF      @relation(fields: [pdfId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
}
```

------

### 🔧 核心功能实现

#### 1. 多模态对话（文本 + 图片）

**前端上传图片**：

```
// app/components/chat/InputArea.js
const handleImageUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  const { url } = await response.json();
  setImages([...images, url]);
};
```

**后端处理图片**：

```
// app/api/chat/route.js
// 将本地图片转换为 Base64
const imageBuffer = await fs.readFile(filePath);
const base64Image = imageBuffer.toString('base64');

// 构造多模态消息
const multimodalMessage = {
  role: 'user',
  content: [
    { type: 'text', text: userMessage.content },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` }}
  ]
};
```

#### 2. PDF 智能检索（RAG）

**查询重写策略**：

```
// app/api/chat-pdf/route.js
async function rewriteQuery(originalQuery) {
  // 步骤1：标准化（去除口语化）
  const normalizedQuery = await llm.invoke(normalizationPrompt);
  
  // 步骤2：判断问题类型
  if (isCompoundQuery) {
    // 复合问题 → 查询分解
    const subQueries = await llm.invoke(decompositionPrompt);
  } else {
    // 标准问题 → 查询扩展（添加同义词）
    const expandedQuery = await llm.invoke(expansionPrompt);
  }
  
  return finalQuery;
}
```

**智能检索流程**：

```
// 策略1：标准检索（阈值 0.6）
let chunks = await searchSimilarChunks(query, { threshold: 0.6, topK: 5 });

// 策略2：降低阈值（0.4）
if (chunks.length < 3) {
  chunks = await searchSimilarChunks(query, { threshold: 0.4, topK: 8 });
}

// 策略3：均匀采样
if (chunks.length < 3) {
  chunks = await uniformSampling(pdfId, 10);
}

// 策略4：取前 N 个块（最终回退）
if (chunks.length === 0) {
  chunks = await getFirstNChunks(pdfId, 10);
}
```

#### 3. 联网搜索（Agent）

**LangChain Agent 配置**：

```
// lib/langchain/agent.js
import { createReactAgent } from '@langchain/langgraph/prebuilt';

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: [bochaWebSearchTool],  // 博查搜索工具
  messageModifier: systemPrompt
});
```

**流式返回引用来源**：

```
// app/api/chat-web-search/route.js
for await (const chunk of streamAgentResponse(agent, message)) {
  if (chunk.type === 'tool_call' && chunk.toolName === 'bocha_web_search') {
    const citations = formatCitations(chunk.result);
    // 立即发送引用来源到前端
    controller.enqueue(encoder.encode(
      `data: ${JSON.stringify({ type: 'citations', citations })}\\n\\n`
    ));
  }
}
```

------

### 🎯 API 接口文档

#### 认证相关

| 接口                 | 方法 | 说明         |
| -------------------- | ---- | ------------ |
| `/api/auth/register` | POST | 用户注册     |
| `/api/auth/signin`   | POST | 用户登录     |
| `/api/auth/signout`  | POST | 用户登出     |
| `/api/auth/session`  | GET  | 获取当前会话 |

#### 聊天相关

| 接口                   | 方法 | 说明                 |
| ---------------------- | ---- | -------------------- |
| `/api/chat`            | POST | 普通聊天（支持图片） |
| `/api/chat-pdf`        | POST | PDF 文档对话（RAG）  |
| `/api/chat-web-search` | POST | 联网搜索聊天         |

#### 会话管理

| 接口                              | 方法   | 说明         |
| --------------------------------- | ------ | ------------ |
| `/api/conversations`              | GET    | 获取会话列表 |
| `/api/conversations`              | POST   | 创建新会话   |
| `/api/conversations/:id`          | PATCH  | 更新会话     |
| `/api/conversations/:id`          | DELETE | 删除会话     |
| `/api/conversations/:id/messages` | GET    | 获取会话消息 |
| `/api/conversations/:id/title`    | POST   | 生成会话标题 |

#### PDF 管理

| 接口              | 方法   | 说明          |
| ----------------- | ------ | ------------- |
| `/api/pdf/upload` | POST   | 上传 PDF 文件 |
| `/api/pdf/list`   | GET    | 获取 PDF 列表 |
| `/api/pdf/delete` | DELETE | 删除 PDF 文件 |
| `/api/pdf/status` | GET    | 查询处理状态  |

------

### 🐳 Docker 部署

#### 1. 构建镜像

```
docker build -t ai-chat-app .
```

#### 2. 使用 Docker Compose

```
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ai_chat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:your_password@postgres:5432/ai_chat
      NEXTAUTH_SECRET: your_secret
      OPENAI_API_KEY: sk-or-v1-xxxxx
    depends_on:
      - postgres
    volumes:
      - ./public/uploads:/app/public/uploads

volumes:
  postgres_data:
```

启动服务：

```
docker-compose up -d
```

------

### 🔒 安全特性

-  **密码加密**：使用 bcryptjs 进行密码哈希（10 轮加盐）
-  **JWT Session**：NextAuth.js 基于 JWT 的无状态认证
-  **CSRF 保护**：内置 CSRF Token 验证
-  **权限验证**：所有 API 接口验证用户身份和资源所有权
-  **SQL 注入防护**：Prisma ORM 参数化查询
-  **XSS 防护**：React 自动转义 + DOMPurify 清理

------

### 📈 性能优化

- ⚡ **服务端组件**：减少客户端 JavaScript 体积
- ⚡ **流式响应**：SSE 实时输出，降低首字节时间
- ⚡ **图片优化**：Next.js Image 组件自动优化
- ⚡ **代码分割**：动态导入减少初始加载时间
- ⚡ **数据库索引**：关键字段添加索引提升查询速度
- ⚡ **向量检索优化**：pgvector 扩展加速相似度搜索

------

### 🛠️ 开发指南

#### 添加新的 AI 模型

```
// lib/models.js
export const AI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4 Omni', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  // 添加新模型
  { id: 'your-model-id', name: '模型名称', provider: '提供商' }
];
```

#### 自定义系统提示词

```
// app/api/chat/route.js
const systemMessage = {
  role: 'system',
  content: `你是一个专业的 AI 助手...
  
  ## 核心能力
  - 自然对话
  - 知识问答
  - 代码生成
  
  ## 回答原则
  1. 准确性优先
  2. 结构化输出
  3. 友好的语气`
};
```

#### 扩展 RAG 功能

```
// lib/rag/retrieval.js
export async function searchSimilarChunks(query, options) {
  // 1. 生成查询向量
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. 向量相似度搜索
  const results = await prisma.$queryRaw`
    SELECT *, 
           1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "DocumentChunk"
    WHERE "pdfId" = ${options.pdfId}
      AND 1 - (embedding <=> ${queryEmbedding}::vector) > ${options.threshold}
    ORDER BY similarity DESC
    LIMIT ${options.topK}
  `;
  
  return results;
}
```

------

### 🧪 测试

```
# 运行单元测试
npm run test

# 运行 E2E 测试
npm run test:e2e

# 代码覆盖率
npm run test:coverage
```

------

### 📝 更新日志

#### v1.0.0 (2025-11-15)

- ✨ 初始版本发布
- ✨ 支持多模态对话（文本 + 图片）
- ✨ 集成 RAG 技术实现 PDF 智能问答
- ✨ 联网搜索功能（博查 API）
- ✨ 完整的用户认证系统
- ✨ 会话管理和消息持久化

------

### 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

------

### 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](https://monica.im/home/chat/Claude 4.5 Sonnet/LICENSE) 文件

------

### 🙏 致谢

- [Next.js](https://nextjs.org/) - React 全栈框架
- [LangChain](https://js.langchain.com/) - AI 应用开发框架
- [OpenRouter](https://openrouter.ai/) - 多模型聚合平台
- [Prisma](https://www.prisma.io/) - 现代化 ORM
- [Shadcn/ui](https://ui.shadcn.com/) - 高质量组件库

------

- ## 📧 联系方式

  - **作者**：lishixian2011
  - **邮箱**：[lishixian2011@gmail.com](mailto:your.email@example.com)
  - **GitHub**：[@lishixian2011](https://github.com/lishixian2011)
  - **LinkedIn**：[您的主页](https://linkedin.com/in/yourprofile)

------

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ Star！**

