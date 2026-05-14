import { createRoot } from "preact/compat/client";
import { App } from "./App";
import { I18nProvider } from "./i18n/context";
import { initWasm } from "./wasm/drummark_wasm";
import "./styles.css";

async function bootstrap() {
  await initWasm();
  createRoot(document.getElementById("root")!).render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

bootstrap().catch(console.error);
