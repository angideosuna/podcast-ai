"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { AudioPlayer } from "@/components/audio-player";
import { EpisodeFeedback } from "@/components/episode-feedback";
import { ArrowLeft, Loader2, Share2, Check, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import type { Episode } from "@/lib/types";

export default function EpisodeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const episodeId = params.id as string;

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado del audio (para regenerar si no existe)
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Estado de compartir
  const [isShared, setIsShared] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadEpisode() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("id", episodeId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        router.push("/historial");
        return;
      }

      setEpisode(data);
      if (data.audio_url) setAudioUrl(data.audio_url);
      setIsShared(!!data.is_shared);
      setLoading(false);
    }

    loadEpisode();
  }, [episodeId, router]);

  const generateAudio = useCallback(async () => {
    if (!episode) return;
    setAudioLoading(true);
    setAudioError(null);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: episode.script, episodeId: episode.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Error al generar el audio"
        );
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : "No se pudo generar el audio"
      );
    } finally {
      setAudioLoading(false);
    }
  }, [episode]);

  const handleShare = useCallback(async () => {
    if (!episode) return;
    setShareLoading(true);

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episode.id }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setIsShared(data.is_shared);

      if (data.is_shared) {
        const shareUrl = `${window.location.origin}/shared/${episode.id}`;

        if (navigator.share) {
          await navigator.share({
            title: episode.title,
            text: `Escucha este podcast generado con IA: ${episode.title}`,
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch {
      // silencioso
    } finally {
      setShareLoading(false);
    }
  }, [episode]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  if (!episode) return null;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-cream px-4 pb-24 pt-8 text-dark">
      <div className="mx-auto max-w-3xl">
        {/* Volver */}
        <Link
          href="/historial"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-all duration-300 hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al historial
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{episode.title}</h1>
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-forest/10 px-3.5 py-1.5 text-sm font-medium text-forest transition-all duration-300 hover:bg-forest/20 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copiado
                </>
              ) : isShared ? (
                <>
                  <LinkIcon className="h-3.5 w-3.5" />
                  Compartido
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  Compartir
                </>
              )}
            </button>
          </div>
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
            {episode.topics.map((topicId) => {
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

        {/* Boton de generar audio si no existe */}
        {!audioUrl && !audioLoading && !audioError && (
          <div className="glass-card p-4 mb-6 text-center">
            <p className="mb-3 text-sm text-muted">
              Este episodio no tiene audio generado
            </p>
            <button
              onClick={generateAudio}
              className="cursor-pointer rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-forest-light"
            >
              🔊 Generar audio
            </button>
          </div>
        )}

        {/* Guion */}
        <div className="glass-card p-6 sm:p-8">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(episode.script) }}
          />
        </div>

        {/* Fuentes */}
        {episode.articles && episode.articles.length > 0 && (
          <div className="glass-card p-6 mt-8">
            <h2 className="mb-4 text-lg font-semibold text-dark">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {episode.articles.map((article, i) => (
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
                      {new Date(article.publishedAt).toLocaleDateString(
                        "es-ES"
                      )}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="mx-auto max-w-3xl px-4">
        <EpisodeFeedback episodeId={episodeId} />
      </div>

      {/* Audio Player */}
      <AudioPlayer
        audioUrl={audioUrl}
        isLoading={audioLoading}
        error={audioError}
        onRetry={generateAudio}
        episodeId={episodeId}
      />
    </div>
  );
}
