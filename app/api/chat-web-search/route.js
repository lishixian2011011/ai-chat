/**
 * ============================================================================
 * 联网搜索聊天 API (app/api/chat-web-search/route.js)
 * ============================================================================
 * 
 * 文件作用：
 *   处理带联网搜索功能的聊天请求
 * 
 * 主要功能：
 *   1. 身份验证
 *   2. 保存用户消息到数据库
 *   3. 调用 LangChain Agent 执行联网搜索
 *   4. 流式返回 AI 回复
 *   5. 新增：提取并返回搜索引用来源
 *   6. 保存 AI 回复到数据库（包含引用来源）
 *   7. 修复：在流式开始时立即返回 aiMessageId，避免前端重复创建消息
 *   8. 新增：支持图片上传和多模态对话（联网模式）
 * 
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { createWebSearchAgent, streamAgentResponse } from "@/lib/langchain/agent";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
// 修改1：引入文件系统和路径模块（用于图片处理）
import { promises as fs } from 'fs';
import path from 'path';
import log from '@/lib/log';
// 修改1结束】

/**
 * POST - 联网搜索聊天接口
 */
export async function POST(req) {
  try {
    // ========================================================================
    // 1. 身份验证
    // ========================================================================
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未登录" },
        { status: 401 }
      );
    }

    // ========================================================================
    // 2. 解析请求参数
    // ========================================================================
    // 修改2】：从请求体中提取 images 参数
    const { messages, model, conversationId, images } = await req.json();
    // 【修改2结束】

    if (!messages || !model) {
      return NextResponse.json(
        { error: "缺少必填参数 messages 或 model" },
        { status: 400 }
      );
    }

    // 获取最后一条用户消息
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user") {
      return NextResponse.json(
        { error: "最后一条消息必须是用户消息" },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. 保存用户消息到数据库
    // ========================================================================
    let conversation;
    if (conversationId) {
      // 使用现有会话
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation || conversation.userId !== session.user.id) {
        return NextResponse.json(
          { error: "会话不存在或无权访问" },
          { status: 403 }
        );
      }
    } else {
      // 创建新会话
      conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          title: userMessage.content.slice(0, 50) + "...",
          model: model,
        },
      });
    }

    // 保存用户消息
    const userMessageRecord = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userMessage.content,
      },
    });

    // 【修改点1】：创建 AI 消息占位符（在流式开始前）
    // 原因：需要立即获取消息 ID，避免前端重复创建
    const aiMessageRecord = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: "", // 初始为空，流式完成后更新
        isWebSearch: true, // 标记为联网搜索
      },
    });
    log.debug('创建 AI 消息占位符，ID:', aiMessageRecord.id);
    // 【修改点1结束】

    // 【修改3】：处理图片输入（转换为 Base64 多模态格式）
    // ========================================================================
    // 3.5 处理图片输入（新增）
    // ========================================================================
    let processedUserMessage = userMessage.content;
    let hasImages = false;

    if (images && images.length > 0) {
      log.debug('🖼️ 检测到图片上传，开始处理...');
      try {
        // 将图片转换为 Base64 格式
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
                log.debug('📂 文件路径:', filePath);
                
                // 检查文件是否存在
                try {
                  await fs.access(filePath);
                } catch {
                  throw new Error(`文件不存在: ${filePath}`);
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
                
                log.debug(' 图片转换成功，类型:', mimeType);
                
                // 返回 Data URL 格式
                return `data:${mimeType};base64,${base64Image}`;
              } else {
                // ----------------------------------------------------------
                // 远程 URL 直接使用
                // ----------------------------------------------------------
                log.debug('🌐 使用远程图片 URL:', imageUrl);
                return imageUrl;
              }
            } catch (error) {
              console.error(`❌ 处理图片失败 ${imageUrl}:`, error);
              throw error;
            }
          })
        );

        // ------------------------------------------------------------------
        // 构造多模态消息（文本 + 图片）
        // ------------------------------------------------------------------
        processedUserMessage = [
          {
            type: "text",
            text: userMessage.content || "请分析这张图片"
          },
          ...base64Images.map(base64Image => ({
            type: "image_url",
            image_url: {
              url: base64Image  // Base64 Data URL
            }
          }))
        ];

        hasImages = true;
        log.debug(` 多模态消息构造完成，包含 ${base64Images.length} 张图片`);
        
      } catch (imageError) {
        console.error("❌ 图片处理失败:", imageError);
        
        // 图片处理失败，回退到文本模式
        processedUserMessage = `${userMessage.content} [图片处理失败: ${imageError.message}]`;
        console.warn('⚠️ 回退到纯文本模式');
      }
    } else {
      log.debug('📝 纯文本消息，无图片');
    }

    // ========================================================================
    // 4. 创建 Agent 并执行查询
    // ========================================================================
    // 修改4】：传递处理后的消息（可能包含图片）
    // 注意：如果使用图片，需要确保模型支持视觉功能（如 GPT-4 Vision、Claude 3）
    const agent = await createWebSearchAgent(
      model, 
      messages.slice(0, -1),
      hasImages // 传递标志位，让 Agent 知道是否有图片
    );
    // 【修改4结束】

    // ========================================================================
    // 5. 返回流式响应
    // ========================================================================
    const encoder = new TextEncoder();
    let fullResponse = "";
    let searchCitations = []; // 存储搜索引用来源

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        // 辅助函数：安全发送数据
        const safeEnqueue = (data) => {
          if (isClosed) return false;
          try {
            controller.enqueue(data);
            return true;
          } catch (error) {
            if (error.code === 'ERR_INVALID_STATE') {
              isClosed = true;
              return false;
            }
            throw error;
          }
        };

        // 辅助函数：安全关闭流
        const safeClose = () => {
          if (isClosed) return;
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            if (error.code !== 'ERR_INVALID_STATE') {
              console.error('关闭流失败:', error);
            }
          }
        };

        try {
          // 修改点2】：立即发送 aiMessageId 到前端
          // 原因：前端需要这个 ID 来更新 UI 和保存消息
          log.debug('🚀 准备发送 aiMessageId 到前端:', aiMessageRecord.id);
          
          const initSuccess = safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'init', 
              aiMessageId: aiMessageRecord.id 
            })}\n\n`)
          );
          
          if (initSuccess) {
            log.debug(' 已成功发送 aiMessageId 到前端:', aiMessageRecord.id);
          } else {
            console.error('❌ 发送 aiMessageId 失败，流可能已关闭');
            return;
          }

          // 使用处理后的消息（可能是多模态格式）
          // 流式执行 Agent
          for await (const chunk of streamAgentResponse(
            agent,
            processedUserMessage, // ← 使用处理后的消息（包含图片）
            messages.slice(0, -1)
          )) {
            if (isClosed) break;

            // ============================================================
            // 处理博查搜索工具调用结果
            // ============================================================
            if (chunk.type === "tool_call" && chunk.toolName === "bocha_web_search") {
              try {
                log.debug('🔍 收到博查搜索结果');
                
                // 解析搜索结果
                const searchResult = typeof chunk.result === 'string' 
                  ? JSON.parse(chunk.result) 
                  : chunk.result;
                
                // 提取结果数组（标准化格式：results）
                const results = searchResult.results || [];
                
                if (results.length === 0) {
                  console.warn('⚠️ 搜索结果为空');
                  continue; // 跳过，不发送引用来源
                }
                
                log.debug(`提取到 ${results.length} 个搜索结果`);
                
                // 格式化为引用来源（前端显示格式）
                searchCitations = results.slice(0, 5).map((item, index) => ({
                  index: index + 1,
                  title: item.title || '未命名来源',
                  url: item.url || '#',
                  snippet: item.content || '',
                  siteName: item.siteName || extractDomain(item.url),
                  dateLastCrawled: item.publishedDate || null
                }));
                
                log.debug('格式化后的引用来源:', searchCitations.length, '个');
                
                // 立即发送引用来源到前端
                if (searchCitations.length > 0) {
                  const success = safeEnqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      type: 'citations', 
                      citations: searchCitations 
                    })}\n\n`)
                  );
                  if (!success) break;
                  
                  log.debug(' 已发送引用来源到前端');
                }
                
              } catch (parseError) {
                console.error('❌ 解析博查搜索结果失败:', parseError);
                console.error('原始数据:', chunk.result);
              }
            }
            // ============================================================
            // 处理文本内容
            // ============================================================
            else if (chunk.type === "content") {
              fullResponse += chunk.content;
              
              // 发送文本数据块
              const success = safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'text',
                  content: chunk.content 
                })}\n\n`)
              );

              if (!success) break;
            }
            // ============================================================
            // 处理错误
            // ============================================================
            else if (chunk.type === "error") {
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'error',
                  error: chunk.error 
                })}\n\n`)
              );
            }
          }

          // ================================================================
          // 6. 更新 AI 回复到数据库（包含引用来源）
          // ================================================================
          if (fullResponse && !isClosed) {
            await prisma.message.update({
              where: { id: aiMessageRecord.id },
              data: {
                content: fullResponse,
                citations: searchCitations.length > 0 ? searchCitations : null,
              },
            });

            log.debug(' AI 回复已更新到数据库，包含', searchCitations.length, '个引用来源');
          }

          // 发送结束标记
          if (!isClosed) {
            safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          }

          safeClose();

        } catch (error) {
          console.error("❌ 流式响应错误:", error);
          
          if (!isClosed) {
            // 保存错误信息到数据库
            await prisma.message.update({
              where: { id: aiMessageRecord.id },
              data: {
                content: fullResponse || `[错误] ${error.message}`,
                citations: searchCitations.length > 0 ? searchCitations : null,
              },
            }).catch(err => {
              console.error('❌ 保存错误消息失败:', err);
            });

            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'error',
                error: error.message 
              })}\n\n`)
            );
            safeClose();
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("❌ 联网搜索失败:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 *  从 URL 提取域名
 * @param {string} url - 完整 URL
 * @returns {string} 域名
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return '未知来源';
  }
}
