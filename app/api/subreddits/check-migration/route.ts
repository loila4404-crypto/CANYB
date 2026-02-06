import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint для проверки состояния базы данных (PostgreSQL)
export async function GET(request: NextRequest) {
  try {
    // Проверяем подключение к базе данных через простой запрос
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Subreddit'
      ) as exists
    `
    
    const tableExists = result[0]?.exists || false
    
    return NextResponse.json({ 
      exists: tableExists, 
      message: tableExists ? 'Таблица Subreddit существует' : 'Таблица Subreddit не найдена',
      database: 'PostgreSQL'
    })
  } catch (error: any) {
    console.error('❌ Ошибка проверки базы данных:', error)
    return NextResponse.json(
      { 
        error: 'Ошибка проверки базы данных', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}







