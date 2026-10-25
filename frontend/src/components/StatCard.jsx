import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'var(--primary)', trend = null }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `color-mix(in srgb, ${color} 14%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
          {value}
        </div>
        {(subtitle || trend) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {trend && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: trend.isPositive ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {trend.value}
              </span>
            )}
            {subtitle && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
