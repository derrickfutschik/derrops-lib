import { useRef, useState } from 'react'

interface UseUrlHistoryParams {
  url: string
  setUrl: (url: string) => void
  isAnalyzing: boolean
  isSendingRequest: boolean
  onAction: () => void
}

interface UseUrlHistoryReturn {
  urlHistory: string[]
  urlHistoryIndex: number
  setUrlHistoryIndex: (i: number) => void
  showUrlHistory: boolean
  setShowUrlHistory: (v: boolean) => void
  urlInputFocusedRef: React.MutableRefObject<boolean>
  addUrlToHistory: (urlToAdd: string) => void
  handleUrlKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function useUrlHistory({
  url,
  setUrl,
  isAnalyzing,
  isSendingRequest,
  onAction,
}: UseUrlHistoryParams): UseUrlHistoryReturn {
  const [urlHistory, setUrlHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apiTester_urlHistory')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [urlHistoryIndex, setUrlHistoryIndex] = useState(-1)
  const [showUrlHistory, setShowUrlHistory] = useState(false)
  const savedUrlRef = useRef('')
  const urlInputFocusedRef = useRef(false)

  const addUrlToHistory = (urlToAdd: string) => {
    if (!urlToAdd.trim()) return
    setUrlHistory((prev) => {
      const filtered = prev.filter((u) => u !== urlToAdd)
      const updated = [urlToAdd, ...filtered].slice(0, 50)
      localStorage.setItem('apiTester_urlHistory', JSON.stringify(updated))
      return updated
    })
    setUrlHistoryIndex(-1)
  }

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (showUrlHistory) {
        setShowUrlHistory(false)
        return
      }
      if (urlHistoryIndex !== -1) {
        setUrlHistoryIndex(-1)
        setUrl(savedUrlRef.current)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (urlHistory.length === 0) return
      if (urlHistoryIndex === -1) savedUrlRef.current = url
      const newIndex = Math.min(urlHistoryIndex + 1, urlHistory.length - 1)
      setUrlHistoryIndex(newIndex)
      setUrl(urlHistory[newIndex])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (urlHistoryIndex === -1) return
      const newIndex = urlHistoryIndex - 1
      setUrlHistoryIndex(newIndex)
      setUrl(newIndex === -1 ? savedUrlRef.current : urlHistory[newIndex])
      return
    }
    if (e.key === 'Enter' && !isAnalyzing && !isSendingRequest) {
      addUrlToHistory(url)
      onAction()
    }
  }

  return {
    urlHistory,
    urlHistoryIndex,
    setUrlHistoryIndex,
    showUrlHistory,
    setShowUrlHistory,
    urlInputFocusedRef,
    addUrlToHistory,
    handleUrlKeyDown,
  }
}
