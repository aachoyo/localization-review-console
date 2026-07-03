import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn class-name combiner */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let _uid = 0
/** Monotonic id for in-session highlights / flags. */
export function nextId(prefix: string) {
  _uid += 1
  return `${prefix}${_uid}`
}
