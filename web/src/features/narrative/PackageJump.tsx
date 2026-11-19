import { useMemo, useState } from "react";
import { Link } from "react-router";

import { packageNames } from "@/data/client";

import styles from "./PackageJump.module.css";

/**
 * The ending is a door, not a summary. A reader who maintains or depends on one
 * of these libraries should be able to leave the argument and go straight to
 * their own package.
 */
export function PackageJump() {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return packageNames;
    return packageNames.filter((name) => name.includes(needle));
  }, [query]);

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="package-jump">
        Look up a library
      </label>
      <input
        id="package-jump"
        className={styles.input}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="transformers, langchain, vllm…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length > 0 ? (
        <ul className={styles.list}>
          {matches.map((name) => (
            <li key={name}>
              <Link className={styles.chip} to={`/package/${name}`}>
                {name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          No library here by that name. The study covers {packageNames.length}{" "}
          packages; a dependency of yours not on the list simply was not
          collected.
        </p>
      )}
    </div>
  );
}
