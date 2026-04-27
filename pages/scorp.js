import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

export default function SCorp() {
  const [settings, setSettings] = useState({ w2_salary: '70000', revenue_target: '120000', helper_day_rate: '280' })
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [payrollPaid, setPayrollPaid] = useState(0)
  const [distributions, setDistributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [distForm, setDistForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', note: '' })

  useEffect(function() { load() }, [])

  async function load() {
    var sRes = await supabase.from('settings').select('*')
    var tRes = await supabase.from('transactions').select('*')
    var txns = tRes.data || []
    var sett = Object.fromEntries((sRes.data || []).map(function(r) { return [r.key, r.value] }))
    setSettings(function(prev) { return Object.assign({}, prev, sett) })
    setIncome(txns.filter(function(t) { return t.type === 'income' || t.type === 'deposit' }).reduce(function(s, t) { return s + Number(t.amount) }, 0))
    setExpenses(txns.filter(function(t) { return t.type === 'expense' }).reduce(function(s, t) { return s + Number(t.amount) }, 0))
    setPayrollPaid(txns.filter(function(t) { return t.type === 'payroll' }).reduce(function(s, t) { return s + Number(t.amount) }, 0))
    setDistributions(txns.filter(function(t) { return t.type === 'distribution' }))
    setLoading(false)
  }

  async function saveSetting(key, value) {
    await supabase.from('settings').upsert({ key: key, value: String(value) }, { onConflict: 'key' })
    setSettings(function(p) { return Object.assign({}, p, { [key]: String(value) }) })
    showToast('Saved')
  }

  async function addDistribution() {
    if (!distForm.amount || Number(distForm.amount) <= 0) { alert('Enter an amount.'); return }
    await supabase.from('transactions').insert({
      date: distForm.date, vendor: 'Owner Distribution', category: 'Owner Distribution',
      amount: Number(distForm.amount), method: 'Transfer', note: distForm.note || null, type: 'distribution'
    })
    setDistForm({ date: new Date().toISOString().slice(0, 10), amount: '', note: '' })
    showToast('Distribution recorded')
    load()
  }

  async function deleteDist(id) {
    if (!confirm('Remove this distribution?')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  function showToast(m) { setToast(m); setTimeout(function() { setToast('') }, 2200) }

  var salary = Number(settings.w2_salary) || 0
  var employerFica = salary * 0.0765
  var totalDist = distributions.reduce(function(s, d) { return s + Number(d.amount) }, 0)
  var passThrough = income - expenses - payrollPaid - employerFica
  var cashInBiz = passThrough - totalDist

  function Row(props) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: props.bold ? 600 : 400 }}>{props.label}</span>
        <span className="mono" style={{ fontWeight: props.bold ? 700 : 500, color: props.green ? '#15803d' : props.highlight ? '#b45309' : undefined }}>{props.value}</span>
      </div>
    )
  }

  return (
    <Layout title="S-Corp / Owner">
      <div className="page-header"><h2>S-Corp &amp; Owner Compensation</h2></div>
      <div className="page-body">

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Key assumptions</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'w2_salary', label: 'Annual W-2 Salary ($)', type: 'number' },
                { key: 'revenue_target', label: 'Annual Revenue Target ($)', type: 'number' },
                { key: 'helper_day_rate', label: 'Helper Day Rate ($)', type: 'number' },
              ].map(function(item) {
                return (
                  <div key={item.key} className="field">
                    <label>{item.label}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type={item.type} value={settings[item.key]} onChange={function(e) { setSettings(function(p) { return Object.assign({}, p, { [item.key]: e.target.value }) }) }} />
                      <button className="btn btn-sm" onClick={function() { saveSetting(item.key, settings[item.key]) }}>Save</button>
                    </div>
                  </div>
                )
              })}
              <div className="alert alert-info" style={{ fontSize: 12 }}>
                Recommended W-2 salary for your income level: $48,000–$72,000 for an S-corp owner-operator in skilled trades.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Business P&amp;L snapshot</h3></div>
            <div className="card-body">
              <Row label="Total revenue collected" value={fmt(income)} />
              <Row label="Business expenses" value={fmt(expenses)} />
              <Row label="Payroll paid to yourself YTD" value={fmt(payrollPaid)} />
              <Row label="Employer FICA + Medicare (biz cost)" value={fmt(employerFica)} />
              <Row label="Net pass-through income" value={fmt(passThrough)} bold green={passThrough >= 0} highlight={passThrough < 0} />
              <Row label="Total distributions paid" value={fmt(totalDist)} />
              <Row label="Estimated cash left in business" value={fmt(cashInBiz)} bold green={cashInBiz >= 0} highlight={cashInBiz < 0} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Payroll tax breakdown (on W-2 salary of {fmt(salary)})</h3></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Employee side (withheld from your paycheck)</div>
              <Row label="Social Security — 6.2%" value={fmt(salary * 0.062)} />
              <Row label="Medicare — 1.45%" value={fmt(salary * 0.0145)} />
              <Row label="Subtotal employee FICA" value={fmt(salary * 0.0765)} bold />
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Employer side (business pays — deductible)</div>
              <Row label="Social Security match — 6.2%" value={fmt(salary * 0.062)} />
              <Row label="Medicare match — 1.45%" value={fmt(salary * 0.0145)} />
              <Row label="Subtotal employer FICA" value={fmt(salary * 0.0765)} bold />
            </div>
          </div>
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <span>Total FICA + Medicare (both sides)</span>
              <span className="mono" style={{ color: '#b91c1c' }}>{fmt(salary * 0.153)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Owner distributions</h3>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(totalDist)} paid YTD</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              Distributions logged here OR via the Expenses page (Owner Distribution category) both count automatically.
            </div>
            <div className="form-row">
              <div className="field">
                <label>Date</label>
                <input type="date" value={distForm.date} onChange={function(e) { setDistForm(function(p) { return Object.assign({}, p, { date: e.target.value }) }) }} />
              </div>
              <div className="field">
                <label>Amount ($)</label>
                <input type="number" step="0.01" min="0" value={distForm.amount} onChange={function(e) { setDistForm(function(p) { return Object.assign({}, p, { amount: e.target.value }) }) }} placeholder="0.00" />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Note</label>
                <input value={distForm.note} onChange={function(e) { setDistForm(function(p) { return Object.assign({}, p, { note: e.target.value }) }) }} placeholder="e.g. Q1 distribution" />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label>&nbsp;</label>
                <button className="btn btn-primary" onClick={addDistribution}>Record</button>
              </div>
            </div>

            {distributions.length > 0 && (
              <table>
                <thead><tr><th>Date</th><th>Note</th><th className="text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {distributions.map(function(d) {
                    return (
                      <tr key={d.id}>
                        <td>{d.date}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{d.note || '—'}</td>
                        <td className="text-right mono" style={{ fontWeight: 500 }}>{fmt(d.amount)}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={function() { deleteDist(d.id) }}>Remove</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
