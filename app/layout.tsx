import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950`}
      >
        {children}
      </body>
    </html>
  );
}
