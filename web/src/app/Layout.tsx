import { NavLink, Outlet, ScrollRestoration } from "react-router";

import styles from "./Layout.module.css";

const NAV = [
  { to: "/", label: "The argument", end: true },
  { to: "/explore", label: "Explore" },
  { to: "/methods", label: "Methods" },
];

export function Layout() {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>

      <header className={styles.header}>
        <NavLink to="/" className={styles.wordmark}>
          Patching the AI stack
        </NavLink>
        <nav className={styles.nav} aria-label="Sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={styles.link}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>
          Data from the GitHub Global Security Advisories API and the PyPI JSON
          API.
        </span>
        <span>
          Final data project · Dealing with Data · NYU
        </span>
      </footer>

      <ScrollRestoration />
    </div>
  );
}
