import { NextResponse } from 'next/server'
import { isRedisConfigured, checkRedisConnection } from '@/lib/redis'

// Тестовый маршрут для проверки работы хранилища
export async function GET() {
  const configured = isRedisConfigured()
  
  let connected = false
  if (configured) {
    try {
      connected = await checkRedisConnection()
    } catch (e) {
      console.error('Ошибка проверки подключения к Redis:', e)
    }
  }
  
  return NextResponse.json({ 
    message: 'Cloud Storage API работает!',
    storage: 'Upstash Redis',
    configured,
    connected,
    timestamp: Date.now(),
  })
}
