"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { SupabaseClient } from "@supabase/supabase-js";
// import { supabase } from '@/utils/supabase/client';

interface Shipment {
  id: string;
  shipment_number: string;
  status?: string;
  eta?: string;
  company_id?: string; // <-- Add company_id to Shipment type
}

interface Inquiry {
  id: string;
  subject: string;
  from_email: string;
  received_at: string;
  shipment_id?: string | null;
  status?: string; // add status for compatibility with inbox
}

export default function ShipmentsManager({
  shipments,
  setShipments,
  inquiries,
  setInquiries,
  supabase,
  companyId, // <-- Add companyId prop
}: {
  shipments: Shipment[];
  setShipments: (s: Shipment[]) => void;
  inquiries: Inquiry[];
  setInquiries: (inq: Inquiry[]) => void;
  supabase: SupabaseClient;
  companyId: string; // <-- Add companyId type
}) {
  const [creating, setCreating] = useState(false);
  const [newShipmentNumber, setNewShipmentNumber] = useState("");
  const [newStatus, setNewStatus] = useState("new");
  const [newEta, setNewEta] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editShipmentNumber, setEditShipmentNumber] = useState("");
  const [editStatus, setEditStatus] = useState<string>("new");
  const [editEta, setEditEta] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Create shipment
  const handleCreate = async () => {
    if (!newShipmentNumber.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("shipments").insert([
      {
        shipment_number: newShipmentNumber.trim(),
        status: newStatus.trim() || "new",
        eta: newEta ? new Date(newEta).toISOString() : null,
        company_id: companyId, // <-- Add company_id
      },
    ]).select();
    setCreating(false);
    if (!error && data && data.length > 0) {
      setShipments([data[0], ...shipments]);
      setNewShipmentNumber("");
      setNewStatus("new");
      setNewEta("");
    } else {
      alert("Failed to create shipment: " + (error?.message || "Unknown error"));
    }
  };

  // Delete shipment
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("shipments").delete().eq("id", id);
    if (!error) {
      setShipments(shipments.filter(s => s.id !== id));
      // Unlink from inquiries
      const updated = inquiries.map(i => i.shipment_id === id ? { ...i, shipment_id: null } : i);
      setInquiries(updated);
    } else {
      alert("Failed to delete shipment: " + error.message);
    }
    setDeletingId(null);
  };

  // Edit shipment
  const openEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditShipmentNumber(shipment.shipment_number);
    setEditStatus(shipment.status || "new");
    setEditEta(shipment.eta ? new Date(shipment.eta).toISOString().slice(0, 16) : "");
  };

  const handleEditSave = async () => {
    if (!editingShipment) return;
    setSavingEdit(true);
    const { data, error } = await supabase.from("shipments").update({
      shipment_number: editShipmentNumber.trim(),
      status: editStatus,
      eta: editEta ? new Date(editEta).toISOString() : null,
    }).eq("id", editingShipment.id).select();
    if (!error && data && data.length > 0) {
      setShipments(shipments.map(s => s.id === editingShipment.id ? { ...s, ...data[0] } : s));
      // Update all associated inquiries' status
      const { data: updatedInquiries, error: inqError } = await supabase.from("inquiries").update({ status: editStatus }).eq("shipment_id", editingShipment.id).select();
      if (!inqError && updatedInquiries) {
        setInquiries(inquiries.map(i => i.shipment_id === editingShipment.id ? { ...i, status: editStatus } : i));
      }
      setEditingShipment(null);
    } else {
      alert("Failed to update shipment: " + (error?.message || "Unknown error"));
    }
    setSavingEdit(false);
  };

  // Group inquiries by shipment (filter by companyId)
  const shipmentGroups = shipments
    .filter(shipment => shipment.company_id === companyId) // <-- Only show shipments for this company
    .map(shipment => ({
      shipment,
      inquiries: inquiries.filter(i => i.shipment_id === shipment.id),
    }));

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Shipments</CardTitle>
        <CardDescription>View, create, and delete shipments. Link inquiries to shipments in the inbox.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Create New Shipment</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="border rounded px-2 py-1 min-w-[180px]"
              placeholder="Shipment Number"
              value={newShipmentNumber}
              onChange={e => setNewShipmentNumber(e.target.value)}
              disabled={creating}
            />
            <select
              className="border rounded px-2 py-1 min-w-[120px]"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              disabled={creating}
            >
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <input
              className="border rounded px-2 py-1 min-w-[180px]"
              type="datetime-local"
              placeholder="ETA (optional)"
              value={newEta}
              onChange={e => setNewEta(e.target.value)}
              disabled={creating}
            />
            <Button onClick={handleCreate} disabled={creating || !newShipmentNumber.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        <h3 className="font-semibold mb-2">All Shipments & Inquiries</h3>
        <ul className="divide-y">
          {shipmentGroups.map(({ shipment, inquiries }) => (
            <li key={shipment.id} className="p-4 border rounded mb-2 bg-gray-50">
              <div className="flex items-center gap-4 mb-2">
                <span className="font-mono font-bold text-blue-700">{shipment.shipment_number}</span>
                {shipment.status && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ml-2 ${
                    shipment.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                    shipment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    shipment.status === 'resolved' ? 'bg-green-100 text-green-700 border-green-300' :
                    'bg-gray-100 text-gray-700 border-gray-300'
                  }`}>
                    {shipment.status === 'new' ? 'New' : shipment.status === 'in_progress' ? 'In Progress' : shipment.status === 'resolved' ? 'Resolved' : shipment.status}
                  </span>
                )}
                {shipment.eta && <span className="text-xs text-gray-500">ETA: {new Date(shipment.eta).toLocaleString()}</span>}
                <Link href={`/inbox/shipment?id=${shipment.id}`}>
                  <Button variant="secondary" className="ml-2">View All Inquiries</Button>
                </Link>
                <Button variant="outline" onClick={() => openEdit(shipment)} className="ml-2">Edit</Button>
                <AlertDialog open={deletingId === shipment.id} onOpenChange={open => !open && setDeletingId(null)}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"  className="bg-red-600 hover:bg-red-700 text-white border-none" onClick={() => setDeletingId(shipment.id)}>
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white rounded shadow-2xl border border-gray-200">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Shipment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this shipment? All linked inquiries will be unassigned.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(shipment.id)} autoFocus>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div>
                <span className="font-semibold text-xs">Inquiries:</span>
                {inquiries.length === 0 ? (
                  <span className="ml-2 text-xs text-gray-400">No inquiries linked</span>
                ) : (
                  <ul className="ml-4 list-disc">
                    {inquiries.map(i => (
                      <li key={i.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{i.subject}</span>
                        <span className="text-xs text-gray-400">({i.from_email})</span>
                        <span className="text-xs text-gray-400">{new Date(i.received_at).toLocaleString()}</span>
                        {i.status && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            i.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                            i.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                            i.status === 'resolved' ? 'bg-green-100 text-green-700 border-green-300' :
                            'bg-gray-100 text-gray-700 border-gray-300'
                          }`}>
                            {i.status === 'new' ? 'New' : i.status === 'in_progress' ? 'In Progress' : i.status === 'resolved' ? 'Resolved' : i.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      {/* Edit Shipment Modal */}
      {editingShipment && (
        <AlertDialog open={!!editingShipment} onOpenChange={open => !open && setEditingShipment(null)}>
          <AlertDialogContent className="bg-white rounded shadow-2xl border border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Shipment</AlertDialogTitle>
              <AlertDialogDescription>
                Update shipment details. Changing status will update all associated inquiries&#39; status.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-xs font-semibold">Shipment Number
                <input className="border rounded px-2 py-1 w-full" value={editShipmentNumber} onChange={e => setEditShipmentNumber(e.target.value)} />
              </label>
              <label className="text-xs font-semibold">Status
                <select className="border rounded px-2 py-1 w-full" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <label className="text-xs font-semibold">ETA
                <input className="border rounded px-2 py-1 w-full" type="datetime-local" value={editEta} onChange={e => setEditEta(e.target.value)} />
              </label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditingShipment(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEditSave} disabled={savingEdit}>{savingEdit ? "Saving..." : "Save"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}
