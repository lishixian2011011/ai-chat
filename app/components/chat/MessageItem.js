/**
 * ============================================================================
 * 单条消息组件 (app/components/chat/MessageItem.js)
 * ============================================================================
 * 
 * 文件作用：
 *   渲染聊天界面中的单条消息（用户消息或 AI 回复）
 * 
 * 主要功能：
 *   1. 显示消息内容（文本 + 图片）
 *   2. 区分用户消息和 AI 消息（不同样式）
 *   3. 显示操作按钮（复制、删除、编辑、重新生成）
 *   4. 显示 AI 消息的元信息（模型、token 使用量、时间戳）
 *   5. 鼠标悬停显示操作按钮
 *   6. 显示联网搜索标识
 *   7. 显示引用来源（CitationCard 组件）
 *   8. 引用来源显示在 AI 回复内容上方
 * 
 * 修改记录：
 *   - 2025-11-15：修复引用来源显示问题
 *   - 优化引用来源卡片样式
 *   - 添加调试日志
 *   - 调整显示顺序（引用来源在上，内容在下）
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Copy, RefreshCw, Edit2, Trash2, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import MessageContent from './MessageContent';
import CitationCard from './CitationCard';
import { cn } from '@/lib/utils';
import log from '@/lib/log';

/**
 * 单条消息组件
 * @param {Object} props
 * @param {Object} props.message - 消息对象
 * @param {Function} props.onDelete - 删除回调
 * @param {Function} props.onRegenerate - 重新生成回调
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onCopy - 复制回调
 * @param {boolean} props.isLast - 是否是最后一条消息
 */
export default function MessageItem({
  message,
  onDelete,
  onRegenerate,
  onEdit,
  onCopy,
  isLast,
}) {
  // ========================================================================
  // 1. 状态管理
  // ========================================================================
  
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // 更严格的引用来源判断
  const hasCitations = 
    message.citations && 
    Array.isArray(message.citations) && 
    message.citations.length > 0;
  
  const isWebSearch = message.isWebSearch || hasCitations;

  // 调试日志（开发环境）
  useEffect(() => {
    if (isAssistant && process.env.NODE_ENV === 'development') {
      console.log('📊 MessageItem 渲染:', {
        messageId: message.id,
        hasCitations,
        citationsCount: message.citations?.length || 0,
        citations: message.citations,
        isWebSearch: message.isWebSearch
      });
    }
  }, [message, isAssistant, hasCitations]);

  /** 复制消息内容 */
  const handleCopy = () => {
    onCopy(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'message-fade-in flex gap-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ====================================================================
          AI 头像（左侧）
      ==================================================================== */}
      {isAssistant && (
        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
            AI
          </AvatarFallback>
        </Avatar>
      )}

      {/* ====================================================================
          消息内容区域
      ==================================================================== */}
      <div
        className={cn(
          'flex flex-col gap-2 flex-1',
          isUser ? 'items-end' : 'items-start'
        )}
        style={{
          maxWidth: isAssistant ? '89%' : '80%',
        }}
      >
        {/* 联网搜索标识（仅 AI 消息且启用联网搜索时显示） */}
        {isAssistant && isWebSearch && (
          <div className="flex items-center gap-2 px-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <Globe className="h-3 w-3" />
              联网搜索
            </span>
          </div>
        )}

        {/* 消息气泡 */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 w-full',
            isUser
              ? 'bg-[#EBF5FF] text-gray-900 rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
          )}
        >
          {/* 图片预览 */}
          {message.images && message.images.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`上传的图片 ${idx + 1}`}
                  className="max-w-xs rounded-lg border border-gray-200"
                />
              ))}
            </div>
          )}

          {/* 引用来源移到最上面（在文本内容之前） */}
          {/* ====================================================================
              第 1 部分：引用来源（如果有）
          ==================================================================== */}
          {isAssistant && hasCitations && (
            <div className="mb-4">
              {/* 调试信息（仅开发环境） */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-2 text-xs text-gray-400 font-mono">
                  [DEBUG] 引用来源数量: {message.citations.length}
                </div>
              )}
              
              <CitationCard 
                citations={message.citations} 
                defaultExpanded={false}  // 改为 false，默认折叠
              />
            </div>
          )}

          {/* 如果没有引用来源但标记为联网搜索，显示提示 */}
          {isAssistant && isWebSearch && !hasCitations && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              ⚠️ 此消息标记为联网搜索，但未找到引用来源数据
            </div>
          )}

          {/* 文本内容移到引用来源下面 */}
          {/* ====================================================================
              第 2 部分：文本内容
          ==================================================================== */}
          <MessageContent content={message.content} />

          {/* ====================================================================
              第 3 部分：AI 消息的元信息
          ==================================================================== */}
          {isAssistant && message.model && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
              <span>{message.model}</span>
              {message.tokensUsed && (
                <>
                  <span>•</span>
                  <span>{message.tokensUsed} tokens</span>
                </>
              )}
              <span>•</span>
              <span>{message.timestamp}</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {isHovered && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-sm',
              isUser ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {/* 复制按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* AI 消息的重新生成按钮 */}
            {isAssistant && isLast && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onRegenerate(message.id)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* 编辑按钮 */}
            {isUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(message.id, message.content)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* 删除按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700"
              onClick={() => onDelete(message.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ====================================================================
          用户头像（右侧）
      ==================================================================== */}
      {isUser && (
        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
          <AvatarFallback className="bg-blue-600 text-white text-xs">我</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
