import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Sparkles, Send, Bot, User as UserIcon, X, Terminal, Loader2 } from 'lucide-react';

export default function AiAssistantModal({ isOpen, onClose }) {
  const { user, isAdmin, isHR, isEmployee } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am **HCM Lite AI Assistant**.\n\nI can directly interact with HCM Lite services using tool-calling to check your live leave balances, attendance, company policies, headcount KPIs, and payroll details. How can I help you today?`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const samplePrompts = isEmployee
    ? [
        'What is my leave balance?',
        'Show my attendance this month',
        'What is my latest payslip and take-home pay?',
        'What is the company policy on office hours and late arrivals?',
      ]
    : isHR
    ? [
        'Show today\'s daily attendance summary',
        'Are there any pending leave requests?',
        'What is our company headcount and attendance rate?',
        'Explain the company payroll formula and allowances',
      ]
    : [
        'Give me a company executive KPI summary',
        'Show recent payroll runs and costs',
        'Show today\'s daily attendance summary',
        'What are the recent audit log activities?',
      ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(textToSend = null) {
    const query = (textToSend || prompt).trim();
    if (!query || loading) return;

    const userMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const res = await api.askAi({ prompt: query });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          toolUsed: res.toolUsed,
          toolResult: res.toolResult,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error processing request: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 680,
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>HCM Lite AI Assistant</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Role context: <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{user?.role}</span> (Service-layer Tool Calling)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat message history */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}

                <div>
                  {!isUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Sparkles size={10} />
                        AI-generated
                      </span>
                      {msg.toolUsed && (
                        <span
                          style={{
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                          }}
                        >
                          tool: {msg.toolUsed}()
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: isUser
                        ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                        : 'var(--bg-elevated)',
                      color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      border: '1px solid var(--border-color)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>

                {isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'var(--primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <UserIcon size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: '0.825rem', fontStyle: 'italic' }}>
                Executing service tool & generating response...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            background: 'var(--bg-card)',
          }}
        >
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: 10,
            background: 'var(--bg-secondary)',
          }}
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Ask about policies, leaves, attendance, or headcount...`}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="btn btn-primary"
            style={{ borderRadius: 12, padding: '0 16px' }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
