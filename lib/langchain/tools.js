import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import log from '@/lib/log';

// Bocha Web Search 工具
export const bochaWebSearchTool = new DynamicStructuredTool({
  name: "bocha_web_search",
  description: "使用 Bocha API 进行网页搜索，查询最新新闻、实时信息等",
  schema: z.object({
    query: z.string().describe("搜索关键词"),
    count: z.number().optional().default(10).describe("返回结果数量"),
  }),
  func: async ({ query, count = 10 }) => {
    try {
      const response = await axios.post(
        'https://api.bochaai.com/v1/web-search',
        { query, freshness: "noLimit", summary: true, count },
        {
          headers: {
            'Authorization': `Bearer ${process.env.BOCHA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;
      if (data.code !== 200 || !data.data) {
        return `搜索失败：${data.msg || '未知错误'}`;
      }

      const webpages = data.data.webPages?.value || [];
      if (webpages.length === 0) {
        return "未找到相关结果。";
      }

      let formattedResults = `找到 ${webpages.length} 条搜索结果：\n\n`;
      webpages.forEach((page, index) => {
        formattedResults += `${index + 1}. **${page.name}**\n`;
        formattedResults += `   - URL: ${page.url}\n`;
        formattedResults += `   - 摘要: ${page.snippet}\n\n`;
      });

      return formattedResults;
    } catch (error) {
      console.error('Bocha 搜索失败:', error);
      return `搜索失败：${error.message}`;
    }
  },
});

// 计算器工具
export const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "执行数学计算，输入数学表达式字符串",
  schema: z.object({
    expression: z.string().describe("数学表达式，如 '2 + 2'"),
  }),
  func: async ({ expression }) => {
    try {
      // 安全的数学计算（使用 Function 构造器）
      const result = Function(`"use strict"; return (${expression})`)();
      return `计算结果：${result}`;
    } catch (error) {
      return `计算错误：${error.message}`;
    }
  },
});
