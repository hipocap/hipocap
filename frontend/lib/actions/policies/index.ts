import { z } from "zod/v4";

// Zod schema for policy validation
export const PolicySchema = z.object({
  id: z.number(),
  policy_key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_id: z.string(), // UUID string from Hipocap
  roles: z.record(z.string(), z.any()).nullable().optional(),
  functions: z.record(z.string(), z.any()).nullable().optional(),
  severity_rules: z.record(z.string(), z.any()).nullable().optional(),
  output_restrictions: z.record(z.string(), z.any()).nullable().optional(),
  function_chaining: z.record(z.string(), z.any()).nullable().optional(),
  context_rules: z.array(z.any()).nullable().optional(),
  decision_thresholds: z.record(z.string(), z.any()).nullable().optional(),
  custom_prompts: z.record(z.string(), z.string()).nullable().optional(),
  is_active: z.boolean(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

// TypeScript types
export type Policy = z.infer<typeof PolicySchema>;

export const PolicyCreateSchema = z.object({
  policy_key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  roles: z.record(z.string(), z.any()).optional(),
  functions: z.record(z.string(), z.any()).optional(),
  severity_rules: z.record(z.string(), z.any()).optional(),
  output_restrictions: z.record(z.string(), z.any()).optional(),
  function_chaining: z.record(z.string(), z.any()).optional(),
  context_rules: z.array(z.any()).optional(),
  decision_thresholds: z.record(z.string(), z.any()).optional(),
  custom_prompts: z.record(z.string(), z.string()).optional(),
  is_default: z.boolean().optional(),
});

export type PolicyCreate = z.infer<typeof PolicyCreateSchema>;

export const PolicyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  roles: z.record(z.string(), z.any()).optional(),
  functions: z.record(z.string(), z.any()).optional(),
  severity_rules: z.record(z.string(), z.any()).optional(),
  output_restrictions: z.record(z.string(), z.any()).optional(),
  function_chaining: z.record(z.string(), z.any()).optional(),
  context_rules: z.array(z.any()).optional(),
  decision_thresholds: z.record(z.string(), z.any()).optional(),
  custom_prompts: z.record(z.string(), z.string()).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export type PolicyUpdate = z.infer<typeof PolicyUpdateSchema>;

/**
 * List all policies for a project.
 * 
 * @param projectId - Project ID
 * @param baseUrl - Optional base URL for server-side fetching (absolute URL required in server components)
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Array of policies
 */
export async function listPolicies(
  projectId: string,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Policy[]> {
  const url = baseUrl 
    ? `${baseUrl}/api/projects/${projectId}/policies`
    : `/api/projects/${projectId}/policies`;
  
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
    throw new Error(`Failed to fetch policies: ${error}`);
  }

  const data = await res.json();
  return z.array(PolicySchema).parse(data);
}

/**
 * Get a policy by its numeric ID.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param baseUrl - Optional base URL for server-side fetching
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Policy object
 */
export async function getPolicyById(
  projectId: string,
  policyId: number,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Policy | null> {
  const policies = await listPolicies(projectId, baseUrl, cookieHeader);
  return policies.find((p) => p.id === policyId) || null;
}

/**
 * Get a policy by its policy key.
 * 
 * @param projectId - Project ID
 * @param policyKey - Policy key (string identifier)
 * @param baseUrl - Optional base URL for server-side fetching (absolute URL required in server components)
 * @param cookieHeader - Optional cookie header for server-side authentication
 * @returns Policy object
 */
export async function getPolicy(
  projectId: string,
  policyKey: string,
  baseUrl?: string,
  cookieHeader?: string
): Promise<Policy> {
  const url = baseUrl
    ? `${baseUrl}/api/projects/${projectId}/policies/${policyKey}`
    : `/api/projects/${projectId}/policies/${policyKey}`;
  
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
    throw new Error(`Failed to fetch policy: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Create a new policy.
 * 
 * @param projectId - Project ID
 * @param policyData - Policy creation data
 * @returns Created policy
 */
export async function createPolicy(projectId: string, policyData: PolicyCreate): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(policyData),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create policy: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Update an existing policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param policyData - Policy update data
 * @returns Updated policy
 */
export async function updatePolicy(
  projectId: string,
  policyId: number,
  policyData: PolicyUpdate
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(policyData),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update policy: ${error}`);
  }

  const data = await res.json();
  // The response might be a PolicyUpdateResponse with a nested policy
  if (data.policy) {
    return PolicySchema.parse(data.policy);
  }
  return PolicySchema.parse(data);
}

/**
 * Delete a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 */
export async function deletePolicy(projectId: string, policyId: number): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete policy: ${error}`);
  }
}

/**
 * Delete a role from a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param roleName - Name of the role to delete
 * @returns Updated policy
 */
export async function deleteRole(
  projectId: string,
  policyId: number,
  roleName: string
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}/roles/${roleName}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete role: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Delete a function from a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param functionName - Name of the function to delete
 * @returns Updated policy
 */
export async function deleteFunction(
  projectId: string,
  policyId: number,
  functionName: string
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}/functions/${functionName}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete function: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Delete a severity rule from a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param severityLevel - Severity level to delete (safe, low, medium, high, critical)
 * @returns Updated policy
 */
export async function deleteSeverityRule(
  projectId: string,
  policyId: number,
  severityLevel: string
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}/severity-rules/${severityLevel}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete severity rule: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Delete a function chaining rule from a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param sourceFunction - Source function name
 * @returns Updated policy
 */
export async function deleteFunctionChaining(
  projectId: string,
  policyId: number,
  sourceFunction: string
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}/function-chaining/${sourceFunction}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete function chaining rule: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}

/**
 * Delete a context rule from a policy.
 * 
 * @param projectId - Project ID
 * @param policyId - Policy ID (numeric)
 * @param ruleIndex - Index of the context rule to delete
 * @returns Updated policy
 */
export async function deleteContextRule(
  projectId: string,
  policyId: number,
  ruleIndex: number
): Promise<Policy> {
  const res = await fetch(`/api/projects/${projectId}/policies/${policyId}/context-rules/${ruleIndex}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete context rule: ${error}`);
  }

  const data = await res.json();
  return PolicySchema.parse(data);
}
