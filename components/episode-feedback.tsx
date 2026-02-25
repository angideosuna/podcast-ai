"use client";

import { useState } from "react";

const POSITIVE_TAGS = [
  "Buen ritmo",
  "Temas interesantes",
  "Buena profundidad",
  "Me ha entretenido",
];

const NEGATIVE_TAGS = [
  "Muy largo",
  "Muy corto",
  "Temas poco interesantes",
  "Demasiado básico",
  "Demasiado técnico",
];

interface EpisodeFeedbackProps {
  episodeId: string;
}

export function EpisodeFeedback({ episodeId }: EpisodeFeedbackProps) {
  const [rating, setRating] = useState<1 | 5 | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSending(true);

    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: episodeId,
          rating,
          tags: selectedTags,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError("No se pudo enviar el feedback. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="glass-card mt-6 p-4 text-center">
        <p className="text-sm font-medium text-forest">
          Gracias por tu feedback
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card mt-6 space-y-4 p-5 animate-in fade-in duration-300">
      <p className="text-sm font-medium text-dark">
        ¿Qué te ha parecido?
      </p>

      {/* Rating buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => { setRating(5); setSelectedTags([]); }}
          className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-xl transition-all duration-300 ${
            rating === 5
              ? "bg-forest/15 ring-2 ring-forest scale-110"
              : "bg-cream-dark/50 hover:bg-forest/10"
          }`}
        >
          👍
        </button>
        <button
          onClick={() => { setRating(1); setSelectedTags([]); }}
          className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-xl transition-all duration-300 ${
            rating === 1
              ? "bg-red-500/15 ring-2 ring-red-400 scale-110"
              : "bg-cream-dark/50 hover:bg-red-500/10"
          }`}
        >
          👎
        </button>
      </div>

      {/* Tags */}
      {rating !== null && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(rating === 5 ? POSITIVE_TAGS : NEGATIVE_TAGS).map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                  selectedTags.includes(tag)
                    ? "bg-forest text-white"
                    : "bg-cream-dark/50 text-dark/80 hover:bg-forest/10"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Comment */}
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 200))}
            placeholder="¿Algo más? (opcional)"
            className="glass-input w-full text-sm"
          />

          {/* Error */}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="cursor-pointer rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
