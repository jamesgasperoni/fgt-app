import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct, calcTaxes } from '../lib/utils'

export default function Dashboard() {
  const [d, setD] = useState(null)

  useEffect(function() { load() }, [])

  async function load() {
    var sRes = await supabase.from('settings').select('*')
    var tRes = await supabase.from('transactions').select('*')
    var jRes = await supabase.from('jobs').select('*')
    var txns = tRes.data || []
    var jobs = jRes.data || []
    var sett = Object.fromEntries((sRes.data || []).map(function(r) { return [r.key, r.value] }))

    var income        = txns.filter(function(t) { return t.type === 'income' || t.type === 'deposit' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var expenses      = txns.filter(function(t) { return t.type === 'expense' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var payrollPaid   = txns.filter(function(t) { return t.type === 'payroll' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var distributions = txns.filter(function(t) { return t.type === 'distribution' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var irsPaid       = txns.filter(function(t) { return t.category === 'IRS Tax Payment' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var statePaid     = txns.filter(function(t) { return t.category === 'State Tax Payment' }).reduce(function(s,t) { return s+Number(t.amount) }, 0)
    var totalTaxPaid  = irsPaid + statePaid

    var outstanding = jobs
      .filter(function(j) { return j.status !== 'paid' })
      .reduce(function(s,j) { return s + Number(j.invoice_amount || 0) }, 0)

    var target       = Number(sett.revenue_target || 120000)
    var fedRate      = Number(sett.federal_tax_rate || 0.22)
    var stateRate    = Number(sett.state_tax_rate || 0.0425)
    var employerFica = payrollPaid * 0.0765
    var passThrough  = income - expenses - payrollPaid - employerFica
    var tax          = calcTaxes(payrollPaid, passThrough, fedRate, stateRate)
    var profit       = income - expenses - payrollPaid
    var margin       = income > 0 ? profit / income : 0

    var expByCat = {}
    txns.filter(function(t) { return t.type === 'expense' }).forEach(function(t) {
      expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount)
    })

    setD({
      income, expenses, payrollPaid, distributions,
      irsPaid, statePaid, totalTaxPaid,
      outstanding, profit, margin,
      target, tax, passThrough, expByCat, jobs
    })
  }

  if (!d) {
    return (
      <Layout title="Dashboard">
        <div className="page-body">
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </Layout>
    )
  }

  var pct = d.target > 0 ? Math.min(d.income / d.target, 1) : 0
  var taxRemaining = d.tax.grandTotal - d.totalTaxPaid

  return (
    <Layout title="Dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>2026 Year to Date — live data</span>
      </div>
      <div className="page-body">

        <div className="metric-grid">
          <div className="card metric-card metric-blue">
            <div className="label">Revenue collected</div>
            <div className="value">{fmt(d.income)}</div>
            <div className="sub">of {fmt(d.target)} target</div>
          </div>
          <div className="card metric-card metric-green">
            <div className="label">Gross profit</div>
            <div className="value">{fmt(d.profit)}</div>
            <div className="sub">{fmtPct(d.margin)} margin</div>
          </div>
          <div className="card metric-card metric-orange">
            <div className="label">Business expenses</div>
            <div className="value">{fmt(d.expenses)}</div>
          </div>
          <div className="card metric-card" style={{ borderTop: d.outstanding > 0 ? '3px solid #b91c1c' : '3px solid #15803d' }}>
            <div className="label">Outstanding invoices</div>
            <div className="value" style={{ color: d.outstanding > 0 ? '#b91c1c' : '#15803d' }}>
              {fmt(d.outstanding)}
            </div>
            <div className="sub">{d.outstanding > 0 ? 'unpaid jobs' : 'all jobs paid'}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Revenue progress</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>{fmt(d.income)} collected</span>
              <span style={{ color: 'var(--text-muted)' }}>{fmt(d.target)} goal</span>
            </div>
            <div style={{ background: 'var(--gray)', borderRadius: 8, height: 16, overflow: 'hidden' }}>
              <div style={{ width: (pct * 100).toFixed(1) + '%', background: 'var(--blue)', height: '100%', borderRadius: 8, transition: 'width 0.5s' }}></div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{(pct * 100).toFixed(1)}% of annual goal</div>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #fee2e2' }}>
          <div className="card-header" style={{ background: '#fff1f2' }}>
            <h3 style={{ color: '#9f1239' }}>Live tax burden</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on {fmt(d.payrollPaid)} payroll paid YTD</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: '10px 14px', background: '#fff1f2', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>W-2 payroll paid YTD</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(d.payrollPaid)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#fff1f2', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>FICA + Medicare (both sides)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#9f1239' }}>{fmt(d.tax.allFica)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Income tax (fed + MI est.)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{fmt(d.tax.totalIncomeTax)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Total tax burden (est.)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#b91c1c' }}>{fmt(d.tax.grandTotal)}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>IRS payments made YTD</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{fmt(d.irsPaid)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>State tax payments YTD</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{fmt(d.statePaid)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: taxRemaining > 0 ? '#fee2e2' : '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Remaining tax balance</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: taxRemaining > 0 ? '#b91c1c' : '#15803d' }}>{fmt(taxRemaining)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Expenses by category</h3></div>
            <div className="card-body">
              {Object.keys(d.expByCat).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No expenses logged yet.</p>
              ) : (
                Object.entries(d.expByCat).sort(function(a,b) { return b[1]-a[1] }).map(function(entry) {
                  return (
                    <div key={entry[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{entry[0]}</span>
                      <span className="mono" style={{ fontWeight: 500 }}>{fmt(entry[1])}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Owner snapshot</h3></div>
            <div className="card-body">
              {[
                { label: 'W-2 payroll paid YTD',   value: fmt(d.payrollPaid) },
                { label: 'Distributions paid YTD', value: fmt(d.distributions) },
                { label: 'Pass-through income',     value: fmt(d.passThrough) },
                { label: 'Est. total tax burden',   value: fmt(d.tax.grandTotal) },
                { label: 'IRS + state taxes paid',  value: fmt(d.totalTaxPaid) },
                { label: 'Remaining tax balance',   value: fmt(taxRemaining) },
                { label: 'Net after taxes (est.)',  value: fmt(d.passThrough - d.tax.grandTotal) },
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
