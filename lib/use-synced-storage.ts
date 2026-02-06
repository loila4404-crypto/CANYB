'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { saveUserData, getUserData } from './user-data'

// Хук для синхронизированного хранилища (localStorage + сервер)
// С защитой от перезаписи при входе с другого ПК и live-обновлениями
export function useSyncedStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    debounceMs?: number // Задержка перед сохранением на сервер (по умолчанию 500ms)
    syncOnMount?: boolean // Синхронизировать с сервером при монтировании (по умолчанию true)
    pollIntervalMs?: number // Интервал опроса сервера для live-обновлений (по умолчанию 5000ms, 0 = выключен)
  }
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const { debounceMs = 500, syncOnMount = true, pollIntervalMs = 5000 } = options || {}
  
  const [value, setValue] = useState<T>(initialValue)
  const [isLoading, setIsLoading] = useState(syncOnMount)
  
  // Флаг: начальная загрузка с сервера завершена — можно сохранять
  const serverSyncDoneRef = useRef(false)
  // Флаг: пользователь явно изменил значение (через setValueAndSync)
  const userHasEditedRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const keyRef = useRef(key)
  const valueRef = useRef<T>(initialValue)
  const initialValueRef = useRef<T>(initialValue)
  // Метка последнего сохранения для предотвращения перезаписи свежих данных поллингом
  const lastSaveTimestampRef = useRef(0)
  
  // Обновляем ref при изменении key
  useEffect(() => {
    keyRef.current = key
  }, [key])

  // Обновляем valueRef при каждом изменении value
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Загружаем данные с сервера при монтировании + настраиваем polling
  useEffect(() => {
    mountedRef.current = true
    serverSyncDoneRef.current = false
    userHasEditedRef.current = false
    
    if (!syncOnMount) {
      setIsLoading(false)
      serverSyncDoneRef.current = true
      // Загрузим из localStorage если есть
      try {
        const saved = localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved)
          setValue(parsed)
          valueRef.current = parsed
        }
      } catch {}
      return
    }
    
    const loadFromServer = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        // Нет токена — берём из localStorage
        try {
          const saved = localStorage.getItem(key)
          if (saved) {
            const parsed = JSON.parse(saved)
            setValue(parsed)
            valueRef.current = parsed
          }
        } catch {}
        setIsLoading(false)
        serverSyncDoneRef.current = true
        return
      }
      
      try {
        const serverData = await getUserData(key)
        if (!mountedRef.current) return
        
        if (serverData !== null) {
          // Сервер имеет данные — используем их (они главные!)
          setValue(serverData)
          valueRef.current = serverData
          localStorage.setItem(key, JSON.stringify(serverData))
          console.log(`📥 ${key}: загружено с сервера`)
        } else {
          // На сервере нет данных — проверяем localStorage
          const localData = localStorage.getItem(key)
          if (localData) {
            try {
              const parsed = JSON.parse(localData)
              setValue(parsed)
              valueRef.current = parsed
              // Если есть локальные данные — пушим на сервер
              const hasData = parsed && (
                Array.isArray(parsed) ? parsed.length > 0 :
                typeof parsed === 'object' ? Object.keys(parsed).length > 0 :
                true
              )
              if (hasData) {
                console.log(`📤 ${key}: локальные данные отправляем на сервер`)
                await saveUserData(key, parsed)
              }
            } catch {}
          }
        }
      } catch (error) {
        console.error(`Ошибка загрузки ${key} с сервера:`, error)
        // При ошибке — используем localStorage как fallback
        try {
          const saved = localStorage.getItem(key)
          if (saved) {
            const parsed = JSON.parse(saved)
            setValue(parsed)
            valueRef.current = parsed
          }
        } catch {}
      } finally {
        if (mountedRef.current) {
          serverSyncDoneRef.current = true
          setIsLoading(false)
        }
      }
    }
    
    loadFromServer()
    
    return () => {
      mountedRef.current = false
    }
  }, [key, syncOnMount])

  // Polling — периодический опрос сервера для live-обновлений
  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return
    
    const poll = async () => {
      // Не поллим пока начальная загрузка не завершена
      if (!serverSyncDoneRef.current) return
      // Не поллим если только что сохраняли (подождём чтоб не перезатереть)
      if (Date.now() - lastSaveTimestampRef.current < 3000) return
      
      const token = localStorage.getItem('token')
      if (!token) return
      
      try {
        const serverData = await getUserData(keyRef.current)
        if (!mountedRef.current) return
        if (serverData === null) return
        
        // Сравниваем с текущими данными
        const currentJson = JSON.stringify(valueRef.current)
        const serverJson = JSON.stringify(serverData)
        
        if (currentJson !== serverJson) {
          console.log(`🔄 ${keyRef.current}: обнаружены изменения с сервера, обновляем`)
          setValue(serverData)
          valueRef.current = serverData
          localStorage.setItem(keyRef.current, JSON.stringify(serverData))
        }
      } catch {
        // Тихо игнорируем ошибки polling
      }
    }
    
    pollIntervalRef.current = setInterval(poll, pollIntervalMs)
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [pollIntervalMs, key])

  // Функция для установки значения (вызывается ТОЛЬКО из пользовательского кода)
  const setValueAndSync = useCallback((newValue: T | ((prev: T) => T)) => {
    // Помечаем что пользователь явно изменил данные
    userHasEditedRef.current = true
    
    setValue((prev) => {
      const resolved = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prev) 
        : newValue
      
      // Обновляем ref сразу
      valueRef.current = resolved
      
      // Сохраняем в localStorage сразу
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(resolved))
      } catch (error) {
        console.error(`Ошибка сохранения ${keyRef.current} в localStorage:`, error)
      }
      
      // НЕ сохраняем на сервер, пока начальная загрузка не завершена!
      if (!serverSyncDoneRef.current) {
        console.warn(`⏳ ${keyRef.current}: пропускаем сохранение на сервер — начальная загрузка не завершена`)
        return resolved
      }
      
      // Отложенное сохранение на сервер (debounce)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        const token = localStorage.getItem('token')
        if (!token) return
        
        lastSaveTimestampRef.current = Date.now()
        
        try {
          const success = await saveUserData(keyRef.current, valueRef.current)
          if (success) {
            console.log(`✅ ${keyRef.current}: сохранено на сервер`)
          }
        } catch (error) {
          console.error(`Ошибка сохранения ${keyRef.current} на сервер:`, error)
        }
      }, debounceMs)
      
      return resolved
    })
  }, [debounceMs])

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  return [value, setValueAndSync, isLoading]
}

// Хук для синхронизации настроек пользователя
export function useSyncedSettings<T extends Record<string, any>>(
  settingsKey: keyof T,
  initialValue: T[keyof T]
): [T[keyof T], (value: T[keyof T]) => void] {
  const [value, setValue] = useState<T[keyof T]>(() => {
    if (typeof window === 'undefined') return initialValue
    
    try {
      const saved = localStorage.getItem(settingsKey as string)
      if (saved) {
        // Для boolean значений
        if (saved === 'true') return true as T[keyof T]
        if (saved === 'false') return false as T[keyof T]
        return saved as T[keyof T]
      }
    } catch {
      // Игнорируем ошибку
    }
    
    return initialValue
  })

  const setValueAndSync = useCallback((newValue: T[keyof T]) => {
    setValue(newValue)
    
    try {
      localStorage.setItem(settingsKey as string, String(newValue))
    } catch {
      // Игнорируем ошибку
    }
    
    // Сохраняем на сервер
    const token = localStorage.getItem('token')
    if (token) {
      import('./user-data').then(({ saveUserSettings }) => {
        saveUserSettings({ [settingsKey]: newValue } as any).catch(console.error)
      })
    }
  }, [settingsKey])

  return [value, setValueAndSync]
}
