import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

export default function Taxes() {
  const [settings, setSettings] = useState({ w2_salary:'52000', federal_tax_rate:'0.22', state_tax_rate:'0.0425' })
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [taxPaid, setTaxPaid] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [sRes, tRes] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('transactions').select('type,amount'),
    ])
    const sett = Object.fromEntries((sRes.data||[]).map(r=>[r.key,r.value]))
    setSettings(p => ({ ...p, ...sett }))
    const txns = tRes.data || []
    setIncome(txns.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0))
    setExpenses(txns.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0))
    setLoading(false)
  }

  async function saveSetting(key, value) {
    await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
    setSettings(p => ({ ...p, [key]: String(value) }))
  }

  const salary = Number(settings.w2_salary) || 0
  const fedRate = Number(settings.federal_tax_rate) || 0.22
  const stateRate = Number(settings.state_tax_rate) || 0.0425
  const employerFica = salary * 0.0765
  const passThrough = income - expenses - salary - employerFica

  // FICA
  const empSS = salary * 0.062
  const empMed = salary * 0.0145
  const empFicaTotal = empSS + empMed
  const bizSS = salary * 0.062
  const bizMed = salary * 0.0145
  const bizFicaTotal = bizSS + bizMed
  const allFica = empFicaTotal + bizFicaTotal

  // Income tax
  const qbi = Math.max(passThrough * 0.20, 0)
  const taxableQBI = Math.max(passThrough - qbi, 0)
  const fedOnSalary = salary * fedRate
  const fedOnQBI = taxableQBI * fedRate
  const stateTax = (salary + taxableQBI) * stateRate
  const totalIncomeTax = fedOnSalary + fedOnQBI + stateTax
  const grandTotal = allFica + totalIncomeTax

  const quarterlyEst = fedOnQBI / 4

  const QUARTERS = [
    { q: 'Q1 (Jan–Mar)', due: 'Apr 15, 2026' },
    { q: 'Q2 (Apr–Jun)', due: 'Jun 16, 2026' },
    { q: 'Q3 (Jul–Sep)', due: 'Sep 15, 2026' },
    { q: 'Q4 (Oct–Dec)', due: 'Jan 15, 2027' },
  ]

  const TaxRow = ({ label, value, sub, bold, red, muted }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{fontWeight:bold?600:400,color:muted?'var(--text-muted)':undefined}}>{label}</div>
        {sub && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{sub}</div>}
      </div>
      <span className="mono" style={{fontWeight:bold?700:500,color:red?'#b91c1c':undefined,whiteSpace:'nowrap',marginLeft:16}}>{value}</span>
    </div>
  )

  return (
    <Layout title="Tax Planner">
      <div className="page-header">
        <h2>Tax Planner 2026</h2>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>Estimate only — consult your CPA for filings</span>
      </div>
      <div className="page-body">

        <div className="alert alert-warn">
          These are <strong>estimates</strong> based on your inputs. Your actual tax liability depends on deductions, credits, and filing status. Always verify with your accountant.
        </div>

        {/* Assumptions */}
        <div className="card">
          <div className="card-header"><h3>Assumptions</h3></div>
          <div className="card-body">
            <div className="form-row">
              {[
                { key:'w2_salary', label:'W-2 Salary ($)', type:'number' },
                { key:'federal_tax_rate', label:'Federal rate (decimal)', type:'number', step:'0.01' },
                { key:'state_tax_rate', label:'Michigan rate (decimal)', type:'number', step:'0.001' },
              ].map(({key,label,type,step})=>(
                <div key={key} className="field">
                  <label>{label}</label>
                  <div style={{display:'flex',gap:6}}>
                    <input type={type} step={step||'1'} value={settings[key]} onChange={e=>setSettings(p=>({...p,[key]:e.target.value}))} />
                    <button className="btn btn-sm" onClick={()=>saveSetting(key,settings[key])}>Save</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,fontSize:13}}>
              <div style={{padding:'8px 12px',background:'var(--gray)',borderRadius:8}}><div style={{color:'var(--text-muted)',fontSize:11}}>Revenue collected</div><strong>{fmt(income)}</strong></div>
              <div style={{padding:'8px 12px',background:'var(--gray)',borderRadius:8}}><div style={{color:'var(--text-muted)',fontSize:11}}>Total expenses</div><strong>{fmt(expenses)}</strong></div>
              <div style={{padding:'8px 12px',background:'var(--gray)',borderRadius:8}}><div style={{color:'var(--text-muted)',fontSize:11}}>Pass-through income</div><strong style={{color: passThrough>=0?'#15803d':'#b91c1c'}}>{fmt(passThrough)}</strong></div>
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

          {/* FICA */}
          <div className="card">
            <div className="card-header" style={{background:'#fff1f2'}}>
              <h3 style={{color:'#9f1239'}}>FICA &amp; Medicare — paid to IRS</h3>
            </div>
            <div className="card-body">
              <div className="section-label" style={{marginBottom:6}}>Employee side (withheld from your W-2)</div>
              <TaxRow label="Social Security — 6.2%" value={fmt(empSS)} sub={`6.2% × ${fmt(salary)}`} />
              <TaxRow label="Medicare — 1.45%" value={fmt(empMed)} sub="no wage cap" />
              <TaxRow label="Employee subtotal" value={fmt(empFicaTotal)} bold />
              <div style={{height:12}}/>
              <div className="section-label" style={{marginBottom:6}}>Employer side (business pays — deductible)</div>
              <TaxRow label="Social Security match — 6.2%" value={fmt(bizSS)} />
              <TaxRow label="Medicare match — 1.45%" value={fmt(bizMed)} />
              <TaxRow label="Employer subtotal" value={fmt(bizFicaTotal)} bold />
              <div style={{marginTop:8,padding:'8px 0',borderTop:'2px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:15}}>
                  <span>Total FICA + Medicare</span>
                  <span className="mono" style={{color:'#9f1239'}}>{fmt(allFica)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Income Tax */}
          <div className="card">
            <div className="card-header" style={{background:'#eff6ff'}}>
              <h3 style={{color:'#1e40af'}}>Income taxes — IRS &amp; Michigan</h3>
            </div>
            <div className="card-body">
              <div className="section-label" style={{marginBottom:6}}>Federal income tax</div>
              <TaxRow label="On W-2 salary" value={fmt(fedOnSalary)} sub={`${fmtPct(fedRate)} × ${fmt(salary)}`} />
              <TaxRow label="QBI deduction (20%)" value={`(${fmt(qbi)})`} muted sub="Section 199A deduction" />
              <TaxRow label="On pass-through (after QBI)" value={fmt(fedOnQBI)} sub={`${fmtPct(fedRate)} × ${fmt(taxableQBI)}`} />
              <div style={{height:12}}/>
              <div className="section-label" style={{marginBottom:6}}>Michigan state — {fmtPct(stateRate)} flat rate</div>
              <TaxRow label="On salary + pass-through QBI" value={fmt(stateTax)} sub="via withholding + MI-1040ES" />
              <div style={{marginTop:8,padding:'8px 0',borderTop:'2px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:15}}>
                  <span>Total income tax</span>
                  <span className="mono" style={{color:'#1e40af'}}>{fmt(totalIncomeTax)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grand total */}
        <div className="card" style={{border:'2px solid var(--navy)'}}>
          <div className="card-body">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:18}}>Estimated total tax burden</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>FICA/Medicare + all income taxes</div>
              </div>
              <div style={{fontSize:32,fontWeight:700,color:grandTotal>0?'#b91c1c':'#15803d'}}>{fmt(grandTotal)}</div>
            </div>
          </div>
        </div>

        {/* Quarterly schedule */}
        <div className="card">
          <div className="card-header"><h3>Quarterly estimated payment schedule</h3></div>
          <div className="card-body">
            <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
              Quarterly payments cover <strong>pass-through income tax only</strong>. Your W-2 payroll handles FICA and salary withholding separately — do not double-pay.
            </div>
            <div style={{marginBottom:12}}>
              <strong>Estimated quarterly payment: {fmt(quarterlyEst)}</strong>
              <span style={{fontSize:12,color:'var(--text-muted)',marginLeft:8}}>Federal tax on QBI ÷ 4</span>
            </div>
            <table>
              <thead><tr><th>Quarter</th><th>Due date</th><th className="text-right">Est. payment</th><th>Form</th></tr></thead>
              <tbody>
                {QUARTERS.map(({q,due})=>(
                  <tr key={q}>
                    <td style={{fontWeight:500}}>{q}</td>
                    <td>{due}</td>
                    <td className="text-right mono" style={{fontWeight:500}}>{fmt(quarterlyEst)}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>IRS Form 1040-ES + MI-1040ES</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{marginTop:16,display:'flex',gap:12,alignItems:'center'}}>
              <div className="field" style={{maxWidth:200}}>
                <label>Estimated payments made YTD ($)</label>
                <input type="number" step="0.01" value={taxPaid} onChange={e=>setTaxPaid(e.target.value)} placeholder="0.00" />
              </div>
              {taxPaid !== '' && (
                <div style={{padding:'10px 16px',background: (fedOnQBI - Number(taxPaid)) > 0 ? 'var(--orange)' : 'var(--green)',borderRadius:8,marginTop:16}}>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Remaining pass-through tax to pay</div>
                  <div style={{fontWeight:700,fontSize:16}}>{fmt(fedOnQBI - Number(taxPaid))}</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
