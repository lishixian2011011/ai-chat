/**
 * ============================================================================
 * 博查 AI 搜索工具 (lib/langchain/tools/bocha-search.js)
 * ============================================================================
 * 
 * 文档：https://bochaai.com/docs
 * API：https://api.bochaai.com/v1/web-search
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export class BochaSearchTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: "bocha_web_search",
      description: "搜索互联网获取最新信息。适用于需要实时数据、新闻、事实核查的场景。",
      schema: z.object({
        query: z.string().describe("搜索关键词"),
      }),
      func: async ({ query }) => {
        try {
          console.log(`🔍 博查搜索: ${query}`);
          
          //  调用博查 API
          const response = await fetch("https://api.bochaai.com/v1/web-search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.BOCHA_API_KEY}`,
            },
            body: JSON.stringify({
              query: query,
              freshness: "noLimit",  // 不限时间范围（推荐）
              summary: false,        // 不需要摘要（加快响应）
              count: 10,             // 返回 10 条结果
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`博查 API HTTP 错误: ${response.status} ${errorText}`);
          }

          const data = await response.json();
          
          console.log('📥 博查 API 原始返回:', JSON.stringify(data, null, 2));
          
          //  检查返回状态码（博查返回 200 表示成功）
          if (data.code !== 200) {
            throw new Error(`博查 API 返回错误: code=${data.code}, msg=${data.msg || '未知错误'}`);
          }

          //  提取搜索结果（根据文档：data.webPages.value）
          const webPages = data.data?.webPages?.value || [];

          if (webPages.length === 0) {
            console.warn('⚠️ 博查搜索未返回结果');
            return JSON.stringify({ 
              results: [],
              message: '未找到相关结果'
            });
          }

          console.log(` 博查返回 ${webPages.length} 个结果`);
          
          //  标准化数据格式（映射到统一字段）
          const results = webPages.map(item => ({
            title: item.name || '未命名来源',           //  文档字段：name
            url: item.url || '#',
            content: item.snippet || '',                //  文档字段：snippet
            publishedDate: item.datePublished || item.dateLastCrawled || null,
            siteName: item.siteName || '',
            siteIcon: item.siteIcon || ''
          }));

          console.log(' 标准化后的结果:', JSON.stringify(results.slice(0, 2), null, 2));
          
          //  返回标准格式
          return JSON.stringify({ results });
          
        } catch (error) {
          console.error("❌ 博查搜索失败:", error);
          return JSON.stringify({ 
            error: error.message,
            results: [] 
          });
        }
      },
    });
  }
}
