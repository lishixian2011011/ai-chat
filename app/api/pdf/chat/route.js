/**
 * ============================================================================
 * PDF 对话 API (app/api/pdf/chat/route.js)
 * ============================================================================
 * 
 * 功能：与 PDF 内容进行 AI 对话
 * 
 * 技术栈：
 *   - LangChain（PDF 解析和向量化）
 *   - OpenRouter（AI 模型）
 *   - pdf-parse（PDF 文本提取）
 * 
 * ============================================================================
 */
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { ChatOpenAI } from '@langchain/openai';
import { promises as fs } from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import log from '@/lib/log';

export async function POST(req) {
  try {
    // 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 解析请求体
    const { pdfId, message, model, history } = await req.json();

    if (!pdfId || !message || !model) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 查询 PDF 记录
    const pdf_record = await prisma.pDF.findUnique({
      where: { id: pdfId },
    });

    if (!pdf_record) {
      return NextResponse.json(
        { success: false, error: 'PDF 不存在' },
        { status: 404 }
      );
    }

    // 验证权限
    if (pdf_record.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '无权访问此文件' },
        { status: 403 }
      );
    }

    // 读取 PDF 文件
    const filePath = path.join(process.cwd(), 'public', pdf_record.filePath);
    const dataBuffer = await fs.readFile(filePath);

    // 解析 PDF 文本
    const pdfData = await pdf(dataBuffer);
    const pdfText = pdfData.text;

    // 配置 AI 模型
    const llm = new ChatOpenAI({
      modelName: model,
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      streaming: true,
    });

    // 构造系统提示词
    const systemMessage = {
      role: 'system',
      content: `你是一个专业的 PDF 文档分析助手。用户上传了一个 PDF 文件，你需要基于文档内容回答用户的问题。

## PDF 文档内容：
${pdfText.slice(0, 15000)} ${pdfText.length > 15000 ? '...(文档内容过长，已截断)' : ''}

## 回答要求：
1. 仅基于文档内容回答问题
2. 如果文档中没有相关信息，明确告知用户
3. 引用具体的文档内容时，可以标注页码或段落
4. 使用 Markdown 格式美化回答
5. 保持专业、准确、友好的语气

## 文档信息：
- 文件名：${pdf_record.name}
- 总页数：${pdfData.numpages}
- 文件大小：${(pdf_record.size / 1024 / 1024).toFixed(2)} MB`
    };

    // 构造消息历史
    const messages = [
      systemMessage,
      ...(history || []).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // 调用 AI 模型（流式响应）
    const stream = await llm.stream(messages);

    // 创建流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let isClosed = false;

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

        const safeClose = () => {
          if (isClosed) return;
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            if (error.code === 'ERR_INVALID_STATE') {
              isClosed = true;
            }
          }
        };

        try {
          for await (const chunk of stream) {
            if (isClosed) break;

            if (chunk.content) {
              const success = safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
              );

              if (!success) break;
            }
          }

          safeEnqueue(encoder.encode('data: [DONE]\n\n'));
          safeClose();
        } catch (error) {
          console.error('流式响应错误:', error);
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '生成失败' })}\n\n`)
          );
          safeClose();
        }
      },

      cancel(reason) {
        console.log('流被取消:', reason);
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('PDF 对话失败:', error);
    return NextResponse.json(
      { success: false, error: '对话失败，请稍后重试' },
      { status: 500 }
    );
  }
}
