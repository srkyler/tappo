export const metadata = { title: "Tappo — CRM de Prospecção" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
