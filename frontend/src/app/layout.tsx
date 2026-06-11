import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVO Voice Agent | Imperial Barber Studio",
  description: "Demo profesional de llamada IA para Imperial Barber Studio con Sofía IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-evo-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
