import { useEffect, useState } from "react";
import { jobSnapshot, subscribeJobs, controlJob } from "./jobs";
export function JobManager() {
  const [jobs, setJobs] = useState(jobSnapshot);
  useEffect(() => subscribeJobs(() => setJobs(jobSnapshot())), []);
  return (
    <section className="panel workflow-settings" aria-label="Job manager">
      <h2>Jobs</h2>
      <p>
        Pause takes effect between positions or download chunks. Priority
        reorders queued jobs in this tab; it does not interrupt active work.
        Keep this tab open.
      </p>
      {!jobs.length && <p>No jobs this session.</p>}
      {jobs.map((j) => (
        <article className="job-row" key={j.id}>
          <strong>{j.label}</strong>
          <p>
            {j.state} - {j.detail}
          </p>
          {j.controls &&
            !["completed", "cancelled", "failed"].includes(j.state) && (
              <div>
                <button
                  onClick={() =>
                    controlJob(j.id, j.state === "paused" ? "resume" : "pause")
                  }
                >
                  {j.state === "paused" ? "Resume" : "Pause"}
                </button>{" "}
                <button onClick={() => controlJob(j.id, "cancel")}>
                  Cancel
                </button>{" "}
                <button
                  aria-pressed={j.priority === 1}
                  onClick={() => controlJob(j.id, "priority")}
                >
                  High priority
                </button>
              </div>
            )}
        </article>
      ))}
    </section>
  );
}
