import { useEffect, useMemo } from "react";
import {
  ConfettiLayer,
  Leaderboard,
  createClockSync,
  useConfetti,
  useDeadline,
  useDraft,
  useEventLog,
  useFairRng,
  useFlashOnChange,
  useNamedPeer,
  usePhase,
  useReactions,
  useRotatingTurn,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Toast = { id: string; peerId: string; text: string; ts: number; slotId: number };
const SLOT_MS = 45_000;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="ts-screen">
        <h1>toast stack</h1>
        <p className="ts-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock.destroy(), [clock]);

  useFairRng(room, "ts-salts");
  const phase = usePhase<"lobby" | "toasting" | "done">(room, "phase", "lobby");
  const toasts = useEventLog<Toast>(room, "toasts");
  const reactions = useReactions(room, "ts-reactions");
  const turn = useRotatingTurn(room, clock, { slotMs: SLOT_MS, order: "shuffle" });
  const draft = useDraft<string>(`${config.storagePrefix}:draft`, "");
  const { burst } = useConfetti();

  const stateMap = room.doc.getMap<number>("state");
  const baselineSlot = stateMap.get("baselineSlot") ?? 0;
  const slotOffset = turn.slotId - baselineSlot;
  const deadline = useDeadline(turn.msToNextTurn ? Date.now() + turn.msToNextTurn : null);

  const flash = useFlashOnChange(toasts.size);
  useEffect(() => {
    if (flash) burst({ origin: "top", count: 50, hueRange: [40, 60] });
  }, [flash, burst]);

  const start = () => {
    room.doc.transact(() => {
      stateMap.set("baselineSlot", turn.slotId);
      phase.transition("toasting", { from: "lobby" });
    });
  };

  const currentName = turn.currentPeerId ? (nameOf(turn.currentPeerId) ?? "…") : "…";
  const isMyTurn = turn.isMyTurn && phase.phase === "toasting";
  const alreadyToasted = toasts.events.some(
    (t) => t.peerId === room.peerId && t.slotId === turn.slotId,
  );

  const give = () => {
    const text = draft.value.trim();
    if (!text || !isMyTurn || alreadyToasted) return;
    draft.commit((v) => {
      toasts.push({
        id: Math.random().toString(36).slice(2, 12),
        peerId: room.peerId,
        text: v.trim().slice(0, 200),
        ts: Date.now(),
        slotId: turn.slotId,
      });
    });
  };

  const clinkScore: Record<string, number> = {};
  for (const t of toasts.events) {
    const c = reactions.countsFor(t.id);
    clinkScore[t.peerId] = (clinkScore[t.peerId] ?? 0) + (c.clink ?? 0);
  }
  const board = Object.entries(clinkScore)
    .map(([peerId, score]) => ({
      id: peerId,
      name: nameOf(peerId) ?? `peer-${peerId.slice(0, 4)}`,
      score,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="ts-screen">
      <ConfettiLayer />
      <header className="ts-header">
        <h1>toast stack</h1>
        <p className="ts-status">
          {room.peerCount + 1} peer{room.peerCount === 0 ? "" : "s"} · slot{" "}
          {Math.max(0, slotOffset)}
        </p>
      </header>

      <input
        className="ts-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={24}
        aria-label="your name"
      />

      {phase.phase === "lobby" && (
        <>
          <p className="ts-howto">
            Everyone takes a turn giving a one-line toast (it rotates every 45s). When it's not your
            turn, raise a 🥂 to the toast you like best — 🥂 clinks are what climb the leaderboard.
          </p>
          <button type="button" className="ts-start" aria-label="start the round" onClick={start}>
            start the round
          </button>
        </>
      )}

      {phase.phase !== "lobby" && (
        <>
          <div className={`ts-current ${turn.isMyTurn ? "is-mine" : ""}`}>
            <span className="ts-current-label">toasting:</span>
            <strong>{currentName}</strong>
            <span className="ts-countdown">{deadline.fmt}</span>
          </div>
          {!isMyTurn && (
            <p className="ts-howto">
              Raise a 🥂 to the toasts you love — it's their turn, not yours.
            </p>
          )}
        </>
      )}

      {isMyTurn && (
        <div className="ts-compose">
          <textarea
            placeholder="your toast"
            maxLength={200}
            value={draft.value}
            onChange={(e) => draft.setValue(e.target.value)}
            disabled={alreadyToasted}
          />
          <button
            type="button"
            className="ts-give"
            aria-label="give toast"
            onClick={give}
            disabled={alreadyToasted || !draft.value.trim()}
          >
            give toast
          </button>
        </div>
      )}

      {phase.phase !== "lobby" && toasts.size === 0 && (
        <p className="ts-empty">No toasts yet — they'll stack up here as people raise a glass.</p>
      )}

      <ul className={`ts-feed ${flash ? "is-flash" : ""}`}>
        {toasts.events
          .slice()
          .reverse()
          .map((t) => {
            const c = reactions.countsFor(t.id);
            return (
              <li key={t.id} className="ts-row">
                <div className="ts-text">"{t.text}"</div>
                <div className="ts-byline">— {nameOf(t.peerId) ?? "peer"}</div>
                <div className="ts-react">
                  <button
                    type="button"
                    className="ts-clink"
                    aria-label="react clink"
                    onClick={() => reactions.react(t.id, "clink")}
                  >
                    🥂
                  </button>
                  <span className="ts-tally">{c.clink ?? 0}</span>
                  <button
                    type="button"
                    className="ts-cheers"
                    aria-label="react cheers"
                    onClick={() => reactions.react(t.id, "cheers")}
                  >
                    🍻
                  </button>
                  <span className="ts-tally">{c.cheers ?? 0}</span>
                </div>
              </li>
            );
          })}
      </ul>

      <Leaderboard items={board} highlightId={room.peerId} title={`top toasters · ${myName}`} />
    </div>
  );
}
