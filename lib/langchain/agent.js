/**
 * ============================================================================
 * LangChain Agent 配置 (lib/langchain/agent.js)
 * ============================================================================
 * 
 * 文件作用：
 *   创建和配置 LangChain Agent，集成工具和记忆功能
 * 
 * 主要功能：
 *   1. 初始化 Agent（ReAct 类型）
 *   2. 集成工具（搜索、计算器等）
 *   3. 管理对话记忆（BufferMemory）
 *   4. 流式输出支持
 * 
 * 技术栈：
 *   - LangChain Agents
 *   - ChatOpenAI（通过 OpenRouter）
 *   - BufferMemory（对话记忆）
 * 
 * ============================================================================
 */

/**
 * ============================================================================
 * LangChain Agent 配置 (lib/langchain/agent.js)
 * ============================================================================
 * 
 * 使用 LangGraph 的 createReactAgent + 博查搜索工具
 */

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { BochaSearchTool } from "./tools/bocha-search";

/**
 * 创建 Web 搜索 Agent
 */
export async function createWebSearchAgent(model = "openai/gpt-4o", chatHistory = []) {
  // ========================================================================
  // 1. 初始化 LLM
  // ========================================================================
  const llm = new ChatOpenAI({
    modelName: model,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.7,
    streaming: true,
    cache: false,
    maxRetries: 0,
  });

  // ========================================================================
  // 2. 定义工具列表（ 使用博查搜索工具）
  // ========================================================================
  const tools = [
    new BochaSearchTool(),
  ];

  // ========================================================================
  // 3. 系统提示词
  // ========================================================================
  const systemMessage = `你是一个智能助手，可以使用搜索工具来回答问题。

## 可用工具

**bocha_web_search** - 博查网页搜索工具
- 用于查询最新新闻、实时信息、网页内容
- 输入：搜索关键词字符串
- 输出：搜索结果列表（标题、URL、摘要）

## 使用规则

1. **何时使用工具**：
   - 问题涉及最新信息、新闻、实时数据 → 使用 bocha_web_search
   - 问题是常识性问题 → 直接回答，无需工具

2. **搜索策略**：
   - 提取问题中的关键词作为搜索查询
   - 优先搜索中文内容（如果问题是中文）
   - 搜索结果要包含来源引用

3. **回答格式**：
   - 使用 Markdown 格式
   - 引用搜索结果时标注来源
   - 结构清晰，分点列出

当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  // ========================================================================
  // 4. 转换聊天历史
  // ========================================================================
  const formattedHistory = chatHistory.map(msg => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });

  // ========================================================================
  // 5. 创建 React Agent
  // ========================================================================
  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemMessage,
  });

  return agent;
}

/**
 * 执行 Agent 查询（流式输出）
 */
export async function* streamAgentResponse(agent, query, chatHistory = []) {
  try {
    // 转换聊天历史
    const formattedHistory = chatHistory.map(msg => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });

    // 构造输入
    const input = {
      messages: [...formattedHistory, new HumanMessage(query)],
    };

    console.log('🚀 开始执行 Agent...');

    //  流式执行（修复：正确处理工具调用）
    const stream = await agent.stream(input, {
      streamMode: "values",
    });

    let lastMessageContent = "";

    for await (const chunk of stream) {
      console.log('📦 收到 chunk:', JSON.stringify(chunk, null, 2));

      const messages = chunk.messages;
      const lastMessage = messages[messages.length - 1];

      //  处理工具调用结果
      if (lastMessage._getType() === "ai" && lastMessage.tool_calls?.length > 0) {
        for (const toolCall of lastMessage.tool_calls) {
          if (toolCall.name === "bocha_web_search") {
            console.log('🔧 检测到博查搜索工具调用');
          }
        }
      }

      //  处理工具返回结果
      if (lastMessage._getType() === "tool") {
        console.log('🔧 工具返回结果:', lastMessage.content);
        
        yield {
          type: "tool_call",
          toolName: lastMessage.name,
          result: lastMessage.content
        };
      }

      //  处理 AI 回复内容（增量输出）
      if (lastMessage._getType() === "ai" && lastMessage.content) {
        const newContent = lastMessage.content.slice(lastMessageContent.length);
        if (newContent) {
          lastMessageContent = lastMessage.content;
          yield {
            type: "content",
            content: newContent,
          };
        }
      }
    }

    console.log(' Agent 执行完成');

  } catch (error) {
    console.error("❌ Agent 执行失败:", error);
    yield {
      type: "error",
      error: error.message,
    };
  }
}
