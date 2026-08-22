export function allowNext(value: string | undefined): string | undefined {
  if (!value || value.includes('//') || value.includes(':') || value.includes('\\')) {
    return undefined
  }
  if (
    value === '/dashboard' ||
    value.startsWith('/dashboard/') ||
    value === '/admin' ||
    value.startsWith('/admin/')
  ) {
    return value
  }
  return undefined
}
