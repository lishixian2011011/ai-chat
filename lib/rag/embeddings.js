/**
 * ============================================================================
 * Embedding 工具 (lib/rag/embeddings.js)
 * ============================================================================
 * 
 * 功能：
 *   1. 文本向量化（单个/批量）
 *   2. Token 计数
 *   3. 成本估算
 * 
 * 使用：使用原生 Fetch 调用 OpenRouter Embeddings API
 * 
 * ============================================================================
 */

import { encoding_for_model } from 'tiktoken';
import log from '@/lib/log';
// ============================================================================
// 配置
// ============================================================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'baai/bge-m3';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'AI Chat App';

// ============================================================================
// Token 计数器
// ============================================================================
let tokenizer;
try {
  tokenizer = encoding_for_model('gpt-3.5-turbo');
} catch (error) {
  console.warn('⚠️ Tiktoken 初始化失败，使用估算方法');
}

export function countTokens(text) {
  if (!text) return 0;
  
  if (tokenizer) {
    try {
      const tokens = tokenizer.encode(text);
      return tokens.length;
    } catch (error) {
      console.error('Token 计数失败:', error);
    }
  }
  
  return Math.ceil(text.length / 4);
}

// ============================================================================
// ✅ 原生 Fetch 实现：单个文本向量化
// ============================================================================
export async function embedText(text) {
  if (!text || !text.trim()) {
    throw new Error('文本不能为空');
  }

  if (!OPENAI_API_KEY) {
    throw new Error('❌ OPENAI_API_KEY 未配置');
  }

  try {
    log.debug('🔄 开始向量化，文本长度:', text.length);
    const startTime = Date.now();

    // ✅ 按照 OpenRouter 官方文档格式调用
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,      // ✅ 必需
        'X-Title': APP_NAME,           // ✅ 必需
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    // ✅ 详细错误处理
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 错误响应:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // ✅ 验证返回格式（按照官方文档）
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.error('❌ API 返回格式错误:', data);
      throw new Error(`API 返回格式错误: ${JSON.stringify(data)}`);
    }

    if (!data.data[0].embedding || !Array.isArray(data.data[0].embedding)) {
      console.error('❌ 缺少 embedding 字段:', data.data[0]);
      throw new Error('API 返回缺少 embedding 字段');
    }

    const vector = data.data[0].embedding;
    const duration = Date.now() - startTime;

    log.debug(`✅ 向量化完成，耗时: ${duration}ms，维度: ${vector.length}`);
    log.debug(`💰 成本: $${data.usage?.cost || '未知'}`);

    return vector;

  } catch (error) {
    console.error('❌ 向量化失败:', error);
    console.error('配置信息:', {
      baseURL: OPENAI_BASE_URL,
      model: EMBEDDING_MODEL,
      apiKey: OPENAI_API_KEY ? `${OPENAI_API_KEY.slice(0, 10)}...` : '未配置',
      textLength: text.length,
    });
    throw new Error(`向量化失败: ${error.message}`);
  }
}

// ============================================================================
// ✅ 原生 Fetch 实现：批量文本向量化
// ============================================================================
export async function embedBatch(texts, options = {}) {
  const {
    batchSize = 50,       // OpenRouter 建议批次大小
    showProgress = true,
  } = options;

  if (!texts || texts.length === 0) {
    return [];
  }

  if (!OPENAI_API_KEY) {
    throw new Error('❌ OPENAI_API_KEY 未配置');
  }

  log.debug(`🔄 批量向量化开始，总数: ${texts.length}`);
  log.debug(`  - 模型: ${EMBEDDING_MODEL}`);
  log.debug(`  - 批次大小: ${batchSize}`);
  
  const startTime = Date.now();
  const results = [];
  let totalCost = 0;

  // 分批处理
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);

    if (showProgress) {
      log.debug(`📊 处理批次 ${batchNum}/${totalBatches} (${batch.length} 个文本)`);
    }

    try {
      // ✅ 按照 OpenRouter 官方文档格式调用（批量）
      const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': APP_URL,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,  // ✅ 数组形式
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // ✅ 验证返回数据
      if (!data.data || data.data.length !== batch.length) {
        throw new Error(`返回数量不匹配: 期望 ${batch.length}, 实际 ${data.data?.length || 0}`);
      }

      // ✅ 提取 embeddings
      const vectors = data.data.map(item => item.embedding);
      results.push(...vectors);

      // 累计成本
      if (data.usage?.cost) {
        totalCost += parseFloat(data.usage.cost);
      }

      log.debug(`  ✅ 批次 ${batchNum} 完成`);

    } catch (error) {
      console.error(`❌ 批次 ${batchNum} 失败:`, error.message);

      // ✅ 失败时逐个重试
      log.debug(`  🔄 逐个重试批次 ${batchNum}...`);
      for (let j = 0; j < batch.length; j++) {
        try {
          const vector = await embedText(batch[j]);
          results.push(vector);

          // 避免频繁请求
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (retryError) {
          console.error(`  ❌ 文本 ${i + j} 重试失败:`, retryError.message);
          // 返回零向量（避免数据库错误）
          results.push(new Array(1024).fill(0));
        }
      }
    }

    // 批次间延迟，避免限流
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const duration = Date.now() - startTime;
  log.debug(`✅ 批量向量化完成，耗时: ${duration}ms`);
  log.debug(`💰 总成本: $${totalCost.toFixed(6)}`);

  return results;
}

// ============================================================================
// 成本估算
// ============================================================================
export function estimateCost(tokenCount) {
  // OpenAI text-embedding-3-small: $0.02 / 1M tokens
  const costPerMillion = 0.00001;
  const cost = (tokenCount / 1000000) * costPerMillion;

  return {
    tokens: tokenCount,
    cost: cost.toFixed(6),
    costUSD: `$${cost.toFixed(6)}`,
    costCNY: `¥${(cost * 7.2).toFixed(4)}`,
  };
}

// ============================================================================
// 导出
// ============================================================================
export default {
  embedText,
  embedBatch,
  countTokens,
  estimateCost,
};
