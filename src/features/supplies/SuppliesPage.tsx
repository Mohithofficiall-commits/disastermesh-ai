import { useState, type FormEvent } from "react";
import { useMesh } from "@/lib/mesh-context";

export function SuppliesPage() {
  const { activePeer, supplies, createSupplyItem, updateSupplyQuantity, error } = useMesh();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("packs");
  const [locationName, setLocationName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    const qty = Number(quantity);
    if (itemName.trim().length < 2) {
      setFormError("Enter an item name.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      setFormError("Quantity must be a whole number, zero or greater.");
      return;
    }
    if (!unit.trim() || !locationName.trim()) {
      setFormError("Unit and location are required.");
      return;
    }
    setSaving(true);
    try {
      await createSupplyItem({ itemName, quantityAvailable: qty, unit, locationName });
      setItemName("");
      setQuantity("1");
      setLocationName("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save inventory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supplies</h1>
        <p className="mt-1 text-sm text-slate-muted">
          Inventory belongs only to {activePeer?.displayName ?? "the selected peer"}. Other peers do not receive these updates.
        </p>
      </div>
      {(formError || error) && (
        <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-sm">{formError || error}</p>
      )}
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-sand bg-panel p-4 sm:grid-cols-2">
        <label className="text-sm">
          Item name
          <input className="field" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
        </label>
        <label className="text-sm">
          Quantity
          <input className="field" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <label className="text-sm">
          Unit
          <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </label>
        <label className="text-sm">
          Location
          <input className="field" value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
        </label>
        <div className="sm:col-span-2">
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Add to this peer"}</button>
        </div>
      </form>
      {supplies.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-panel px-4 py-8 text-sm text-slate-muted">This peer has no supply items.</p>
      ) : (
        <ul className="space-y-3">
          {supplies.map((item) => (
            <li key={item.itemId} className="rounded-2xl border border-sand bg-panel p-4">
              <h2 className="font-semibold">{item.itemName}</h2>
              <p className="text-sm text-slate-muted">
                {item.quantityAvailable} {item.unit} · {item.location.label} · Updated {new Date(item.updatedAt).toLocaleString()}
              </p>
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = Number(drafts[item.itemId] ?? item.quantityAvailable);
                  if (!Number.isInteger(next) || next < 0) return;
                  void updateSupplyQuantity(item.itemId, next);
                }}
              >
                <label className="text-xs text-slate-muted">
                  New quantity
                  <input
                    className="field"
                    inputMode="numeric"
                    value={drafts[item.itemId] ?? String(item.quantityAvailable)}
                    onChange={(e) => setDrafts((d) => ({ ...d, [item.itemId]: e.target.value }))}
                  />
                </label>
                <button type="submit" className="btn-secondary">Update quantity</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
