import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-toast-stack",
  description: "Rotating peer gives a one-line toast; others react 🥂/🍻; cumulative leaderboard.",
  accentHex: "#ffd11a",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
