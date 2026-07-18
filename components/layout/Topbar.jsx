import styles from './Topbar.module.css'
import { BellIcon, MenuIcon } from '@/components/Icons'

export default function Topbar({ title, onMenuToggle }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle}>
          <MenuIcon />
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <button className={styles.notifBtn}>
        <BellIcon />
      </button>
    </header>
  )
}
