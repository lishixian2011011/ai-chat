import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件
const envPath = resolve(__dirname, '.env');
console.log('🔍 正在查找 .env 文件:', envPath);

// 检查 .env 文件是否存在
if (!existsSync(envPath)) {
    console.error('❌ .env 文件不存在:', envPath);
    console.log('💡 请确保 .env 文件位于项目根目录');
    process.exit(1);
}

// 读取并显示 .env 文件内容（不包含敏感信息）
try {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').filter(line => 
        line.trim() && !line.trim().startsWith('#') && line.includes('=')
    );
    
    console.log('📁 .env 文件内容概要:');
    lines.forEach(line => {
        const [key, value] = line.split('=');
        const displayValue = key.includes('PASSWORD') || key.includes('SECRET') 
            ? '***' 
            : value;
        console.log(`   ${key}=${displayValue}`);
    });
} catch (error) {
    console.error('❌ 读取 .env 文件失败:', error.message);
}

// 加载环境变量
const result = config({ path: envPath });

if (result.error) {
    console.error('❌ 加载环境变量失败:', result.error);
    process.exit(1);
}

console.log('✅ 环境变量加载成功');

// 验证数据库连接字符串
if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    console.log('🔗 数据库连接字符串已设置');
    
    if (dbUrl.startsWith('postgresql://')) {
        console.log('✅ 连接字符串格式正确 (PostgreSQL)');
        
        // 解析连接字符串以隐藏密码
        try {
            const url = new URL(dbUrl);
            const safeUrl = `${url.protocol}//${url.username}:***@${url.host}${url.pathname}`;
            console.log(`   ${safeUrl}`);
        } catch (e) {
            console.log(`   ${dbUrl.split('@')[0]}:***@${dbUrl.split('@')[1]}`);
        }
    } else if (dbUrl.startsWith('prisma+postgres://')) {
        console.log('⚠️  连接字符串格式为 Prisma Postgres');
        console.log('💡 建议改为标准 PostgreSQL 格式: postgresql://username:password@host:port/database');
    } else {
        console.log('❌ 未知的连接字符串格式');
    }
} else {
    console.error('❌ DATABASE_URL 环境变量未设置');
    console.log('💡 请在 .env 文件中添加: DATABASE_URL="postgresql://username:password@localhost:5432/database_name"');
    process.exit(1);
}

// 检查其他重要环境变量
const importantVars = ['NODE_ENV', 'DATABASE_URL'];
importantVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`✅ ${varName}: 已设置`);
    } else {
        console.log(`⚠️  ${varName}: 未设置`);
    }
});
