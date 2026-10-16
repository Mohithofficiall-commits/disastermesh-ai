import { useState, type FormEvent } from "react";
import { useMesh } from "@/lib/mesh-context";
import type { Incident, IncidentSeverity, IncidentStatus, IncidentType } from "@/types/models";

const TYPES: { id: IncidentType; label: string }[] = [
  { id: "flood", label: "Flood" },
  { id: "fire", label: "Fire" },
  { id: "medical", label: "Medical Emergency" },
  { id: "earthquake", label: "Earthquake" },
  { id: "blocked_route", label: "Road Blockage" },
  { id: "other", label: "Other" },
];

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: IncidentStatus[] = ["open", "monitoring", "resolved"];

function severityClass(severity: IncidentSeverity): string {
  if (severity === "critical") return "bg-coral/15 text-coral-dark";
  if (severity === "high") return "bg-amber/25 text-slate-forest";
  return "bg-mint-pale text-teal-deep";
}

export function IncidentsPage() {
  const { activePeer, incidents, createIncident, updateIncidentStatus, error } = useMesh();
  const [title, setTitle] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("flood");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    if (title.trim().length < 3) {
      setFormError("Enter a title of at least 3 characters.");
      return;
    }
    if (!locationName.trim()) {
      setFormError("Enter a location name.");
      return;
    }
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (lat.trim() || lng.trim()) {
      latitude = Number(lat);
      longitude = Number(lng);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        setFormError("Latitude must be a number from -90 to 90.");
        return;
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setFormError("Longitude must be a number from -180 to 180.");
        return;
      }
    }
    setSaving(true);
    try {
      await createIncident({
        title,
        incidentType,
        severity,
        description,
        locationName,
        latitude,
        longitude,
        reportedBy,
      });
      setTitle("");
      setDescription("");
      setLocationName("");
      setLat("");
      setLng("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the incident.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="mt-1 text-sm text-slate-muted">
          Records stay on {activePeer?.displayName ?? "the selected peer"}. They are not sent to other peers. Every report stays Unverified.
        </p>
      </div>
      {(formError || error) && (
        <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-sm">
          {formError || error}
        </p>
      )}
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-sand bg-panel p-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Title
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
        </label>
        <label className="text-sm">
          Type
          <select className="field" value={incidentType} onChange={(e) => setIncidentType(e.target.value as IncidentType)}>
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Severity
          <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Description
          <textarea className="field min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="text-sm">
          Location name
          <input className="field" value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
        </label>
        <label className="text-sm">
          Reporter label
          <input className="field" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} placeholder="Field team label" />
        </label>
        <label className="text-sm">
          Latitude (optional)
          <input className="field" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label className="text-sm">
          Longitude (optional)
          <input className="field" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save incident locally"}
          </button>
        </div>
      </form>

      {incidents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-panel px-4 py-8 text-sm text-slate-muted">
          This peer has no incidents.
        </p>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li key={incident.incidentId} className="rounded-2xl border border-sand bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" className="text-left" onClick={() => setSelected(incident)}>
                  <h2 className="font-semibold">{incident.title}</h2>
                  <p className="text-sm text-slate-muted">{incident.location.label}</p>
                </button>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityClass(incident.severity)}`}>
                  {incident.severity}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-muted">
                {new Date(incident.createdAt).toLocaleString()} · Source {incident.sourcePeerId} · Unverified · {incident.status}
              </p>
              <label className="mt-3 block text-xs text-slate-muted">
                Status
                <select
                  className="field"
                  value={incident.status}
                  onChange={(e) => void updateIncidentStatus(incident.incidentId, e.target.value as IncidentStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <dialog open className="w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-sand bg-panel p-5 text-slate-forest">
          <h2 className="text-lg font-semibold">{selected.title}</h2>
          <p className="mt-2 text-sm">{selected.description || "No description."}</p>
          <dl className="mt-3 space-y-1 text-sm text-slate-muted">
            <div>Type: {TYPES.find((t) => t.id === selected.incidentType)?.label}</div>
            <div>Severity: {selected.severity}</div>
            <div>Location: {selected.location.label}</div>
            <div>
              Coordinates:{" "}
              {selected.location.latitude !== undefined
                ? `${selected.location.latitude}, ${selected.location.longitude}`
                : "not provided"}
            </div>
            <div>Reporter label: {selected.reportedBy}</div>
            <div>Source peer: {selected.sourcePeerId}</div>
            <div>Created: {new Date(selected.createdAt).toLocaleString()}</div>
            <div>Verification: unverified</div>
          </dl>
          <button type="button" className="btn-secondary mt-4" onClick={() => setSelected(null)}>
            Close
          </button>
        </dialog>
      )}
    </div>
  );
}
