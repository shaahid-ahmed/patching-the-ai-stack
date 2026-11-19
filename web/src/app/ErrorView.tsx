import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import styles from "./ErrorView.module.css";

export function ErrorView() {
  const error = useRouteError();

  const { heading, body } = (() => {
    if (isRouteErrorResponse(error)) {
      if (error.status === 404) {
        return {
          heading: "No such page",
          body: "That address does not match anything here. The sixteen packages in the study are listed in the explorer.",
        };
      }
      return {
        heading: `Something failed to load (${error.status})`,
        body: "A data file could not be fetched. Reloading usually fixes it.",
      };
    }
    return {
      heading: "Something went wrong",
      body: "An unexpected error stopped this page from rendering.",
    };
  })();

  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>{heading}</h1>
      <p className={styles.body}>{body}</p>
      <p>
        <Link to="/">Back to the beginning</Link>
      </p>
    </div>
  );
}
