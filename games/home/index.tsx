"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { maximumPrize, type GameSnapshot } from "@rarefriends/friendsdk/game";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { createFriendReader, spriteFrame, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundCue, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Overlay = "odds" | "pocket" | "settings" | "reveal" | null;
type Car = { lane: number; x: number; w: number; speed: number; dir: number; color: string };
type Sim = {
  lane: number;
  from: number;
  to: number;
  tween: number;
  tweening: boolean;
  arrived: boolean;
  cars: Car[];
  seeded: boolean;
  frame: number;
  frameAcc: number;
  hit: number;
  width: number;
  height: number;
};

const COLORS = ["#c4553a", "#d7a15a", "#3d5a4c", "#6e7c99"];
const LINES = [
  "Nobody left the light on.",
  "A coin on the step.",
  "The window is warm.",
  "A key under the mat.",
  "The whole block stayed up.",
];

const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

function percent(bps: number) {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function cueFor(index: number): FriendSoundCue {
  if (index >= 4) return "reveal-legendary";
  if (index === 3) return "reveal-rare";
  return "reveal-common";
}

function bands(height: number) {
  const stoopH = Math.max(28, height * 0.14);
  const curbH = Math.max(36, height * 0.16);
  const laneH = (height - stoopH - curbH) / 4;
  const y = [
    height - curbH * 0.52,
    stoopH + laneH * 3.5,
    stoopH + laneH * 2.5,
    stoopH + laneH * 1.5,
    stoopH + laneH * 0.5,
    stoopH * 0.58,
  ];
  return { stoopH, curbH, laneH, y };
}

function seedCars(width: number): Car[] {
  const cars: Car[] = [];
  for (let lane = 1; lane <= 4; lane++) {
    const dir = lane % 2 === 0 ? 1 : -1;
    const w = width * 0.22;
    for (let i = 0; i < 2; i++) {
      cars.push({
        lane,
        x: i === 0 ? width * 0.02 : width * 0.64,
        w,
        speed: width * (0.16 + lane * 0.025),
        dir,
        color: COLORS[lane - 1],
      });
    }
  }
  return cars;
}

function friendSize(width: number, height: number) {
  const { laneH } = bands(height);
  return Math.max(48, Math.min(width * 0.22, laneH * 0.92, 112));
}

function carHits(car: Car, left: number, right: number, width: number) {
  const start = ((car.x % width) + width) % width;
  const end = start + car.w;
  if (start < right && end > left) return true;
  return end > width && end - width > left;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, color: string) {
  ctx.save();
  ctx.translate(dir < 0 ? x + w : x, 0);
  if (dir < 0) ctx.scale(-1, 1);

  const ground = y + h * 0.9;
  const wheelR = Math.max(5, h * 0.16);
  const bodyTop = y + h * 0.46;
  const bodyBot = ground - wheelR * 0.2;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, w * 0.08, ground - 2, w * 0.84, 5, 2);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, bodyBot);
  ctx.lineTo(w * 0.08, bodyTop + h * 0.06);
  ctx.quadraticCurveTo(w * 0.18, bodyTop, w * 0.3, bodyTop);
  ctx.lineTo(w * 0.72, bodyTop);
  ctx.quadraticCurveTo(w * 0.88, bodyTop, w * 0.97, bodyTop + h * 0.07);
  ctx.lineTo(w * 0.98, bodyBot);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.22, bodyTop);
  ctx.lineTo(w * 0.32, y + h * 0.14);
  ctx.lineTo(w * 0.58, y + h * 0.12);
  ctx.lineTo(w * 0.72, bodyTop);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c5deec";
  ctx.beginPath();
  ctx.moveTo(w * 0.36, y + h * 0.18);
  ctx.lineTo(w * 0.56, y + h * 0.17);
  ctx.lineTo(w * 0.66, bodyTop - 3);
  ctx.lineTo(w * 0.38, bodyTop - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9ec9de";
  ctx.beginPath();
  ctx.moveTo(w * 0.26, bodyTop - 2);
  ctx.lineTo(w * 0.33, y + h * 0.2);
  ctx.lineTo(w * 0.35, bodyTop - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff4cc";
  roundRect(ctx, w * 0.9, bodyTop + (bodyBot - bodyTop) * 0.28, Math.max(4, w * 0.06), Math.max(4, h * 0.08), 1);
  ctx.fillStyle = "#ff2a22";
  roundRect(ctx, w * 0.04, bodyTop + (bodyBot - bodyTop) * 0.25, Math.max(3, w * 0.04), Math.max(4, h * 0.09), 1);

  for (const axle of [w * 0.28, w * 0.75]) {
    ctx.fillStyle = "#121316";
    ctx.beginPath();
    ctx.arc(axle, ground - wheelR, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d5d8de";
    ctx.beginPath();
    ctx.arc(axle, ground - wheelR, wheelR * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSprite(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, size: number) {
  const cell = size / 16;
  const originX = x - size / 2;
  const originY = y - size / 2;
  ctx.fillStyle = "#ffffff";
  rows.forEach((row, py) => {
    [...row].forEach((bit, px) => {
      if (bit === "#") ctx.fillRect(originX + px * cell - cell * 0.28, originY + py * cell - cell * 0.28, cell * 1.56, cell * 1.56);
    });
  });
  ctx.fillStyle = "#1a120c";
  rows.forEach((row, py) => {
    [...row].forEach((bit, px) => {
      if (bit === "#") ctx.fillRect(originX + px * cell, originY + py * cell, cell, cell);
    });
  });
}

/** Get one Rare Friend across a night street. The SDK supplies identity and the action client. */
export default function Home({ friendId, client, paused }: GameComponentProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [artError, setArtError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [ledger, setLedger] = useState({ spent: 0n, redeemed: 0n });
  const [attempt, setAttempt] = useState(0);
  const [lane, setLane] = useState(0);
  const [revealId, setRevealId] = useState<number | null>(null);
  const sound = useRef<FriendSoundKit | null>(null);
  const locked = useRef(false);
  const epoch = useRef(0);
  const openId = useRef<bigint | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    lane: 0, from: 0, to: 0, tween: 1, tweening: false, arrived: false,
    cars: [], seeded: false, frame: 0, frameAcc: 0, hit: 0, width: 1, height: 1,
  });
  const still = reducedMotion || systemReduced;
  const spritesRef = useRef(sprites);
  const stillRef = useRef(still);
  const pausedRef = useRef(paused);
  const overlayRef = useRef(overlay);
  spritesRef.current = sprites;
  stillRef.current = still;
  pausedRef.current = paused;
  overlayRef.current = overlay;
  const definition = client.definition;

  function resetStreet() {
    const street = sim.current;
    street.lane = 0;
    street.from = 0;
    street.to = 0;
    street.tween = 1;
    street.tweening = false;
    street.arrived = false;
    street.seeded = false;
    street.cars = [];
    street.hit = 0;
    openId.current = null;
    setLane(0);
    setRevealId(null);
  }

  useEffect(() => {
    const version = ++epoch.current;
    sound.current?.dispose();
    sound.current = createFriendSoundKit({ muted: true });
    setSnapshot(null);
    setSprites(null);
    setArtError("");
    setError("");
    setMessage("");
    setBusy(false);
    setOverlay(null);
    setLedger({ spent: 0n, redeemed: 0n });
    setMuted(true);
    locked.current = false;
    resetStreet();
    void client.read().then((value) => {
      if (version === epoch.current) setSnapshot(value);
    }).catch((cause: unknown) => {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not load the block.");
    });
    const reader = createFriendReader();
    void reader.read(friendId).then((value) => {
      if (version === epoch.current) setSprites(value);
    }).catch((cause: unknown) => {
      if (version === epoch.current) setArtError(cause instanceof Error ? cause.message : "The Friend’s pixels could not be read.");
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => {
      epoch.current += 1;
      sound.current?.dispose();
      sound.current = null;
      preference.removeEventListener("change", update);
    };
  }, [client, friendId, attempt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const street = sim.current;
      street.width = width;
      street.height = height;
      if (!street.seeded && width > 20) {
        street.cars = seedCars(width);
        street.seeded = true;
      }
      const hold = pausedRef.current || overlayRef.current !== null;
      const calm = stillRef.current;
      if (!hold) {
        const pace = calm ? 0.42 : 1;
        for (const car of street.cars) {
          car.x += car.dir * car.speed * pace * dt;
          car.x = ((car.x % width) + width) % width;
        }
        street.hit = Math.max(0, street.hit - dt);
        if (street.tweening) {
          street.tween += dt / (calm ? 0.01 : 0.18);
          if (street.tween >= 1) {
            street.tween = 1;
            street.tweening = false;
            street.lane = street.to;
            setLane(street.lane);
            if (street.lane === 5 && !street.arrived) {
              street.arrived = true;
              void finishNight();
            }
          }
        }
        street.frameAcc += dt;
        if (street.frameAcc > 0.09) {
          street.frameAcc = 0;
          street.frame = (street.frame + 1) % 8;
        }
      }
      const { stoopH, curbH, laneH, y } = bands(height);
      const shown = street.tweening ? street.from + (street.to - street.from) * Math.min(1, street.tween) : street.lane;
      const yIndex = Math.min(4, Math.floor(shown));
      const yNext = Math.min(5, yIndex + 1);
      const yBlend = shown - yIndex;
      const friendY = y[yIndex] + (y[yNext] - y[yIndex]) * yBlend - (street.tweening && !calm ? Math.sin(street.tween * Math.PI) * 8 : 0);
      const friendSizePx = friendSize(width, height);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#141920";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = street.lane === 5 ? "#8a6230" : "#3a2c22";
      ctx.fillRect(0, 0, width, stoopH);
      ctx.fillStyle = street.lane === 5 ? "#f0c27a" : "#6a5030";
      roundRect(ctx, width * 0.5 - 18, 8, 14, stoopH * 0.55, 2);
      roundRect(ctx, width * 0.5 + 4, 8, 14, stoopH * 0.55, 2);
      ctx.fillStyle = "#1b2028";
      ctx.fillRect(0, stoopH, width, height - stoopH - curbH);
      ctx.strokeStyle = "#2a313b";
      ctx.setLineDash([8, 10]);
      for (let i = 1; i < 4; i++) {
        const line = stoopH + laneH * i;
        ctx.beginPath();
        ctx.moveTo(8, line);
        ctx.lineTo(width - 8, line);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = "#2c261f";
      ctx.fillRect(0, height - curbH, width, curbH);
      const nextLane = street.lane + 1;
      if (nextLane <= 4 && street.seeded) {
        const open = !street.cars.some((car) => car.lane === nextLane && carHits(car, width / 2 - friendSizePx / 2 - 8, width / 2 + friendSizePx / 2 + 8, width));
        ctx.fillStyle = open ? "rgba(240,194,122,0.2)" : "rgba(224,122,98,0.18)";
        ctx.fillRect(width / 2 - friendSizePx / 2 - 6, y[nextLane] - laneH * 0.42, friendSizePx + 12, laneH * 0.84);
      }
      for (const car of street.cars) {
        const carH = Math.max(28, laneH * 0.62);
        const carY = y[car.lane] - carH / 2;
        const paint = (px: number) => drawCar(ctx, px, carY, car.w, carH, car.dir, car.color);
        paint(car.x);
        if (car.x + car.w > width) paint(car.x - width);
      }
      const art = spritesRef.current;
      if (art) {
        const walking = street.tweening;
        const facing = walking ? "up" : "down";
        const rows = spriteFrame(art, facing, walking, street.frame).frame.rows;
        drawSprite(ctx, rows, width / 2, friendY, friendSizePx);
      }
      if (street.hit > 0) {
        ctx.fillStyle = `rgba(224,122,98,${street.hit * 1.4})`;
        ctx.fillRect(0, 0, width, height);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [snapshot]);

  async function act(work: () => Promise<void>) {
    if (locked.current || paused) return false;
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      const value = await client.read();
      if (version === epoch.current) setSnapshot(value);
      return version === epoch.current;
    } catch (cause: unknown) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "The block refused that.");
      return false;
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  async function finishNight() {
    const id = openId.current;
    if (id == null) {
      sim.current.arrived = false;
      return;
    }
    const ok = await act(async () => {
      const settled = await client.settle(id);
      if (settled.outcomeId == null) {
        sim.current.arrived = false;
        sim.current.lane = 4;
        sim.current.from = 4;
        sim.current.to = 4;
        setLane(4);
        setMessage("The stoop is still dark. Step up again.");
        return;
      }
      setRevealId(settled.outcomeId);
      setOverlay("reveal");
      sound.current?.play(cueFor(settled.outcomeId - 1));
    });
    if (!ok) sim.current.arrived = false;
  }

  const simulated = client.mode !== "chain";
  const maxPrize = maximumPrize(definition);
  const pending = snapshot?.plays.find((play) => play.outcomeId === null) ?? null;
  const canBuy = Boolean(
    snapshot &&
      snapshot.rfBalance >= definition.price &&
      snapshot.freeStake >= maxPrize &&
      snapshot.freeStake + definition.price >= maxPrize,
  );
  const buyBlock = !snapshot
    ? ""
    : snapshot.rfBalance < definition.price
      ? `Not enough ${snapshot.mode === "preview" ? "simulated " : ""}RF.`
      : "Redeem a kept find before another night. The block is backing too many unredeemed prizes.";

  async function goOut() {
    void sound.current?.unlock();
    const ok = await act(async () => {
      await client.buy(1n);
      setLedger((current) => ({ ...current, spent: current.spent + definition.price }));
      sound.current?.play("purchase");
      setMessage("Night paid. Step when the gold gap is open.");
    });
    if (ok) setMessage("Night paid. Step when the gold gap is open.");
  }

  async function step() {
    if (locked.current || paused || overlay || sim.current.tweening || sim.current.lane >= 5) return;
    void sound.current?.unlock();
    if (!snapshot) return;
    const owed = pending ?? null;
    if (sim.current.lane === 0 && openId.current == null && !owed && snapshot.consumables === 0n) {
      if (canBuy) await goOut();
      else setMessage(buyBlock);
      return;
    }
    const next = sim.current.lane + 1;
    const size = friendSize(sim.current.width, sim.current.height);
    const left = sim.current.width / 2 - size / 2 - 8;
    const right = sim.current.width / 2 + size / 2 + 8;
    if (next <= 4 && sim.current.cars.some((car) => car.lane === next && carHits(car, left, right, sim.current.width))) {
      sim.current.hit = 0.22;
      sound.current?.play("impact");
      setMessage("Car in the lane. Wait for the gold gap.");
      setError("");
      return;
    }
    if (sim.current.lane === 0 && openId.current == null) {
      const existing = owed?.id ?? null;
      if (existing == null) {
        let opened: bigint | null = null;
        const ok = await act(async () => {
          const [play] = await client.play(1n);
          if (!play) throw new Error("No night was paid for.");
          opened = play.id;
        });
        if (!ok || opened == null) return;
        openId.current = opened;
      } else {
        openId.current = existing;
      }
    }
    const street = sim.current;
    street.from = street.lane;
    street.to = next;
    street.tween = 0;
    street.tweening = true;
    sound.current?.play("impact");
    setMessage(next === 5 ? "Up the steps." : "");
    setError("");
  }

  const onStepRef = useRef(step);
  onStepRef.current = step;
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const onPointer = (event: PointerEvent) => {
      event.preventDefault();
      void onStepRef.current();
    };
    node.addEventListener("pointerdown", onPointer);
    return () => node.removeEventListener("pointerdown", onPointer);
  }, [snapshot, sprites]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      event.preventDefault();
      void onStepRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snapshot) {
    return (
      <section className="home" aria-label={definition.name} role={error ? "alert" : "status"}>
        <p className="home-waiting">{error || "The block is waking…"}</p>
        {error && (
          <button type="button" className="home-go" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
        )}
      </section>
    );
  }

  if (snapshot.friendId !== friendId) {
    return (
      <section className="home" role="alert">
        <p className="home-waiting">This night does not match the selected Friend.</p>
      </section>
    );
  }

  const edition = revealId ? definition.outcomes[revealId - 1] : null;
  const nightReady = Boolean(pending || snapshot.consumables > 0n || openId.current);
  const status = error || message || (busy ? "Waiting…" : "");

  function closeReveal() {
    resetStreet();
    setOverlay(null);
    setMessage("Back on the curb.");
  }

  return (
    <section className="home" aria-label={definition.name} aria-busy={busy}>
      <header className="home-top">
        <div>
          <p className="home-kicker">{simulated ? "Simulated fare" : "Live fare"} · Friend #{friendId.toString()}</p>
          <h1>HOME</h1>
        </div>
        <p className="home-balance">
          <strong>{rf(snapshot.rfBalance)}</strong>
          <span>{snapshot.consumables.toString()} nights · spent {rf(ledger.spent)}</span>
        </p>
      </header>
      <div className="home-street">
        <canvas ref={canvasRef} aria-hidden="true" />
        {!sprites && (
          <p className="home-waiting" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            {artError || "Reading original pixels…"}
          </p>
        )}
      </div>
      <p className="home-hint" style={{ padding: "6px 14px 0" }}>
        {sprites ? `${sprites.familyName} is crossing.` : "Artwork pending."}
        {still ? " Motion is slower, and a gold gap means step." : " Tap the street or the button. Gold means go."}
      </p>
      <p className="home-status" role={error ? "alert" : "status"} data-tone={error ? "alert" : "ok"}>{status}</p>
      <div className="home-tools">
        <button type="button" onClick={() => setOverlay("odds")} disabled={busy || paused}>Odds</button>
        <button type="button" onClick={() => setOverlay("pocket")} disabled={busy || paused}>Pocket</button>
        <button type="button" onClick={() => setOverlay("settings")} disabled={busy || paused}>Settings</button>
      </div>
      <div className="home-dock">
        {nightReady ? (
          <button type="button" className="home-go" disabled={busy || paused || !sprites || Boolean(overlay) || lane >= 5} onClick={() => void step()}>
            {lane >= 5 ? "Home" : "Step"}
          </button>
        ) : (
          <button type="button" className="home-go" disabled={!canBuy || busy || paused || Boolean(overlay)} onClick={() => void goOut()}>
            Go out · {rf(definition.price)}
          </button>
        )}
      </div>
      {overlay && (
        <div className="home-overlay">
          <div className="home-card" role="dialog" aria-modal="true" aria-label={overlay}>
            {overlay === "reveal" && edition && revealId ? (
              <>
                <h2>{edition.name}</h2>
                <p>
                  {LINES[revealId - 1]} {edition.reward === 0n ? "Nothing to redeem." : `${rf(edition.reward)} is on the step.`}{" "}
                  The find is {simulated ? "a simulated draw" : "the on-chain draw"}, not how clean the crossing was.
                </p>
                <div className="home-card-actions">
                  <button type="button" className="home-go" disabled={busy || paused} onClick={closeReveal}>Keep it</button>
                  {edition.reward > 0n && (
                    <button
                      type="button"
                      disabled={busy || paused}
                      onClick={() => void act(async () => {
                        await client.redeem(revealId, 1n);
                        setLedger((current) => ({ ...current, redeemed: current.redeemed + edition.reward }));
                        sound.current?.play("reward");
                        resetStreet();
                        setOverlay(null);
                        setMessage(`Redeemed ${rf(edition.reward)}.`);
                      })}
                    >
                      Redeem · {rf(edition.reward)}
                    </button>
                  )}
                </div>
              </>
            ) : overlay === "odds" ? (
              <>
                <h2>Odds</h2>
                <p>
                  A night costs {rf(definition.price)}. Getting hit sends you back to wait. It does not spend another night.
                  Expected redeem value is {rf(definition.outcomes.reduce((sum, item) => sum + item.reward * BigInt(item.chanceBps), 0n) / 10_000n)}.
                  Keeping a find leaves the fare spent.
                </p>
                <table className="home-table">
                  <thead>
                    <tr><th>On the stoop</th><th>Chance</th><th>Redeem</th></tr>
                  </thead>
                  <tbody>
                    {definition.outcomes.map((item) => (
                      <tr key={item.name}>
                        <td>{item.name}</td>
                        <td>{percent(item.chanceBps)}</td>
                        <td>{item.reward === 0n ? "None" : rf(item.reward)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!canBuy && <p>{buyBlock}</p>}
                <button type="button" className="home-go" onClick={() => setOverlay(null)}>Close</button>
              </>
            ) : overlay === "pocket" ? (
              <>
                <h2>Pocket</h2>
                <p>Kept finds stay with this Friend until you redeem them. A dark stoop has no RF. Nothing expires.</p>
                {definition.outcomes.map((item, index) => (
                  <div className="home-row" key={item.name}>
                    <span>
                      <strong>{item.name}</strong>
                      <br />
                      <span className="home-meta">{snapshot.inventory[index].toString()} kept · {item.reward === 0n ? "no redemption" : rf(item.reward)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy || paused || snapshot.inventory[index] === 0n || item.reward === 0n}
                      onClick={() => void act(async () => {
                        await client.redeem(index + 1, 1n);
                        setLedger((current) => ({ ...current, redeemed: current.redeemed + item.reward }));
                        sound.current?.play("reward");
                        setMessage(`Redeemed one ${item.name}.`);
                      })}
                    >
                      Redeem
                    </button>
                  </div>
                ))}
                <button type="button" className="home-go" onClick={() => setOverlay(null)}>Close</button>
              </>
            ) : (
              <>
                <h2>Settings</h2>
                <div className="home-card-actions" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    aria-pressed={!muted}
                    onClick={() => {
                      const next = !muted;
                      setMuted(next);
                      sound.current?.setMuted(next);
                      if (!next) void sound.current?.unlock();
                    }}
                  >
                    {muted ? "Sound off" : "Sound on"}
                  </button>
                </div>
                <label className="home-check">
                  <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
                  Reduce motion
                </label>
                <p>
                  This sitting spent {rf(ledger.spent)} and redeemed {rf(ledger.redeemed)}.
                  Reloading clears the {simulated ? "simulated " : ""}ledger.
                </p>
                {artError && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry artwork</button>}
                <div className="home-card-actions">
                  <button type="button" className="home-go" onClick={() => setOverlay(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
