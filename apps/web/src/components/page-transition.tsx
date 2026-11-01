"use client";

import { type ReactNode } from "react";
import { NavigationTrail } from "./navigation-trail";
import {CommitActiveField} from "./commit-active-field";

/** Reveal committed pages without delaying navigation or freezing the old screen. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <main className="journal-main min-w-0 flex-1" data-page-transition>
      <CommitActiveField />
      <div className="journal-context-bar sticky top-14 lg:top-0 z-40 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur">
        <NavigationTrail />
      </div>
      {children}
    </main>
  );
}
