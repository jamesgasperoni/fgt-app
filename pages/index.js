import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    const [txRes, jobRes, settRes] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('jobs').select('*'),
      supabase.from('settings').select('*'),
    ])
    const txns = txRes.data || []
    const jobs = jobRes.data || []
    const sett = Object.fromEntries((settRes.data || []).map(r => [r.key, r.value]))
    setSettings(sett)

    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const invoiced = jobs.reduce((s, j) => s + Number(j.invoice_amount || 0), 0)
    const outstanding = invoiced - income
    const profit = income - expenses
    const margin = income > 0 ? profit / income : 0
    const target = Number(sett.revenue_target || 120000)
    const salary = Number(sett.w2_salary || 52000)
    const passThrough = income - expenses - salary
    const ficaEmp = salary * 0.062 + salary * 0.0145
    const ficaBiz = salary * 0.062 + salary * 0.0145
    const qbi = passThrough * 0.20
    const taxable = passThrough - qbi
    const fedTax = taxable * Number(sett.federal_tax_rate || 0.22)
    const stateTax = (salary + taxable) * Number(sett.state_tax_rate || 0.0425)
    const totalTax = ficaEmp + ficaBiz + fedTax + stateTax

    const expByCat = {}
    txns.filter(t => t.type === 'expense').forEach(t => {
      expByCat[t.category] = (expByCat[t.category] || 0) + Number(t.amount)
    })

    setData({ income, expenses, invoiced, outstanding, profit, margin, target, totalTax, expByCat, jobs, salary, passThrough })
  }

  if (!data) return <Layout title="Dashboard"><div className="page-body"><p style={{color:'var(--text-muted)'}}>Loading…</p></div></Layout>

  const pct = data.target > 0 ? Math.min(data.income / data.target, 1) : 0

  return (
    <Layout title="Dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>2026 Year to Date</span>
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
            <div className="label">Est. total tax burden</div>
            <div className="value">{fmt(data.totalTax)}</div>
            <div className="sub">FICA + income taxes</div>
          </div>
          <div className="card metric-card">
            <div className="label">Jobs logged</div>
            <div className="value">{data.jobs.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Revenue progress</h3></div>
          <div className="card-body">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}>
              <span>{fmt(data.income)} collected</span>
              <span style={{color:'var(--text-muted)'}}>{fmt(data.target)} goal</span>
            </div>
            <div style={{background:'var(--gray)',borderRadius:8,height:16,overflow:'hidden'}}>
              <div style={{width:`${(pct*100).toFixed(1)}%`,background:'var(--blue)',height:'100%',borderRadius:8,transition:'width 0.5s'}}></div>
            </div>
            <div style={{marginTop:6,fontSize:12,color:'var(--text-muted)'}}>{(pct*100).toFixed(1)}% of annual goal</div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div className="card">
            <div className="card-header"><h3>Expenses by category</h3></div>
            <div className="card-body">
              {Object.keys(data.expByCat).length === 0
                ? <p style={{color:'var(--text-muted)',fontSize:13}}>No expenses logged yet.</p>
                : Object.entries(data.expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                  <div key={cat} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                    <span>{cat}</span>
                    <span className="mono" style={{fontWeight:500}}>{fmt(amt)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Owner snapshot</h3></div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                ['W-2 Salary', fmt(data.salary)],
                ['Pass-through income', fmt(data.passThrough)],
                ['Net after taxes (est.)', fmt(data.passThrough - data.totalTax)],
              ].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{color:'var(--text-muted)'}}>{l}</span>
                  <span className="mono" style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
