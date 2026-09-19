import { GLASS } from "./surfaces.js";

export default function Card({ children, className = "", onClick }) {
  const isButton = typeof onClick === "function";
  const Tag = isButton ? "button" : "div";
  return (
    <Tag
      type={isButton ? "button" : undefined}
      onClick={onClick}
      className={`w-full p-4 rounded-3xl ${GLASS} text-left ${
        isButton ? "active:bg-white/[0.06] transition-colors" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
