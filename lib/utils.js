export const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

export const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`

export const normVendor = (v) => v.trim().toLowerCase()

export const CAT_LIST = [
  'Materials',
  'Tools & Equipment',
  'Truck & Gas',
  'Helper Pay',
  'Phone',
  'Insurance',
  'Licensing',
  'Shop Supplies',
  'Other',
]

export const CAT_BADGE = {
  'Materials':         'badge-blue',
  'Tools & Equipment': 'badge-orange',
  'Truck & Gas':       'badge-red',
  'Helper Pay':        'badge-green',
  'Phone':             'badge-teal',
  'Insurance':         'badge-yellow',
  'Licensing':         'badge-purple',
  'Shop Supplies':     'badge-pink',
  'Other':             'badge-gray',
}

export function catBadge(cat) {
  return <span className={`badge ${CAT_BADGE[cat] || 'badge-gray'}`}>{cat}</span>
}

export function Toast({ message, onDone }) {
  if (!message) return null
  setTimeout(onDone, 2200)
  return <div className="toast">{message}</div>
}

export function Spinner() {
  return <div style={{padding:'40px',textAlign:'center',color:'var(--text-muted)'}}>Loading…</div>
}

export function useToast() {
  const [msg, setMsg] = useState('')
  const show = (m) => setMsg(m)
  const clear = () => setMsg('')
  return { msg, show, clear }
}

import { useState } from 'react'
