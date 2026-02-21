import { describe, it, expect } from "vitest";
import { cleanScriptForTTS, preprocessForTTS } from "@/lib/tts-utils";

describe("cleanScriptForTTS", () => {
  it("removes markdown headers but keeps text", () => {
    expect(cleanScriptForTTS("# Titulo del Podcast")).toBe("Titulo del Podcast");
    expect(cleanScriptForTTS("## Seccion")).toBe("Seccion");
    expect(cleanScriptForTTS("### Subseccion")).toBe("Subseccion");
  });

  it("removes bold markers", () => {
    expect(cleanScriptForTTS("Esto es **importante**")).toBe("Esto es importante");
  });

  it("removes italic markers", () => {
    expect(cleanScriptForTTS("Esto es *enfasis*")).toBe("Esto es enfasis");
  });

  it("removes markdown separators", () => {
    const input = "Texto antes\n---\nTexto despues";
    const result = cleanScriptForTTS(input);
    expect(result).not.toContain("---");
    expect(result).toContain("Texto antes");
    expect(result).toContain("Texto despues");
  });

  it("removes markdown links but keeps text", () => {
    expect(cleanScriptForTTS("[Google](https://google.com)")).toBe("Google");
  });

  it("removes time annotations", () => {
    expect(cleanScriptForTTS("[INTRO - 30 segundos]")).toBe("");
    expect(cleanScriptForTTS("[NOTICIA 1 - 60 segundos]")).toBe("");
  });

  it("removes estimated duration metadata", () => {
    const input = "Contenido\n*Duración estimada: 15 minutos*";
    expect(cleanScriptForTTS(input)).not.toContain("Duración estimada");
  });

  it("collapses multiple empty lines", () => {
    const input = "Linea 1\n\n\n\n\nLinea 2";
    expect(cleanScriptForTTS(input)).toBe("Linea 1\n\nLinea 2");
  });
});

describe("preprocessForTTS", () => {
  it("expands IA abbreviation on first occurrence", () => {
    const result = preprocessForTTS("La IA esta cambiando el mundo. La IA seguira avanzando.");
    expect(result).toContain("inteligencia artificial");
    // Only the first occurrence gets expanded
    expect(result.indexOf("inteligencia artificial")).toBeLessThan(
      result.lastIndexOf("IA")
    );
  });

  it("expands EEUU abbreviation", () => {
    const result = preprocessForTTS("EEUU lidera la innovacion.");
    expect(result).toContain("Estados Unidos");
  });

  it("converts $B amounts to readable text", () => {
    expect(preprocessForTTS("La empresa vale $2.5B")).toContain("2.5 mil millones");
  });

  it("converts M amounts to readable text", () => {
    expect(preprocessForTTS("Inversion de 500M")).toContain("500 millones");
  });

  it("adds pauses after headers", () => {
    const result = preprocessForTTS("# Titulo");
    expect(result).toContain("...");
  });

  it("removes URLs", () => {
    const result = preprocessForTTS("Visita https://example.com para mas info");
    expect(result).not.toContain("https://");
  });

  it("removes markdown special characters", () => {
    const result = preprocessForTTS("**negrita** y *cursiva* con `codigo`");
    expect(result).not.toContain("*");
    expect(result).not.toContain("`");
  });
});
