import type { SocialPost } from '../../types/analytics'
import { classifyPost, number } from '../../utils/analytics'
import styles from '../../styles/dashboard.module.css'

export function PostBadge({ post }: { post: SocialPost }) {
  const rating = classifyPost(post)
  return (
    <span className={`${styles.badge} ${styles[rating.tone]}`}>
      <span aria-hidden="true">{rating.symbol}</span> {rating.label}
    </span>
  )
}

export function TopContent({ posts }: { posts: SocialPost[] }) {
  const top = [...posts]
    .sort((a, b) => b.whatsappClicks - a.whatsappClicks)
    .slice(0, 3)
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>Conteúdos que geraram interesse</h2>
          <p>Mais cliques no WhatsApp neste período.</p>
        </div>
        <a href="#conteudo" className={styles.textLink}>
          Ver todos <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={styles.topList}>
        {top.map((post, index) => (
          <article key={post.id} className={styles.topItem}>
            <span className={styles.postMark} aria-hidden="true">
              0{index + 1}
            </span>
            <div className={styles.topTitle}>
              <h3>{post.title}</h3>
              <span>
                {post.type} · {number(post.reach)} pessoas alcançadas
              </span>
            </div>
            <div className={styles.topValue}>
              <strong>{post.whatsappClicks}</strong>
              <span>cliques</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
