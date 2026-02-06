import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { saveUserData, loadUserData, isRedisConfigured, SyncData } from '@/lib/redis'

// Сохранить данные (PUT)
export async function PUT(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем, настроен ли Redis
    if (!isRedisConfigured()) {
      console.error('❌ Redis не настроен')
      return NextResponse.json(
        { error: 'Хранилище не настроено. Добавьте Upstash Redis в Vercel Storage.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { localStorage, sessionStorage, cookies, accounts } = body

    const data: SyncData = {
      localStorage: localStorage || {},
      sessionStorage: sessionStorage || {},
      cookies: cookies || '',
      accounts: accounts || [],
      timestamp: Date.now(),
    }

    console.log('📤 Сохранение данных для пользователя:', userId)
    const success = await saveUserData(userId, data)

    if (success) {
      return NextResponse.json({ 
        message: 'Данные сохранены',
        timestamp: data.timestamp,
        userId,
      })
    } else {
      return NextResponse.json(
        { error: 'Ошибка сохранения данных' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Ошибка сохранения в MEGA:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка сохранения данных' },
      { status: 500 }
    )
  }
}

// Загрузить данные (GET)
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем, настроен ли Redis
    if (!isRedisConfigured()) {
      console.error('❌ Redis не настроен')
      return NextResponse.json(
        { error: 'Хранилище не настроено. Добавьте Upstash Redis в Vercel Storage.' },
        { status: 500 }
      )
    }

    console.log('📥 Загрузка данных для пользователя:', userId)
    const data = await loadUserData(userId)

    if (!data) {
      return NextResponse.json(
        { 
          message: 'Данные не найдены', 
          data: null,
          timestamp: Date.now(),
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ 
      message: 'Данные загружены',
      data,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Ошибка загрузки из MEGA:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка загрузки данных' },
      { status: 500 }
    )
  }
}

// Синхронизировать данные (POST) - для совместимости со старым API
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем, настроен ли Redis
    if (!isRedisConfigured()) {
      console.error('❌ Redis не настроен')
      return NextResponse.json(
        { error: 'Хранилище не настроено. Добавьте Upstash Redis в Vercel Storage.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { data, localStorage, sessionStorage, cookies, accounts } = body

    // Поддерживаем оба формата: {data: {...}} и прямые поля
    const syncData: SyncData = data ? {
      localStorage: data.localStorage || {},
      sessionStorage: data.sessionStorage || {},
      cookies: data.cookies || '',
      accounts: data.accounts || [],
      timestamp: Date.now(),
    } : {
      localStorage: localStorage || {},
      sessionStorage: sessionStorage || {},
      cookies: cookies || '',
      accounts: accounts || [],
      timestamp: Date.now(),
    }

    console.log('📤 Синхронизация данных для пользователя:', userId)
    const success = await saveUserData(userId, syncData)

    if (success) {
      return NextResponse.json({ 
        message: 'Данные синхронизированы',
        timestamp: syncData.timestamp,
        userId,
      })
    } else {
      return NextResponse.json(
        { error: 'Ошибка синхронизации данных' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Ошибка синхронизации:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка синхронизации данных' },
      { status: 500 }
    )
  }
}
