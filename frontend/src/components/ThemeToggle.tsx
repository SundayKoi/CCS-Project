import { useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || localStorage.getItem("theme") || "dark"
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="bg-transparent border border-border rounded-md px-2.5 py-1 text-base cursor-pointer leading-none"
      title="Toggle theme"
    >
      {theme === "dark" ? "\uD83C\uDF19" : "\u2600\uFE0F"}
    </button>
  );
}
