export interface SignalItem {
  id: string
  createdAt: string
  text: string
}

export interface SignalFeed {
  source: string
  handle?: string
  fetchedAt: string
  items: SignalItem[]
}
