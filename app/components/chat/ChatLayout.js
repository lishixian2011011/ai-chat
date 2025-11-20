/**
 * ============================================================================
 * 聊天布局组件 (app/components/chat/ChatLayout.js)
 * ============================================================================
 * 
 * 文件作用：
 *   整个聊天应用的核心布局和状态管理中心
 * 
 * 主要功能：
 *   1. 用户认证检查（未登录跳转到登录页）
 *   2. 会话管理（创建、切换、删除、重命名会话）
 *   3. 消息管理（发送、删除、重新生成消息）
 *   4. AI 流式回复处理（实时显示 AI 回复）
 *   5. 自动生成会话标题
 *   6. 协调子组件（Header、Sidebar、ChatArea）
 *   7. 处理联网搜索引用来源
 *   8. 避免消息重复创建
 *   9. 联网搜索实时显示
 *   10. 联网搜索时显示用户消息
 *   11. 联网搜索状态管理（防止重置）
 * 
 * ============================================================================
 */

'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea'
import { models } from '@/lib/mock-data'
import { useConversations } from '@/lib/hooks/useConversations'
import { useMessages } from '@/lib/hooks/useMessages'
import log from '@/lib/log';

export default function ChatLayout() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState(models[0])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // AI 生成状态管理
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = useRef(null)

  //【新增】：联网搜索状态（在父组件管理，防止重置）
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)

  // 使用自定义Hooks
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    loading: conversationsLoading,
    createConversation,
    updateConversation,
    deleteConversation,
    generateTitle
  } = useConversations(session?.user?.id)

  const {
    messages: currentMessages,
    setMessages, // 用于直接操作消息数组
    loading: messagesLoading,
    sendMessage,
    updateMessageContent,
    deleteMessage
  } = useMessages(currentConversation?.id)

  // 未登录跳转
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // 创建新会话
  const handleNewConversation = async () => {
    try {
      await createConversation('新对话', selectedModel.id)
    } catch (error) {
      alert('创建会话失败: ' + error.message)
    }
  }

  // 切换会话
  const handleSelectConversation = (conversation) => {
    setCurrentConversation(conversation)
  }

/**
 * 发送消息（核心函数）
 * 
 * 功能：
 *   1. 保存用户消息到数据库
 *   2. 调用 AI 流式 API 获取回复
 *   3. 实时更新 UI 显示 AI 回复
 *   4. 接收并保存引用来源
 *   5. 流式完成后，保存完整内容到数据库
 *   6. 如果是第一条消息，自动生成会话标题
 *   7. 避免联网搜索时消息重复创建
 *   8. 联网搜索实时显示
 *   9. 联网搜索时显示用户消息
 * 
 * 参数：
 *   @param {string} content - 用户输入的消息内容
 *   @param {Array} images - 用户上传的图片数组（默认为空）
 *   @param {boolean} useWebSearch - 是否使用联网搜索（默认 false）
 */
const handleSendMessage = async (content, images = [], useWebSearch = false, skipUserMessage = false) => {
  try {
    // 如果正在生成，先中断
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 确保有当前会话
    let convId = currentConversation?.id
    if (!convId) {
      const newConv = await createConversation('新对话', selectedModel.id)
      convId = newConv.id
    }

    // 联网搜索时不调用 sendMessage，但要手动添加用户消息到 UI
    // 原因：联网搜索 API 内部会自己创建用户消息和 AI 消息
    let aiMessageId
    if (!useWebSearch) {
      // 普通聊天：前端创建消息占位符（包含用户消息和 AI 消息）
      aiMessageId = await sendMessage(content, images, selectedModel.id, skipUserMessage)
      log.debug('✅ 普通聊天：前端创建消息占位符，aiMessageId:', aiMessageId)
    } else {
      log.debug('✅ 联网搜索：跳过前端创建 AI 消息，等待后端返回 aiMessageId')
      
      // 手动添加用户消息到 UI
      // 原因：联网搜索时不调用 sendMessage，所以需要手动添加用户消息
      const tempUserMessage = {
        id: `temp-user-${Date.now()}`, // 临时 ID
        role: 'user',
        content: content,
        images: images || [],
        createdAt: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, tempUserMessage])
      log.debug('✅ 已添加用户消息到 UI')
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    setIsGenerating(true)

    // 根据 useWebSearch 选择不同的 API
    const apiEndpoint = useWebSearch ? '/api/chat-web-search' : '/api/chat'
    log.debug('📡 调用 API:', apiEndpoint)

    // 调用流式 API
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          ...currentMessages.map(m => ({ 
            role: m.role,
            content: m.content,
            images: m.images || []
          })), 
          { 
            role: 'user', 
            content: content,
            images: images
          }
        ],
        model: selectedModel.id,
        conversationId: convId, //传递会话 ID
        images: images
      }),
      signal: abortControllerRef.current.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // ========================================================================
    // 流式读取处理（支持引用来源 + 实时显示）
    // ========================================================================
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulatedContent = ''
    let messageCitations = []  //存储引用来源
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // 将新数据追加到缓冲区
        buffer += decoder.decode(value, { stream: true })
        
        // 按行分割，保留最后一个不完整的行
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          // 跳过空行
          if (!line.trim()) continue
          
          // 检查是否以 data: 开头
          if (!line.startsWith('data: ')) continue
          
          // 提取 data: 后面的内容
          const dataStr = line.slice(6).trim()
          
          // 检查是否是结束标记
          if (dataStr === '[DONE]') {
            log.debug('流式响应结束')
            break
          }
          
          // 安全的 JSON 解析
          try {
            const data = JSON.parse(dataStr)
            
            // 处理联网搜索返回的 aiMessageId
            // 原因：联网搜索时，后端会在第一个数据块返回消息 ID
            if (data.type === 'init' && data.aiMessageId) {
              aiMessageId = data.aiMessageId
              log.debug('联网搜索：接收到后端返回的 aiMessageId:', aiMessageId)
              
              // 立即添加 AI 消息占位符到 UI
              // 原因：如果不添加，updateMessageContent 无法找到对应消息
              setMessages(prev => [
                ...prev,
                {
                  id: aiMessageId,
                  role: 'assistant',
                  content: '',
                  citations: [],
                  isWebSearch: true,
                  createdAt: new Date().toISOString()
                }
              ])
              log.debug('已添加 AI 消息占位符到 UI')
              
              continue
            }
            
            // 处理不同类型的消息
            if (data.type === 'text') {
              // 文本内容
              accumulatedContent += data.content
              // 只有在有 aiMessageId 时才更新 UI
              // 原因：避免在没有消息 ID 的情况下尝试更新，导致错误
              if (aiMessageId) {
                updateMessageContent(aiMessageId, accumulatedContent)
              } else {
                console.warn('⚠️ 尚未获取到 aiMessageId，暂存内容')
              }
              
            } else if (data.type === 'citations') {
              //引用来源
              messageCitations = data.citations
              log.debug('✅ 接收到引用来源:', messageCitations.length, '个')
              
              // 立即更新引用来源到 UI
              // 原因：实时显示引用来源，不需要等到流式结束
              if (aiMessageId) {
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, citations: messageCitations }
                    : msg
                ))
                log.debug('✅ 已更新引用来源到 UI')
              } else {
                console.warn('⚠️ 收到引用来源，但 aiMessageId 为空')
              }
              
            } else if (data.type === 'tool') {
              // 工具调用信息（搜索过程）
              accumulatedContent += data.content
              if (aiMessageId) {
                updateMessageContent(aiMessageId, accumulatedContent)
              }
              
            } else if (data.type === 'final') {
              // 最终内容
              accumulatedContent += data.content
              if (aiMessageId) {
                updateMessageContent(aiMessageId, accumulatedContent)
              }
              
            } else if (data.content) {
              // 兼容处理：直接包含 content 字段的情况
              accumulatedContent += data.content
              if (aiMessageId) {
                updateMessageContent(aiMessageId, accumulatedContent)
              }
              
            } else if (data.type === 'error' || data.error) {
              // 错误处理
              throw new Error(data.error || '未知错误')
            }
          } catch (parseError) {
            // 解析失败时不中断流程，只记录警告
            console.warn('⚠️ JSON 解析失败，跳过该行:', dataStr, parseError.message)
          }
        }
      }
      // ========================================================================
      // 流式读取结束
      // ========================================================================

      // 只有在有 aiMessageId 时才保存到数据库
      // 原因：联网搜索时，后端已经保存了消息，这里只需要更新
      if (aiMessageId) {
        log.debug('💾 准备保存消息到数据库...')
        
        // 流式完成，保存到数据库（包含引用来源）
        const saveResponse = await fetch(`/api/messages/${aiMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: accumulatedContent,
            citations: messageCitations.length > 0 ? messageCitations : null, // 保存引用来源
            isWebSearch: useWebSearch // 标记为联网搜索
          })
        })

        if (saveResponse.ok) {
          log.debug('✅ 消息保存成功，包含', messageCitations.length, '个引用来源')
        } else {
          console.error('❌ 消息保存失败:', await saveResponse.text())
        }
      } else {
        console.error('❌ 未获取到 aiMessageId，无法保存消息！')
        console.error('调试信息:', {
          useWebSearch,
          apiEndpoint,
          conversationId: convId,
          accumulatedContentLength: accumulatedContent.length
        })
      }

      // 自动生成标题
      if (currentMessages.length === 0) {
        log.debug('📝 自动生成会话标题...')
        await generateTitle(convId)
      }

    } catch (streamError) {
      // 处理中断错误
      if (streamError.name === 'AbortError') {
        log.debug('⚠️ 用户中断了生成')
        // 保存已生成的部分内容（只有在有 aiMessageId 时）
        if (accumulatedContent && aiMessageId) {
          await fetch(`/api/messages/${aiMessageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              content: accumulatedContent + '\n\n[已停止生成]',
              citations: messageCitations.length > 0 ? messageCitations : null,
              isWebSearch: useWebSearch
            })
          })
          log.debug('✅ 已保存部分生成的内容')
        }
      } else {
        throw streamError
      }
    } finally {
      // 重置生成状态
      setIsGenerating(false)
      abortControllerRef.current = null
    }

  } catch (error) {
    console.error('❌ 发送消息失败:', error)
    if (error.name !== 'AbortError') {
      alert('发送消息失败: ' + error.message)
    }
    setIsGenerating(false)
  }
}

  /**
   * 停止 AI 生成
   */
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
    }
  }

  // 删除消息
  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId)
    } catch (error) {
      alert('删除消息失败: ' + error.message)
    }
  }

  // 重新生成消息
  const handleRegenerateMessage = async (messageId) => {
    const messageIndex = currentMessages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) return

    const newMessages = currentMessages.slice(0, messageIndex)
    const lastUserMessage = [...newMessages].reverse().find(msg => msg.role === 'user')
    
    if (lastUserMessage) {
      // 删除旧的AI消息
      await handleDeleteMessage(messageId)
      
      // 重新发送时保持原有的联网搜索状态
      const originalMessage = currentMessages[messageIndex]
      const wasWebSearch = originalMessage?.isWebSearch || false
      
      setTimeout(() => {
        handleSendMessage(
          lastUserMessage.content, 
          lastUserMessage.images || [],
          wasWebSearch,// 传递联网搜索标识
          true // ✅ 新增：跳过用户消息创建
        )
      }, 500)
    }
  }

  // 编辑消息（暂不实现数据库更新）
  const handleEditMessage = (messageId, newContent) => {
    log.debug('编辑消息功能待实现')
  }

  // 复制消息
  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content)
  }

  // 删除会话
  const handleDeleteConversation = async (convId) => {
    if (confirm('确定要删除这个会话吗？')) {
      try {
        await deleteConversation(convId)
      } catch (error) {
        alert('删除会话失败: ' + error.message)
      }
    }
  }

  // 重命名会话
  const handleRenameConversation = async (convId, newTitle) => {
    try {
      await updateConversation(convId, { title: newTitle })
    } catch (error) {
      alert('重命名失败: ' + error.message)
    }
  }

  if (status === 'loading' || conversationsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header 
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          conversations={conversations}
          currentConversation={currentConversation}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          isOpen={isSidebarOpen}
        />
        
        {/* 传递联网搜索状态给 ChatArea */}
        <ChatArea 
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onCopyMessage={handleCopyMessage}
          currentModel={selectedModel}
          loading={messagesLoading}
          isGenerating={isGenerating}
          onStopGeneration={handleStopGeneration}
          isWebSearchEnabled={isWebSearchEnabled}
          onToggleWebSearch={setIsWebSearchEnabled}
        />
      </div>
    </div>
  )
}
