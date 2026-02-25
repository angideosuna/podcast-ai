import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WaveCast — Tu podcast diario personalizado",
  description:
    "Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan. Noticias, tecnología, economía y más.",
  keywords: [
    "podcast",
    "IA",
    "inteligencia artificial",
    "noticias",
    "personalizado",
    "audio",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WaveCast",
  },
  openGraph: {
    title: "WaveCast — Tu podcast diario personalizado",
    description:
      "Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan.",
    type: "website",
    locale: "es_ES",
    siteName: "WaveCast",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveCast — Tu podcast diario personalizado",
    description:
      "Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${montserrat.variable} ${geistMono.variable} antialiased bg-cream`}
      >
        {children}
      </body>
    </html>
  );
}
