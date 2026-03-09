'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME_MESSAGE = 'Opa! Eu sou o Flux, seu assistente do NoCheck! Pode me perguntar qualquer coisa sobre o sistema — como preencher checklists, interpretar relatorios, gerenciar planos de acao... Estou aqui pra ajudar! 😄'

export function FluxChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Opa, tive um probleminha pra te responder! Tenta de novo em alguns segundos? 😅' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[calc(100vw-2rem)] sm:w-[380px] h-[70vh] sm:h-[520px] flex flex-col rounded-2xl shadow-xl border border-subtle bg-page overflow-hidden">
          {/* Header */}
          <div className="bg-accent px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Flux</h3>
                <p className="text-white/70 text-xs">Assistente NoCheck</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent text-white rounded-br-md'
                      : 'bg-surface border border-subtle text-main rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface border border-subtle rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-bounce bg-accent/60" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce bg-accent/60" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce bg-accent/60" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-subtle px-3 py-3 shrink-0 bg-surface">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte ao Flux..."
                disabled={isLoading}
                className="flex-1 bg-page border border-subtle rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-accent text-white p-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <FiSend className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-4 sm:right-6 z-[60] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-surface border border-subtle text-muted hover:text-main'
            : 'bg-accent text-white hover:opacity-90'
        }`}
        title={isOpen ? 'Fechar Flux' : 'Falar com o Flux'}
      >
        {isOpen ? (
          <FiX className="w-6 h-6" />
        ) : (
          <FiMessageCircle className="w-6 h-6" />
        )}
      </button>
    </>
  )
}
