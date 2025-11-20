/**
 * ============================================================================
 * PDF upload API app/api/pdf/upload/route.js
 * ============================================================================
 */

import { chunkText } from '@/lib/rag/chunking';
import { embedBatch } from '@/lib/rag/embeddings';
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route'; // ✅ 从 NextAuth 路由导入
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import log from '@/lib/log';

// 在文件顶部添加配置
const VECTOR_DIMENSION = 1024; // 根据模型调整
// GET 方法用于测试
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'PDF 上传 API 正常运行',
    timestamp: new Date().toISOString()
  });
}

// POST 方法处理文件上传
export async function POST(req) {
  
  try {
    // 1. 身份验证
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // 2. 解析表单数据
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      );
    }

    // 3. 验证文件类型
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: '仅支持 PDF 文件' },
        { status: 400 }
      );
    }

    // 4. 验证文件大小（20MB）
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '文件大小不能超过 20MB' },
        { status: 400 }
      );
    }

    // 5. 生成文件名
    const timestamp = Date.now();
    const originalName = file.name;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const fileName = `${baseName}_${timestamp}${ext}`;

    // 6. 创建上传目录
    const year = new Date().getFullYear().toString();
    const month = (new Date().getMonth() + 1).toString();
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'pdfs',
      year,
      month
    );

    await fs.mkdir(uploadDir, { recursive: true });

    // 7. 保存文件
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // 8. 生成访问 URL
    const fileUrl = `/uploads/pdfs/${year}/${month}/${fileName}`;

    // 9. 保存到数据库
    const pdfRecord = await prisma.pDF.create({
      data: {
        userId: session.user.id,
        name: originalName,
        fileName: fileName,
        filePath: fileUrl,
        size: file.size,
        status: 'processing',  // 设置为处理中
      },
    });

    // 启动异步 RAG 处理（不阻塞响应）
    processPdfInBackground(pdfRecord.id, filePath).catch(error => {
      console.error('❌ 后台处理失败:', error);
    });

    // 10. 返回成功响应
    return NextResponse.json({
      success: true,
      message: '上传成功，正在处理中...',
      data: pdfRecord,
    });

  } catch (error) {
    console.error('❌ 上传失败:', error);
    console.error('错误堆栈:', error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '上传失败：' + error.message,
      },
      { status: 500 }
    );
  }
}


// 后台处理函数
async function processPdfInBackground(pdfId, filePath) {
  try {
    // 1. 解析 PDF
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    // 2. 文本分块
    const chunks = await chunkText(pdfData.text, {
      source: 'pdf',
      totalPages: pdfData.numpages,
    });
    
    // 3. 批量向量化
    const texts = chunks.map(c => c.content);
    const vectors = await embedBatch(texts);
    
    // 动态获取向量维度
    const actualDimension = vectors[0]?.length || VECTOR_DIMENSION;
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = vectors[i];
      
      try {
        if (vector && vector.length > 0) {
          // 方案 1：使用 $executeRawUnsafe
          const vectorStr = `[${vector.join(',')}]`;
          const metadataStr = JSON.stringify(chunk.metadata || {});
          
          await prisma.$executeRawUnsafe(
            `INSERT INTO document_chunks (
              id, pdf_id, chunk_index, content, embedding, 
              token_count, page_number, metadata, created_at
            ) VALUES (
              $1, $2, $3, $4, $5::vector(${actualDimension}), $6, $7, $8::jsonb, NOW()
            )`,
            `chunk_${pdfId}_${i}`,
            pdfId,
            chunk.chunkIndex,
            chunk.content,
            vectorStr,
            chunk.tokenCount || 0,
            chunk.metadata?.pageNumber || null,
            metadataStr
          );
          
        } else {
          // 没有向量时使用 ORM
          await prisma.documentChunk.create({
            data: {
              id: `chunk_${pdfId}_${i}`,
              pdfId: pdfId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              tokenCount: chunk.tokenCount || 0,
              pageNumber: chunk.metadata?.pageNumber || null,
              metadata: chunk.metadata || {},
            }
          });
        }
        
        successCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(` 已保存 ${i + 1}/${chunks.length} 个块`);
        }
        
      } catch (insertError) {
        failCount++;
        console.error(`❌ 保存块 ${i} 失败:`, insertError.message);
        console.error('详细错误:', insertError);
        
        if (failCount > 5) {
          throw new Error(`保存失败过多 (${failCount} 个)，停止处理`);
        }
      }
    }
    
    // 5. 更新 PDF 状态
    await prisma.pDF.update({
      where: { id: pdfId },
      data: {
        status: 'ready',
        totalChunks: successCount,
        totalPages: pdfData.numpages,
        processedAt: new Date(),
      },
    });
    
    console.log('PDF 处理完成:', pdfId);
    
  } catch (error) {
    console.error('❌ 后台处理失败:', error);
    console.error('错误堆栈:', error.stack);
    
    try {
      await prisma.pDF.update({
        where: { id: pdfId },
        data: {
          status: 'failed',
          errorMessage: error.message || '未知错误',
        },
      });
    } catch (updateError) {
      console.error('❌ 更新失败状态失败:', updateError);
    }
  }
}
