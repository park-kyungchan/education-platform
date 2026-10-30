- One VPS host runs the repository's agents and services. Operators and their coding agents run as root and are trusted
  operators, not adversaries; the CI threat model above covers outsiders and accidents.
- The academy runtime owner is one Hermes container (uid 10000) holding academy credentials and the owner artifacts;
  MCP upstreams run inside it through `docker exec`, each launch serialized by a host `flock` on the native academy
  account lock. Bridges run on the host as root. There is no multi-host or multi-container writer deployment.
- The academy web source offers no server-side conditional write. Writers outside the participating MCP processes
  (for example the academy web UI) can race; code must fail closed and never replay uncertain effects, but cannot
  remove that race.
- Owner paths under `/opt/data/profiles/dc-gang-a-dev/artifacts` are administered by the owner; a finding that needs
  an operator to misconfigure them (symlinks, ownership) is at most medium.
