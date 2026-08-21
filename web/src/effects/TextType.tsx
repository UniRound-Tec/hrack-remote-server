'use client'

import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactNode
} from 'react'

/**
 * 主仓 src/app/effects/TextType.tsx 移植；gsap 光标改为 CSS 动画
 * （globals.css 的 .tt-cursor），并接入 prefers-reduced-motion。
 */
export interface TextTypeProps extends HTMLAttributes<HTMLElement> {
  text: string | string[]
  as?: ElementType
  typingSpeed?: number
  initialDelay?: number
  pauseDuration?: number
  deletingSpeed?: number
  loop?: boolean
  showCursor?: boolean
  cursorCharacter?: string
  cursorClassName?: string
  textColors?: string[]
  keywords?: string[]
  keywordColor?: string
  /** 应用到关键词 span 的额外类名（如 whitespace-nowrap 防止换行劈开关键词） */
  keywordClassName?: string
}

export default function TextType({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  cursorCharacter = '|',
  cursorClassName = '',
  textColors = [],
  keywords = [],
  keywordColor = '#ff4500',
  keywordClassName = '',
  ...props
}: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const containerRef = useRef<HTMLElement>(null)
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text])
  const currentText = textArray[currentTextIndex] ?? ''
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      // 静态呈现全文，不打字。
      setDisplayedText(currentText)
      setCurrentCharIndex(currentText.length)
      setIsDeleting(false)
      return
    }
    if (textArray.length === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined

    const execute = (): void => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false)
          if (currentTextIndex === textArray.length - 1 && !loop) return
          setCurrentTextIndex((value) => (value + 1) % textArray.length)
          setCurrentCharIndex(0)
          timer = setTimeout(() => {}, pauseDuration)
        } else {
          timer = setTimeout(
            () => setDisplayedText((value) => value.slice(0, -1)),
            deletingSpeed
          )
        }
      } else if (currentCharIndex < currentText.length) {
        timer = setTimeout(
          () => {
            setDisplayedText((value) => value + currentText[currentCharIndex])
            setCurrentCharIndex((value) => value + 1)
          },
          typingSpeed
        )
      } else {
        if (!loop && currentTextIndex === textArray.length - 1) return
        timer = setTimeout(() => setIsDeleting(true), pauseDuration)
      }
    }

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timer = setTimeout(execute, initialDelay)
    } else {
      execute()
    }
    return () => clearTimeout(timer)
  }, [
    currentCharIndex,
    currentText,
    currentTextIndex,
    deletingSpeed,
    displayedText,
    initialDelay,
    isDeleting,
    loop,
    pauseDuration,
    reduceMotion,
    textArray.length,
    typingSpeed
  ])

  const highlightedText = useMemo<ReactNode>(() => {
    if (keywords.length === 0 || displayedText.length === 0) return displayedText
    const escaped = keywords
      .filter(Boolean)
      .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (escaped.length === 0) return displayedText
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
    return displayedText.split(pattern).map((part, index) =>
      keywords.some((keyword) => keyword.toLowerCase() === part.toLowerCase()) ? (
        <span
          key={`${part}-${index}`}
          className={keywordClassName || undefined}
          style={{ color: keywordColor }}
        >
          {part}
        </span>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    )
  }, [displayedText, keywordClassName, keywordColor, keywords])

  return createElement(
    Component,
    {
      ref: containerRef,
      className: `inline-block whitespace-pre-wrap tracking-tight ${className}`,
      ...props
    },
    <span
      className="inline"
      style={{
        color: textColors[currentTextIndex % textColors.length] ?? 'inherit'
      }}
    >
      {highlightedText}
    </span>,
    showCursor && !reduceMotion && (
      <span className={`ml-1 inline-block ${cursorClassName}`}>
        <span className="tt-cursor">{cursorCharacter}</span>
      </span>
    )
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const listener = (event: MediaQueryListEvent): void =>
      setReduced(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}
