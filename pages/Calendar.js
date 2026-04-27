import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, CAT_BADGE } from '../lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

const TYPE_STYLE = {
  income:       { bg: '#dcfce7', color: '#15803d', label: 'Payment in' },
  deposit:      { bg: '#dbeafe', color: '#1d4ed8', label: 'Deposit' },
  expense:      { bg: '#fee2e2', color: '#b91c1c', label: 'Expense' },
  payroll:      { bg: '#ede9fe', color: '#6d28d9', label: 'Payroll' },
  distribution: { bg: '#fce7f3', color: '#be185d', label: 'Distribution' },
  job:          { bg: '#fef9c3', color: '#a16207', label: 'Job day' },
}

export default function Calendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [txns, setTxns] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('month')

  useEffect(() => { load() }, [])

  async function load() {
    const [tRes, jRes] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('jobs').select('*'),
    ])
    setTxns(tRes.data || [])
    setJobs(jRes.data || [])
    setLoading(false)
  }

  function buildEventMap() {
    const map = {}
    const add = (date, event) => {
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(event)
    }
    txns.forEach(t => {
      add(t.date, {
        type: t.type,
        label: t.vendor,
        amount: Number(t.amount),
        category: t.category,
        note: t.note,
        id: t.id,
      })
    })
    jobs.forEach(j => {
      if (!j.start_date) return
      const start = new Date(j.start_date + 'T00:00:00')
      const end = j.end_date ? new Date(j.end_date + 'T00:00:00') : start
      let cur = new Date(start)
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10)
        add(ds, {
          type: 'job',
          label: j.customer,
          location: j.location,
          job_number: j.job_number,
          invoice: Number(j.invoice_amount || 0),
          helper_days: Number(j.helper_days || 0),
          id: j.id,
        })
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }

  const eventMap = buildEventMap()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayStr = now.toISOString().slice(0, 10)

  const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`
  const monthEvents = Object.entries(eventMap)
    .filter(([d]) => d.startsWith(monthPrefix))
    .flatMap(([,evs]) => evs)
  const monthIncome = monthEvents.filter(e => e.type === 'income' || e.type === 'deposit').reduce((s,e) => s + (e.amount||0), 0)
  const monthExpenses = monthEvents.filter(e => ['expense','payroll','distribution'].includes(e.type)).reduce((s,e) => s + (e.amount||0), 0)
  const monthJobDays = monthEvents.filter(e => e.type === 'job').length

  const selectedEvents = selected ? (eventMap[selected] || []) : []

  const listEvents = Object.entries(eventMap)
    .filter(([d]) => d.startsWith(monthPrefix))
    .sort(([a],[b]) => a.localeCompare(b))
    .flatMap(([date, evs]) => evs.map(e => ({ ...e, date })))

  function DayDot({ type }) {
    const s = TYPE_STYLE[type] || TYPE_STYLE.expense
    return <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
  }

  function EventPill({ e }) {
    const s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
    return (
      <div style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1 }}>
        {e.type === 'job' ? `Job: ${e.label}` : e.type === 'income' ? `+ ${e.label}` : `- ${e.label}`}
      </div>
    )
  }

  return (
    <Layout title="Calendar">
      <div className="page-header">
        <h2>Calendar</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm${view === 'month' ? ' btn-primary' : ''}`} onClick={() => setView('month')}>Month</button>
          <button className={`btn btn-sm${view === 'list' ? ' btn-primary' : ''}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>
      <div className="page-body">

        <div className="metric-grid">
          <div className="card metric-card metric-green">
            <div className="label">Income this month</div>
            <div className="value">{fmt(monthIncome)}</div>
          </div>
          <div className="card metric-card metric-red">
            <div className="label">Expenses this month</div>
            <div className="value">{fmt(monthExpenses)}</div>
          </div>
          <div className="card metric-card metric-blue">
            <div className="label">Net this month</div>
            <div className="value" style={{ color: monthIncome - monthExpenses >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(monthIncome - monthExpenses)}</div>
          </div>
          <div className="card metric-card">
            <div className="label">Job days this month</div>
            <div className="value">{monthJobDays}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-sm" onClick={prevMonth}>‹ Prev</button>
              <span style={{ fontWeight: 600, fontSize: 16, minWidth: 160, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
              <button className="btn btn-sm" onClick={nextMonth}>Next ›</button>
            </div>
            <button className="btn btn-sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}>Today</button>
          </div>

          {view === 'month' && (
            <div style={{ padding: '0 0 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 90, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: 'var(--gray)' }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = toDateStr(year, month, day)
                  const events = eventMap[dateStr] || []
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selected
                  const hasIncome = events.some(e => e.type === 'income' || e.type === 'deposit')
                  const hasExpense = events.some(e => ['expense','payroll','distribution'].includes(e.type))
                  const hasJob = events.some(e => e.type === 'job')
                  return (
                    <div key={day} onClick={() => setSelected(isSelected ? null : dateStr)}
                      style={{ minHeight: 90, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', padding: '6px 6px 4px', cursor: events.length ? 'pointer' : 'default', background: isSelected ? '#dbeafe' : isToday ? '#fffbeb' : 'var(--card-bg)', transition: 'background 0.1s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#1d4ed8' : 'var(--text)', background: isToday ? '#dbeafe' : 'transparent', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day}</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {hasJob && <DayDot type="job" />}
                          {hasIncome && <DayDot type="income" />}
                          {hasExpense && <DayDot type="expense" />}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {events.slice(0, 3).map((e, idx) => <EventPill key={idx} e={e} />)}
                        {events.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 2 }}>+{events.length - 3} more</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'list' && (
            <div style={{ padding: '0 20px 20px' }}>
              {listEvents.length === 0
                ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activity this month.</div>
                : listEvents.map((e, idx) => {
                  const s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ width: 80, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{e.date}</div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{e.type === 'job' ? `Job: ${e.label}` : e.label}</div>
                        {e.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.note}</div>}
                        {e.type === 'job' && e.location && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.location}{e.helper_days > 0 ? ` · Helper: ${e.helper_days} day${e.helper_days !== 1 ? 's' : ''}` : ''}</div>}
                      </div>
                      <div style={{ fontSize: 11, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>{s.label}</div>
                      {e.amount > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right', color: (e.type === 'income' || e.type === 'deposit') ? '#15803d' : '#b91c1c' }}>
                          {(e.type === 'income' || e.type === 'deposit') ? '+' : '−'}{fmt(e.amount)}
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
          )}
        </div>

        {selected && selectedEvents.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>{new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedEvents.map((e, idx) => {
                const s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
                return (
                  <div key={idx} style={{ display: 'flex', gap: 14, padding: '10px 14px', background: s.bg, borderRadius: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                        {e.type === 'job' ? `Job #${e.job_number || '—'} — ${e.label}` : e.label}
                      </div>
                      {e.category && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.category}</div>}
                      {e.note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.note}</div>}
                      {e.type === 'job' && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {e.location && <span style={{ marginRight: 12 }}>📍 {e.location}</span>}
                          {e.helper_days > 0 && <span>👷 Helper: {e.helper_days} day{e.helper_days !== 1 ? 's' : ''}</span>}
                          {e.invoice > 0 && <span style={{ marginLeft: 12 }}>Invoice: {fmt(e.invoice)}</span>}
                        </div>
                      )}
                    </div>
                    {e.amount > 0 && (
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>
                        {(e.type === 'income' || e.type === 'deposit') ? '+' : '−'}{fmt(e.amount)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
          {Object.entries(TYPE_STYLE).map(([type, s]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}
