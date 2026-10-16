import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion/provider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tappo — Prospecção B2B com IA",
  description:
    "Leads, cadências, pipeline e analytics num só lugar — com um agente de IA que trabalha a sua base com você.",
  keywords: ["prospecção", "leads", "CRM", "vendas B2B", "cadências", "pipeline", "IA"],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-tema="escuro" className={`h-full ${geist.variable} ${geistMono.variable}`}>
      <head>
        {/* Aplica o tema salvo antes da hidratação (sem flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("tappo-tema");if(t==="claro"||t==="escuro"){document.documentElement.setAttribute("data-tema",t);}}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
