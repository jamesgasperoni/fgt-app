import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { CAT_LIST, CAT_BADGE } from '../lib/utils'

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [editing, setEditing] = useState(null)
  const [editCat, setEditCat] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('vendors').select('*').order('name_display')
    setVendors(data || [])
  }

  async function deleteVendor(id) {
    if (!confirm('Remove this vendor from memory? Future transactions will ask for a category again.')) return
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(p => p.filter(v => v.id !== id))
    showToast('Vendor removed')
  }

  async function saveEdit(v) {
    if (!editCat) { alert('Select a category.'); return }
    await supabase.from('vendors').update({ category: editCat }).eq('id', v.id)
    setVendors(p => p.map(vv => vv.id === v.id ? { ...vv, category: editCat } : vv))
    setEditing(null)
    showToast('Updated')
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200) }

  const byCat = {}
  vendors.forEach(v => { if (!byCat[v.category]) byCat[v.category] = []; byCat[v.category].push(v) })

  return (
    <Layout title="Vendor Memory">
      <div className="page-header">
        <h2>Vendor Memory</h2>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>{vendors.length} vendors saved</span>
      </div>
      <div className="page-body">

        <div className="alert alert-info">
          These are vendors you've categorized before. Next time you enter one on the Expenses page, the category auto-fills. You can re-assign any vendor here if needed.
        </div>

        {vendors.length === 0 ? (
          <div className="card"><div className="card-body" style={{textAlign:'center',color:'var(--text-muted)',padding:'40px 0'}}>
            No vendors saved yet. Add your first expense to start building vendor memory.
          </div></div>
        ) : (
          <>
            {/* Group by category */}
            {Object.entries(byCat).sort().map(([cat, vlist]) => (
              <div key={cat} className="card">
                <div className="card-header">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className={`badge ${CAT_BADGE[cat]||'badge-gray'}`}>{cat}</span>
                    <span style={{fontSize:12,color:'var(--text-muted)'}}>{vlist.length} vendor{vlist.length!==1?'s':''}</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Vendor name</th><th>Category</th><th>First seen</th><th></th></tr></thead>
                    <tbody>
                      {vlist.map(v=>(
                        <tr key={v.id}>
                          <td style={{fontWeight:500}}>{v.name_display}</td>
                          <td>
                            {editing === v.id ? (
                              <div style={{display:'flex',gap:6}}>
                                <select value={editCat} onChange={e=>setEditCat(e.target.value)} style={{width:'auto'}}>
                                  <option value="">— select —</option>
                                  {CAT_LIST.map(c=><option key={c}>{c}</option>)}
                                </select>
                                <button className="btn btn-sm btn-primary" onClick={()=>saveEdit(v)}>Save</button>
                                <button className="btn btn-sm" onClick={()=>setEditing(null)}>Cancel</button>
                              </div>
                            ) : (
                              <span className={`badge ${CAT_BADGE[v.category]||'badge-gray'}`}>{v.category}</span>
                            )}
                          </td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(v.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              <button className="btn btn-sm" onClick={()=>{setEditing(v.id);setEditCat(v.category)}}>Re-assign</button>
                              <button className="btn btn-sm btn-danger" onClick={()=>deleteVendor(v.id)}>Forget</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
