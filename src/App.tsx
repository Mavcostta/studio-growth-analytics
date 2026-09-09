import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { useGA4 } from './hooks/useGA4'
import { useInstagram } from './hooks/useInstagram'
import styles from './styles/dashboard.module.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ContentAnalytics = lazy(() => import('./pages/ContentAnalytics'))

export default function App() {
  const [page, setPage] = useState(() =>
    window.location.hash === '#conteudo' ? 'content' : 'overview',
  )
  const main = useRef<HTMLElement>(null)
  const analytics = useGA4()
  const instagram = useInstagram()
  useEffect(() => {
    const navigate = () => {
      setPage(window.location.hash === '#conteudo' ? 'content' : 'overview')
      window.scrollTo({ top: 0 })
      main.current?.focus({ preventScroll: true })
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    document.title = `${page === 'overview' ? 'Visão Geral' : 'Conteúdo & Conversão'} | Studio Anna Costa`
  }, [page])
  return (
    <div className={styles.app}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
          main.current?.scrollIntoView()
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className={styles.sidebar}>
        <a
          href="#visao-geral"
          className={styles.brand}
          aria-label="Studio Anna Costa — início"
        >
          <span className={styles.monogram}>
            ac<span>.</span>
          </span>
          <span className={styles.brandName}>
            ANNA COSTA<small>STUDIO DE BELEZA</small>
          </span>
        </a>
        <div className={styles.workspace}>
          <span className={styles.workspaceIcon}>A</span>
          <div>
            Studio Anna Costa<small>Seu espaço de crescimento</small>
          </div>
        </div>
        <span className={styles.navLabel}>ACOMPANHE SEU STUDIO</span>
        <nav aria-label="Menu principal">
          <a
            href="#visao-geral"
            aria-current={page === 'overview' ? 'page' : undefined}
          >
            <Icon name="grid" />
            <span>Visão Geral</span>
          </a>
          <a
            href="#conteudo"
            aria-current={page === 'content' ? 'page' : undefined}
          >
            <Icon name="content" />
            <span>Conteúdo & Conversão</span>
          </a>
        </nav>
        <div className={styles.sidebarNote}>
          <Icon name="spark" size={24} />
          <h2>
            Crescer começa
            <br />
            com um novo olhar.
          </h2>
          <p>
            Entenda seus resultados.
            <br />
            Cuide dos próximos passos.
          </p>
          <span>STUDIO GROWTH ANALYTICS</span>
        </div>
        <div className={styles.profile}>
          <span>AC</span>
          <div>
            Anna Costa<small>Seu negócio, em perspectiva</small>
          </div>
        </div>
      </aside>
      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <div>
            Seu Studio <span>/</span>{' '}
            <strong>
              {page === 'overview' ? 'Visão Geral' : 'Conteúdo & Conversão'}
            </strong>
          </div>
          <span className={styles.demoBadge}>
            Instagram:{' '}
            {instagram.state.status === 'ready'
              ? 'dados reais'
              : instagram.state.status === 'loading'
                ? 'carregando'
                : 'indisponível'}{' '}
            · GA4:{' '}
            {analytics.state.status === 'ready'
              ? analytics.state.data.status === 'empty'
                ? 'sem dados'
                : analytics.state.data.status === 'partial'
                  ? 'dados parciais'
                  : 'dados reais'
              : analytics.state.status === 'loading'
                ? 'carregando'
                : 'indisponível'}
          </span>
        </header>
        <main id="main" ref={main} tabIndex={-1} className={styles.main}>
          <Suspense fallback={<p role="status">Carregando seu Studio…</p>}>
            {page === 'overview' ? (
              <Dashboard
                analytics={analytics.state}
                retryAnalytics={analytics.retry}
                instagram={instagram.state}
                retry={instagram.retry}
              />
            ) : (
              <ContentAnalytics
                instagram={instagram.state}
                retry={instagram.retry}
              />
            )}
          </Suspense>
        </main>
        <footer className={styles.footer}>
          <span>Feito para transformar números em próximos passos.</span>
          <span>Studio Growth Analytics · MVP visual</span>
        </footer>
      </div>
    </div>
  )
}
