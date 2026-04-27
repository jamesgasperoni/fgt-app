import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct, calcTaxes } from '../lib/utils'

export default function Taxes() {
  const [settings, setSettings] = useState({ w2_salary: '70000', federal_tax_rate: '0.22', state_tax_rate: '0.0425' })
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [payrollPaid, setPayrollPaid] = useState(0)
  const [irsPaid, setIrsPaid] = useState(0)
  const [statePaid, setStatePaid] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(function() { load() }, [])

  async function load() {
    var sRes = await supabase.from('settings').select('*')
    var tRes = await supabase.from('transactions').select('*')
    var txns = tRes.data || []
    var sett = Object.fromEntries((sRes.data || []).map(function(r) { return [r.key, r.value] }))
    setSettings(function(prev) { return Object.assign({}, prev, sett) })
    setIncome(txns.filter(function(t) { return t.type === 'income' || t.type === 'deposit' }).reduce(function(s,t) { return s+Number(t.amount) }, 0))
    setExpenses(txns.filter(function(t) { return t.type === 'expense' }).reduce(function(s,t) { return s+Number(t.amount) }, 0))
    setPayrollPaid(txns.filter(function(t) { return t.type === 'payroll' }).reduce(function(s,t) { return s+Number(t.amount) }, 0))
    setIrsPaid(txns.filter(function(t) { return t.category === 'IRS Tax Payment' }).reduce(function(s,t) { return s+Number(t.amount) }, 0))
    setStatePaid(txns.filter(function(t) { return t.category === 'State Tax Payment' }).reduce(function(s,t) { return s+Number(t.amount) }, 0))
    setLoading(false)
  }

  async function saveSetting(key, value) {
    await supabase.from('settings').upsert({ key: key, value: String(value) }, { onConflict: 'key' })
    setSettings(function(p) { return Object.assign({}, p, { [key]: String(value) }) })
  }

  var fedRate      = Number(settings.federal_tax_rate) || 0.22
  var stateRate    = Number(settings.state_tax_rate) || 0.0425
  var employerFica = payrollPaid * 0.0765
  var passThrough  = income - expenses - payrollPaid - employerFica
  var tax          = calcTaxes(payrollPaid, passThrough, fedRate, stateRate)
  var totalTaxPaid = irsPaid + statePaid
  var taxRemaining = tax.grandTotal - totalTaxPaid

  var QUARTERS = [
    { q: 'Q1 (Jan–Mar)', due: 'Apr 15, 2026' },
    { q: 'Q2 (Apr–Jun)', due: 'Jun 16, 2026' },
    { q: 'Q3 (Jul–Sep)', due: 'Sep 15, 2026' },
    { q: 'Q4 (Oct–Dec)', due: 'Jan 15, 2027' },
  ]

  function TaxRow(props) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight: props.bold ? 600 : 400, color: props.muted ? 'var(--text-muted)' : undefined }}>{props.label}</div>
          {props.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{props.sub}</div>}
        </div>
        <span className="mono" style={{ fontWeight: props.bold ? 700 : 500, color: props.red ? '#b91c1c' : props.green ? '#15803d' : undefined, whiteSpace: 'nowrap', marginLeft: 16 }}>{props.value}</span>
      </div>
    )
  }

  return (
    <Layout title="Tax Planner">
      <div className="page-header">
        <h2>Tax Planner 2026</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on actual payroll paid — updates live</span>
      </div>
      <div className="page-body">

        <div className="alert alert-warn">
          Estimates based on your actual transactions. Always verify with your CPA before filing.
        </div>

        <div className="card">
          <div className="card-header"><h3>Assumptions</h3></div>
          <div className="card-body">
            <div className="form-row">
              {[
                { key: 'federal_tax_rate', label: 'Federal rate (decimal)', step: '0.01' },
                { key: 'state_tax_rate',   label: 'Michigan rate (decimal)', step: '0.001' },
              ].map(function(item) {
                return (
                  <div key={item.key} className="field">
                    <label>{item.label}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="number" step={item.step} value={settings[item.key]}
                        onChange={function(e) { setSettings(function(p) { return Object.assign({},p,{[item.key]:e.target.value}) }) }} />
                      <button className="btn btn-sm" onClick={function() { saveSetting(item.key, settings[item.key]) }}>Save</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, fontSize: 13 }}>
              {[
                { label: 'Revenue collected',  value: fmt(income) },
                { label: 'Business expenses',  value: fmt(expenses) },
                { label: 'Payroll paid YTD',   value: fmt(payrollPaid) },
                { label: 'Pass-through income', value: fmt(passThrough), color: passThrough >= 0 ? '#15803d' : '#b91c1c' },
              ].map(function(item) {
                return (
                  <div key={item.label} style={{ padding: '8px 12px', background: 'var(--gray)', borderRadius: 8 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.label}</div>
                    <strong style={{ color: item.color }}>{item.value}</strong>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header" style={{ background: '#fff1f2' }}>
              <h3 style={{ color: '#9f1239' }}>FICA &amp; Medicare — paid to IRS</h3>
            </div>
            <div className="card-body">
              <div className="section-label" style={{ marginBottom: 6 }}>Employee side (withheld from W-2 checks)</div>
              <TaxRow label="Social Security — 6.2%" value={fmt(tax.empSS)} sub={'6.2% x ' + fmt(payrollPaid) + ' paid'} />
              <TaxRow label="Medicare — 1.45%" value={fmt(tax.empMed)} />
              <TaxRow label="Employee subtotal" value={fmt(tax.empSS + tax.empMed)} bold />
              <div style={{ height: 12 }} />
              <div className="section-label" style={{ marginBottom: 6 }}>Employer side (business pays — deductible)</div>
              <TaxRow label="Social Security match — 6.2%" value={fmt(tax.bizSS)} />
              <TaxRow label="Medicare match — 1.45%" value={fmt(tax.bizMed)} />
              <TaxRow label="Employer subtotal" value={fmt(tax.bizSS + tax.bizMed)} bold />
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '2px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>Total FICA + Medicare</span>
                  <span className="mono" style={{ color: '#9f1239' }}>{fmt(tax.allFica)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ background: '#eff6ff' }}>
              <h3 style={{ color: '#1e40af' }}>Income taxes — IRS &amp; Michigan</h3>
            </div>
            <div className="card-body">
              <div className="section-label" style={{ marginBottom: 6 }}>Federal income tax</div>
              <TaxRow label="On payroll paid YTD" value={fmt(tax.fedOnPayroll)} sub={fmtPct(fedRate) + ' x ' + fmt(payrollPaid)} />
              <TaxRow label="QBI deduction (20%)" value={'(' + fmt(tax.qbi) + ')'} muted sub="Section 199A deduction" />
              <TaxRow label="On pass-through (after QBI)" value={fmt(tax.fedOnQBI)} sub={fmtPct(fedRate) + ' x ' + fmt(tax.taxableQBI)} />
              <div style={{ height: 12 }} />
              <div className="section-label" style={{ marginBottom: 6 }}>Michigan — {fmtPct(stateRate)} flat rate</div>
              <TaxRow label="On payroll + pass-through QBI" value={fmt(tax.stateTax)} />
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '2px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>Total income tax</span>
                  <span className="mono" style={{ color: '#1e40af' }}>{fmt(tax.totalIncomeTax)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid var(--navy)' }}>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Estimated total tax burden</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Based on {fmt(payrollPaid)} payroll paid YTD</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#b91c1c' }}>{fmt(tax.grandTotal)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Tax payments made</h3></div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 14, fontSize: 12 }}>
              Log IRS and state payments on the <strong>Expenses page</strong> using the <strong>IRS Tax Payment</strong> or <strong>State Tax Payment</strong> categories and they will appear here automatically.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 16px', background: '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>IRS payments YTD</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>{fmt(irsPaid)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>State payments YTD</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>{fmt(statePaid)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: taxRemaining > 0 ? '#fee2e2' : '#dcfce7', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Remaining balance</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: taxRemaining > 0 ? '#b91c1c' : '#15803d' }}>{fmt(taxRemaining)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Quarterly estimated payment schedule</h3></div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 12 }}>
              Quarterly payments cover pass-through income tax only. FICA on your W-2 is deposited separately through payroll.
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Estimated quarterly payment: {fmt(tax.quarterlyEst)}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Federal tax on QBI / 4</span>
            </div>
            <table>
              <thead>
                <tr><th>Quarter</th><th>Due date</th><th className="text-right">Est. payment</th><th>Form</th></tr>
              </thead>
              <tbody>
                {QUARTERS.map(function(item) {
                  return (
                    <tr key={item.q}>
                      <td style={{ fontWeight: 500 }}>{item.q}</td>
                      <td>{item.due}</td>
                      <td className="text-right mono" style={{ fontWeight: 500 }}>{fmt(tax.quarterlyEst)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>IRS 1040-ES + MI-1040ES</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  )
}
