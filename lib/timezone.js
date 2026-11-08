// Timezone helpers shared by server code (notifications, AI context, usage quotas).
import { parseDateStr } from './planEngine.js'

export const DEFAULT_TIMEZONE = 'Africa/Cairo'

export function resolveTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return tz || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/** 'YYYY-MM-DD' of `date` in the given timezone. */
export function localDateStr(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: resolveTimezone(tz) }).format(date)
}

/** A Date whose local Y/M/D is the calendar day of `date` in the user's timezone. */
export function userDay(tz, date = new Date()) {
  return parseDateStr(localDateStr(tz, date))
}
