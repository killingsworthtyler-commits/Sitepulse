"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { inviteUser, removeUser, setRole, type Role } from "@/lib/auth/users";

export async function inviteUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role: Role = formData.get("role") === "admin" ? "admin" : "member";
  if (!email) return;
  await inviteUser(email, name, role);
  revalidatePath("/account");
}

export async function removeUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  // Don't let an admin remove their own account (would lock them out).
  if (!id || id === admin.sub) return;
  await removeUser(id);
  revalidatePath("/account");
}

export async function setRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role: Role = formData.get("role") === "admin" ? "admin" : "member";
  if (!id || id === admin.sub) return; // don't change own role
  await setRole(id, role);
  revalidatePath("/account");
}
