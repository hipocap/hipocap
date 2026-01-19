import { z } from "zod/v4";

// Zod schema for shield validation
export const ShieldSchema = z.object({
  id: z.number(),
  shield_key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  prompt_description: z.string(),
  what_to_block: z.string(),
  what_not_to_block: z.string(),
  owner_id: z.string(), // UUID string from Hipocap
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

// TypeScript types
export type Shield = z.infer<typeof ShieldSchema>;

export const ShieldCreateSchema = z.object({
  shield_key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.string().min(1), // JSON string containing prompt_description, what_to_block, what_not_to_block
});

export type ShieldCreate = z.infer<typeof ShieldCreateSchema>;

export const ShieldUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().optional(), // JSON string
  is_active: z.boolean().optional(),
});

export type ShieldUpdate = z.infer<typeof ShieldUpdateSchema>;

/**
 * List all shields for a project.
 * 
 * @param projectId - Project ID
 * @param baseUrl - Optional base URL for server-side fetching (absolute URL required in server components)
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Array of shields
 */
export async function listShields(
  projectId: string,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Shield[]> {
  const url = baseUrl 
    ? `${baseUrl}/api/projects/${projectId}/shields`
    : `/api/projects/${projectId}/shields`;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  
  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch shields: ${error}`);
  }

  const data = await res.json();
  return z.array(ShieldSchema).parse(data);
}

/**
 * Get a shield by its numeric ID.
 * 
 * @param projectId - Project ID
 * @param shieldId - Shield ID (numeric)
 * @param baseUrl - Optional base URL for server-side fetching
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Shield object
 */
export async function getShieldById(
  projectId: string,
  shieldId: number,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Shield | null> {
  const shields = await listShields(projectId, baseUrl, cookieHeader);
  return shields.find((s) => s.id === shieldId) || null;
}

/**
 * Get a shield by its shield key.
 * 
 * @param projectId - Project ID
 * @param shieldKey - Shield key (string identifier)
 * @param baseUrl - Optional base URL for server-side fetching (absolute URL required in server components)
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Shield object
 */
export async function getShield(
  projectId: string,
  shieldKey: string,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Shield> {
  const url = baseUrl
    ? `${baseUrl}/api/projects/${projectId}/shields/${shieldKey}`
    : `/api/projects/${projectId}/shields/${shieldKey}`;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  
  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch shield: ${error}`);
  }

  const data = await res.json();
  return ShieldSchema.parse(data);
}

/**
 * Create a new shield.
 * 
 * @param projectId - Project ID
 * @param shieldData - Shield creation data
 * @returns Created shield
 */
export async function createShield(projectId: string, shieldData: ShieldCreate): Promise<Shield> {
  const res = await fetch(`/api/projects/${projectId}/shields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(shieldData),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create shield: ${error}`);
  }

  const data = await res.json();
  return ShieldSchema.parse(data);
}

/**
 * Update an existing shield.
 * 
 * @param projectId - Project ID
 * @param shieldKey - Shield key (string)
 * @param shieldData - Shield update data
 * @returns Updated shield
 */
export async function updateShield(
  projectId: string,
  shieldKey: string,
  shieldData: ShieldUpdate
): Promise<Shield> {
  const res = await fetch(`/api/projects/${projectId}/shields/${shieldKey}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(shieldData),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update shield: ${error}`);
  }

  const data = await res.json();
  // The response might be a ShieldUpdateResponse with a nested shield
  if (data.shield) {
    return ShieldSchema.parse(data.shield);
  }
  return ShieldSchema.parse(data);
}

/**
 * Delete a shield.
 * 
 * @param projectId - Project ID
 * @param shieldKey - Shield key or ID (string or number)
 */
export async function deleteShield(projectId: string, shieldKey: string | number): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/shields/${shieldKey}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete shield: ${error}`);
  }
}

