import React from "react";
import ReactDOM from "react-dom/client";
import { DocsPage } from "./DocsPage_zh";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DocsPage />
  </React.StrictMode>,
);
