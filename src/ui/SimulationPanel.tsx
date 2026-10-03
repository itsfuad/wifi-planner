import {
  Activity,
  AlertTriangle,
  Gauge,
  RadioTower,
  TimerReset,
} from "lucide-react";
import type { SimulationResponse } from "../sim/worker";

interface Props {
  result: SimulationResponse | null;
  isSimulating: boolean;
  isStale: boolean;
  error: string | null;
  onRun: () => void;
}

export const SimulationPanel = ({
  result,
  isSimulating,
  isStale,
  error,
  onRun,
}: Props) => {
  if (error) {
    return (
      <section className="simulation-card simulation-card-empty">
        <div className="simulation-card-icon">
          <AlertTriangle size={19} />
        </div>
        <div>
          <strong>Analysis failed</strong>
          <p>{error}</p>
          <button className="text-button" onClick={onRun}>
            Try again
          </button>
        </div>
      </section>
    );
  }
  if (!result) {
    return (
      <section className="simulation-card simulation-card-empty">
        <div className="simulation-card-icon">
          <RadioTower size={19} />
        </div>
        <div>
          <strong>
            {isSimulating ? "Analyzing coverage…" : "Coverage ready"}
          </strong>
          <p>Add an access point to generate a live RF coverage model.</p>
        </div>
      </section>
    );
  }

  const stats = result.stats;
  return (
    <section className="simulation-card">
      <div className="simulation-card-heading">
        <div>
          <span className="eyebrow">Coverage health</span>
          <strong>{stats.coveragePercent.toFixed(0)}%</strong>
        </div>
        <span
          className={`simulation-state ${isSimulating ? "running" : ""} ${isStale ? "stale" : ""}`}
        >
          <span />
          {isSimulating ? "Updating" : isStale ? "Needs update" : "Live"}
        </span>
      </div>
      <div className="coverage-bar">
        <span
          className="coverage-excellent"
          style={{ width: `${stats.excellentPercent}%` }}
        />
        <span
          className="coverage-good"
          style={{ width: `${stats.goodPercent}%` }}
        />
        <span
          className="coverage-fair"
          style={{ width: `${stats.fairPercent}%` }}
        />
        <span
          className="coverage-poor"
          style={{ width: `${stats.poorPercent}%` }}
        />
        <span
          className="coverage-dead"
          style={{ width: `${stats.deadPercent}%` }}
        />
      </div>
      <div className="simulation-metrics">
        <div>
          <Activity size={15} />
          <span>Median signal</span>
          <strong>{Math.round(stats.medianRSSI)} dBm</strong>
        </div>
        <div>
          <Gauge size={15} />
          <span>Usable link</span>
          <strong>~{stats.medianUsableThroughputMbps} Mbps</strong>
        </div>
        <div>
          <RadioTower size={15} />
          <span>Usable coverage</span>
          <strong>{stats.usableCoveragePercent.toFixed(0)}%</strong>
        </div>
        <div>
          <TimerReset size={15} />
          <span>Compute</span>
          <strong>{stats.durationMs.toFixed(0)} ms</strong>
        </div>
      </div>
      {stats.meshIssueCount ? (
        <p className="simulation-warning">
          <AlertTriangle size={12} />
          {stats.meshIssueCount} mesh node
          {stats.meshIssueCount === 1 ? "" : "s"} lack a usable uplink.
        </p>
      ) : null}
      {stats.meshCapacityLimitedCount ? (
        <p className="simulation-warning mesh-capacity-warning">
          <Gauge size={12} />
          {stats.meshCapacityLimitedCount} mesh node
          {stats.meshCapacityLimitedCount === 1 ? "" : "s"} share backhaul
          capacity
          {stats.maxMeshHops > 1 ? ` across ${stats.maxMeshHops} hops` : ""}.
        </p>
      ) : null}
      {isStale ? (
        <button className="reanalyze-button" onClick={onRun}>
          Reanalyze current plan
        </button>
      ) : null}
      <p className="simulation-note">
        Coverage is radio strength. Usable coverage excludes mesh nodes without
        a working uplink.
      </p>
    </section>
  );
};
