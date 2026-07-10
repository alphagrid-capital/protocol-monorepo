declare module 'hono' {
  interface ContextVariableMap {
    authAddress: string
    authEmail: string | null
  }
}

export {}
