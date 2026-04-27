import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(function() { load() }, [])

  async function load() {
    var sRes = await supabase.from('settings').select('*')
    var tRes = await supabase.from('transactions').select('*')
    var jRes = await supabase.from('jobs').select('*')

    var txns = tRes.data || []
    var jobs = jRes.data || []
    var sett = Object.fromEntries((sRes.data || []).map(function(r) { return [r.key, r.value] }))
    setSettings(sett)

    var income = txns.filter(function(t) { return t.type === 'income' || t.type === 'deposit' }).reduce(function(s, t) { return s + Number(t.amount) }, 0)
    var expenses = txns.filter(function(t) { return t.type === 'expense' }).reduce(function(s, t) { return s + Number(t.amount) }, 0)
    var payrollPaid = txns.filter(function(t) { return t.type === 'payroll' }).reduce(function(s, t) { return s + Number(t.amount) }, 0)
    var distributions = txns.filter(function(t) { return t.type === 'distribution' }).reduce(function(s, t) { return s + Number(t.amount) }, 0)
    var invoiced = jobs.reduce(function(s, j) { return s + Number(j.invoice_amount || 0) }, 0)
    var outstanding = invoiced - income
    var profit = income - expenses - payrollPaid
    var margin = income > 0 ? profit / income : 0
    var target = Number(sett.revenue_target || 120000)
    var salary = Number(sett.w2_salary || 70000)
    var fedRate = Number(sett.federal_tax_rate || 0.22)
    var stateRate = Number(sett.state_tax_rate || 0.0425)

    var employerFica = salary * 0.0765
    var passThrough = income - expenses - payrollPaid - employerFica

    var empFica = salary * 0.0765
    var bizFica = salary * 0.0765
    var allFica = empFica + bizFica

    var qbi = Math.max(passThrough * 0.20, 0)
    var taxableQBI = Math.max(passThrough - qbi, 0)
    var fedOnPayroll = payrollPaid * fedRate
    var fedOnQBI = taxableQBI * fedRate
    var stateTax = (payrollPaid + taxableQBI) * stateRate
    var totalIncomeTax = fedOnPayroll + fedOnQBI + stateTax
    var totalTax = allFica + totalIncomeTax

    var expByCat = {}
    txns.filter(function(t) { return t.type === 'expense' }).forEach(function(t) {
      expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount)
    })

    setData({
      income, expenses, payrollPaid, distributions,
      invoiced, outstanding, profit, margin,
      target, totalTax, expByCat, jobs,
      salary, passThrough, allFica, totalIncomeTax
    })
  }

  if (!data) {
    return (
      <Layout title="Dashboard">
        <div className="page-body">
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </Layout>
    )
  }

  var pct = data.target > 0 ? Math.min(data.income / data.target, 1) : 0

  return (
    <Layout title="Dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>2026 Year to Date</span>
      </div>
      <div className="page-body">

        <div className="metric-grid">
          <div className="card metric-card metric-blue">
            <div className="label">Revenue collected</div>
            <div className="value">{fmt(data.income)}</div>
            <div className="sub">of {fmt(data.target)} target</div>
          </div>
          <div className="card metric-card metric-green">
            <div className="label">Gross profit</div>
            <div className="value">{fmt(data.profit)}</div>
            <div className="sub">{fmtPct(data.margin)} margin</div>
          </div>
          <div className="card metric-card metric-orange">
            <div className="label">Total expenses</div>
            <div className="value">{fmt(data.expenses)}</div>
          </div>
          <div className="card metric-card metric-red">
            <div className="label">Outstanding invoices</div>
            <div className="value">{fmt(data.outstanding)}</div>
            <div className="sub">not yet collected</div>
          </div>
          <div className="card metric-card">
            <div className="label">FICA + Medicare</div>
            <div className="value">{fmt(data.allFica)}</div>
            <div className="sub">both sides on W-2 salary</div>
          </div>
          <div className="card metric-card">
            <div className="label">Income tax (est.)</div>
            <div className="value">{fmt(data.totalIncomeTax)}</div>
            <div className="sub">federal + Michigan</div>
          </div>
          <div className="card metric-card metric-red">
            <div className="label">Total tax burden (est.)</div>
            <div className="value">{fmt(data.totalTax)}</div>
            <div className="sub">FICA + all income taxes</div>
          </div>
          <div className="card metric-card">
            <div className="label">Jobs logged</div>
            <div className="value">{data.jobs.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Revenue progress</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>{fmt(data.income)} collected</span>
              <span style={{ color: 'var(--text-muted)' }}>{fmt(data.target)} goal</span>
            </div>
            <div style={{ background: 'var(--gray)', borderRadius: 8, height: 16, overflow: 'hidden' }}>
              <div style={{ width: (pct * 100).toFixed(1) + '%', background: 'var(--blue)', height: '100%', borderRadius: 8, transition: 'width 0.5s' }}></div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{(pct * 100).toFixed(1)}% of annual goal</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Expenses by category</h3></div>
            <div className="card-body">
              {Object.keys(data.expByCat).length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No expenses logged yet.</p>
                : Object.entries(data.expByCat).sort(function(a, b) { return b[1] - a[1] }).map(function(entry) {
                  return (
                    <div key={entry[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{entry[0]}</span>
                      <span className="mono" style={{ fontWeight: 500 }}>{fmt(entry[1])}</span>
                    </div>
                  )
                })
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Owner snapshot</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'W-2 payroll paid YTD', value: fmt(data.payrollPaid) },
                { label: 'Distributions paid YTD', value: fmt(data.distributions) },
                { label: 'Pass-through income', value: fmt(data.passThrough) },
                { label: 'Est. total tax burden', value: fmt(data.totalTax) },
                { label: 'Net after taxes (est.)', value: fmt(data.passThrough - data.totalTax) },
              ].map(function(row) {
                return (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className="mono" style={{ fontWeight: 500 }}>{row.value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
