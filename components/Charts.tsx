'use client'

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts'

interface ScoreTrendProps {
  data: { date: string; score: number }[]
}

export function ScoreTrendChart({ data }: ScoreTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111111', border: '1px solid #1F1F1F', borderRadius: '8px' }}
          labelStyle={{ color: '#A3A3A3', fontSize: 12 }}
          itemStyle={{ color: '#F97316', fontSize: 12 }}
        />
        <Area type="monotone" dataKey="score" stroke="#F97316" strokeWidth={2} fill="url(#scoreGradient)" dot={{ fill: '#F97316', r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface FindingsByCategoryProps {
  data: { category: string; count: number }[]
}

export function FindingsByCategoryChart({ data }: FindingsByCategoryProps) {
  const COLORS = ['#F97316', '#EF4444', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6']
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 30, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
        <XAxis dataKey="category" tick={{ fill: '#525252', fontSize: 10 }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111111', border: '1px solid #1F1F1F', borderRadius: '8px' }}
          labelStyle={{ color: '#A3A3A3', fontSize: 12 }}
          itemStyle={{ color: '#F97316', fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface SeverityDonutProps {
  critical: number
  high: number
  medium: number
  low: number
}

export function SeverityDonut({ critical, high, medium, low }: SeverityDonutProps) {
  const data = [
    { name: 'Critical', value: critical, color: '#EF4444' },
    { name: 'High', value: high, color: '#F97316' },
    { name: 'Medium', value: medium, color: '#EAB308' },
    { name: 'Low', value: low, color: '#22C55E' },
  ].filter(d => d.value > 0)

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-[160px] text-neutral-700 text-sm">No findings</div>
  )

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#111111', border: '1px solid #1F1F1F', borderRadius: '8px', fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface AuditFrequencyProps {
  data: { month: string; count: number }[]
}

export function AuditFrequencyChart({ data }: AuditFrequencyProps) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="month" tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111111', border: '1px solid #1F1F1F', borderRadius: '8px' }}
          labelStyle={{ color: '#A3A3A3', fontSize: 11 }}
          itemStyle={{ color: '#F97316', fontSize: 11 }}
        />
        <Bar dataKey="count" fill="#F97316" radius={[3, 3, 0, 0]} opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  )
}
