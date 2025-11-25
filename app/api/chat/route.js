/**
 * ============================================================================
 * AI 聊天 API (app/api/chat/route.js)
 * ============================================================================
 * 
 * 文件作用：
 *   处理 AI 聊天请求，支持文本和图片输入，返回流式响应
 * 
 * 主要功能：
 *   1. 接收用户消息和图片
 *   2. 将本地图片转换为 Base64 格式
 *   3. 调用 OpenRouter API（通过 LangChain）
 *   4. 返回流式响应（Server-Sent Events）
 * 
 * 路由：POST /api/chat
 * 
 * 请求体：
 *   {
 *     messages: Array<{role, content}>,  // 聊天历史
 *     model: string,                     // 模型名称
 *     images?: Array<string>             // 图片 URL 列表（可选）
 *   }
 * 
 * 响应：
 *   - Content-Type: text/event-stream（流式响应）
 *   - 格式：data: {"content": "..."}\n\n
 * 
 * 技术栈：
 *   - LangChain（AI 框架）
 *   - OpenRouter（AI 模型聚合平台）
 *   - Server-Sent Events（流式传输）
 * 
 * ============================================================================
 */

import { ChatOpenAI } from "@langchain/openai";  // LangChain OpenAI 封装
import { promises as fs } from 'fs';             // Node.js 文件系统（Promise 版本）
import path from 'path';                         // 路径处理工具
import log from '@/lib/log';

/**
 * POST - AI 聊天接口
 * 
 * 流程：
 *   1. 验证请求参数
 *   2. 处理图片（转 Base64）
 *   3. 构造多模态消息
 *   4. 调用 AI 模型
 *   5. 返回流式响应
 */
export async function POST(req) {
  try {
    // ========================================================================
    // 1. 解析请求体
    // ========================================================================
    const { messages, model, images } = await req.json();

    // 验证必填参数
    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: "Invalid input: messages or model is missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 2. 配置 LangChain ChatOpenAI（使用 OpenRouter）
    // ========================================================================
    const llm = new ChatOpenAI({
      modelName: model,                           // 模型名称（如：gpt-4）
      openAIApiKey: process.env.OPENAI_API_KEY,  // API Key
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",  // OpenRouter API 地址
      },
      streaming: true,  // 启用流式响应
      
      // 可选参数（已注释）：
      // temperature: 0.8,        // 创造性（0-2，越高越随机）
      // maxTokens: 4000,         // 最大输出长度
      // topP: 0.95,              // 核采样（0-1，控制多样性）
      // frequencyPenalty: 0.3,   // 频率惩罚（减少重复）
      // presencePenalty: 0.3,    // 存在惩罚（鼓励新话题）
    });

    // ========================================================================
    // 3. 处理图片输入（转换为 Base64）
    // ========================================================================
    const lastMessage = messages[messages.length - 1];  // 最后一条用户消息
    let processedMessages = [...messages.slice(0, -1)]; // 前面的历史消息

    if (images && images.length > 0) {
      try {
        /**
         * 将图片 URL 转换为 Base64 格式
         * 
         * 支持：
         *   - 本地文件：http://localhost:3000/uploads/...
         *   - 相对路径：/uploads/...
         *   - 远程 URL：https://example.com/image.jpg
         */
        const base64Images = await Promise.all(
          images.map(async (imageUrl) => {
            try {
              // ----------------------------------------------------------
              // 处理本地图片
              // ----------------------------------------------------------
              if (imageUrl.startsWith('http:') || imageUrl.startsWith('/') || imageUrl.startsWith('https:')) {
                let filePath;
                let urlPath;
                
                if (imageUrl.startsWith('http:') || imageUrl.startsWith('https:')) {
                  // 从完整 URL 提取路径
                  urlPath = new URL(imageUrl).pathname;
                } else {
                  // 相对路径
                  urlPath = imageUrl;
                }
                
                //  处理 API 路由 URL
                if (urlPath.includes('/api/files/')) {
                  // /api/files/uploads/images/2025/11/xxx.png
                  // -> uploads/images/2025/11/xxx.png
                  const actualPath = urlPath.split('/api/files/')[1];
                  filePath = path.join(process.cwd(), 'public', actualPath);
                } else {
                  // 普通路径
                  filePath = path.join(process.cwd(), 'public', urlPath);
                }
                
                log.debug('🔍 原始 URL:', imageUrl);
                log.debug('🔍 提取路径:', urlPath);
                log.debug('🖼️ 文件路径:', filePath);
                
                // 检查文件是否存在
                try {
                  await fs.access(filePath);
                } catch {
                  throw new Error(`File not found: ${filePath}`);
                }
                
                // 读取文件并转换为 Base64
                const imageBuffer = await fs.readFile(filePath);
                const base64Image = imageBuffer.toString('base64');
                
                // 根据文件扩展名确定 MIME 类型
                const ext = path.extname(filePath).toLowerCase();
                let mimeType = 'image/jpeg'; // 默认
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.gif') mimeType = 'image/gif';
                else if (ext === '.webp') mimeType = 'image/webp';
                
                // 返回 Data URL 格式
                return `data:${mimeType};base64,${base64Image}`;
              } else {
                // ----------------------------------------------------------
                // 远程 URL 直接使用
                // ----------------------------------------------------------
                return imageUrl;
              }
            } catch (error) {
              console.error(`Error processing image ${imageUrl}:`, error);
              throw error;
            }
          })
        );

        // ------------------------------------------------------------------
        // 构造多模态消息（文本 + 图片）
        // ------------------------------------------------------------------
        const multimodalMessage = {
          role: "user",
          content: [
            {
              type: "text",
              text: lastMessage.content || "请分析这张图片"
            },
            ...base64Images.map(base64Image => ({
              type: "image_url",
              image_url: {
                url: base64Image  // Base64 Data URL
              }
            }))
          ]
        };
        
        processedMessages.push(multimodalMessage);
        
      } catch (imageError) {
        console.error("Error processing images:", imageError);
        
        // 图片处理失败，回退到文本模式
        const fallbackMessage = {
          role: "user",
          content: `${lastMessage.content} [图片处理失败，但用户上传了图片]`
        };
        processedMessages.push(fallbackMessage);
      }
    } else {
      // 没有图片，直接添加文本消息
      processedMessages.push(lastMessage);
    }

    // ========================================================================
    // 4. 添加系统提示词（定义 AI 行为）
    // ========================================================================
    const systemMessage = {
      role: "system",
      content: `你是一个专业、友好、博学的 AI 助手，名字可以叫"智能助手"。
                ## 核心能力
                - 💬 自然对话：理解上下文，提供连贯的多轮对话
                - 🧠 知识广博：涵盖技术、科学、人文、生活等多个领域
                - 🎨 创意思维：帮助用户头脑风暴、创作内容
                - 📊 数据分析：解读数据、提供洞察
                - 🖼️ 图像理解：分析和描述图片内容

                ## 回答原则
                1. **结构清晰**：使用标题、列表、表格等 Markdown 格式
                2. **详细全面**：提供完整的背景、步骤、示例
                3. **实用可行**：给出具体可操作的建议
                4. **引用来源**：重要信息标注来源或依据
                5. **友好亲和**：使用适当的表情符号，语气温和

                ## 特殊场景处理
                - **技术问题**：提供代码示例、最佳实践、常见陷阱
                - **学习问题**：给出学习路径、资源推荐、时间规划
                - **创作需求**：激发灵感、提供多个方案
                - **问题诊断**：逐步分析、定位根因、给出解决方案

                ## 回答格式
                - 使用 Markdown 语法美化排版
                - 代码用 \`\`\` 代码块包裹并标注语言
                - 重要内容用 **加粗** 或 > 引用块强调
                - 适当使用表情符号增加可读性（但不过度）

                ## 限制与边界
                - 不提供医疗诊断、法律咨询等专业建议
                - 不生成有害、违法、歧视性内容
                - 遇到不确定的信息会明确说明
                - 不假装能访问实时信息或外部系统
                ## 处理文本和图片
                - 你可以处理文本和图片内容。当用户提供图片时，请详细描述和分析图片内容。`
    };

    // 构造最终消息列表（系统提示词 + 历史消息）
    const finalMessages = [systemMessage, ...processedMessages];

    // ========================================================================
    // 5. 调用 AI 模型并返回流式响应
    // ========================================================================
    // ========================================================================
    // 5. 调用 AI 模型并返回流式响应
    // ========================================================================
    try {
      // 调用 LangChain 流式接口
      const stream = await llm.stream(finalMessages);

      // 创建 Server-Sent Events (SSE) 流
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let isClosed = false;  //  添加标志位

          //  辅助函数：安全写入数据
          const safeEnqueue = (data) => {
            if (isClosed) return false;
            try {
              controller.enqueue(data);
              return true;
            } catch (error) {
              if (error.code === 'ERR_INVALID_STATE') {
                isClosed = true;
                log.debug('Stream closed during enqueue');
                return false;
              }
              throw error;
            }
          };

          //  辅助函数：安全关闭流
          const safeClose = () => {
            if (isClosed) return;
            try {
              controller.close();
              isClosed = true;
            } catch (error) {
              if (error.code === 'ERR_INVALID_STATE') {
                isClosed = true;
                log.debug('Stream already closed');
              } else {
                console.error('Error closing stream:', error);
              }
            }
          };

          try {
            // 遍历流式响应
            for await (const chunk of stream) {
              // 检查是否已关闭
              if (isClosed) {
                log.debug('Stream closed, stopping iteration');
                break;
              }

              if (chunk.content) {
                // 使用安全写入函数
                const success = safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
                );
                
                // 如果写入失败，退出循环
                if (!success) {
                  log.debug('Client disconnected, stopping stream');
                  break;
                }
              }
            }

            // 安全关闭流
            safeClose();

          } catch (error) {
            console.error("Error while streaming response:", error);

            // 尝试发送错误信息
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
            );
            
            // 安全关闭
            safeClose();
          }
        },

        // 处理客户端取消
        cancel(reason) {
          log.debug('Stream cancelled by client:', reason);
        }
      });

      // 返回流式响应
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });

    } catch (error) {
      console.error("Chat API Error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Internal server error" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

  } catch (error) {
    console.error("Error in /api/chat route:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error",
        details: error.message 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
