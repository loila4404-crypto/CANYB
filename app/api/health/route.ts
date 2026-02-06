import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'НЕ УСТАНОВЛЕН ❌',
      JWT_SECRET: process.env.JWT_SECRET ? 'Установлен ✅' : 'НЕ УСТАНОВЛЕН ❌',
      NODE_ENV: process.env.NODE_ENV || 'не указан',
    },
    database: 'не проверено',
    prisma_status: 'не проверено',
  }

  // Проверяем подключение к базе данных
  try {
    // Простой запрос к базе
    const result = await prisma.$queryRaw`SELECT 1 as test`
    checks.database = 'Подключение успешно ✅'
    checks.prisma_status = 'Работает ✅'
    
    // Проверяем, есть ли таблицы
    try {
      const userCount = await prisma.user.count()
      checks.users_count = userCount
      checks.tables = 'Таблицы созданы ✅'
    } catch (tableError: any) {
      checks.tables = `Ошибка таблиц: ${tableError.message}`
    }
  } catch (dbError: any) {
    checks.database = `Ошибка подключения ❌: ${dbError.message}`
    checks.prisma_status = `Ошибка: ${dbError.code || dbError.name}`
    checks.db_error_full = dbError.message
  }

  return NextResponse.json(checks, { status: 200 })
}


