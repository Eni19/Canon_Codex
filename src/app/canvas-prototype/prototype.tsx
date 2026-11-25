"use client";

import { useEffect, useRef, useState } from "react";

type Surface = { reset: () => void; connect: () => void };

export default function CanvasPrototype() {
  const container = useRef<HTMLDivElement>(null);
  const surface = useRef<Surface | null>(null);
  const [status, setStatus] = useState("Carregando canvas…");

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    async function setup() {
      const { default: K } = await import("konva");
      if (cancelled || !container.current) return;
      const host = container.current;
      const stage = new K.Stage({ container: host, width: host.clientWidth, height: 540, draggable: true });
      const layer = new K.Layer();
      stage.add(layer);
      const cards = [
        { x: 80, y: 110, title: "Exploradora", detail: "Cartão sintético" },
        { x: 420, y: 240, title: "Observatório", detail: "Imagem e texto" },
      ].map((card) => {
        const group = new K.Group({ x: card.x, y: card.y, draggable: true });
        group.add(new K.Rect({ width: 210, height: 110, fill: "#fffaf0", stroke: "#785b42", strokeWidth: 2, cornerRadius: 12, shadowBlur: 8, shadowOpacity: 0.15 }));
        group.add(new K.Circle({ x: 30, y: 32, radius: 15, fill: "#86a985" }));
        group.add(new K.Text({ x: 55, y: 19, width: 145, text: card.title, fontSize: 17, fontStyle: "bold", fill: "#2c211b" }));
        group.add(new K.Text({ x: 20, y: 68, width: 170, text: card.detail, fontSize: 14, fill: "#594a3e" }));
        return group;
      });
      const arrow = new K.Arrow({ stroke: "#9c4a39", fill: "#9c4a39", strokeWidth: 3, pointerLength: 12, pointerWidth: 10, dash: [10, 5], tension: 0.25 });
      arrow.visible(false);
      layer.add(arrow);
      cards.forEach((card) => layer.add(card));
      const sample = document.createElement("canvas");
      sample.width = 30; sample.height = 30;
      const context = sample.getContext("2d");
      if (context) {
        context.fillStyle = "#334f6b"; context.fillRect(0, 0, 30, 30);
        context.fillStyle = "#f7d982"; context.beginPath(); context.arc(15, 15, 7, 0, Math.PI * 2); context.fill();
        cards[1].add(new K.Image({ x: 15, y: 17, width: 30, height: 30, image: sample }));
      }
      const updateArrow = () => {
        const a = cards[0].position(); const b = cards[1].position();
        arrow.points([a.x + 210, a.y + 55, (a.x + b.x + 210) / 2, (a.y + b.y) / 2 + 20, b.x, b.y + 55]);
      };
      cards.forEach((card) => card.on("dragmove", updateArrow));
      updateArrow();
      const reset = () => { stage.position({ x: 0, y: 0 }); stage.scale({ x: 1, y: 1 }); };
      let connecting = false;
      let origin = -1;
      cards.forEach((card, index) => card.on("click tap", () => {
        if (!connecting) return;
        if (origin === -1) { origin = index; setStatus("Selecione o outro cartão."); return; }
        if (origin === index) return;
        if (origin === 1) cards.reverse();
        updateArrow(); arrow.visible(true); connecting = false; origin = -1;
        setStatus("Conexão sintética criada. Arraste os cartões para atualizar a seta.");
      }));
      surface.current = { reset, connect: () => { connecting = true; origin = -1; setStatus("Selecione o cartão de origem e depois o destino."); } };
      const zoom = (point: { x: number; y: number }, scale: number) => {
        const old = stage.scaleX(); const next = Math.max(0.3, Math.min(3, scale));
        const local = { x: (point.x - stage.x()) / old, y: (point.y - stage.y()) / old };
        stage.scale({ x: next, y: next });
        stage.position({ x: point.x - local.x * next, y: point.y - local.y * next });
      };
      stage.on("wheel", (event) => {
        event.evt.preventDefault();
        const point = stage.getPointerPosition();
        if (point) zoom(point, stage.scaleX() * (event.evt.deltaY < 0 ? 1.1 : 1 / 1.1));
      });
      let lastDistance = 0;
      stage.on("touchmove", (event) => {
        const touches = event.evt.touches;
        if (touches.length !== 2) return;
        event.evt.preventDefault(); stage.stopDrag();
        const rect = host.getBoundingClientRect();
        const point = { x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left, y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top };
        const distance = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        if (lastDistance) zoom(point, stage.scaleX() * distance / lastDistance);
        lastDistance = distance;
      });
      stage.on("touchend", () => { lastDistance = 0; });
      const observer = new ResizeObserver(() => stage.width(host.clientWidth));
      observer.observe(host);
      setStatus("Protótipo pronto. Arraste cartões e o fundo; use a roda ou pinça para ampliar.");
      cleanup = () => { observer.disconnect(); stage.destroy(); surface.current = null; };
    }
    void setup().catch(() => setStatus("Não foi possível carregar o protótipo."));
    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
    <h1>Protótipo do canvas</h1>
    <p>Experimento isolado com dados sintéticos; não salva alterações.</p>
    <p role="status">{status}</p>
    <button type="button" onClick={() => surface.current?.reset()}>Redefinir câmera</button>
    {" "}<button type="button" onClick={() => surface.current?.connect()}>Conectar cartões</button>
    <div ref={container} aria-label="Protótipo visual com dois cartões conectados" style={{ marginTop: 16, background: "#eee7db", border: "1px solid #ad9d8a", touchAction: "none" }} />
    <p>A seta tracejada indica a direção escolhida para a conexão sintética.</p>
  </main>;
}
