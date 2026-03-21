"use client";

import { useState } from "react";
import { Send, Bot, Instagram, Youtube, Megaphone, Users, Sparkles } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  tag: string;
  icon: typeof Bot;
  color: string;
  description: string;
};

const agents: Agent[] = [
  { id: "ig", name: "Instagram Intelligence", tag: "@InstagramIntelligence", icon: Instagram, color: "text-pink-400", description: "Acceso a transcripciones de Reels, métricas, curvas de retención y análisis de ganchos." },
  { id: "yt", name: "YouTube Intelligence", tag: "@YouTubeIntelligence", icon: Youtube, color: "text-red-400", description: "Acceso a transcripciones de videos, métricas, CTR de thumbnails y watch time." },
  { id: "ads", name: "Ads Intelligence", tag: "@AdsIntelligence", icon: Megaphone, color: "text-blue-400", description: "Acceso a data de campañas, métricas de ads, creativos y segmentación geográfica." },
  { id: "cv", name: "Customer Voice", tag: "@CustomerVoice", icon: Users, color: "text-cyan-400", description: "Acceso a respuestas de formularios, transcripciones de llamadas, dolores y objeciones." },
];

type Message = {
  role: "user" | "assistant";
  content: string;
  agent?: string;
};

const exampleMessages: Message[] = [
  { role: "user", content: "@InstagramIntelligence Dame ideas de tópicos para Reels basado en lo que mejor me funcionó en los últimos 30 días. Quiero maximizar alcance y retención." },
  {
    role: "assistant",
    agent: "InstagramIntelligence",
    content: `Basándome en el análisis de tus últimos 15 Reels, estos son los tópicos con mejor rendimiento:

**Top 3 temas por alcance + retención:**

1. **"Errores que cuestan dinero"** → 234K views, 62% retención, 78% hook rate
   - El formato de "errores/problemas" genera 2.4x más guardados que el promedio
   - Recomendación: "5 errores de pricing que te cuestan $5K/mes"

2. **"Sistemas y procesos"** → 189K views, 58% retención
   - Los Reels de 45-55 segundos tienen la mejor retención en este tema
   - Recomendación: "Mi sistema de 3 pasos para crear 30 Reels en 1 día"

3. **"Resultados con números específicos"** → 156K views, 55% retención
   - El uso de cifras en el hook aumenta el hook rate en 15%
   - Recomendación: "De $2K a $30K/mes en 90 días: el plan exacto"

**Patrón clave detectado:** Tus mejores hooks empiezan con una declaración contraintuitiva o un número específico en los primeros 2 segundos.`,
  },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages] = useState<Message[]>(exampleMessages);
  const [input, setInput] = useState("");

  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col gap-6">
      <div>
        <h1 className="page-title">AI Brain</h1>
        <p className="text-zinc-400 mt-1 text-sm">Agentes especializados con acceso a toda tu data. Etiquetá al agente que necesitás.</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Agents Sidebar */}
        <div className="w-72 shrink-0 glass-panel rounded-2xl p-4 flex flex-col">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 px-2">Agentes Disponibles</h3>
          <div className="space-y-2 flex-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  selectedAgent === agent.id
                    ? "bg-white/10 border border-white/20"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <agent.icon className={`h-4 w-4 ${agent.color}`} />
                  <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{agent.description}</p>
                <code className="text-[10px] text-zinc-600 mt-1 block">{agent.tag}</code>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-medium text-zinc-300">Tip</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Escribí <code className="text-zinc-400">@</code> seguido del nombre del agente para dirigir tu consulta al agente especializado.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${msg.role === "user" ? "order-2" : ""}`}>
                  {msg.agent && (
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-3.5 w-3.5 text-pink-400" />
                      <span className="text-[10px] font-medium text-pink-400">@{msg.agent}</span>
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-white/10 border border-white/10 text-zinc-200"
                        : "bg-white/5 border border-white/5 text-zinc-300"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="@InstagramIntelligence ¿Qué tipo de Reel debería publicar esta semana?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
              <button className="h-11 w-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                <Send className="h-4 w-4 text-zinc-300" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 px-1">
              Los agentes responden en base a data real de tu cuenta. Las respuestas son generadas por IA y pueden contener imprecisiones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
