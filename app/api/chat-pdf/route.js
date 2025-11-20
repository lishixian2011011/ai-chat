/**
 * ============================================================================
 * ChatPDF API 路由 (app/api/chat-pdf/route.js)
 * ============================================================================
 * 
 * 文件作用：
 *   处理与 PDF 文件的 AI 对话请求
 * 
 * 主要功能：
 *   1. 验证用户身份
 *   2. 解析 PDF 文件内容
 *   3. 调用 AI 模型进行对话
 *   4. 返回 AI 响应
 * 
 * 技术栈：
 *   - pdf-parse: PDF 文本提取
 *   - OpenRouter API: AI 模型调用
 * 
 * 修改记录：
 *   - 2025-11-16：修复 pdf-parse 导入问题 修复
 * 
 * ============================================================================
 */

import { searchSimilarChunks } from '@/lib/rag/retrieval';
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma'; // 保持 ES modules 导入
import log from '@/lib/log';

// ========================================================================
// 在文件顶部添加模型配置
// ========================================================================
const AI_MODELS = {
  // 主对话模型（使用 deepseek/deepseek-chat）
  main: 'deepseek/deepseek-chat-v3.1',
  
  // 查询重写模型（使用 Claude Haiku，更快更便宜）
  rewrite: 'deepseek/deepseek-chat',
  
  // 备用模型（如果 deepseek/deepseek-chat 也不可用）
  fallback: 'deepseek/deepseek-chat',
};


// ========================================================================
// 新增独立的查询重写函数
// ========================================================================
/**
 * 查询重写函数（标准化 + 扩展策略）
 * @param {string} originalQuery - 原始用户问题
 * @returns {Promise<Object>} 重写结果对象
 */
async function rewriteQuery(originalQuery) {
  
  let rewriteResult = {
    originalQuery,
    finalQuery: originalQuery,
    queryType: 'original',
    steps: []
  };

  try {
    // ========================================================================
    // 步骤1：查询标准化
    // ========================================================================

    const normalizationPrompt = `请将以下用户问题改写成更适合文档检索的标准化表达。

要求：
1. 去除口语化内容（如"emmm"、"呀"、"吧"等语气词）
2. 去除冗余表达（如"能不能"、"可以吗"等）
3. 使用书面化、正式的表达
4. 保持问题的核心意图不变
5. 只返回改写后的问题，不要任何解释

原始问题：${originalQuery}

改写后的问题：`;

    const normalizationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'AI Chat App - Query Rewriting',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: AI_MODELS.rewrite,
        messages: [
          { role: 'user', content: normalizationPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
      })
    });

    if (!normalizationResponse.ok) {
      log.debug('⚠️ 标准化失败，使用原始问题');
      rewriteResult.steps.push('标准化失败');
    } else {
      const normalizationData = await normalizationResponse.json();
      const normalizedQuery = normalizationData.choices?.[0]?.message?.content?.trim();
      
      if (normalizedQuery) {
        rewriteResult.normalizedQuery = normalizedQuery;
        rewriteResult.finalQuery = normalizedQuery;
        rewriteResult.steps.push('标准化完成');
      } else {
        log.debug('⚠️ 标准化结果为空，使用原始问题');
        rewriteResult.steps.push('标准化结果为空');
      }
    }

    // ========================================================================
    // 步骤2：判断问题类型并执行对应策略
    // ========================================================================
    
    const queryForAnalysis = rewriteResult.finalQuery;
    const isCompoundQuery = /和|与|或者|以及|区别|对比|比较/.test(queryForAnalysis);

    // 策略A：复合问题 → 使用查询分解
    if (isCompoundQuery) {
      rewriteResult.queryType = 'decomposition';
      rewriteResult.steps.push('使用查询分解');
      
      const decompositionPrompt = `请将以下复合问题拆解成 2-3 个独立的子问题。

要求：
1. 每个子问题应该独立且完整
2. 子问题应该覆盖原问题的所有方面
3. 使用换行符分隔子问题
4. 每个子问题前加上序号（1. 2. 3.）
5. 只返回子问题列表，不要任何解释

原始问题：${queryForAnalysis}

子问题列表：`;

      const decompositionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Chat App - Query Decomposition',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: AI_MODELS.rewrite,
          messages: [
            { role: 'user', content: decompositionPrompt }
          ],
          temperature: 0.3,
          max_tokens: 300,
        })
      });

      if (decompositionResponse.ok) {
        const decompositionData = await decompositionResponse.json();
        const subQueries = decompositionData.choices?.[0]?.message?.content?.trim();
        
        if (subQueries) {
          rewriteResult.subQueries = subQueries;
          // 将子问题合并成一个查询（用于检索）
          rewriteResult.finalQuery = subQueries.replace(/\d+\.\s*/g, '').replace(/\n+/g, ' ');
        } else {
          log.debug('⚠️ 查询分解失败，使用标准化问题');
          rewriteResult.steps.push('查询分解失败');
        }
      } else {
        log.debug('⚠️ 查询分解 API 调用失败，使用标准化问题');
        rewriteResult.steps.push('查询分解 API 失败');
      }
    }
    
    // 策略B：标准问题 → 使用查询扩展
    else {
      rewriteResult.queryType = 'expansion';
      rewriteResult.steps.push('使用查询扩展');
      
      const expansionPrompt = `请为以下问题添加相关的同义词和扩展表达，以提高检索效果。

要求：
1. 保留原始问题的核心内容
2. 添加 3-5 个相关的同义词或近义表达
3. 使用逗号或顿号分隔
4. 不要改变问题的意图
5. 只返回扩展后的问题，不要任何解释

原始问题：${queryForAnalysis}

扩展后的问题：`;

      const expansionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Chat App - Query Expansion',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: AI_MODELS.rewrite,
          messages: [
            { role: 'user', content: expansionPrompt }
          ],
          temperature: 0.4,
          max_tokens: 250,
        })
      });

      if (expansionResponse.ok) {
        const expansionData = await expansionResponse.json();
        const expandedQuery = expansionData.choices?.[0]?.message?.content?.trim();
        
        if (expandedQuery) {
          rewriteResult.finalQuery = expandedQuery;
        } else {
          log.debug('⚠️ 查询扩展失败，使用标准化问题');
          rewriteResult.steps.push('查询扩展失败');
        }
      } else {
        log.debug('⚠️ 查询扩展 API 调用失败，使用标准化问题');
        rewriteResult.steps.push('查询扩展 API 失败');
      }
    }

    log.debug('\n查询重写完成');

  } catch (rewriteError) {
    console.error('❌ 查询重写失败:', rewriteError);
    log.debug('⚠️ 降级：使用原始问题');
    rewriteResult.queryType = 'fallback';
    rewriteResult.error = rewriteError.message;
    rewriteResult.steps.push('查询重写失败');
  }

  return rewriteResult;
}

// ========================================================================
// 新增：智能检索函数（支持动态阈值 + 多重回退策略）
// ========================================================================
async function smartRetrieval(query, pdfId, pdfRecord) {  
  // ========================================================================
  // 阶段1：查询重写（调用独立函数）
  // ========================================================================
  const rewriteResult = await rewriteQuery(query);
  
  // ========================================================================
  // 阶段2：向量检索（使用重写后的查询）
  // ========================================================================
  const queryForRetrieval = rewriteResult.finalQuery;
  let chunks = [];
  
  // 策略1：标准向量检索（阈值 0.6）
  chunks = await searchSimilarChunks(queryForRetrieval, {
    pdfId,
    topK: 5,
    threshold: 0.6,
  });
  
  if (chunks.length >= 3) {
    return chunks;
  }
  
  // 策略2：降低阈值到 0.4
  log.debug('⚠️ 策略1结果不足，降低阈值到 0.4 重试...');
  chunks = await searchSimilarChunks(queryForRetrieval, {
    pdfId,
    topK: 8,
    threshold: 0.4,
  });
  
  if (chunks.length >= 3) {
    return chunks;
  }
  
  // 策略3：取文档的均匀采样（每隔N个块取一个）
  log.debug('⚠️ 策略2仍不足，使用均匀采样策略...');
  const totalChunks = pdfRecord.totalChunks;
  const step = Math.max(1, Math.ceil(totalChunks / 10));
  
  const allChunks = await prisma.documentChunk.findMany({
    where: { pdfId },
    orderBy: { chunkIndex: 'asc' },
    take: 100, // 最多取100个块进行采样
  });
  
  // 均匀采样
  const sampled = allChunks.filter((_, idx) => idx % step === 0).slice(0, 10);
  
  if (sampled.length > 0) {
    return sampled;
  }
  
  // 策略4：直接取前10个块（最终回退）
  log.debug('⚠️ 策略3失败，使用最终回退：取前10个块');
  const fallbackChunks = await prisma.documentChunk.findMany({
    where: { pdfId },
    orderBy: { chunkIndex: 'asc' },
    take: 10,
  });
  
  return fallbackChunks;
}


export async function POST(request) {

  try {
    // ========================================================================
    // 1. 身份验证（保持不变）
    // ========================================================================
    const session = await auth();
    if (!session || !session.user) {
      log.debug('❌ 用户未登录');
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    log.debug('用户已登录:', session.user.email);
    
    // ========================================================================
    // 2. 解析请求参数（保持不变）
    // ========================================================================
    const { message, pdfId } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    if (!pdfId) {
      return NextResponse.json({ error: '请先选择 PDF 文件' }, { status: 400 });
    }
    
    // ========================================================================
    // 简化文件查找逻辑（只查数据库，不再读取文件）
    // ========================================================================
    const pdfRecord = await prisma.PDF.findFirst({
      where: {
        id: pdfId,  // 直接使用字符串 ID
        userId: session.user.id
      }
    });
    
    if (!pdfRecord) {
      log.debug('❌ PDF 记录不存在');
      return NextResponse.json({ 
        error: 'PDF 文件不存在或无权访问'
      }, { status: 404 });
    }
    
    // ========================================================================
    // 检查 PDF 处理状态
    // ========================================================================
    
    if (pdfRecord.status === 'processing') {
      return NextResponse.json({
        error: 'PDF 文件正在处理中，请稍后再试',
        status: pdfRecord.status,
      }, { status: 400 });
    }
    
    if (pdfRecord.status === 'failed') {
      return NextResponse.json({
        error: 'PDF 文件处理失败',
        details: pdfRecord.errorMessage,
      }, { status: 400 });
    }
    
    if (pdfRecord.status !== 'ready') {
      return NextResponse.json({
        error: `PDF 文件状态异常: ${pdfRecord.status}`,
      }, { status: 400 });
    }


    // ========================================================================
    // 新增 RAG 检索逻辑
    // ========================================================================    
    let relevantChunks = [];
    try {
      // 使用智能检索函数（自动处理阈值调整和回退）
      relevantChunks = await smartRetrieval(message, pdfId, pdfRecord);
      
      log.debug(`检索到 ${relevantChunks.length} 个相关文档块`);

      if (relevantChunks.length > 0) {
      relevantChunks.forEach((chunk, index) => {
        //安全处理 similarity 字段
        const similarity = chunk.similarity !== undefined 
          ? chunk.similarity.toFixed(3) 
          : 'N/A';
        const pageNumber = chunk.pageNumber || 'N/A';
        const contentLength = chunk.content?.length || 0;
      });
    }
            
    } catch (retrievalError) {
      console.error('❌ RAG 检索失败:', retrievalError);
      
      // 检索失败时降级处理
      return NextResponse.json({
        error: 'RAG 检索服务暂时不可用',
        details: retrievalError.message,
        suggestion: '请稍后重试或联系管理员',
      }, { status: 500 });
    }
    
    const context = relevantChunks
      .map((chunk, index) => {
        const pageInfo = chunk.pageNumber ? ` (第 ${chunk.pageNumber} 页)` : '';
        const similarity = chunk.similarity ? (chunk.similarity * 100).toFixed(1) : 'N/A';
        return `[来源 ${index + 1}${pageInfo} | 相关度: ${similarity}%]\n${chunk.content}`;
      })
      .join('\n\n---\n\n');

    // ========================================================================
    // 更新 AI 提示词（使用 RAG 上下文）
    // ========================================================================
    log.debug('开始调用 AI 模型...');
    
    // 检查 API 密钥
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenRouter API 密钥未配置');
      return NextResponse.json({ 
        error: 'AI 服务配置错误，请联系管理员',
        details: 'OpenRouter API key not configured'
      }, { status: 500 });
    }
    
    try {
      // 新的系统提示词（基于 RAG 检索）
      const systemPrompt = `你是一个专业的 PDF 文档分析助手。用户上传了一个名为 "${pdfRecord.name}" 的 PDF 文件。

      ## 📚 相关文档内容（基于语义检索）：
      ${context}

      ## 📋 回答要求：
      1. **基于检索内容**：优先使用上述检索到的相关内容回答问题
      2. **引用来源**：回答时可以标注来源编号，如"根据来源1..."或"第X页提到..."
      3. **准确性**：如果检索内容不足以完整回答问题，明确告知用户
      4. **格式美化**：使用 Markdown 格式，提高可读性
      5. **友好语气**：保持专业、准确、友好的语气
      6. **中文回答**：使用简体中文回答

      ## 📊 文档信息：
      - 文件名：${pdfRecord.name}
      - 总页数：${pdfRecord.totalPages || 'N/A'}
      - 文档块数：${pdfRecord.totalChunks}
      - 检索到的相关块：${relevantChunks.length}

      ## ⚠️ 注意事项：
      - 不要编造文档中不存在的内容
      - 如果问题超出检索内容范围，诚实告知用户
      - 可以建议用户换一种方式提问`;

      const userPrompt = `用户问题：${message}`;

      // 调用 OpenRouter API      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Chat App - ChatPDF with RAG',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: AI_MODELS.main, // 修改：使用 deepseek
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      //API 响应状态

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ OpenRouter API 错误:', response.status, errorData);
        
        let errorMessage = 'AI 服务暂时不可用';
        if (response.status === 401) {
          errorMessage = 'AI 服务认证失败，请检查 API 密钥';
        } else if (response.status === 429) {
          errorMessage = 'AI 服务请求过于频繁，请稍后重试';
        } else if (response.status === 500) {
          errorMessage = 'AI 服务内部错误，请稍后重试';
        }
        
        throw new Error(`${errorMessage} (状态码: ${response.status})`);
      }

      const aiResponse = await response.json();
      const aiMessage = aiResponse.choices?.[0]?.message?.content;
      
      if (!aiMessage) {
        console.error('❌ AI 响应为空:', aiResponse);
        throw new Error('AI 响应为空，请重试');
      }

      // ========================================================================
      // 更新返回的元数据
      // ========================================================================
      return NextResponse.json({
        success: true,
        response: aiMessage,
        metadata: {
          pdfName: pdfRecord.name,
          totalPages: pdfRecord.totalPages,
          totalChunks: pdfRecord.totalChunks,
          chunksRetrieved: relevantChunks.length,
          sources: relevantChunks.map(chunk => ({  // 来源信息
            pageNumber: chunk.pageNumber,
            similarity: chunk.similarity,
            preview: chunk.content.substring(0, 100) + '...'
          })),
          model: AI_MODELS.main,
          ragEnabled: true,  //标识使用了 RAG
          timestamp: new Date().toISOString()
        }
      });

    } catch (aiError) {
      console.error('❌ AI 调用失败:', aiError);
      return NextResponse.json({ 
        error: `AI 服务调用失败: ${aiError.message}`,
        suggestion: '请检查网络连接或稍后重试',
        debugInfo: {
          errorType: aiError.name,
          errorMessage: aiError.message
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ ChatPDF API 总体错误:', error);
    return NextResponse.json({ 
      error: '服务器内部错误',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}