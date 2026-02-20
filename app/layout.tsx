import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PodCast.ai — Tu podcast diario personalizado",
  description:
    "Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan. Noticias, tecnologia, economia y mas.",
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
    title: "PodCast.ai",
  },
  openGraph: {
    title: "PodCast.ai — Tu podcast diario personalizado",
    description:
      "Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan.",
    type: "website",
    locale: "es_ES",
    siteName: "PodCast.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "PodCast.ai — Tu podcast diario personalizado",
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
        className={`${inter.variable} ${playfair.variable} ${geistMono.variable} antialiased bg-cream`}
      >
        {children}
      </body>
    </html>
  );
}
