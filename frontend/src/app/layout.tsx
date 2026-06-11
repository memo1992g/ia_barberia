import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVO Voice Agent | Imperial Barber Studio",
  description: "Demo profesional de llamada IA para Imperial Barber Studio con Sofía IA.",
  applicationName: "EVO Voice Agent",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "EVO Voice Agent",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050507",
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
