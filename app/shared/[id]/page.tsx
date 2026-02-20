import { notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/service";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

async function getSharedEpisode(id: string) {
  const supabase = createServerComponentClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, script, topics, duration, tone, audio_url, articles, created_at")
    .eq("id", id)
    .eq("is_shared", true)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const episode = await getSharedEpisode(id);

  if (!episode) {
    return { title: "Episodio no encontrado — PodCast.ai" };
  }

  const topicNames = episode.topics
    .map((t: string) => {
      const topic = getTopicById(t);
      return topic ? topic.nombre : t;
    })
    .slice(0, 3)
    .join(", ");

  return {
    title: `${episode.title} — PodCast.ai`,
    description: `Podcast sobre ${topicNames} · ${episode.duration} min · Generado con IA`,
    openGraph: {
      title: episode.title,
      description: `Podcast sobre ${topicNames} · ${episode.duration} min`,
      type: "article",
      locale: "es_ES",
      siteName: "PodCast.ai",
    },
    twitter: {
      card: "summary",
      title: episode.title,
      description: `Podcast sobre ${topicNames} · ${episode.duration} min`,
    },
  };
}

export default async function SharedEpisodePage({ params }: Props) {
  const { id } = await params;
  const episode = await getSharedEpisode(id);

  if (!episode) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-cream px-4 pb-16 pt-8 text-dark">
      <div className="mx-auto max-w-3xl">
        {/* Branding */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-xl font-bold text-forest transition-colors hover:text-forest-light"
          >
            🎙️ PodCast.ai
          </Link>
          <p className="mt-1 text-xs text-muted">
            Podcast generado con inteligencia artificial
          </p>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{episode.title}</h1>
          <p className="mt-1 text-sm text-muted-light">
            {new Date(episode.created_at).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · {episode.duration} min · {episode.tone}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {episode.topics.map((topicId: string) => {
              const topic = getTopicById(topicId);
              return (
                <span
                  key={topicId}
                  className="rounded-full bg-forest/10 px-3 py-1 text-sm text-dark"
                >
                  {topic ? `${topic.emoji} ${topic.nombre}` : topicId}
                </span>
              );
            })}
          </div>
        </div>

        {/* Script */}
        <div className="glass-card p-6 sm:p-8">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(episode.script) }}
          />
        </div>

        {/* Articles */}
        {episode.articles && episode.articles.length > 0 && (
          <div className="glass-card mt-8 p-6">
            <h2 className="mb-4 text-lg font-semibold text-dark">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {episode.articles.map((article: { title: string; url: string; source: string; publishedAt: string }, i: number) => (
                <li
                  key={i}
                  className="border-b border-white/30 pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="font-medium text-dark underline transition-all duration-300 group-hover:text-forest">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-light">
                      {article.source} ·{" "}
                      {new Date(article.publishedAt).toLocaleDateString("es-ES")}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="mb-4 text-sm text-muted">
            ¿Quieres generar tus propios podcasts personalizados?
          </p>
          <Link
            href="/login"
            className="inline-block rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light"
          >
            Crear mi podcast con IA
          </Link>
        </div>
      </div>
    </div>
  );
}
