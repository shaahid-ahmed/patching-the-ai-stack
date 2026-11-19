import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import "@fontsource-variable/newsreader";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import "@/styles/reset.css";
import "@/styles/tokens.css";
import "@/styles/global.css";

import { router } from "@/routes";

const container = document.getElementById("root");
if (!container) throw new Error("no #root element");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
