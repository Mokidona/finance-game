import React from "react";
import ReactDOM from "react-dom/client";
import { LucideProvider } from "lucide-react";
import "./index.css";
import "./i18n/index.js"; // §35.2: инициализируем i18n до первого рендера
import App from "./App.jsx";

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
tg?.ready?.();
tg?.expand?.();
tg?.setHeaderColor?.("#000000");
tg?.setBackgroundColor?.("#000000");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* SF Symbols-стиль: единая ультратонкая монохромная обводка */}
    <LucideProvider strokeWidth={1.25}>
      <App />
    </LucideProvider>
  </React.StrictMode>
);
