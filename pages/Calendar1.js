import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const TYPE_STYLE = {
  income:       { bg: '#dcfce7', color: '#15803d', label: 'Payment in' },
  deposit:      { bg: '#dbeafe', color: '#1d4ed8', label: 'Deposit' },
  expense:      { bg: '#fee2e2', color: '#b91c1c', label: 'Expense' },
  payroll:      { bg: '#ede9fe', color: '#6d28d9', label: 'Payroll' },
  distribution: { bg: '#fce7f3', color: '#be185d', label: 'Distribution' },
  job:          { bg: '#fef9c3', color: '#a16207', label: 'Job day' },
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay()
}

function padded(n) {
  return String(n).padStart(2, '0')
}

function toDateStr(year, month, day) {
  return year + '-' + padded(month + 1) + '-' + padded(day)
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

  useEffect(function() { load() }, [])

  async function load() {
    var tRes = await supabase.from('transactions').select('*')
    var jRes = await supabase.from('jobs').select('*')
    setTxns(tRes.data || [])
    setJobs(jRes.data || [])
    setLoading(false)
  }

  function buildEventMap() {
    var map = {}

    function add(date, event) {
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(event)
    }

    for (var i = 0; i < txns.length; i++) {
      var t = txns[i]
      add(t.date, {
        type: t.type,
        label: t.vendor,
        amount: Number(t.amount),
        category: t.category,
        note: t.note,
      })
    }

    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j]
      if (!job.start_date) continue
      var start = new Date(job.start_date + 'T00:00:00')
      var end = job.end_date ? new Date(job.end_date + 'T00:00:00') : new Date(start)
      var cur = new Date(start)
      while (cur <= end) {
        var ds = cur.toISOString().slice(0, 10)
        add(ds, {
          type: 'job',
          label: job.customer,
          location: job.location,
          job_number: job.job_number,
          invoice: Number(job.invoice_amount || 0),
          helper_days: Number(job.helper_days || 0),
        })
        cur.setDate(cur.getDate() + 1)
      }
    }

    return map
  }

  var eventMap = buildEventMap()
  var daysInMonth = getDaysInMonth(year, month)
  var firstDay = getFirstDay(year, month)
  var todayStr = now.toISOString().slice(0, 10)
  var monthPrefix = year + '-' + padded(month + 1)

  var monthEvents = []
  var keys = Object.keys(eventMap)
  for (var k = 0; k < keys.length; k++) {
    if (keys[k].indexOf(monthPrefix) === 0) {
      monthEvents = monthEvents.concat(eventMap[keys[k]])
    }
  }

  var monthIncome = 0
  var monthExpenses = 0
  var monthJobDays = 0
  for (var m = 0; m < monthEvents.length; m++) {
    var ev = monthEvents[m]
    if (ev.type === 'income' || ev.type === 'deposit') monthIncome += ev.amount || 0
    if (ev.type === 'expense' || ev.type === 'payroll' || ev.type === 'distribution') monthExpenses += ev.amount || 0
    if (ev.type === 'job') monthJobDays++
  }

  var listEvents = []
  var sortedKeys = keys.filter(function(d) { return d.indexOf(monthPrefix) === 0 }).sort()
  for (var sk = 0; sk < sortedKeys.length; sk++) {
    var dayEvs = eventMap[sortedKeys[sk]]
    for (var de = 0; de < dayEvs.length; de++) {
      listEvents.push(Object.assign({}, dayEvs[de], { date: sortedKeys[sk] }))
    }
  }

  var selectedEvents = selected ? (eventMap[selected] || []) : []

  function prevMonth() {
    setSelected(null)
    if (month === 0) { setYear(function(y) { return y - 1 }); setMonth(11) }
    else setMonth(function(m) { return m - 1 })
  }

  function nextMonth() {
    setSelected(null)
    if (month === 11) { setYear(function(y) { return y + 1 }); setMonth(0) }
    else setMonth(function(m) { return m + 1 })
  }

  function isIn(type) {
    return type === 'income' || type === 'deposit'
  }

  if (loading) {
    return (
      <Layout title="Calendar">
        <div className="page-body">
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Calendar">
      <div className="page-header">
        <h2>Calendar</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'btn btn-sm' + (view === 'month' ? ' btn-primary' : '')} onClick={function() { setView('month') }}>Month</button>
          <button className={'btn btn-sm' + (view === 'list' ? ' btn-primary' : '')} onClick={function() { setView('list') }}>List</button>
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
              <button className="btn btn-sm" onClick={prevMonth}>Prev</button>
              <span style={{ fontWeight: 600, fontSize: 16, minWidth: 160, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
              <button className="btn btn-sm" onClick={nextMonth}>Next</button>
            </div>
            <button className="btn btn-sm" onClick={function() { setYear(now.getFullYear()); setMonth(now.getMonth()) }}>Today</button>
          </div>

          {view === 'month' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
                {DAYS.map(function(d) {
                  return <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d}</div>
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {Array.from({ length: firstDay }).map(function(_, i) {
                  return <div key={'e' + i} style={{ minHeight: 90, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: 'var(--gray)' }} />
                })}
                {Array.from({ length: daysInMonth }).map(function(_, i) {
                  var day = i + 1
                  var dateStr = toDateStr(year, month, day)
                  var events = eventMap[dateStr] || []
                  var isToday = dateStr === todayStr
                  var isSel = dateStr === selected
                  var hasIncome = events.some(function(e) { return e.type === 'income' || e.type === 'deposit' })
                  var hasExpense = events.some(function(e) { return e.type === 'expense' || e.type === 'payroll' || e.type === 'distribution' })
                  var hasJob = events.some(function(e) { return e.type === 'job' })

                  return (
                    <div key={day}
                      onClick={function() { setSelected(isSel ? null : dateStr) }}
                      style={{ minHeight: 90, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', padding: '6px', cursor: events.length ? 'pointer' : 'default', background: isSel ? '#dbeafe' : isToday ? '#fffbeb' : 'var(--card-bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#1d4ed8' : 'var(--text)', width: 22, height: 22, borderRadius: '50%', background: isToday ? '#dbeafe' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day}</span>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {hasJob && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a16207' }} />}
                          {hasIncome && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#15803d' }} />}
                          {hasExpense && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#b91c1c' }} />}
                        </div>
                      </div>
                      {events.slice(0, 3).map(function(e, idx) {
                        var s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
                        return (
                          <div key={idx} style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1 }}>
                            {e.type === 'job' ? 'Job: ' + e.label : e.label}
                          </div>
                        )
                      })}
                      {events.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{events.length - 3} more</div>}
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
                : listEvents.map(function(e, idx) {
                  var s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ width: 90, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{e.date}</div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{e.type === 'job' ? 'Job: ' + e.label : e.label}</div>
                        {e.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.note}</div>}
                        {e.type === 'job' && e.location && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.location}{e.helper_days > 0 ? ' · Helper: ' + e.helper_days + ' day' + (e.helper_days !== 1 ? 's' : '') : ''}</div>}
                      </div>
                      <div style={{ fontSize: 11, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>{s.label}</div>
                      {e.amount > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right', color: isIn(e.type) ? '#15803d' : '#b91c1c' }}>
                          {isIn(e.type) ? '+' : '-'}{fmt(e.amount)}
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
              <button className="btn btn-sm" onClick={function() { setSelected(null) }}>Close</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedEvents.map(function(e, idx) {
                var s = TYPE_STYLE[e.type] || TYPE_STYLE.expense
                return (
                  <div key={idx} style={{ display: 'flex', gap: 14, padding: '10px 14px', background: s.bg, borderRadius: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {e.type === 'job' ? 'Job #' + (e.job_number || '-') + ' - ' + e.label : e.label}
                      </div>
                      {e.category && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.category}</div>}
                      {e.note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.note}</div>}
                      {e.type === 'job' && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {e.location ? e.location + '  ' : ''}
                          {e.helper_days > 0 ? 'Helper: ' + e.helper_days + ' day' + (e.helper_days !== 1 ? 's' : '') : ''}
                          {e.invoice > 0 ? '  Invoice: ' + fmt(e.invoice) : ''}
                        </div>
                      )}
                    </div>
                    {e.amount > 0 && (
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>
                        {isIn(e.type) ? '+' : '-'}{fmt(e.amount)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
          {Object.keys(TYPE_STYLE).map(function(type) {
            var s = TYPE_STYLE[type]
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                {s.label}
              </div>
            )
          })}
        </div>

      </div>
    </Layout>
  )
}
