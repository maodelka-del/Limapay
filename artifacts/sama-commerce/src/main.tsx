import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import "./index.css";

// Support a cross-domain API URL (needed when frontend and API are on different Render services)
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(String(apiUrl).replace(/\/+$/, ""));
}

setAuthTokenGetter(() => localStorage.getItem("sama_token"));

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:red">Erreur: élément #root introuvable dans index.html</div>';
} else {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
