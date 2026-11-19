/** Every URL in the application is visible here.
 *
 * Four routes, no nesting beyond the shell, no tabs. The narrative argues in a
 * fixed order; the explorer lets a reader wander; a package gets a real URL so
 * it can be sent to the person who maintains it; methods holds the caveats.
 */
import { createBrowserRouter } from "react-router";

import { Layout } from "@/app/Layout";
import { ErrorView } from "@/app/ErrorView";
import { loadAdvisories, loadFigure, loadMethods, loadPackage } from "@/data/client";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorView />,
    children: [
      {
        path: "/",
        lazy: async () => ({
          Component: (await import("@/features/narrative/Narrative")).Narrative,
        }),
        loader: async () => {
          const [q1, q2, q3, q4, q5] = await Promise.all([
            loadFigure("q1"),
            loadFigure("q2"),
            loadFigure("q3"),
            loadFigure("q4"),
            loadFigure("q5"),
          ]);
          return { q1, q2, q3, q4, q5 };
        },
      },
      {
        path: "/explore",
        lazy: async () => ({
          Component: (await import("@/features/explorer/Explorer")).Explorer,
        }),
        loader: () => loadAdvisories(),
      },
      {
        path: "/package/:name",
        lazy: async () => ({
          Component: (await import("@/features/package-detail/PackageDetail"))
            .PackageDetail,
        }),
        loader: ({ params }) => loadPackage(params.name as string),
      },
      {
        path: "/methods",
        lazy: async () => ({
          Component: (await import("@/features/methods/MethodsPage")).MethodsPage,
        }),
        loader: () => loadMethods(),
      },
    ],
  },
]);
