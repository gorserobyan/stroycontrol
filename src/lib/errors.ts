import { isAuthError } from '@supabase/supabase-js'

interface ErrorLike {
  message?: unknown
  code?: unknown
  status?: unknown
}

const CYRILLIC = /[а-яё]/i

function asErrorLike(error: unknown): ErrorLike | null {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : null
}

/** PostgREST / GoTrue codes that mean the session is no longer valid. */
export function isSessionExpiredError(error: unknown): boolean {
  const e = asErrorLike(error)
  if (!e) return false
  const code = typeof e.code === 'string' ? e.code : ''
  if (code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303') return true
  if (code === 'session_expired' || code === 'refresh_token_not_found' || code === 'bad_jwt') return true
  return typeof e.message === 'string' && /jwt expired/i.test(e.message)
}

/**
 * Turns any Supabase/Postgres/network error into a Russian message that is
 * safe to show the user. Messages raised by our own database functions are
 * already in Russian and are shown as-is.
 */
export function getErrorMessage(error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.'): string {
  const e = asErrorLike(error)
  if (!e) return fallback

  const message = typeof e.message === 'string' ? e.message : ''
  const code = typeof e.code === 'string' ? e.code : ''

  if (isSessionExpiredError(error)) return 'Сессия истекла. Войдите снова.'

  if (isAuthError(error)) {
    if (code === 'invalid_credentials') return 'Неверный email или пароль'
    if (code === 'over_request_rate_limit' || error.status === 429)
      return 'Слишком много попыток входа. Подождите немного и попробуйте снова.'
    if (code === 'email_not_confirmed') return 'Email не подтверждён. Обратитесь к администратору.'
    if (code === 'user_banned') return 'Учётная запись заблокирована. Обратитесь к администратору.'
  }

  if (message && CYRILLIC.test(message)) return message

  if (/failed to fetch|networkerror|load failed/i.test(message))
    return 'Нет соединения с сервером. Проверьте подключение к интернету.'

  switch (code) {
    case '42501':
      return 'Недостаточно прав для выполнения этого действия.'
    case '23505':
      return 'Запись с такими данными уже существует.'
    case '23503':
      return 'Связанная запись не найдена или недоступна.'
    case '23514':
    case '23502':
    case '22001':
      return 'Данные не прошли проверку. Исправьте поля формы.'
    case 'P0002':
    case 'PGRST116':
      return 'Запись не найдена или у вас нет к ней доступа.'
  }

  return fallback
}
