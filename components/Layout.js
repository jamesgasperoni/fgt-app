import { useRouter } from 'next/router'
import Head from 'next/head'

const NAV = [
  { id: '/',           label: 'Dashboard',      icon: '▦' },
  { id: '/jobs',       label: 'Jobs',            icon: '🔨' },
  { id: '/income',     label: 'Income',          icon: '↑' },
  { id: '/expenses',   label: 'Expenses',        icon: '↓' },
  { id: '/reconcile',  label: 'Reconcile',       icon: '⇌' },
  { id: '/calendar',   label: 'Calendar',        icon: '📅' },
  { id: '/scorp',      label: 'S-Corp / Owner',  icon: '$' },
  { id: '/taxes',      label: 'Tax Planner',     icon: '%' },
  { id: '/vendors',    label: 'Vendor Memory',   icon: '☰' },
]

export default function Layout({ children, title }) {
  const router = useRouter()
  return (
    <>
      <Head>
        <title>{title ? `${title} — FG Tile` : 'Fourth Generation Tile'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>Fourth Generation Tile</h1>
            <p>Business Manager 2026</p>
          </div>
          <nav>
            {NAV.map(n => (
              <button
                key={n.id}
                className={`nav-item${router.pathname === n.id ? ' active' : ''}`}
                onClick={() => router.push(n.id)}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 11, opacity: 0.5 }}>FG Tile © 2026</div>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  )
}
