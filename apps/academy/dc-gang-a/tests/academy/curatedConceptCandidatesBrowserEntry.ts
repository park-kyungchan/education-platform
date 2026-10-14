import { curatedConceptCandidatesView } from "../../src/academy/web/curatedConceptCandidatesView";
import type { CuratedConceptCandidateReply } from "../../src/academy/contracts/curatedConceptCandidates";
const form = document.getElementById("synthetic-login") as HTMLFormElement;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: data.get("username"),
      password: data.get("password"),
    }),
  });
  if (!response.ok) throw Error("synthetic_login_refused");
  form.hidden = true;
  document.getElementById("candidate-mount")!.append(
    curatedConceptCandidatesView(async () => {
      const result = await fetch("/api/curated-concept-candidates", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!result.ok) throw Error("candidate_read_refused");
      return (await result.json()) as CuratedConceptCandidateReply;
    }),
  );
});
