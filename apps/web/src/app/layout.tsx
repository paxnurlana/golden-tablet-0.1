import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import {NumericInputPolicy} from '@/components/numeric-input-policy';

export const metadata: Metadata = {
  title: "The Golden Tablet",
  description: "Личный торговый журнал.",
  icons: {
    icon: [{url:'/brand/golden-fehu-v5.ico',sizes:'any',type:'image/x-icon'},{url:'/brand/golden-fehu-v5-32.png',sizes:'32x32',type:'image/png'}],
    shortcut:'/brand/golden-fehu-v5.ico',
    apple:{url:'/brand/golden-fehu-v5-180.png',sizes:'180x180',type:'image/png'},
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>

      <body className="min-h-screen font-sans antialiased">
        <NumericInputPolicy/>
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          <Suspense>
            <Shell>{children}</Shell>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
