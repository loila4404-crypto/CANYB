// Утилита для работы с Upstash Redis
// Используется для синхронизации данных между устройствами

import { Redis } from '@upstash/redis'

// Интерфейс данных синхронизации
export interface SyncData {
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  cookies: string
  timestamp: number
  accounts?: any[] // Reddit аккаунты
}

// Создаем клиент Redis с проверкой переменных окружения
function getRedisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn('⚠️ Redis не настроен. Переменные KV_REST_API_URL и KV_REST_API_TOKEN не найдены.')
    return null
  }

  return new Redis({
    url,
    token,
  })
}

// Ленивая инициализация клиента
let redisClient: Redis | null = null

function getClient(): Redis {
  if (!redisClient) {
    redisClient = getRedisClient()
  }
  if (!redisClient) {
    throw new Error('Redis не настроен. Добавьте Upstash Redis в Vercel Storage.')
  }
  return redisClient
}

/**
 * Сохраняет данные пользователя в Redis
 */
export async function saveUserData(userId: string, data: SyncData): Promise<boolean> {
  try {
    const client = getClient()
    const key = `user:${userId}:sync`
    
    // Сохраняем данные в Redis (автоматическая сериализация JSON)
    await client.set(key, data)
    
    console.log('✅ Данные сохранены в Redis:', {
      userId,
      timestamp: new Date(data.timestamp).toISOString(),
      localStorageKeys: Object.keys(data.localStorage || {}).length,
      accountsCount: data.accounts?.length || 0,
    })
    
    return true
  } catch (error) {
    console.error('❌ Ошибка сохранения в Redis:', error)
    return false
  }
}

/**
 * Загружает данные пользователя из Redis
 */
export async function loadUserData(userId: string): Promise<SyncData | null> {
  try {
    const client = getClient()
    const key = `user:${userId}:sync`
    
    // Получаем данные из Redis (автоматическая десериализация JSON)
    const data = await client.get<SyncData>(key)
    
    if (!data) {
      console.log('📭 Данные не найдены в Redis для пользователя:', userId)
      return null
    }
    
    console.log('✅ Данные загружены из Redis:', {
      userId,
      timestamp: new Date(data.timestamp).toISOString(),
      localStorageKeys: Object.keys(data.localStorage || {}).length,
      accountsCount: data.accounts?.length || 0,
    })
    
    return data
  } catch (error) {
    console.error('❌ Ошибка загрузки из Redis:', error)
    return null
  }
}

/**
 * Удаляет данные пользователя из Redis
 */
export async function deleteUserData(userId: string): Promise<boolean> {
  try {
    const client = getClient()
    const key = `user:${userId}:sync`
    
    await client.del(key)
    
    console.log('🗑️ Данные удалены из Redis для пользователя:', userId)
    return true
  } catch (error) {
    console.error('❌ Ошибка удаления из Redis:', error)
    return false
  }
}

/**
 * Проверяет подключение к Redis
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getClient()
    await client.ping()
    console.log('✅ Подключение к Redis успешно')
    return true
  } catch (error) {
    console.error('❌ Ошибка подключения к Redis:', error)
    return false
  }
}

/**
 * Проверяет, настроен ли Redis
 */
export function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return !!(url && token)
}



