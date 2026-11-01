import type { AnchorHTMLAttributes } from "react";
import { hrefFor, navigate } from "./navigation";
export default function Link({
  href,
  prefetch,
  replace,
  scroll,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: any;
  prefetch?: any;
  replace?: boolean;
  scroll?: boolean;
}) {
  const target = typeof href === "string" ? href : (href.pathname ?? "/");
  return (
    <a
      {...props}
      href={hrefFor(target)}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          target.startsWith("/") &&
          !props.target
        ) {
          e.preventDefault();
          navigate(target, replace);
        }
      }}
    />
  );
}
